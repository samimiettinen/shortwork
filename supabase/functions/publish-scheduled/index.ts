// Cron-driven processor for scheduled publishes. Called every minute by
// pg_cron via net.http_post with the service-role key in the Authorization
// header (see the accompanying cron setup — verify_jwt is off so we can
// enforce this ourselves).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  publishToProvider,
  fetchMediaBlob,
  PublishOptions,
  MediaMeta,
  decryptToken,
} from "../_shared/publishers.ts";

const BATCH_SIZE = 25;
const NEEDS_MEDIA_BYTES = new Set(['youtube', 'tiktok', 'x', 'linkedin', 'bluesky']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  // Load the shared scheduler token from public.app_config (seeded by
  // migration; readable only by service_role). Accept either that token or
  // the raw service-role key for manual invocation.
  const { data: cfg } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'scheduler_token')
    .maybeSingle();
  const schedulerToken = cfg?.value || '';
  const auth = req.headers.get('Authorization') || '';
  if (auth !== `Bearer ${serviceKey}` && (!schedulerToken || auth !== `Bearer ${schedulerToken}`)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const now = new Date().toISOString();
  const processed: any[] = [];

  try {
    // Claim due jobs (queued or retry_scheduled with run_at/next_retry_at <= now).
    // Mark as 'processing' first with an updated_at bump so parallel runs skip them.
    const { data: dueJobs } = await supabase
      .from('publish_jobs')
      .select('id, post_target_id, attempts, max_attempts, status, run_at, next_retry_at')
      .in('status', ['queued', 'retry_scheduled'])
      .or(`and(status.eq.queued,run_at.lte.${now}),and(status.eq.retry_scheduled,next_retry_at.lte.${now})`)
      .limit(BATCH_SIZE);

    if (!dueJobs?.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const job of dueJobs) {
      // Best-effort claim: only proceed if we successfully flip to 'processing'
      const { data: claimed } = await supabase
        .from('publish_jobs')
        .update({ status: 'processing', attempts: job.attempts + 1, updated_at: new Date().toISOString() })
        .eq('id', job.id)
        .in('status', ['queued', 'retry_scheduled'])
        .select('id')
        .maybeSingle();
      if (!claimed) continue;

      const result = await runJob(supabase, job);
      processed.push({ jobId: job.id, ...result });
    }

    return new Response(JSON.stringify({ processed: processed.length, results: processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('publish-scheduled fatal:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function runJob(supabase: any, job: any) {
  // Load the post_target with its post and account+token
  const { data: target, error: targetErr } = await supabase
    .from('post_targets')
    .select(`
      id, post_id, social_account_id, platform,
      posts!inner (
        id, workspace_id, body_text, link_url, per_channel_overrides, status
      ),
      social_accounts!inner (
        id, platform_user_id, status,
        oauth_tokens ( access_token, refresh_token, expires_at )
      )
    `)
    .eq('id', job.post_target_id)
    .maybeSingle();

  if (targetErr || !target) {
    await failJob(supabase, job, 'Target not found', true);
    return { ok: false, error: 'target not found' };
  }

  const token = target.social_accounts?.oauth_tokens?.[0];
  if (!token?.access_token) {
    await failJob(supabase, job, 'No access token', true);
    await supabase.from('post_targets').update({
      status: 'needs_user_action',
      last_error_message: 'No access token; reconnect the channel.',
      last_attempt_at: new Date().toISOString(),
    }).eq('id', target.id);
    await rollupPostStatus(supabase, target.post_id);
    return { ok: false, error: 'no token' };
  }

  const overrides = (target.posts.per_channel_overrides || {}) as any;
  let mediaUrl: string | undefined = overrides.media_url;
  const mediaType: 'image' | 'video' | undefined = overrides.media_type;
  const mediaMeta: MediaMeta | undefined = overrides.media_meta;

  // Re-sign internal storage URLs (the social-media bucket is private).
  if (mediaUrl) {
    const signed = await signInternalMediaUrl(supabase, mediaUrl);
    if (signed) mediaUrl = signed;
  }

  let mediaBlob: Blob | null = null;
  if (mediaUrl && NEEDS_MEDIA_BYTES.has(target.platform)) {
    try { mediaBlob = await fetchMediaBlob(mediaUrl); } catch (e) { console.error('media prefetch', e); }
  }

  const opts: PublishOptions = {
    accountId: target.social_accounts.platform_user_id,
    socialAccountId: target.social_accounts.id,
    accessToken: await decryptToken(token.access_token),
    refreshToken: token.refresh_token ? await decryptToken(token.refresh_token) : undefined,
    tokenExpiresAt: token.expires_at,
    content: target.posts.body_text || '',
    linkUrl: target.posts.link_url || undefined,
    mediaUrl,
    mediaType,
    mediaMeta,
    mediaBlob,
  };

  await supabase.from('post_targets').update({
    status: 'publishing',
    last_attempt_at: new Date().toISOString(),
    publish_attempts: (target.publish_attempts || 0) + 1,
  }).eq('id', target.id);

  let result;
  try {
    result = await publishToProvider(target.platform, opts, supabase);
  } catch (err) {
    result = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (result.success) {
    await supabase.from('post_targets').update({
      status: 'published',
      remote_post_id: result.postId,
      published_at: new Date().toISOString(),
      last_error_message: null,
    }).eq('id', target.id);
    await supabase.from('publish_jobs').update({
      status: 'done',
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);
  } else {
    const attempts = job.attempts + 1;
    const terminal = attempts >= job.max_attempts || result.needsReconnect;
    if (terminal) {
      await supabase.from('post_targets').update({
        status: result.needsReconnect ? 'needs_user_action' : 'failed',
        last_error_message: result.error?.slice(0, 500),
      }).eq('id', target.id);
      await supabase.from('publish_jobs').update({
        status: 'failed',
        last_error: { message: result.error, needsReconnect: !!result.needsReconnect },
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
    } else {
      const backoffMin = Math.pow(2, attempts);
      const nextRetry = new Date(Date.now() + backoffMin * 60 * 1000).toISOString();
      await supabase.from('post_targets').update({
        status: 'queued',
        last_error_message: result.error?.slice(0, 500),
      }).eq('id', target.id);
      await supabase.from('publish_jobs').update({
        status: 'retry_scheduled',
        next_retry_at: nextRetry,
        last_error: { message: result.error },
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
    }
  }

  await rollupPostStatus(supabase, target.post_id);
  return { ok: result.success, platform: target.platform };
}

async function failJob(supabase: any, job: any, message: string, terminal: boolean) {
  await supabase.from('publish_jobs').update({
    status: terminal ? 'failed' : 'retry_scheduled',
    last_error: { message },
    updated_at: new Date().toISOString(),
  }).eq('id', job.id);
}

async function rollupPostStatus(supabase: any, postId: string) {
  const { data: targets } = await supabase
    .from('post_targets')
    .select('status')
    .eq('post_id', postId);
  if (!targets?.length) return;
  const terminal = new Set(['published', 'failed', 'skipped', 'needs_user_action']);
  const allDone = targets.every((t: any) => terminal.has(t.status));
  if (!allDone) return;
  const anySuccess = targets.some((t: any) => t.status === 'published');
  await supabase
    .from('posts')
    .update({ status: anySuccess ? 'published' : 'failed', updated_at: new Date().toISOString() })
    .eq('id', postId);
}
