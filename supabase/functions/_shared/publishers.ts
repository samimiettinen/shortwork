// Shared publishing engine used by both the interactive `social-publish`
// function and the scheduled `publish-scheduled` queue processor.
//
// Every platform supports short-video publishing where the platform API
// allows it:
//   youtube   – resumable upload (Shorts are auto-detected: vertical, <=3min)
//   tiktok    – Content Posting API direct post (chunked FILE_UPLOAD)
//   instagram – Reels container + publish (video pulled from public URL)
//   facebook  – Page Reels (9:16 short video) or regular page video
//   linkedin  – versioned Videos API (initialize/upload/finalize) + Posts API
//   x         – v2 chunked media upload + tweet with media
//   threads   – VIDEO container + publish
//   bluesky   – video service upload + app.bsky.embed.video record

const GRAPH_VERSION = 'v25.0';
const LINKEDIN_VERSION = '202506';

export interface MediaMeta {
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface PublishOptions {
  // platform_user_id (page id / ig user id / channel id / did / person sub ...)
  accountId: string;
  // database id of the social_accounts row (for token refresh writebacks)
  socialAccountId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string | null;
  content: string;
  linkUrl?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  mediaMeta?: MediaMeta;
  // pre-fetched media bytes, shared across platforms to avoid re-downloading
  mediaBlob?: Blob | null;
}

export interface ProviderResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  needsReconnect?: boolean;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchMediaBlob(mediaUrl: string): Promise<Blob> {
  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
  }
  return await response.blob();
}

function firstLine(text: string, maxLen: number): string {
  const line = text.split('\n')[0].trim();
  return line.substring(0, maxLen) || 'Short video';
}

