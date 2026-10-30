import { deepStrictEqual, equal, throws, match, ok } from 'node:assert/strict';
import { parsePublishPayload, platformVariant, validateForPlatform, validateMediaMeta, summarizeStatuses, targetStatus, MAX_MEDIA_BYTES } from './publishing-contract.ts';
import { workspaceMediaPath, fetchMediaBlob } from './media.ts';

const workspace = '11111111-1111-4111-8111-111111111111';
const account = '22222222-2222-4222-8222-222222222222';
const request = '33333333-3333-4333-8333-333333333333';
const payload = { workspaceId: workspace, requestId: request, targetAccountIds: [account, account], content: ' A short video ' };
Deno.test('request validates types, deduplicates targets and defaults YouTube to private', () => {
  const result = parsePublishPayload(payload);
  equal(result.content, 'A short video'); equal(result.youtubeVisibility, 'private');
  deepStrictEqual(result.targetAccountIds, [account]);
  for (const override of [{ linkUrl: 12 }, { linkUrl: 'javascript:alert(1)' }, { mediaUrl: [] }, { targetAccountIds: [] }, { requestId: 'bad' }, { content: '' }, { youtubeVisibility: 'everyone' }]) {
    throws(() => parsePublishPayload({ ...payload, ...override }));
  }
});
Deno.test('schedule must be valid and in the future', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  for (const scheduledAt of ['invalid', '2026-10-30T11:59:00Z', '2026-10-30T12:00:10Z']) {
    throws(() => parsePublishPayload({ ...payload, scheduledAt }, now));
  }
  equal(parsePublishPayload({ ...payload, scheduledAt: '2026-10-30T15:05:00+02:00' }, now).scheduledAt, '2026-10-30T13:05:00.000Z');
});
Deno.test('all entry points share media, length and video checks', () => {
  for (const platform of ['youtube', 'tiktok']) {
    match(validateForPlatform(platform, { content: 'Caption', hasMedia: true, mediaType: 'image' }).join(''), /upload a video/);
  }
  equal(validateForPlatform('x', { content: 'x'.repeat(281), hasMedia: false }).length, 1);
  equal(validateForPlatform('instagram', { content: 'Caption', hasMedia: false }).length, 1);
  equal(validateForPlatform('unknown', { content: 'Caption', hasMedia: false }).length, 1);
  equal(validateForPlatform('youtube', { content: 'Caption', hasMedia: true, mediaType: 'video' }).length, 1);
  equal(validateForPlatform('x', { content: 'Caption', hasMedia: true, mediaType: 'video', mediaMeta: { width: 1080, height: 1920, durationSeconds: 141 } }).length, 1);
  equal(validateForPlatform('youtube', { content: 'Caption', hasMedia: true, mediaType: 'video', mediaMeta: { width: 1080, height: 1920, durationSeconds: 181 } }).length, 1);
  for (const meta of [{ width: Infinity }, { durationSeconds: NaN }, { height: -1 }, { sizeBytes: MAX_MEDIA_BYTES + 1 }, { mimeType: 'text/html' }]) throws(() => validateMediaMeta(meta));
});
Deno.test('workspace storage never signs another workspace or an arbitrary URL', () => {
  const path = `${workspace}/clip.mp4`;
  const host = 'https://example.supabase.co';
  equal(workspaceMediaPath(workspace, host, path), path);
  equal(workspaceMediaPath(workspace, host, undefined, `${host}/storage/v1/object/sign/social-media/${path}?token=expired`), path);
  for (const bad of [`${account}/clip.mp4`, `${workspace}/../clip.mp4`, `${workspace}/%2e%2e/file`, `${workspace}/file?secret=x`, `${workspace}/file\u0000`]) {
    throws(() => workspaceMediaPath(workspace, host, bad));
  }
  throws(() => workspaceMediaPath(workspace, host, undefined, 'https://evil.example/clip.mp4'));
  throws(() => workspaceMediaPath(workspace, host, undefined, `${host}/storage/v1/object/sign/another-bucket/${path}`));
});
Deno.test('partial success and handoffs never become a fully published post', () => {
  equal(summarizeStatuses(['published', 'failed']), 'partial');
  equal(summarizeStatuses(['published', 'needs_user_action']), 'partial');
  equal(summarizeStatuses(['needs_user_action']), 'needs_user_action');
  equal(summarizeStatuses(['queued', 'published']), 'publishing');
  equal(summarizeStatuses(['published', 'published']), 'published');
  equal(targetStatus({ success: false, needsUserAction: true, postId: 'upload-id' }), 'needs_user_action');
});
Deno.test('media reader checks HTTP, type, empty files and size without redirects', async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [new Response('no', { status: 404 }), new Response('html', { headers: { 'content-type': 'text/html' } }), new Response('', { headers: { 'content-type': 'video/mp4' } }), new Response('tiny', { headers: { 'content-type': 'video/mp4', 'content-length': String(MAX_MEDIA_BYTES + 1) } })]) {
      globalThis.fetch = async (_url, init) => { equal(init?.redirect, 'error'); return response; };
      await fetchMediaBlob('https://example.supabase.co/file').then(() => { throw new Error('Expected rejection'); }, () => undefined);
    }
    globalThis.fetch = async () => new Response('video', { headers: { 'content-type': 'video/mp4' } });
    equal((await fetchMediaBlob('https://example.supabase.co/file')).size, 5);
  } finally { globalThis.fetch = original; }
});
Deno.test('platform variants preserve one media path and validate independent captions', () => {
  const parsed = parsePublishPayload({ ...payload, content: 'Long caption '.repeat(30), mediaPath: `${workspace}/video.mp4`, mediaType: 'video',
    mediaMeta: { width: 1080, height: 1920, durationSeconds: 30 }, verticalShort: true,
    platformOverrides: { x: { content: 'Short X caption' }, youtube: { title: 'Separate Shorts title' } } });
  const x = platformVariant(parsed, 'x');
  equal(x.content, 'Short X caption'); equal(x.mediaPath, parsed.mediaPath);
  equal(platformVariant(parsed, 'youtube').videoTitle, 'Separate Shorts title');
  equal(validateForPlatform('x', { ...x, hasMedia: true }).length, 0);
  ok(validateForPlatform('x', { ...parsed, hasMedia: true }).length > 0);
  const landscape = { ...x, mediaMeta: { width: 1920, height: 1080, durationSeconds: 30 }, hasMedia: true };
  match(validateForPlatform('youtube', landscape).join(''), /9:16/);
  match(validateForPlatform('facebook', { ...x, hasMedia: true, mediaMeta: { width: 1080, height: 1920, durationSeconds: 91 } }).join(''), /90 seconds/);
});
Deno.test('per-network schedules and options are validated before saving', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  const body = { ...payload, scheduledAt: '2026-10-30T13:00:00Z', platformOverrides: { x: { content: 'Short', scheduledAt: '2026-10-30T14:00:00Z' } }, youtubeMadeForKids: true };
  const parsed = parsePublishPayload(body, now);
  equal(platformVariant(parsed, 'x').scheduledAt, '2026-10-30T14:00:00.000Z');
  equal(parsed.youtubeMadeForKids, true);
  for (const overrides of [{ madeUp: {} }, { x: { content: 42 } }, { x: { scheduledAt: 'yesterday' } }, { x: { title: 'x'.repeat(101) } }]) {
    throws(() => parsePublishPayload({ ...body, platformOverrides: overrides }, now));
  }
  throws(() => parsePublishPayload({ ...payload, youtubeMadeForKids: 'false' }));
  throws(() => parsePublishPayload({ ...payload, platformOverrides: body.platformOverrides }, now));
});
