-- Executed after the original schema and the new publishing migrations.
INSERT INTO workspaces(id, name) VALUES
 ('11111111-1111-4111-8111-111111111111', 'First'), ('99999999-9999-4999-8999-999999999999', 'Other');
INSERT INTO workspace_members(workspace_id, user_id, role) VALUES
 ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'editor'),
 ('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', 'viewer');
INSERT INTO social_accounts(id, workspace_id, platform, display_name) VALUES
 ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'facebook', 'Page'),
 ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'x', 'X'),
 ('55555555-5555-4555-8555-555555555555', '99999999-9999-4999-8999-999999999999', 'x', 'Other X');
DO $$
DECLARE result jsonb; repeated jsonb; v_post uuid; v_job public.publish_jobs; initial_count integer;
BEGIN
  SELECT count(*) INTO initial_count FROM posts;
  BEGIN
    PERFORM create_publish_request('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',gen_random_uuid(),'Caption',
      ARRAY['33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555']::uuid[],null,'{}',now());
    RAISE EXCEPTION 'cross-workspace request accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Every selected channel must be connected to this workspace' THEN RAISE; END IF;
  END;
  ASSERT (SELECT count(*) FROM posts) = initial_count, 'invalid request left an orphan post';
  BEGIN
    PERFORM create_publish_request('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111',gen_random_uuid(),'Caption',
      ARRAY['33333333-3333-4333-8333-333333333333']::uuid[],null,'{}',now());
    RAISE EXCEPTION 'viewer was allowed to publish';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Publishing permission required' THEN RAISE; END IF;
  END;
  result := create_publish_request('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666','Caption',
    ARRAY['33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444']::uuid[],null,'{}',now() - interval '1 minute');
  v_post := (result->>'post_id')::uuid;
  ASSERT (result->>'created')::boolean, 'first request not created';
  repeated := create_publish_request('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666','Caption',
    ARRAY['33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444']::uuid[],null,'{}',now());
  ASSERT NOT (repeated->>'created')::boolean, 'request replay created duplicates';
  ASSERT repeated->>'post_id' = result->>'post_id';
  ASSERT (SELECT count(*) FROM posts) = initial_count + 1;
  ASSERT (SELECT count(*) FROM post_targets WHERE post_id = v_post) = 2;
  ASSERT (SELECT count(*) FROM publish_jobs) = 2;
  SELECT * INTO v_job FROM claim_publish_job();
  ASSERT v_job.status = 'processing';
  ASSERT (SELECT status FROM post_targets WHERE id = v_job.post_target_id) = 'publishing';
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  BEGIN
    PERFORM cancel_publish_request(v_post);
    RAISE EXCEPTION 'claimed post was canceled';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Publishing has already started; this post cannot be canceled' THEN RAISE; END IF;
  END;
  UPDATE post_targets SET status = 'published' WHERE id = v_job.post_target_id;
  UPDATE post_targets SET status = 'failed' WHERE post_id = v_post AND id <> v_job.post_target_id;
  PERFORM rollup_publish_status(v_post);
  ASSERT (SELECT status FROM posts WHERE id = v_post) = 'partial';
  result := create_publish_request('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',gen_random_uuid(),'Cancel me',
    ARRAY['33333333-3333-4333-8333-333333333333']::uuid[],null,'{}',now() + interval '1 hour');
  v_post := (result->>'post_id')::uuid;
  PERFORM cancel_publish_request(v_post);
  ASSERT (SELECT status FROM posts WHERE id = v_post) = 'canceled';
  ASSERT NOT EXISTS(SELECT 1 FROM publish_jobs j JOIN post_targets t ON t.id=j.post_target_id WHERE t.post_id=v_post);
  result := create_publish_request('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',gen_random_uuid(),'Variants',
    ARRAY['33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444']::uuid[],null,
    '{"platform_overrides":{"x":{"content":"Short X caption","scheduledAt":"2099-10-30T14:00:00Z"}}}', '2099-10-30T13:00:00Z');
  v_post := (result->>'post_id')::uuid;
  ASSERT (SELECT j.run_at FROM publish_jobs j JOIN post_targets t ON t.id=j.post_target_id WHERE t.post_id=v_post AND t.platform='x') = '2099-10-30T14:00:00Z'::timestamptz;
  ASSERT (SELECT j.run_at FROM publish_jobs j JOIN post_targets t ON t.id=j.post_target_id WHERE t.post_id=v_post AND t.platform='facebook') = '2099-10-30T13:00:00Z'::timestamptz;
  ASSERT NOT has_function_privilege('authenticated', 'create_publish_request(uuid,uuid,uuid,text,uuid[],text,jsonb,timestamptz)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'claim_publish_job()', 'EXECUTE');
  ASSERT has_function_privilege('authenticated', 'cancel_publish_request(uuid)', 'EXECUTE');
END;
$$;
SELECT 'Atomic publishing assertions passed' AS result;
GRANT SELECT, UPDATE ON public.posts, public.post_targets TO authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SET ROLE authenticated;
DO $$ DECLARE affected integer; BEGIN
  ASSERT (SELECT count(*) FROM public.posts) = 3, 'workspace history not readable';
  UPDATE public.post_targets SET status = 'queued';
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'browser could mutate delivery outcomes';
END $$;
RESET ROLE;