function isVertical(meta?: MediaMeta): boolean {
  if (!meta?.width || !meta?.height) return false;
  return meta.height > meta.width;
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

const REFRESHABLE = new Set(['youtube', 'x', 'tiktok', 'threads', 'bluesky']);

async function markNeedsReconnect(supabase: any, socialAccountId: string) {
  await supabase
    .from('social_accounts')
    .update({ status: 'needs_refresh', updated_at: new Date().toISOString() })
    .eq('id', socialAccountId);
}

import { encryptToken, decryptToken } from "./token-crypto.ts";
export { decryptToken } from "./token-crypto.ts";

async function persistToken(
  supabase: any,
  socialAccountId: string,
  token: { accessToken: string; refreshToken?: string; expiresAt?: Date | null }
) {
  const update: Record<string, unknown> = {
    access_token: await encryptToken(token.accessToken),
    updated_at: new Date().toISOString(),
  };
  if (token.refreshToken) update.refresh_token = await encryptToken(token.refreshToken);
  if (token.expiresAt !== undefined) update.expires_at = token.expiresAt ? token.expiresAt.toISOString() : null;

  await supabase
    .from('oauth_tokens')
    .update(update)
    .eq('social_account_id', socialAccountId);
}

// Refresh an access token for platforms that support it. Returns updated
// tokens (persisted to the database as a side effect) or needsReconnect.
export async function ensureFreshToken(
  platform: string,
  options: PublishOptions,
  supabase: any
): Promise<{ accessToken: string; refreshToken?: string; error?: string; needsReconnect?: boolean }> {
  const { accessToken, refreshToken, tokenExpiresAt, socialAccountId } = options;

  if (!REFRESHABLE.has(platform)) {
    // Meta page tokens are long-lived; LinkedIn tokens last 60 days and
    // standard apps cannot refresh programmatically.
    if (tokenExpiresAt && new Date(tokenExpiresAt) < new Date()) {
      await markNeedsReconnect(supabase, socialAccountId);
      return {
        accessToken,
        error: `Your ${platform} connection has expired. Please reconnect it in the Channels page.`,
        needsReconnect: true,
      };
    }
    return { accessToken };
  }

  // Bluesky sessions are short-lived; always refresh before publishing.
  if (platform === 'bluesky') {
    if (!refreshToken) return { accessToken };
    const response = await fetch('https://bsky.social/xrpc/com.atproto.server.refreshSession', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${refreshToken}` },
    });
    if (!response.ok) {
      await markNeedsReconnect(supabase, socialAccountId);
      return {
        accessToken,
        error: 'Your Bluesky session has expired. Please reconnect it in the Channels page.',
        needsReconnect: true,
      };
    }
    const session = await response.json();
    await persistToken(supabase, socialAccountId, {
      accessToken: session.accessJwt,
      refreshToken: session.refreshJwt,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    return { accessToken: session.accessJwt, refreshToken: session.refreshJwt };
  }

  // Only refresh when the token is missing an expiry or expires within 5 min
  if (tokenExpiresAt) {
    const expiresAt = new Date(tokenExpiresAt);
    if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
      return { accessToken };
    }
  } else {
    return { accessToken };
  }

  const reconnectMessage = (p: string) =>
    `Your ${p} connection has expired. Please reconnect it in the Channels page.`;

  try {
    if (platform === 'youtube') {
      if (!refreshToken) {
        await markNeedsReconnect(supabase, socialAccountId);
        return { accessToken, error: reconnectMessage('YouTube'), needsReconnect: true };
      }
      const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
      const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');
      if (!clientId || !clientSecret) {
        return { accessToken, error: 'YouTube OAuth credentials not configured' };
      }
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (!response.ok) {
        await markNeedsReconnect(supabase, socialAccountId);
        return { accessToken, error: reconnectMessage('YouTube'), needsReconnect: true };
      }
      const data = await response.json();
      await persistToken(supabase, socialAccountId, {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      });
      return { accessToken: data.access_token };
    }

    if (platform === 'x') {
      if (!refreshToken) {
        await markNeedsReconnect(supabase, socialAccountId);
        return { accessToken, error: reconnectMessage('X'), needsReconnect: true };
      }
      const clientId = Deno.env.get('X_CLIENT_ID');
      const clientSecret = Deno.env.get('X_CLIENT_SECRET');
      if (!clientId || !clientSecret) {
        return { accessToken, error: 'X OAuth credentials not configured' };
      }
      const response = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.access_token) {
        await markNeedsReconnect(supabase, socialAccountId);
        return { accessToken, error: reconnectMessage('X'), needsReconnect: true };
      }
      // X rotates refresh tokens — persist the new one or the next refresh fails
      await persistToken(supabase, socialAccountId, {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      });
      return { accessToken: data.access_token, refreshToken: data.refresh_token };
    }

    if (platform === 'tiktok') {
      if (!refreshToken) {
        await markNeedsReconnect(supabase, socialAccountId);
        return { accessToken, error: reconnectMessage('TikTok'), needsReconnect: true };
      }
      const clientKey = Deno.env.get('TIKTOK_CLIENT_ID');
      const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET');
      if (!clientKey || !clientSecret) {
        return { accessToken, error: 'TikTok OAuth credentials not configured' };
      }
      const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });
      const data = await response.json();
      if (!data.access_token) {
        await markNeedsReconnect(supabase, socialAccountId);
        return { accessToken, error: reconnectMessage('TikTok'), needsReconnect: true };
      }
      await persistToken(supabase, socialAccountId, {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      });
      return { accessToken: data.access_token, refreshToken: data.refresh_token };
    }

    if (platform === 'threads') {
      // Threads refreshes the (unexpired) long-lived token itself
      const response = await fetch(
        `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${accessToken}`
      );
      const data = await response.json();
      if (!data.access_token) {
        await markNeedsReconnect(supabase, socialAccountId);
        return { accessToken, error: reconnectMessage('Threads'), needsReconnect: true };
      }
      await persistToken(supabase, socialAccountId, {
        accessToken: data.access_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      });
      return { accessToken: data.access_token };
    }
  } catch (error) {
    console.error(`Token refresh error for ${platform}:`, error);
    return { accessToken, error: `Failed to refresh ${platform} token` };
  }

  return { accessToken };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function publishToProvider(
  platform: string,
  options: PublishOptions,
  supabase: any
): Promise<ProviderResult> {
  // Refresh tokens up front for all platforms that support it
  const fresh = await ensureFreshToken(platform, options, supabase);
  if (fresh.needsReconnect) {
    return { success: false, error: fresh.error, needsReconnect: true };
  }
  const opts: PublishOptions = {
    ...options,
    accessToken: fresh.accessToken,
    refreshToken: fresh.refreshToken ?? options.refreshToken,
  };

  switch (platform) {
    case 'facebook':
      return publishToFacebook(opts);
    case 'linkedin':
      return publishToLinkedIn(opts);
    case 'x':
      return publishToX(opts);
    case 'bluesky':
      return publishToBluesky(opts);
    case 'instagram':
      return publishToInstagram(opts);
    case 'tiktok':
      return publishToTikTok(opts);
    case 'threads':
      return publishToThreads(opts);
    case 'youtube':
      return publishToYouTube(opts);
    default:
      return { success: false, error: `Unsupported platform: ${platform}` };
  }
}

// ---------------------------------------------------------------------------
// Facebook (Pages) — feed, photos, videos and Reels
// ---------------------------------------------------------------------------

async function publishToFacebook(options: PublishOptions): Promise<ProviderResult> {
  const { accountId: pageId, accessToken, content, linkUrl, mediaUrl, mediaType, mediaMeta } = options;

  try {
    if (mediaUrl && mediaType === 'video') {
      // Vertical short videos go to Reels; other videos to regular page video
      const duration = mediaMeta?.durationSeconds ?? 0;
      const reelsEligible = isVertical(mediaMeta) && duration >= 3 && duration <= 90;

      if (reelsEligible) {
        const reelResult = await publishFacebookReel(pageId, accessToken, content, mediaUrl);
        if (reelResult.success) return reelResult;
        console.error('Facebook Reel publish failed, falling back to page video:', reelResult.error);
      }

      const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: mediaUrl,
          description: content,
          title: firstLine(content, 65),
          access_token: accessToken,
        }),
      });
      const data = await response.json();
      if (data.error) return { success: false, error: data.error.message };
      return {
        success: true,
        postId: data.id,
        postUrl: `https://www.facebook.com/${pageId}/videos/${data.id}`,
      };
    }

    let endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`;
    const body: Record<string, string> = { message: content, access_token: accessToken };

    if (mediaUrl) {
      endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`;
      body.url = mediaUrl;
    } else if (linkUrl) {
      body.link = linkUrl;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (data.error) return { success: false, error: data.error.message };
    return {
      success: true,
      postId: data.id || data.post_id,
      postUrl: `https://facebook.com/${data.post_id || data.id}`,
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function publishFacebookReel(
  pageId: string,
  accessToken: string,
  description: string,
  videoUrl: string
): Promise<ProviderResult> {
  // Phase 1: start an upload session
  const startResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_phase: 'start', access_token: accessToken }),
  });
  const startData = await startResponse.json();
  if (startData.error || !startData.video_id) {
    return { success: false, error: startData.error?.message || 'Failed to start Reel upload' };
  }

  // Phase 2: hand Facebook the hosted file URL. Note: file_url is an HTTP
  // HEADER on rupload, and the auth scheme is literally "OAuth", not Bearer.
  const uploadUrl = startData.upload_url
    || `https://rupload.facebook.com/video-upload/${GRAPH_VERSION}/${startData.video_id}`;
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${accessToken}`,
      'file_url': videoUrl,
    },
  });
  const uploadData = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok || uploadData.success === false) {
    return { success: false, error: uploadData?.debug_info?.message || 'Failed to upload Reel video' };
  }

  // Wait until Facebook has ingested the file before finishing
  {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      await sleep(5000);
      const statusResponse = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${startData.video_id}?fields=status&access_token=${accessToken}`
      );
      const statusData = await statusResponse.json().catch(() => ({}));
      const uploadPhase = statusData.status?.uploading_phase?.status;
      const processingErrors = statusData.status?.processing_phase?.errors;
      if (processingErrors?.length) {
        return { success: false, error: `Facebook Reel processing error: ${processingErrors[0]?.message || 'unknown'}` };
      }
      if (uploadPhase === 'complete') break;
      if (uploadPhase === 'error') {
        return { success: false, error: 'Facebook Reel upload failed during ingestion' };
      }
    }
  }

  // Phase 3: publish
  const finishParams = new URLSearchParams({
    access_token: accessToken,
    video_id: startData.video_id,
    upload_phase: 'finish',
    video_state: 'PUBLISHED',
    description,
  });
  const finishResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/video_reels?${finishParams.toString()}`,
    { method: 'POST' }
  );
  const finishData = await finishResponse.json();
  if (finishData.error) {
    return { success: false, error: finishData.error.message };
  }

  // finish returns success:true as an acknowledgment only — confirm via status
  {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await sleep(5000);
      const statusResponse = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${startData.video_id}?fields=status&access_token=${accessToken}`
      );
      const statusData = await statusResponse.json().catch(() => ({}));
      const publishing = statusData.status?.publishing_phase;
      if (publishing?.status === 'complete') break;
      if (publishing?.status === 'error') {
        return { success: false, error: publishing.errors?.[0]?.message || 'Facebook Reel publish failed' };
      }
    }
  }

  return {
    success: true,
    postId: startData.video_id,
    postUrl: `https://www.facebook.com/reel/${startData.video_id}`,
  };
}

