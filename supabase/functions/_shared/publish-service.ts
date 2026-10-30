import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { publishToProvider, decryptToken } from './publishers.ts';
import { fetchMediaBlob, workspaceMediaPath } from './media.ts';
import { platformVariant, targetStatus, type PublishPayload, type DeliveryResult } from './publishing-contract.ts';

export interface Account {
  id: string;
  workspace_id: string;
  platform: string;
  platform_user_id: string;
  status: string;
  oauth_tokens: Token[] | Token | null;
}
interface Token { access_token: string; refresh_token: string | null; expires_at: string | null }
export type AccountResult = DeliveryResult & { accountId: string; platform: string };

export async function prepareMedia(client: SupabaseClient, payload: Pick<PublishPayload, 'workspaceId' | 'mediaPath' | 'mediaUrl' | 'mediaType'>) {
  const path = workspaceMediaPath(payload.workspaceId, Deno.env.get('SUPABASE_URL')!, payload.mediaPath, payload.mediaUrl);
  if (!path) return { path, url: undefined, blob: null };
  const { data, error } = await client.storage.from('social-media').createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error('Could not access the workspace media file');
  const blob = await fetchMediaBlob(data.signedUrl);
  if (!blob.type.startsWith(`${payload.mediaType}/`)) throw new Error('Uploaded file does not match the selected media type');
  return { path, url: data.signedUrl, blob };
}

export async function deliver(client: SupabaseClient, account: Account, payload: PublishPayload,
  media: { url?: string; blob: Blob | null }): Promise<AccountResult> {
  payload = platformVariant(payload, account.platform);
  const base = { accountId: account.id, platform: account.platform };
  if (account.workspace_id !== payload.workspaceId || account.status !== 'connected') {
    return { ...base, success: false, needsUserAction: true, error: 'Channel is no longer connected to this workspace' };
  }
  const token = Array.isArray(account.oauth_tokens) ? account.oauth_tokens[0] : account.oauth_tokens;
  try {
    const accessToken = await decryptToken(token?.access_token);
    if (!accessToken) return { ...base, success: false, needsReconnect: true, error: 'Reconnect this channel before publishing' };
    const result = await publishToProvider(account.platform, {
      accountId: account.platform_user_id, socialAccountId: account.id, accessToken,
      refreshToken: token?.refresh_token ? await decryptToken(token.refresh_token) : undefined,
      tokenExpiresAt: token?.expires_at, content: payload.content, linkUrl: payload.linkUrl,
      mediaUrl: media.url, mediaBlob: media.blob, mediaType: payload.mediaType,
      mediaMeta: payload.mediaMeta, youtubeVisibility: payload.youtubeVisibility,
      videoTitle: payload.videoTitle, verticalShort: payload.verticalShort, youtubeMadeForKids: payload.youtubeMadeForKids, instagramShareToFeed: payload.instagramShareToFeed,
    }, client);
    return { ...base, ...result };
  } catch {
    return { ...base, success: false, needsUserAction: true,
      error: 'The delivery could not be confirmed. Check the platform before retrying.' };
  }
}

export async function saveResult(client: SupabaseClient, postId: string, result: AccountResult) {
  const { error } = await client.from('post_targets').update({
    status: targetStatus(result), remote_post_id: result.postId || null,
    remote_post_url: result.postUrl || null, last_error_message: result.error?.slice(0, 1000) || null,
    publish_attempts: 1, last_attempt_at: new Date().toISOString(),
    published_at: result.success ? new Date().toISOString() : null,
  }).eq('post_id', postId).eq('social_account_id', result.accountId);
  if (error) throw new Error('Could not save delivery outcome. Check the platform before retrying.');
}

export async function rollup(client: SupabaseClient, postId: string) {
  const { error } = await client.rpc('rollup_publish_status', { p_post: postId });
  if (error) throw new Error('Could not update publishing history');
}
