import { IMAGE_TYPES, VIDEO_TYPES, MAX_MEDIA_BYTES } from './publishing-contract.ts';

export function workspaceMediaPath(workspaceId: string, supabaseUrl: string, path?: string, legacyUrl?: string): string | undefined {
  if (!path && !legacyUrl) return undefined;
  if (!path && legacyUrl) {
    const url = new URL(legacyUrl);
    if (url.origin !== new URL(supabaseUrl).origin || url.username || url.password) throw new Error('Upload media to this workspace first');
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/social-media\/(.+)$/);
    if (!match) throw new Error('Invalid workspace media URL');
    path = decodeURIComponent(match[1]);
  }
  if (!path?.startsWith(`${workspaceId}/`) || path.split('/').some(p => !p || p === '.' || p === '..') || /[%?#\\]/.test(path) || [...path].some(c => c.charCodeAt(0) < 32)) {
    throw new Error('Media must belong to the selected workspace');
  }
  return path;
}

// Bounded reads also protect against a misleading Content-Length header.
export async function fetchMediaBlob(mediaUrl: string): Promise<Blob> {
  const response = await fetch(mediaUrl, { redirect: 'error', signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) throw new Error(`Could not read uploaded media (${response.status})`);
  const type = response.headers.get('content-type')?.split(';')[0] || '';
  if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(type)) {
    await response.body.cancel();
    throw new Error('Unsupported uploaded media type');
  }
  if (Number(response.headers.get('content-length')) > MAX_MEDIA_BYTES) {
    await response.body.cancel();
    throw new Error('Maximum upload size is 100 MiB');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MEDIA_BYTES) throw new Error('Maximum upload size is 100 MiB');
      chunks.push(new Uint8Array(value));
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new Error('The uploaded file is empty');
  return new Blob(chunks, { type });
}