// ---------------------------------------------------------------------------
// Instagram — Reels (video) and photo posts via container + publish
// ---------------------------------------------------------------------------

async function publishToInstagram(options: PublishOptions): Promise<ProviderResult> {
  const { accountId: igUserId, accessToken, content, mediaUrl, mediaType } = options;

  if (!mediaUrl) {
    return { success: false, error: 'Instagram requires an image or video' };
  }

  try {
    const containerBody: Record<string, string> = {
      caption: content,
      access_token: accessToken,
    };
    if (mediaType === 'video') {
      containerBody.media_type = 'REELS';
      containerBody.video_url = mediaUrl;
      containerBody.share_to_feed = 'true';
    } else {
      containerBody.image_url = mediaUrl;
    }

    const containerResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerBody),
      }
    );
    const containerData = await containerResponse.json();
    if (containerData.error) {
      return { success: false, error: containerData.error.message };
    }

    // Videos are processed asynchronously — poll the container status
    if (mediaType === 'video') {
      const ready = await pollInstagramContainer(containerData.id, accessToken);
      if (!ready.ok) return { success: false, error: ready.error };
    }

    const publishResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerData.id, access_token: accessToken }),
      }
    );
    const publishData = await publishResponse.json();
    if (publishData.error) {
      return { success: false, error: publishData.error.message };
    }

    // Fetch the real permalink (the media id is not a valid shortcode)
    let postUrl = `https://www.instagram.com/`;
    try {
      const permalinkResponse = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${publishData.id}?fields=permalink&access_token=${accessToken}`
      );
      const permalinkData = await permalinkResponse.json();
      if (permalinkData.permalink) postUrl = permalinkData.permalink;
    } catch { /* permalink is cosmetic */ }

    return { success: true, postId: publishData.id, postUrl };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function pollInstagramContainer(
  containerId: string,
  accessToken: string,
  timeoutMs = 180_000
): Promise<{ ok: boolean; error?: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(5000);
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${containerId}?fields=status_code,status&access_token=${accessToken}`
    );
    const data = await response.json();
    if (data.error) return { ok: false, error: data.error.message };
    if (data.status_code === 'FINISHED') return { ok: true };
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      return { ok: false, error: `Instagram could not process the video (${data.status || data.status_code}). Check the video meets Reels specs (MP4, 9:16 recommended, max 15 min).` };
    }
  }
  return { ok: false, error: 'Instagram video processing timed out. The video may still publish shortly.' };
}

