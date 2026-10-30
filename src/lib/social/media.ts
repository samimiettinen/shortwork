import { supabase } from '@/integrations/supabase/client';
import { IMAGE_TYPES, VIDEO_TYPES, MAX_MEDIA_BYTES } from '../../../supabase/functions/_shared/publishing-contract';

export interface UploadedMedia {
  path: string;
  url: string;
  type: 'image' | 'video';
  name: string;
  size: number;
  mimeType: string;
  duration?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

export function probeVideo(file: File): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const cleanup = () => {
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Video metadata timed out. Try MP4 with H.264 video and AAC audio.')); }, 15_000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const meta = { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
      cleanup();
      if (!Object.values(meta).every(n => Number.isFinite(n) && n > 0)) reject(new Error('Could not read video metadata'));
      else resolve(meta);
    };
    video.onerror = () => { cleanup(); reject(new Error('This browser cannot read the video. Try MP4 with H.264 video and AAC audio.')); };
    video.src = url;
  });
}

export async function uploadMedia(workspaceId: string, file: File): Promise<UploadedMedia> {
  if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(file.type)) throw new Error('Choose a supported image or MP4, MOV or WebM video');
  if (!file.size || file.size > MAX_MEDIA_BYTES) throw new Error('Choose a file between 1 byte and 100 MiB');
  const type = VIDEO_TYPES.includes(file.type) ? 'video' : 'image';
  const metadata = type === 'video' ? await probeVideo(file) : {};
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${workspaceId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('social-media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data, error: signError } = await supabase.storage.from('social-media').createSignedUrl(path, 3600);
  if (signError || !data?.signedUrl) {
    await supabase.storage.from('social-media').remove([path]);
    throw signError || new Error('Could not preview uploaded media');
  }
  return { path, url: data.signedUrl, name: file.name, size: file.size, mimeType: file.type, type, ...metadata };
}

export function mediaMetadata(media: UploadedMedia | null) {
  return media ? { width: media.width, height: media.height, durationSeconds: media.duration, sizeBytes: media.size, mimeType: media.mimeType } : undefined;
}
