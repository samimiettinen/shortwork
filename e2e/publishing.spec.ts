import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const workspace = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const youtube = '33333333-3333-4333-8333-333333333333';
const tiktok = '44444444-4444-4444-8444-444444444444';
const fixture = path.join(import.meta.dirname, 'fixtures/short.mp4');
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'test@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
async function setup(page: Page) {
  const media = await readFile(fixture);
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.test`;
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('sb-shortwork-test-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fake-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600, user }));
  }, { token, user });
  const requests: Record<string, unknown>[] = [];
  await page.route('https://shortwork-test.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const respond = (value: unknown) => route.fulfill({ json: value });
    if (url.pathname === '/auth/v1/user') return respond(user);
    if (url.pathname.includes('/rpc/is_app_admin')) return respond(false);
    if (url.pathname.includes('/workspace_members')) return respond({ workspace_id: workspace, role: 'owner' });
    if (url.pathname.includes('/social_accounts')) return respond([
      { id: youtube, platform: 'youtube', display_name: 'Test YouTube', status: 'connected', handle: '@youtube' },
      { id: tiktok, platform: 'tiktok', display_name: 'Test TikTok', status: 'connected', handle: '@tiktok' },
    ]);
    if (url.pathname.includes('/storage/v1/object/sign/')) {
      if (route.request().method() === 'POST') return respond({ signedURL: `/object/sign/social-media/${workspace}/short.mp4?token=test` });
      return route.fulfill({ contentType: 'video/mp4', body: media });
    }
    if (url.pathname.includes('/storage/v1/object/social-media/')) return respond({ Key: 'social-media/short.mp4', Id: 'upload' });
    if (url.pathname.endsWith('/functions/v1/social-publish')) {
      const body = route.request().postDataJSON(); requests.push(body);
      return respond({ postId: 'post-id', status: body.scheduledAt ? 'scheduled' : 'partial', replayed: false,
        results: [{ accountId: youtube, platform: 'youtube', success: true, postUrl: 'https://youtube.com/watch?v=test' },
          { accountId: tiktok, platform: 'tiktok', success: false, needsUserAction: true, postId: 'inbox-id', error: 'Open your TikTok inbox to finish publishing.' }],
        summary: { total: body.targetAccountIds.length, succeeded: body.scheduledAt ? 0 : 1, needsAction: body.scheduledAt ? 0 : 1, failed: 0 } });
    }
    return respond([]);
  });
  await page.goto('/compose');
  await expect(page.getByText('Create & Publish', { exact: true })).toBeVisible();
  return requests;
}

test('video upload previews, validates and preserves handoffs without retrying successful channels', async ({ page }) => {
  const requests = await setup(page);
  await page.getByPlaceholder('What do you want to share?').fill('A short video for two channels');
  await page.getByText('Test YouTube', { exact: false }).click();
  await page.getByText('Test TikTok', { exact: true }).click();
  const publish = page.getByRole('button', { name: 'Publish to 2 Channels', exact: true });
  await expect(publish).toBeDisabled();
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText('short.mp4', { exact: true })).toBeVisible();
  await expect(page.getByText('TikTok receives the video in your inbox.', { exact: false })).toBeVisible();
  await page.getByLabel('YouTube visibility').selectOption('unlisted');
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByText('Open your TikTok inbox to finish publishing.', { exact: false })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].mediaPath).toMatch(new RegExp(`^${workspace}/`));
  expect(requests[0].mediaUrl).toBeUndefined();
  expect(requests[0].mediaMeta).toMatchObject({ width: 720, height: 1280, durationSeconds: 4 });
  expect(requests[0].youtubeVisibility).toBe('unlisted');
  await expect(page.getByRole('button', { name: 'Select channels to publish' })).toBeDisabled();
  await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/compose-outcomes.png', fullPage: true });
});

test('scheduled upload reads metadata, previews video and sends one atomic request', async ({ page }) => {
  const requests = await setup(page);
  await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
  await page.getByLabel('Caption', { exact: true }).fill('Scheduled short video');
  await page.getByText('Test YouTube', { exact: false }).click();
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.locator('video')).toBeVisible();
  await page.getByLabel('Date', { exact: true }).fill('2099-10-30');
  await page.getByLabel('Time', { exact: true }).fill('14:30');
  await page.getByRole('button', { name: 'Schedule post', exact: true }).click();
  await expect(page).toHaveURL(/\/queue$/);
  expect(requests).toHaveLength(1);
  expect(requests[0].mediaMeta).toMatchObject({ width: 720, height: 1280, durationSeconds: 4 });
  expect(requests[0].mediaPath).toBeTruthy(); expect(requests[0].mediaUrl).toBeUndefined();
  expect(requests[0].scheduledAt).toContain('2099-10-30');
  expect(requests[0].youtubeVisibility).toBe('private');
});

test('one master upload survives delivery-mode changes and carries per-network variants', async ({ page }) => {
  const requests = await setup(page);
  let uploads = 0;
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/storage/v1/object/social-media/')) uploads++; });
  await page.getByLabel('Caption', { exact: true }).fill('A shared caption for this vertical master');
  await page.getByRole('button', { name: 'Select all connected' }).click();
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText('short.mp4', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
  await expect(page.getByText('short.mp4', { exact: true })).toBeVisible();
  await page.getByText('YouTube ·', { exact: false }).click();
  await page.getByLabel('YouTube caption', { exact: true }).fill('Custom YouTube description');
  await page.getByLabel('YouTube title', { exact: true }).fill('Custom Shorts title');
  await page.getByLabel('YouTube publishing time (optional)', { exact: true }).fill('2099-10-30T15:45');
  await page.getByLabel('Date', { exact: true }).fill('2099-10-30');
  await page.getByLabel('Time', { exact: true }).fill('14:30');
  await page.getByLabel('Preview network').selectOption('youtube');
  await expect(page.getByRole('paragraph').filter({ hasText: /^Custom YouTube description$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Schedule post', exact: true }).click();
  await expect(page).toHaveURL(/\/queue$/);
  expect(uploads).toBe(1); expect(requests).toHaveLength(1);
  expect(requests[0].verticalShort).toBe(true);
  expect(requests[0].targetAccountIds).toEqual([youtube, tiktok]);
  expect(requests[0].platformOverrides).toMatchObject({ youtube: { content: 'Custom YouTube description', title: 'Custom Shorts title' } });
  expect((requests[0].platformOverrides as Record<string, {scheduledAt: string}>).youtube.scheduledAt).not.toBe(requests[0].scheduledAt);
});