// ---------------------------------------------------------------------------
// LinkedIn — text, image and native video posts via the versioned REST API
// ---------------------------------------------------------------------------

// LinkedIn "little text" format: these characters must be escaped in commentary
function escapeLinkedInText(text: string): string {
  return text.replace(/[\(\)\{\}\[\]<>@|~_*\\]/g, (c) => `\\${c}`);
}

async function publishToLinkedIn(options: PublishOptions): Promise<ProviderResult> {
  const { accountId, accessToken, content, linkUrl, mediaUrl, mediaType, mediaBlob } = options;
  const authorUrn = `urn:li:person:${accountId}`;

  try {
    let mediaContent: Record<string, unknown> | undefined;

    if (mediaUrl && mediaType === 'video') {
      const upload = await uploadLinkedInVideo(authorUrn, accessToken, mediaUrl, mediaBlob);
      if (!upload.ok) return { success: false, error: upload.error };
      mediaContent = { media: { id: upload.urn, title: firstLine(content, 100) } };
    } else if (mediaUrl && mediaType !== 'video') {
      const upload = await uploadLinkedInImage(authorUrn, accessToken, mediaUrl, mediaBlob);
      if (upload.ok) {
        mediaContent = { media: { id: upload.urn, altText: firstLine(content, 100) } };
      }
    } else if (linkUrl) {
      mediaContent = { article: { source: linkUrl, title: firstLine(content, 100) } };
    }

    const postBody: Record<string, unknown> = {
      author: authorUrn,
      commentary: escapeLinkedInText(content),
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };
    if (mediaContent) postBody.content = mediaContent;

    const response = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': LINKEDIN_VERSION,
      },
      body: JSON.stringify(postBody),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.message || `LinkedIn API error (${response.status})` };
    }

    const postUrn = response.headers.get('x-restli-id') || response.headers.get('x-linkedin-id') || '';
    return {
      success: true,
      postId: postUrn,
      postUrl: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : 'https://www.linkedin.com/feed/',
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function uploadLinkedInVideo(
  authorUrn: string,
  accessToken: string,
  mediaUrl: string,
  preFetched?: Blob | null
): Promise<{ ok: true; urn: string } | { ok: false; error: string }> {
  const blob = preFetched ?? await fetchMediaBlob(mediaUrl);
  const fileSizeBytes = blob.size;

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': LINKEDIN_VERSION,
  };

  // 1. Initialize the upload
  const initResponse = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: authorUrn,
        fileSizeBytes,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  const initData = await initResponse.json();
  if (!initResponse.ok || !initData.value) {
    return { ok: false, error: initData.message || 'LinkedIn video upload initialization failed' };
  }

  const { uploadInstructions, video: videoUrn, uploadToken } = initData.value;

  // 2. Upload each part and collect ETags
  const uploadedPartIds: string[] = [];
  for (const instruction of uploadInstructions) {
    const chunk = blob.slice(instruction.firstByte, instruction.lastByte + 1);
    const partResponse = await fetch(instruction.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: chunk,
    });
    if (!partResponse.ok) {
      return { ok: false, error: `LinkedIn video part upload failed (${partResponse.status})` };
    }
    const etag = partResponse.headers.get('etag');
    if (!etag) return { ok: false, error: 'LinkedIn video upload did not return an ETag' };
    uploadedPartIds.push(etag);
  }

  // 3. Finalize
  const finalizeResponse = await fetch('https://api.linkedin.com/rest/videos?action=finalizeUpload', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: videoUrn,
        uploadToken: uploadToken || '',
        uploadedPartIds,
      },
    }),
  });
  if (!finalizeResponse.ok) {
    const data = await finalizeResponse.json().catch(() => ({}));
    return { ok: false, error: data.message || 'LinkedIn video finalize failed' };
  }

  // 4. Wait until LinkedIn finishes processing so the post doesn't 404
  const encodedUrn = encodeURIComponent(videoUrn);
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await sleep(5000);
    const statusResponse = await fetch(`https://api.linkedin.com/rest/videos/${encodedUrn}`, { headers });
    if (!statusResponse.ok) continue;
    const status = await statusResponse.json();
    if (status.status === 'AVAILABLE') return { ok: true, urn: videoUrn };
    if (status.status === 'PROCESSING_FAILED') {
      return { ok: false, error: 'LinkedIn could not process the video' };
    }
  }
  // Processing usually completes shortly; proceed optimistically
  return { ok: true, urn: videoUrn };
}

