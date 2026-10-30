-- Only the authenticated publishing endpoint can create delivery work.
-- The post, targets and scheduled jobs either all exist or none do.
CREATE OR REPLACE FUNCTION public.create_publish_request(
  p_actor uuid, p_workspace uuid, p_request uuid, p_content text,
  p_accounts uuid[], p_link text, p_media jsonb, p_scheduled_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_post uuid;
  v_account public.social_accounts;
  v_target uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members
      WHERE workspace_id = p_workspace AND user_id = p_actor AND role IN ('owner', 'admin', 'editor')) THEN
    RAISE EXCEPTION 'Publishing permission required';
  END IF;
  IF p_request IS NULL OR length(btrim(p_content)) NOT BETWEEN 1 AND 10000
     OR coalesce(cardinality(p_accounts), 0) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Invalid publishing request';
  END IF;
  IF (SELECT count(DISTINCT id) FROM public.social_accounts
      WHERE id = ANY(p_accounts) AND workspace_id = p_workspace AND status = 'connected') <> cardinality(p_accounts) THEN
    RAISE EXCEPTION 'Every selected channel must be connected to this workspace';
  END IF;
  INSERT INTO public.posts(workspace_id, created_by, client_request_id, status,
    title, body_text, link_url, per_channel_overrides, scheduled_at)
  VALUES(p_workspace, p_actor, p_request,
    CASE WHEN p_scheduled_at IS NULL THEN 'publishing'::post_status ELSE 'scheduled'::post_status END,
    coalesce(nullif(p_media->>'video_title', ''), left(split_part(p_content, E'\n', 1), 120)), p_content, p_link, p_media, p_scheduled_at)
  ON CONFLICT (workspace_id, created_by, client_request_id) DO NOTHING
  RETURNING id INTO v_post;
  IF v_post IS NULL THEN
    SELECT id INTO v_post FROM public.posts WHERE workspace_id = p_workspace
      AND created_by = p_actor AND client_request_id = p_request;
    RETURN jsonb_build_object('post_id', v_post, 'created', false);
  END IF;
  FOR v_account IN SELECT * FROM public.social_accounts WHERE id = ANY(p_accounts) LOOP
    INSERT INTO public.post_targets(post_id, social_account_id, platform, status)
    VALUES(v_post, v_account.id, v_account.platform,
      CASE WHEN p_scheduled_at IS NULL THEN 'publishing'::post_target_status ELSE 'queued'::post_target_status END)
    RETURNING id INTO v_target;
    IF p_scheduled_at IS NOT NULL THEN
      INSERT INTO public.publish_jobs(post_target_id, run_at, idempotency_key, max_attempts)
      VALUES(v_target, coalesce((p_media->'platform_overrides'->v_account.platform::text->>'scheduledAt')::timestamptz, p_scheduled_at), v_post::text || ':' || v_target::text, 1);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('post_id', v_post, 'created', true);
END;
$$;
REVOKE ALL ON FUNCTION public.create_publish_request(uuid, uuid, uuid, text, uuid[], text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_publish_request(uuid, uuid, uuid, text, uuid[], text, jsonb, timestamptz) TO service_role;

-- Cancel only before a worker claims a target. Lock targets in the same order
-- as the worker's claim transaction, and never overwrite a completed delivery.
CREATE OR REPLACE FUNCTION public.cancel_publish_request(p_post uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_workspace uuid;
BEGIN
  SELECT workspace_id INTO v_workspace FROM public.posts WHERE id = p_post FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = v_workspace
      AND user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')) THEN
    RAISE EXCEPTION 'Publishing permission required';
  END IF;
  PERFORM id FROM public.publish_jobs WHERE post_target_id IN
    (SELECT id FROM public.post_targets WHERE post_id = p_post) ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.post_targets WHERE post_id = p_post AND status <> 'queued') THEN
    RAISE EXCEPTION 'Publishing has already started; this post cannot be canceled';
  END IF;
  DELETE FROM public.publish_jobs WHERE post_target_id IN
    (SELECT id FROM public.post_targets WHERE post_id = p_post) AND status IN ('queued', 'retry_scheduled');
  UPDATE public.post_targets SET status = 'skipped' WHERE post_id = p_post;
  UPDATE public.posts SET status = 'canceled' WHERE id = p_post AND status = 'scheduled';
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_publish_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_publish_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_publish_job() RETURNS SETOF public.publish_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_job public.publish_jobs;
BEGIN
  SELECT * INTO v_job FROM public.publish_jobs
  WHERE (status = 'queued' AND run_at <= now())
     OR (status = 'retry_scheduled' AND next_retry_at <= now())
  ORDER BY run_at, id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF v_job.id IS NULL THEN RETURN; END IF;
  UPDATE public.publish_jobs SET status = 'processing', attempts = attempts + 1 WHERE id = v_job.id
    RETURNING * INTO v_job;
  UPDATE public.post_targets SET status = 'publishing', last_attempt_at = now(),
    publish_attempts = publish_attempts + 1 WHERE id = v_job.post_target_id AND status = 'queued';
  RETURN NEXT v_job;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_publish_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_publish_job() TO service_role;

-- Serialize rollups so simultaneous workers cannot overwrite a newer outcome.
CREATE OR REPLACE FUNCTION public.rollup_publish_status(p_post uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_status public.post_status;
BEGIN
  PERFORM id FROM public.posts WHERE id = p_post FOR UPDATE;
  SELECT CASE
    WHEN bool_or(status IN ('queued', 'publishing')) THEN 'publishing'
    WHEN bool_and(status = 'skipped') THEN 'canceled'
    WHEN bool_and(status = 'published') THEN 'published'
    WHEN bool_or(status = 'published') THEN 'partial'
    WHEN bool_or(status = 'needs_user_action') THEN 'needs_user_action'
    ELSE 'failed' END::public.post_status INTO v_status
  FROM public.post_targets WHERE post_id = p_post;
  UPDATE public.posts SET status = v_status WHERE id = p_post;
END;
$$;
REVOKE ALL ON FUNCTION public.rollup_publish_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_publish_status(uuid) TO service_role;

-- Browser writes cannot manufacture jobs, mutate outcomes or point a target
-- at an account in another workspace. Existing SELECT policies are retained.
DROP POLICY IF EXISTS "Members can manage post targets" ON public.post_targets;

UPDATE public.social_accounts SET autopublish_capable = false WHERE platform = 'tiktok';

-- These helpers only describe the caller's own membership. RLS evaluates them
-- as authenticated; revoking EXECUTE broke channel and Queue reads.
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, public.app_role) TO authenticated;
