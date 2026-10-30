// Runtime-independent contract shared by the browser, API and queue worker.
export const PLATFORM_LIMITS = {
  youtube: 5000, instagram: 2200, facebook: 63206, linkedin: 3000,
  x: 280, tiktok: 2200, threads: 500, bluesky: 300,
} as const;
export type Platform = keyof typeof PLATFORM_LIMITS;
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MediaMeta {
  width?: number;
  height?: number;
  durationSeconds?: number;
  sizeBytes?: number;
  mimeType?: string;
}

export interface PlatformOverride { content?: string; title?: string; scheduledAt?: string }
export type PlatformOverrides = Partial<Record<Platform, PlatformOverride>>;

export interface PublishPayload {
  workspaceId: string;
  requestId: string;
  content: string;
  targetAccountIds: string[];
  linkUrl?: string;
  mediaPath?: string;
  mediaUrl?: string; // Legacy workspace storage URL; never an arbitrary remote URL.
  mediaType?: 'image' | 'video';
  mediaMeta?: MediaMeta;
  scheduledAt?: string;
  youtubeVisibility: 'private' | 'unlisted' | 'public';
  verticalShort?: boolean;
  videoTitle?: string;
  platformOverrides?: PlatformOverrides;
  youtubeMadeForKids?: boolean;
  instagramShareToFeed?: boolean;
}

export interface DeliveryResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  needsReconnect?: boolean;
  needsUserAction?: boolean;
}

export function targetStatus(result: DeliveryResult) {
  return result.success ? 'published' : result.needsReconnect || result.needsUserAction
    ? 'needs_user_action' : 'failed';
}

export function summarizeStatuses(statuses: string[]) {
  if (statuses.some(s => s === 'queued' || s === 'publishing')) return 'publishing';
  if (statuses.every(s => s === 'skipped')) return 'canceled';
  if (statuses.every(s => s === 'published')) return 'published';
  if (statuses.some(s => s === 'published')) return 'partial';
  if (statuses.some(s => s === 'needs_user_action')) return 'needs_user_action';
  return 'failed';
}

export function validateMediaMeta(value: unknown): MediaMeta | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid media metadata');
  const meta = value as Record<string, unknown>;
  const result: MediaMeta = {};
  for (const key of ['width', 'height', 'durationSeconds', 'sizeBytes'] as const) {
    if (meta[key] === undefined) continue;
    if (typeof meta[key] !== 'number' || !Number.isFinite(meta[key]) || meta[key] <= 0) {
      throw new Error(`Invalid media ${key}`);
    }
    result[key] = meta[key];
  }
  if (meta.mimeType !== undefined) {
    if (typeof meta.mimeType !== 'string' || ![...IMAGE_TYPES, ...VIDEO_TYPES].includes(meta.mimeType)) {
      throw new Error('Unsupported media type');
    }
    result.mimeType = meta.mimeType;
  }
  if (result.sizeBytes && result.sizeBytes > MAX_MEDIA_BYTES) throw new Error('Maximum upload size is 100 MiB');
  return result;
}

export function validateLink(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid link URL');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Link must be an HTTP(S) URL without credentials');
  }
  return url.href;
}

export function parsePublishPayload(value: unknown, now = Date.now()): PublishPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request body');
  const body = value as Record<string, unknown>;
  if (typeof body.workspaceId !== 'string' || !UUID.test(body.workspaceId)) throw new Error('Invalid workspace ID');
  if (typeof body.requestId !== 'string' || !UUID.test(body.requestId)) throw new Error('Invalid request ID');
  if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > 10000) {
    throw new Error('Enter between 1 and 10,000 characters');
  }
  if (!Array.isArray(body.targetAccountIds) || !body.targetAccountIds.length || body.targetAccountIds.length > 20 ||
      body.targetAccountIds.some(id => typeof id !== 'string' || !UUID.test(id))) {
    throw new Error('Select between 1 and 20 valid channels');
  }
  for (const key of ['mediaPath', 'mediaUrl'] as const) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || !body[key] || body[key].length > 4096)) {
      throw new Error(`Invalid ${key}`);
    }
  }
  const hasMedia = !!(body.mediaPath || body.mediaUrl);
  if (hasMedia && !['image', 'video'].includes(String(body.mediaType))) throw new Error('Select a media type');
  if (!hasMedia && body.mediaType !== undefined) throw new Error('Upload the media file first');
  let scheduledAt: string | undefined;
  if (body.scheduledAt !== undefined) {
    if (typeof body.scheduledAt !== 'string' || !Number.isFinite(Date.parse(body.scheduledAt)) ||
        Date.parse(body.scheduledAt) < now + 30_000) throw new Error('Schedule at least 30 seconds in the future');
    scheduledAt = new Date(body.scheduledAt).toISOString();
  }
  const visibility = body.youtubeVisibility ?? 'private';
  if (!['private', 'unlisted', 'public'].includes(String(visibility))) throw new Error('Invalid YouTube visibility');
  const platformOverrides: PlatformOverrides = {};
  if (body.platformOverrides !== undefined) {
    if (!body.platformOverrides || typeof body.platformOverrides !== 'object' || Array.isArray(body.platformOverrides)) throw new Error('Invalid platform overrides');
    for (const [platform, value] of Object.entries(body.platformOverrides)) {
      if (!Object.hasOwn(PLATFORM_LIMITS, platform) || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid platform override');
      const raw = value as Record<string, unknown>;
      const override: PlatformOverride = {};
      for (const key of ['content', 'title'] as const) {
        if (raw[key] === undefined || raw[key] === '') continue;
        if (typeof raw[key] !== 'string' || raw[key].length > (key === 'title' ? 100 : 10000)) throw new Error(`Invalid ${platform} ${key}`);
        override[key] = raw[key].trim();
      }
      if (raw.scheduledAt !== undefined) {
        if (!scheduledAt || typeof raw.scheduledAt !== 'string' || !Number.isFinite(Date.parse(raw.scheduledAt)) || Date.parse(raw.scheduledAt) < now + 30_000) {
          throw new Error(`Choose a valid future ${platform} publishing time`);
        }
        override.scheduledAt = new Date(raw.scheduledAt).toISOString();
      }
      platformOverrides[platform as Platform] = override;
    }
  }
  for (const key of ['verticalShort', 'youtubeMadeForKids', 'instagramShareToFeed'] as const) {
    if (body[key] !== undefined && typeof body[key] !== 'boolean') throw new Error(`Invalid ${key}`);
  }
  if (body.videoTitle !== undefined && (typeof body.videoTitle !== 'string' || body.videoTitle.length > 100)) throw new Error('Video title must be at most 100 characters');
  return {
    workspaceId: body.workspaceId, requestId: body.requestId, content: body.content.trim(),
    targetAccountIds: [...new Set(body.targetAccountIds)] as string[],
    linkUrl: validateLink(body.linkUrl), mediaPath: body.mediaPath as string | undefined,
    mediaUrl: body.mediaUrl as string | undefined, mediaType: body.mediaType as PublishPayload['mediaType'],
    mediaMeta: validateMediaMeta(body.mediaMeta), scheduledAt,
    youtubeVisibility: visibility as PublishPayload['youtubeVisibility'],
    verticalShort: body.verticalShort === true, videoTitle: typeof body.videoTitle === 'string' ? body.videoTitle.trim() : undefined,
    platformOverrides, youtubeMadeForKids: body.youtubeMadeForKids === true, instagramShareToFeed: body.instagramShareToFeed !== false,
  };
}