async function uploadLinkedInImage(
  authorUrn: string,
  accessToken: string,
  mediaUrl: string,
  preFetched?: Blob | null
): Promise<{ ok: true; urn: string } | { ok: false; error: string }> {
  const blob = preFetched ?? await fetchMediaBlob(mediaUrl);

  const initResponse = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': LINKEDIN_VERSION,
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  const initData = await initResponse.json();
  if (!initResponse.ok || !initData.value) {
    return { ok: false, error: initData.message || 'LinkedIn image upload initialization failed' };
  }

  const uploadResponse = await fetch(initData.value.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: blob,
  });
  if (!uploadResponse.ok) {
    return { ok: false, error: `LinkedIn image upload failed (${uploadResponse.status})` };
  }

  return { ok: true, urn: initData.value.image };
}

// ---------------------------------------------------------------------------
// X (Twitter) — v2 chunked media upload + tweet
// ---------------------------------------------------------------------------

const X_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB per APPEND

async function publishToX(options: PublishOptions): Promise<ProviderResult> {
  const { accessToken, content, mediaUrl, mediaType, mediaBlob } = options;

  try {
    let mediaId: string | undefined;

    if (mediaUrl) {
      const upload = await uploadXMedia(accessToken, mediaUrl, mediaType, mediaBlob);
      if (!upload.ok) return { success: false, error: upload.error };
      mediaId = upload.mediaId;
    }

    const tweetBody: Record<string, unknown> = { text: content };
    if (mediaId) tweetBody.media = { media_ids: [mediaId] };

    const response = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });
    const data = await response.json();
    if (data.errors || !response.ok) {
      return { success: false, error: data.errors?.[0]?.message || data.detail || 'X API error' };
    }

    return {
      success: true,
      postId: data.data.id,
      postUrl: `https://x.com/i/status/${data.data.id}`,
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function uploadXMedia(
  accessToken: string,
  mediaUrl: string,
  mediaType?: string,
  preFetched?: Blob | null
): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  const blob = preFetched ?? await fetchMediaBlob(mediaUrl);
  const isVideo = mediaType === 'video';
  const mimeType = blob.type || (isVideo ? 'video/mp4' : 'image/jpeg');

  // 1. INIT
  const initResponse = await fetch('https://api.x.com/2/media/upload/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      media_type: mimeType,
      total_bytes: blob.size,
      media_category: isVideo ? 'tweet_video' : 'tweet_image',
    }),
  });
  const initData = await initResponse.json();
  const mediaId = initData.data?.id;
  if (!initResponse.ok || !mediaId) {
    return { ok: false, error: initData.errors?.[0]?.message || initData.detail || 'X media INIT failed. Note: media upload requires the media.write scope — reconnect your X account if you connected it before this update.' };
  }

  // 2. APPEND in chunks
  let segmentIndex = 0;
  for (let offset = 0; offset < blob.size; offset += X_CHUNK_SIZE) {
    const chunk = blob.slice(offset, Math.min(offset + X_CHUNK_SIZE, blob.size));
    const form = new FormData();
    form.append('media', chunk, 'chunk');
    form.append('segment_index', segmentIndex.toString());

    const appendResponse = await fetch(`https://api.x.com/2/media/upload/${mediaId}/append`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: form,
    });
    if (!appendResponse.ok) {
      const appendData = await appendResponse.json().catch(() => ({}));
      return { ok: false, error: appendData.errors?.[0]?.message || `X media APPEND failed (${appendResponse.status})` };
    }
    segmentIndex++;
  }

  // 3. FINALIZE
  const finalizeResponse = await fetch(`https://api.x.com/2/media/upload/${mediaId}/finalize`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  const finalizeData = await finalizeResponse.json();
  if (!finalizeResponse.ok) {
    return { ok: false, error: finalizeData.errors?.[0]?.message || 'X media FINALIZE failed' };
  }

  // 4. Poll processing status for videos
  let processingInfo = finalizeData.data?.processing_info;
  const deadline = Date.now() + 120_000;
  while (processingInfo && processingInfo.state !== 'succeeded' && Date.now() < deadline) {
    if (processingInfo.state === 'failed') {
      return { ok: false, error: processingInfo.error?.message || 'X could not process the video' };
    }
    await sleep((processingInfo.check_after_secs || 5) * 1000);
    const statusResponse = await fetch(
      `https://api.x.com/2/media/upload?media_id=${mediaId}&command=STATUS`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const statusData = await statusResponse.json().catch(() => ({}));
    processingInfo = statusData.data?.processing_info;
    if (!statusResponse.ok) break;
  }

  return { ok: true, mediaId };
}

// ---------------------------------------------------------------------------
// Threads — TEXT, IMAGE and VIDEO containers
// ---------------------------------------------------------------------------

async function publishToThreads(options: PublishOptions): Promise<ProviderResult> {
  const { accountId, accessToken, content, linkUrl, mediaUrl, mediaType } = options;

  try {
    const body: Record<string, string> = {
      text: content,
      access_token: accessToken,
      media_type: 'TEXT',
    };

    if (mediaUrl && mediaType === 'video') {
      body.media_type = 'VIDEO';
      body.video_url = mediaUrl;
    } else if (mediaUrl) {
      body.media_type = 'IMAGE';
      body.image_url = mediaUrl;
    } else if (linkUrl) {
      body.link_attachment = linkUrl;
    }

    // Step 1: create container
    const containerResponse = await fetch(
      `https://graph.threads.net/v1.0/${accountId}/threads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    const containerData = await containerResponse.json();
    if (containerData.error) {
      return { success: false, error: containerData.error.message };
    }

    // Step 2: wait for processing (videos take a while)
    const deadline = Date.now() + (mediaType === 'video' ? 120_000 : 30_000);
    let status = 'IN_PROGRESS';
    while (Date.now() < deadline) {
      const statusResponse = await fetch(
        `https://graph.threads.net/v1.0/${containerData.id}?fields=status,error_message&access_token=${accessToken}`
      );
      const statusData = await statusResponse.json();
      status = statusData.status || 'FINISHED';
      if (status === 'FINISHED') break;
      if (status === 'ERROR') {
        return { success: false, error: statusData.error_message || 'Threads could not process the media' };
      }
      await sleep(mediaType === 'video' ? 5000 : 2000);
    }
    if (status !== 'FINISHED') {
      return { success: false, error: 'Threads media processing timed out' };
    }

    // Step 3: publish
    const publishResponse = await fetch(
      `https://graph.threads.net/v1.0/${accountId}/threads_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerData.id, access_token: accessToken }),
      }
    );
    const publishData = await publishResponse.json();
    if (publishData.error) {
      return { success: false, error: publishData.error.message };
    }

    // Fetch permalink
    let postUrl = `https://www.threads.net/`;
    try {
      const permalinkResponse = await fetch(
        `https://graph.threads.net/v1.0/${publishData.id}?fields=permalink&access_token=${accessToken}`
      );
      const permalinkData = await permalinkResponse.json();
      if (permalinkData.permalink) postUrl = permalinkData.permalink;
    } catch { /* permalink is cosmetic */ }

    return { success: true, postId: publishData.id, postUrl };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ---------------------------------------------------------------------------
// TikTok — Content Posting API direct post with chunked FILE_UPLOAD
// ---------------------------------------------------------------------------

const TIKTOK_MIN_CHUNK = 5 * 1024 * 1024;   // 5MB
const TIKTOK_MAX_CHUNK = 64 * 1024 * 1024;  // 64MB

async function publishToTikTok(options: PublishOptions): Promise<ProviderResult> {
  const { accessToken, content, mediaUrl, mediaType, mediaBlob } = options;

  if (!mediaUrl || mediaType !== 'video') {
    return { success: false, error: 'TikTok requires a video file' };
  }

  try {
    // 1. Query creator info — required by TikTok before posting, and tells us
    //    which privacy levels this account/app may use
    const creatorResponse = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      }
    );
    const creatorData = await creatorResponse.json();
    if (creatorData.error?.code && creatorData.error.code !== 'ok') {
      return { success: false, error: `TikTok: ${creatorData.error.message || creatorData.error.code}` };
    }

    const creatorUsername: string | undefined = creatorData.data?.creator_username;
    const privacyOptions: string[] = creatorData.data?.privacy_level_options || [];
    // Prefer public; unaudited API clients are only allowed SELF_ONLY (drafts
    // visible to the creator) until the app passes TikTok's audit
    const privacyLevel = privacyOptions.includes('PUBLIC_TO_EVERYONE')
      ? 'PUBLIC_TO_EVERYONE'
      : (privacyOptions[0] || 'SELF_ONLY');

    const maxDuration = creatorData.data?.max_video_post_duration_sec;
    if (maxDuration && options.mediaMeta?.durationSeconds && options.mediaMeta.durationSeconds > maxDuration) {
      return { success: false, error: `TikTok: video exceeds this account's max duration of ${maxDuration}s` };
    }

    // 2. Download the video and initialize a chunked upload.
    //    (PULL_FROM_URL would require verifying the storage domain with
    //    TikTok, so FILE_UPLOAD is used instead.)
    const blob = mediaBlob ?? await fetchMediaBlob(mediaUrl);
    const videoSize = blob.size;

    let chunkSize: number;
    let totalChunkCount: number;
    if (videoSize <= TIKTOK_MAX_CHUNK) {
      chunkSize = videoSize;
      totalChunkCount = 1;
    } else {
      chunkSize = 32 * 1024 * 1024;
      totalChunkCount = Math.floor(videoSize / chunkSize);
    }

    const initResponse = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: {
            title: content.substring(0, 2200),
            privacy_level: privacyLevel,
            disable_duet: creatorData.data?.duet_disabled ?? false,
            disable_comment: creatorData.data?.comment_disabled ?? false,
            disable_stitch: creatorData.data?.stitch_disabled ?? false,
            is_aigc: false,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: chunkSize,
            total_chunk_count: totalChunkCount,
          },
        }),
      }
    );
    const initData = await initResponse.json();
    if (initData.error?.code && initData.error.code !== 'ok') {
      return { success: false, error: `TikTok init failed: ${initData.error.message || initData.error.code}` };
    }
    const { publish_id: publishId, upload_url: uploadUrl } = initData.data || {};
    if (!publishId || !uploadUrl) {
      return { success: false, error: 'TikTok did not return an upload URL' };
    }

    // 3. Upload chunks. The final chunk absorbs the remainder.
    for (let i = 0; i < totalChunkCount; i++) {
      const firstByte = i * chunkSize;
      const lastByte = i === totalChunkCount - 1 ? videoSize - 1 : (i + 1) * chunkSize - 1;
      const chunk = blob.slice(firstByte, lastByte + 1);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${firstByte}-${lastByte}/${videoSize}`,
          'Content-Type': blob.type || 'video/mp4',
        },
        body: chunk,
      });
      if (!uploadResponse.ok && uploadResponse.status !== 201) {
        return { success: false, error: `TikTok chunk upload failed (${uploadResponse.status})` };
      }
    }

    // 4. Poll publish status
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await sleep(5000);
      const statusResponse = await fetch(
        'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({ publish_id: publishId }),
        }
      );
      const statusData = await statusResponse.json();
      const status = statusData.data?.status;

      if (status === 'PUBLISH_COMPLETE') {
        // Note: the field name is misspelled in TikTok's API, and the array is
        // empty until moderation of a public post completes
        const videoId = statusData.data?.publicaly_available_post_id?.[0];
        const profileUrl = creatorUsername ? `https://www.tiktok.com/@${creatorUsername}` : 'https://www.tiktok.com/';
        return {
          success: true,
          postId: String(videoId || publishId),
          postUrl: videoId && creatorUsername
            ? `https://www.tiktok.com/@${creatorUsername}/video/${videoId}`
            : profileUrl,
        };
      }
      if (status === 'FAILED') {
        return { success: false, error: `TikTok publish failed: ${statusData.data?.fail_reason || 'unknown reason'}` };
      }
      // PROCESSING_UPLOAD / PROCESSING_DOWNLOAD / SEND_TO_USER_INBOX → keep waiting
      if (status === 'SEND_TO_USER_INBOX') {
        return {
          success: true,
          postId: publishId,
          postUrl: 'https://www.tiktok.com/',
          error: undefined,
        };
      }
    }

    // Upload was accepted; TikTok finishes processing asynchronously
    return {
      success: true,
      postId: publishId,
      postUrl: 'https://www.tiktok.com/',
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ---------------------------------------------------------------------------
// Bluesky — text, images and video via the video service
// ---------------------------------------------------------------------------

async function publishToBluesky(options: PublishOptions): Promise<ProviderResult> {
  const { accountId: did, accessToken, content, linkUrl, mediaUrl, mediaType, mediaMeta, mediaBlob } = options;

  try {
    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text: linkUrl ? `${content}\n\n${linkUrl}` : content,
      createdAt: new Date().toISOString(),
    };

    if (linkUrl) {
      const textBytes = new TextEncoder().encode(content).length;
      const linkBytes = new TextEncoder().encode(linkUrl).length;
      record.facets = [{
        index: { byteStart: textBytes + 2, byteEnd: textBytes + 2 + linkBytes },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: linkUrl }],
      }];
    }

    if (mediaUrl && mediaType === 'video') {
      const video = await uploadBlueskyVideo(did, accessToken, mediaUrl, mediaBlob);
      if (!video.ok) return { success: false, error: video.error };
      const embed: Record<string, unknown> = {
        $type: 'app.bsky.embed.video',
        video: video.blob,
      };
      if (mediaMeta?.width && mediaMeta?.height) {
        embed.aspectRatio = { width: mediaMeta.width, height: mediaMeta.height };
      }
      record.embed = embed;
    } else if (mediaUrl) {
      const blob = mediaBlob ?? await fetchMediaBlob(mediaUrl);
      const uploadResponse = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': blob.type || 'image/jpeg',
        },
        body: blob,
      });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok || !uploadData.blob) {
        return { success: false, error: uploadData.message || 'Bluesky image upload failed' };
      }
      record.embed = {
        $type: 'app.bsky.embed.images',
        images: [{ image: uploadData.blob, alt: firstLine(content, 100) }],
      };
    }

    const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repo: did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });
    const data = await response.json();
    if (data.error) {
      return { success: false, error: data.message || data.error };
    }

    const rkey = data.uri.split('/').pop();
    return {
      success: true,
      postId: data.uri,
      postUrl: `https://bsky.app/profile/${did}/post/${rkey}`,
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function uploadBlueskyVideo(
  did: string,
  accessToken: string,
  mediaUrl: string,
  preFetched?: Blob | null
): Promise<{ ok: true; blob: unknown } | { ok: false; error: string }> {
  const blob = preFetched ?? await fetchMediaBlob(mediaUrl);
  if (blob.size > 100 * 1024 * 1024) {
    return { ok: false, error: 'Bluesky videos must be under 100MB' };
  }

  // 1. Service auth token scoped to the video service
  const expTimestamp = Math.floor(Date.now() / 1000) + 30 * 60;
  const authResponse = await fetch(
    `https://bsky.social/xrpc/com.atproto.server.getServiceAuth?aud=${encodeURIComponent('did:web:video.bsky.app')}&lxm=app.bsky.video.uploadVideo&exp=${expTimestamp}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  const authData = await authResponse.json();
  if (!authResponse.ok || !authData.token) {
    return { ok: false, error: authData.message || 'Bluesky video service auth failed' };
  }

  // 2. Upload to the video service
  const name = `video-${Date.now()}.mp4`;
  const uploadResponse = await fetch(
    `https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?did=${encodeURIComponent(did)}&name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': blob.type || 'video/mp4',
        'Content-Length': String(blob.size),
      },
      body: blob,
    }
  );
  let job = await uploadResponse.json();
  // "already_exists" is returned with the completed job for repeat uploads
  if (!uploadResponse.ok && job?.error !== 'already_exists' && !job?.jobId && !job?.jobStatus) {
    return { ok: false, error: job.message || 'Bluesky video upload failed' };
  }
  job = job.jobStatus || job;

  // 3. Poll processing status
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (job.state === 'JOB_STATE_COMPLETED' && job.blob) {
      return { ok: true, blob: job.blob };
    }
    if (job.state === 'JOB_STATE_FAILED') {
      return { ok: false, error: job.error || 'Bluesky video processing failed' };
    }
    await sleep(3000);
    const statusResponse = await fetch(
      `https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId=${encodeURIComponent(job.jobId)}`,
      { headers: { 'Authorization': `Bearer ${authData.token}` } }
    );
    const statusData = await statusResponse.json();
    job = statusData.jobStatus || job;
  }

  return { ok: false, error: 'Bluesky video processing timed out' };
}

