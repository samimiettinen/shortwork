import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { parsePublishPayload, platformVariant, summarizeStatuses, validateForPlatform, type PublishPayload } from '../_shared/publishing-contract.ts';
import { workspaceMediaPath } from '../_shared/media.ts';
import { prepareMedia, deliver, saveResult, rollup, type Account, type AccountResult } from '../_shared/publish-service.ts';

Deno.serve(async (req) => {
  const headers = { ...getCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const { data: { user }, error: authError } = await client.auth.getUser(auth.slice(7));
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  let payload: PublishPayload;
  try {
    payload = parsePublishPayload(await req.json());
    payload.mediaPath = workspaceMediaPath(payload.workspaceId, Deno.env.get('SUPABASE_URL')!, payload.mediaPath, payload.mediaUrl);
    payload.mediaUrl = undefined;
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid request' }, 400);
  }
  const { data: membership, error: memberError } = await client.from('workspace_members')
    .select('role').eq('workspace_id', payload.workspaceId).eq('user_id', user.id).maybeSingle();
  if (memberError || !membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
    return json({ error: 'Publishing permission required in this workspace' }, 403);
  }

  try {
    const { data, error } = await client.from('social_accounts')
      .select('id, workspace_id, platform, platform_user_id, status, oauth_tokens(access_token, refresh_token, expires_at)')
      .eq('workspace_id', payload.workspaceId).eq('status', 'connected').in('id', payload.targetAccountIds);
    if (error) throw error;
    const accounts = data as unknown as Account[];
    if (accounts.length !== payload.targetAccountIds.length) {
      return json({ error: 'Every selected channel must be connected to this workspace' }, 400);
    }
    const errors = accounts.flatMap(a => validateForPlatform(a.platform, { ...platformVariant(payload, a.platform), hasMedia: !!payload.mediaPath }));
    if (errors.length) return json({ error: [...new Set(errors)].join('. ') }, 400);

    // Replays return stored outcomes before touching storage or provider APIs.
    const existing = await client.from('posts').select('id').eq('workspace_id', payload.workspaceId)
      .eq('created_by', user.id).eq('client_request_id', payload.requestId).maybeSingle();
    if (existing.error) throw existing.error;
    let postId = existing.data?.id as string | undefined;
    let created = false;
    let media: Awaited<ReturnType<typeof prepareMedia>> | undefined;
    if (!postId) {
      try { media = await prepareMedia(client, payload); }
      catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid media' }, 400); }
      const { data: creation, error: createError } = await client.rpc('create_publish_request', {
        p_actor: user.id, p_workspace: payload.workspaceId, p_request: payload.requestId,
        p_content: payload.content, p_accounts: payload.targetAccountIds, p_link: payload.linkUrl || null,
        p_media: { media_path: media.path, media_type: payload.mediaType, media_meta: payload.mediaMeta,
          youtube_visibility: payload.youtubeVisibility, vertical_short: payload.verticalShort, video_title: payload.videoTitle,
          platform_overrides: payload.platformOverrides, youtube_made_for_kids: payload.youtubeMadeForKids, instagram_share_to_feed: payload.instagramShareToFeed }, p_scheduled_at: payload.scheduledAt || null,
      });
      if (createError || !creation?.post_id) throw createError || new Error('Could not create publish request');
      postId = creation.post_id;
      created = creation.created;
    }
    if (created && !payload.scheduledAt) {
      // Every completed target is saved independently, even if another provider fails.
      await Promise.all(accounts.map(async account => {
        const result = await deliver(client, account, payload, media!);
        await saveResult(client, postId!, result);
      }));
      await rollup(client, postId!);
    }
    const { data: post, error: postError } = await client.from('posts')
      .select('status, post_targets(social_account_id, platform, status, remote_post_id, remote_post_url, last_error_message)')
      .eq('id', postId).single();
    if (postError) throw postError;
    const results: AccountResult[] = post.post_targets.map(t => ({
      accountId: t.social_account_id, platform: t.platform, success: t.status === 'published',
      postId: t.remote_post_id || undefined, postUrl: t.remote_post_url || undefined,
      error: t.last_error_message || undefined, needsUserAction: t.status === 'needs_user_action',
    }));
    const status = post.status === 'scheduled' ? 'scheduled' : summarizeStatuses(post.post_targets.map(t => t.status));
    return json({ postId, status, results, replayed: !created, summary: {
      total: results.length, succeeded: results.filter(r => r.success).length,
      needsAction: results.filter(r => r.needsUserAction).length,
      failed: post.post_targets.filter(t => t.status === 'failed').length,
    } });
  } catch (error) {
    console.error('Publishing request failed', error instanceof Error ? error.message : 'Database error');
    return json({ error: 'Could not complete this request. Open Queue to check saved outcomes before retrying.' }, 500);
  }
});