export function validateForPlatform(platform: string, payload: {
  content: string; linkUrl?: string; mediaType?: string; mediaMeta?: MediaMeta; hasMedia: boolean; verticalShort?: boolean; videoTitle?: string;
}): string[] {
  if (!Object.hasOwn(PLATFORM_LIMITS, platform)) return ['Unsupported platform'];
  const errors: string[] = [];
  if (!payload.content.trim()) errors.push('Content is required');
  const captionLength = payload.content.length + (platform === 'bluesky' && payload.linkUrl ? payload.linkUrl.length + 2 : 0);
  if (captionLength > PLATFORM_LIMITS[platform as Platform]) {
    errors.push(`${platform}: caption exceeds ${PLATFORM_LIMITS[platform as Platform]} characters`);
  }
  if (['youtube', 'tiktok'].includes(platform) && (!payload.hasMedia || payload.mediaType !== 'video')) {
    errors.push(`${platform}: upload a video`);
  }
  if (platform === 'instagram' && !payload.hasMedia) errors.push('Instagram requires an image or video');
  if (payload.verticalShort && (!payload.hasMedia || payload.mediaType !== 'video')) errors.push('Reel/Short mode requires one video');
  if (payload.videoTitle && payload.videoTitle.length > 100) errors.push('Video title must be at most 100 characters');
  if (payload.mediaType === 'video' && !payload.mediaMeta) errors.push('Video metadata is required; upload the video again');
  if (payload.mediaType === 'video' && payload.mediaMeta) {
    const { durationSeconds, width, height } = payload.mediaMeta;
    if (!durationSeconds || !width || !height) errors.push('Could not read video duration and dimensions; upload a playable video');
    if (payload.verticalShort) {
      if (width && height && Math.abs(width / height - 9 / 16) > 0.005) errors.push('Reel/Short mode requires a 9:16 vertical video');
      if (payload.mediaMeta.mimeType && payload.mediaMeta.mimeType !== 'video/mp4') errors.push('Use MP4 for the shared Reel/Short master');
      if (durationSeconds && durationSeconds < 4) errors.push('Use a clip at least 4 seconds long for the shared short-video profile');
      if (platform === 'facebook' && width && height && (width < 540 || height < 960)) errors.push('Use at least 540 × 960 pixels for the Facebook Reels route');
      if (platform === 'facebook' && durationSeconds && durationSeconds > 90) errors.push('Keep the master at 90 seconds or less to use the Facebook Reels route');
    }
    // These are ShortWork's short-video profile limits, not claims about every account tier.
    if (durationSeconds && durationSeconds > 180) errors.push('ShortWork supports videos up to 3 minutes');
    if (platform === 'x' && durationSeconds && durationSeconds > 140) errors.push('ShortWork limits X videos to 140 seconds');
  }
  return errors;
}

// Apply caption/title overrides without mutating the shared master or media.
export function platformVariant(payload: PublishPayload, platform: string): PublishPayload {
  const override = payload.platformOverrides?.[platform as Platform];
  return { ...payload, content: override?.content || payload.content,
    videoTitle: override?.title || payload.videoTitle,
    scheduledAt: override?.scheduledAt || payload.scheduledAt };
}