// ---------------------------------------------------------------------------
// YouTube — resumable upload (Shorts are auto-detected)
// ---------------------------------------------------------------------------

async function publishToYouTube(options: PublishOptions): Promise<ProviderResult> {
  const { accessToken, content, mediaUrl, mediaType, mediaBlob } = options;

  if (!mediaUrl) {
    return { success: false, error: 'YouTube requires a video file' };
  }
  if (mediaType !== 'video') {
    return { success: false, error: 'YouTube only supports video content' };
  }

  try {
    const videoBlob = mediaBlob ?? await fetchMediaBlob(mediaUrl);
    const videoSize = videoBlob.size;

    const title = firstLine(content, 100);

    const metadata = {
      snippet: {
        title,
        description: content,
        categoryId: '22', // People & Blogs
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    };

    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': videoSize.toString(),
          'X-Upload-Content-Type': videoBlob.type || 'video/mp4',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initResponse.ok) {
      const errorData = await initResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error?.message || `Failed to initialize upload: ${initResponse.statusText}`,
      };
    }

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      return { success: false, error: 'Failed to get upload URL from YouTube' };
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': videoBlob.type || 'video/mp4',
        'Content-Length': videoSize.toString(),
      },
      body: videoBlob,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error?.message || `Failed to upload video: ${uploadResponse.statusText}`,
      };
    }

    const uploadData = await uploadResponse.json();
    return {
      success: true,
      postId: uploadData.id,
      postUrl: `https://youtube.com/watch?v=${uploadData.id}`,
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
