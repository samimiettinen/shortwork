import { equal, ok, match } from 'node:assert/strict';
import { deliver } from './publish-service.ts';
import { publishToProvider, type PublishOptions } from './publishers.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const client = {} as SupabaseClient;
const options: PublishOptions = { accountId: 'creator', socialAccountId: 'local-account', accessToken: 'test-token',
  tokenExpiresAt: '2099-01-01T00:00:00Z', content: 'A short video', mediaUrl: 'https://example.supabase.co/video.mp4',
  mediaType: 'video', mediaMeta: { width: 1080, height: 1920, durationSeconds: 15 }, mediaBlob: new Blob(['fake-video'], { type: 'video/mp4' }) };
const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
type Step = [string, Response | ((init?: RequestInit) => Response)];
async function mocked(steps: Step[], run: () => Promise<void>, tick = 1000) {
  const original = { fetch: globalThis.fetch, timeout: globalThis.setTimeout, now: Date.now };
  let time = Date.parse('2026-10-30T00:00:00Z');
  globalThis.fetch = async (input, init) => {
    const step = steps.shift(); ok(step, `Unexpected request ${input}`);
    ok(String(input).includes(step[0]), `Expected ${step[0]}, got ${input}`);
    return typeof step[1] === 'function' ? step[1](init) : step[1];
  };
  globalThis.setTimeout = ((fn: Parameters<typeof setTimeout>[0], _ms?: number, ...args: unknown[]) => original.timeout(fn, 0, ...args)) as typeof setTimeout;
  Date.now = () => { time += tick; return time; };
  try { await run(); equal(steps.length, 0, 'All expected requests must be consumed'); }
  finally { globalThis.fetch = original.fetch; globalThis.setTimeout = original.timeout; Date.now = original.now; }
}
Deno.test('YouTube respects the selected visibility and returns a video link', async () => {
  await mocked([
    ['uploadType=resumable', init => { equal(JSON.parse(String(init?.body)).status.privacyStatus, 'unlisted'); equal(JSON.parse(String(init?.body)).status.selfDeclaredMadeForKids, true); equal(JSON.parse(String(init?.body)).snippet.title, 'Custom Shorts title'); return new Response(null, { headers: { location: 'https://upload.example/youtube' } }); }],
    ['upload.example/youtube', json({ id: 'yt-video' })],
  ], async () => { const result = await publishToProvider('youtube', { ...options, youtubeVisibility: 'unlisted', youtubeMadeForKids: true, videoTitle: 'Custom Shorts title' }, client); equal(result.success, true); match(result.postUrl!, /yt-video/); });
});
Deno.test('TikTok uses inbox upload and never reports a public post', async () => {
  await mocked([
    ['/inbox/video/init/', init => { const body = JSON.parse(String(init?.body)); equal(body.post_info, undefined); equal(body.source_info.video_size, 10); return json({ data: { publish_id: 'inbox-id', upload_url: 'https://upload.example/tiktok' }, error: { code: 'ok' } }); }],
    ['upload.example/tiktok', new Response(null, { status: 201 })],
  ], async () => { const result = await publishToProvider('tiktok', options, client); equal(result.success, false); equal(result.needsUserAction, true); equal(result.postId, 'inbox-id'); match(result.error!, /inbox/); });
});
Deno.test('Instagram waits for processing and publishes a Reel', async () => {
  await mocked([
    ['/creator/media', init => { equal(JSON.parse(String(init?.body)).share_to_feed, 'false'); return json({ id: 'container' }); }], ['/container?fields=status', json({ status_code: 'FINISHED' })],
    ['/creator/media_publish', json({ id: 'ig-post' })], ['/ig-post?fields=permalink', json({ permalink: 'https://instagram.com/reel/ig-post' })],
  ], async () => equal((await publishToProvider('instagram', { ...options, instagramShareToFeed: false }, client)).success, true));
});
Deno.test('Facebook confirms Reel publication after ingestion', async () => {
  await mocked([
    ['/creator/video_reels', json({ video_id: 'fb-video', upload_url: 'https://upload.example/facebook' })],
    ['upload.example/facebook', json({ success: true })], ['/fb-video?fields=status', json({ status: { uploading_phase: { status: 'complete' } } })],
    ['upload_phase=finish', json({ success: true })], ['/fb-video?fields=status', json({ status: { publishing_phase: { status: 'complete' } } })],
  ], async () => equal((await publishToProvider('facebook', options, client)).success, true));
});
Deno.test('LinkedIn uses supported version and waits for AVAILABLE before posting', async () => {
  await mocked([
    ['/rest/videos?action=initializeUpload', init => { equal(new Headers(init?.headers).get('LinkedIn-Version'), '202610'); return json({ value: { video: 'urn:li:video:1', uploadToken: 'upload-token', uploadInstructions: [{ firstByte: 0, lastByte: 9, uploadUrl: 'https://upload.example/linkedin' }] } }); }],
    ['upload.example/linkedin', new Response(null, { headers: { etag: 'part-1' } })], ['/rest/videos?action=finalizeUpload', json({})],
    ['/rest/videos/urn%3Ali%3Avideo%3A1', json({ status: 'AVAILABLE' })], ['/rest/posts', new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:1' } })],
  ], async () => equal((await publishToProvider('linkedin', options, client)).success, true));
});
Deno.test('X initializes, appends, finalizes then creates a post', async () => {
  await mocked([
    ['/media/upload/initialize', json({ data: { id: 'x-media' } })], ['/media/upload/x-media/append', json({})],
    ['/media/upload/x-media/finalize', json({ data: { processing_info: { state: 'succeeded' } } })], ['/2/tweets', json({ data: { id: 'x-post' } })],
  ], async () => equal((await publishToProvider('x', options, client)).success, true));
});
Deno.test('X processing failures never create a post', async () => {
  await mocked([
    ['/media/upload/initialize', json({ data: { id: 'x-media' } })], ['/media/upload/x-media/append', json({})],
    ['/media/upload/x-media/finalize', json({ data: { processing_info: { state: 'failed', error: { message: 'Bad codec' } } } })],
  ], async () => { const result = await publishToProvider('x', options, client); equal(result.success, false); equal(result.error, 'Bad codec'); });
});
Deno.test('Threads requires an explicit FINISHED status', async () => {
  await mocked([['/creator/threads', json({ id: 'thread-container' })], ['/thread-container?fields=status', json({ error: 'unavailable' }, 500)]],
    async () => equal((await publishToProvider('threads', options, client)).success, false));
  await mocked([
    ['/creator/threads', json({ id: 'thread-container' })], ['/thread-container?fields=status', json({ status: 'FINISHED' })],
    ['/creator/threads_publish', json({ id: 'thread-post' })], ['/thread-post?fields=permalink', json({ permalink: 'https://threads.net/post/1' })],
  ], async () => equal((await publishToProvider('threads', options, client)).success, true));
});
Deno.test('Bluesky embeds the video service blob in a native post', async () => {
  await mocked([
    ['getServiceAuth?', json({ token: 'service-token' })], ['app.bsky.video.uploadVideo?', json({ jobStatus: { state: 'JOB_STATE_COMPLETED', blob: { ref: { $link: 'video-cid' } } } })],
    ['com.atproto.repo.createRecord', init => { equal(JSON.parse(String(init?.body)).record.embed.$type, 'app.bsky.embed.video'); return json({ uri: 'at://did:plc:creator/app.bsky.feed.post/1' }); }],
  ], async () => equal((await publishToProvider('bluesky', options, client)).success, true));
});
Deno.test('invalid video payloads stop before token or provider requests', async () => {
  await mocked([], async () => equal((await publishToProvider('youtube', { ...options, mediaType: 'image' }, client)).success, false));
});
Deno.test('Facebook ingestion timeout is action-needed and never calls finish', async () => {
  await mocked([
    ['/creator/video_reels', json({ video_id: 'fb-video', upload_url: 'https://upload.example/facebook' })],
    ['upload.example/facebook', json({ success: true })], ['/fb-video?fields=status', json({ status: { uploading_phase: { status: 'in_progress' } } })],
  ], async () => { const result = await publishToProvider('facebook', options, client); equal(result.success, false); equal(result.needsUserAction, true); equal(result.postId, 'fb-video'); }, 30000);
});
Deno.test('LinkedIn processing timeout never creates a post', async () => {
  await mocked([
    ['/rest/videos?action=initializeUpload', json({ value: { video: 'urn:li:video:1', uploadToken: '', uploadInstructions: [{ firstByte: 0, lastByte: 9, uploadUrl: 'https://upload.example/linkedin' }] } })],
    ['upload.example/linkedin', new Response(null, { headers: { etag: 'part' } })], ['/rest/videos?action=finalizeUpload', json({})],
    ['/rest/videos/urn%3Ali%3Avideo%3A1', json({ status: 'PROCESSING' })],
  ], async () => { const result = await publishToProvider('linkedin', options, client); equal(result.success, false); match(result.error!, /timed out/); }, 30000);
});
Deno.test('X processing timeout never creates a post', async () => {
  await mocked([
    ['/media/upload/initialize', json({ data: { id: 'x-media' } })], ['/media/upload/x-media/append', json({})],
    ['/media/upload/x-media/finalize', json({ data: { processing_info: { state: 'pending' } } })],
    ['command=STATUS', json({ data: { processing_info: { state: 'pending' } } })],
  ], async () => { const result = await publishToProvider('x', options, client); equal(result.success, false); match(result.error!, /timed out/); }, 30000);
});

Deno.test('delivery resolves saved platform copy and title with either token relation shape', async () => {
  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const token = { access_token: 'test-token', refresh_token: null, expires_at: '2099-01-01T00:00:00Z' };
  for (const oauth_tokens of [token, [token]]) {
    await mocked([
      ['uploadType=resumable', init => {
        const body = JSON.parse(String(init?.body)); equal(body.snippet.description, 'Saved YouTube variant'); equal(body.snippet.title, 'Saved title');
        return new Response(null, { headers: { location: 'https://upload.example/youtube' } });
      }], ['upload.example/youtube', json({ id: 'yt-video' })],
    ], async () => {
      const result = await deliver(client, { id: 'local', workspace_id: workspaceId, platform: 'youtube', platform_user_id: 'creator', status: 'connected', oauth_tokens },
        { workspaceId, requestId: '33333333-3333-4333-8333-333333333333', targetAccountIds: ['local'], content: 'Master caption',
          mediaType: 'video', mediaMeta: options.mediaMeta, youtubeVisibility: 'private',
          platformOverrides: { youtube: { content: 'Saved YouTube variant', title: 'Saved title' } } }, { url: options.mediaUrl, blob: options.mediaBlob! });
      equal(result.success, true);
    });
  }
});
