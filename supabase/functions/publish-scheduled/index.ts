// One atomically claimed target per invocation keeps video processing within
// edge runtime limits. See docs/PLATFORM_SETUP.md for the required cron setup.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { prepareMedia, deliver, saveResult, rollup, type Account, type AccountResult } from '../_shared/publish-service.ts';
import { platformVariant, validateMediaMeta, validateForPlatform, type PublishPayload } from '../_shared/publishing-contract.ts';

Deno.serve(async (req) => {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, key);
  const { data: config, error: configError } = await client.from('app_config').select('value').eq('key', 'scheduler_token').maybeSingle();
  if (configError) return json({ error: 'Scheduler configuration unavailable' }, 500);
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${key}` && (!config?.value || auth !== `Bearer ${config.value}`)) return json({ error: 'Unauthorized' }, 401);

  try {
    // A killed invocation is ambiguous. Never replay it automatically: a remote
    // publish may already have succeeded. Preserve evidence for manual review.
    const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: stale, error: staleError } = await client.from('post_targets')
      .update({ status: 'needs_user_action', last_error_message: 'Delivery was interrupted. Check the platform before retrying.' })
      .eq('status', 'publishing').lt('updated_at', staleBefore).select('id, post_id');
    if (staleError) throw staleError;
    for (const target of stale || []) {
      const { error } = await client.from('publish_jobs').update({ status: 'failed' })
        .eq('post_target_id', target.id).eq('status', 'processing');
      if (error) throw error;
      await rollup(client, target.post_id);
    }
    // Also recover a worker killed after saving its target but before saving
    // the job/aggregate state. Completed targets are never sent again.
    const { data: interrupted, error: interruptedError } = await client.from('publish_jobs')
      .select('id, post_targets!inner(post_id, status)').eq('status', 'processing').lt('updated_at', staleBefore);
    if (interruptedError) throw interruptedError;
    for (const job of interrupted || []) {
      const target = Array.isArray(job.post_targets) ? job.post_targets[0] : job.post_targets;
      const { error } = await client.from('publish_jobs').update({ status: target.status === 'published' ? 'done' : 'failed' }).eq('id', job.id);
      if (error) throw error;
      await rollup(client, target.post_id);
    }
    const { data: jobs, error: claimError } = await client.rpc('claim_publish_job');
    if (claimError) throw claimError;
    const job = jobs?.[0];
    if (!job) return json({ processed: 0 });
    const { data: target, error } = await client.from('post_targets')
      .select('id, post_id, social_account_id, platform, status, posts!inner(id, workspace_id, created_by, client_request_id, body_text, link_url, per_channel_overrides, status), social_accounts!inner(id, workspace_id, platform, platform_user_id, status, oauth_tokens(access_token, refresh_token, expires_at))')
      .eq('id', job.post_target_id).single();
    if (error) throw error;
    const post = Array.isArray(target.posts) ? target.posts[0] : target.posts;
    const account = (Array.isArray(target.social_accounts) ? target.social_accounts[0] : target.social_accounts) as unknown as Account;
    let result: AccountResult;
    try {
      if (post.status === 'canceled' || target.status !== 'publishing') throw new Error('This post is no longer queued for publishing');
      const { data: member, error: memberError } = await client.from('workspace_members').select('role')
        .eq('workspace_id', post.workspace_id).eq('user_id', post.created_by).maybeSingle();
      if (memberError || !member || !['owner', 'admin', 'editor'].includes(member.role)) throw new Error('The author no longer has publishing permission');
      const saved = post.per_channel_overrides || {};
      const payload: PublishPayload = {
        workspaceId: post.workspace_id, requestId: post.client_request_id || crypto.randomUUID(),
        content: post.body_text || '', targetAccountIds: [account.id], linkUrl: post.link_url || undefined,
        mediaPath: saved.media_path, mediaUrl: saved.media_url, mediaType: saved.media_type,
        mediaMeta: validateMediaMeta(saved.media_meta), youtubeVisibility: saved.youtube_visibility || 'private',
        verticalShort: saved.vertical_short === true, videoTitle: saved.video_title, platformOverrides: saved.platform_overrides,
        youtubeMadeForKids: saved.youtube_made_for_kids === true, instagramShareToFeed: saved.instagram_share_to_feed !== false,
      };
      const validation = validateForPlatform(account.platform, { ...platformVariant(payload, account.platform), hasMedia: !!(payload.mediaPath || payload.mediaUrl) });
      if (validation.length) throw new Error(validation.join('. '));
      const media = await prepareMedia(client, payload);
      result = await deliver(client, account, payload, media);
    } catch (error) {
      result = { accountId: target.social_account_id, platform: target.platform, success: false,
        needsUserAction: true, error: error instanceof Error ? error.message : 'Could not prepare this delivery' };
    }
    await saveResult(client, target.post_id, result);
    const { error: saveError } = await client.from('publish_jobs').update({
      status: result.success || (result.needsUserAction && result.postId) ? 'done' : 'failed',
      last_error: result.error ? { message: result.error } : null,
    }).eq('id', job.id);
    if (saveError) throw saveError;
    await rollup(client, target.post_id);
    return json({ processed: 1, result });
  } catch (error) {
    console.error('Scheduler failed', error instanceof Error ? error.message : 'Database error');
    return json({ error: 'Scheduler failed; interrupted deliveries require review' }, 500);
  }
});
