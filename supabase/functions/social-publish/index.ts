import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  publishToProvider,
  fetchMediaBlob,
  PublishOptions,
  MediaMeta,
  decryptToken,
} from "../_shared/publishers.ts";

interface PublishRequest {
  workspaceId: string;
  content: string;
  linkUrl?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  mediaMeta?: MediaMeta;
  targetAccountIds: string[];
}

interface PublishResult {
  accountId: string;
  platform: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  needsReconnect?: boolean;
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Platform character limits
const PLATFORM_LIMITS: Record<string, number> = {
  x: 280,
  bluesky: 300,
  threads: 500,
  instagram: 2200,
  linkedin: 3000,
  facebook: 63206,
  youtube: 5000,
  tiktok: 2200,
};

// Platforms that need the media bytes server-side (vs a public URL)
const NEEDS_MEDIA_BYTES = new Set(['youtube', 'tiktok', 'x', 'linkedin', 'bluesky']);

// Validate and sanitize URL
function validateUrl(url: string | undefined): { valid: boolean; sanitized?: string; error?: string } {
  if (!url || url.trim() === '') {
    return { valid: true, sanitized: undefined };
  }

  try {
    const parsed = new URL(url);

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
    }

    // Block localhost and internal IPs
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname === '0.0.0.0'
    ) {
      return { valid: false, error: 'Internal URLs are not allowed' };
    }

    return { valid: true, sanitized: parsed.toString() };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// Validate request body
function validatePublishRequest(body: unknown): {
  valid: boolean;
  data?: PublishRequest;
  error?: string
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const request = body as Record<string, unknown>;

  // Validate workspaceId
  if (!request.workspaceId || typeof request.workspaceId !== 'string') {
    return { valid: false, error: 'workspaceId is required' };
  }
  if (!UUID_REGEX.test(request.workspaceId)) {
    return { valid: false, error: 'Invalid workspaceId format' };
  }

  // Validate content
  if (!request.content || typeof request.content !== 'string') {
    return { valid: false, error: 'content is required' };
  }
  const content = request.content.trim();
  if (content.length === 0) {
    return { valid: false, error: 'content cannot be empty' };
  }
  if (content.length > 10000) {
    return { valid: false, error: 'content exceeds maximum length of 10000 characters' };
  }

  // Validate targetAccountIds
  if (!Array.isArray(request.targetAccountIds) || request.targetAccountIds.length === 0) {
    return { valid: false, error: 'At least one target account is required' };
  }
  if (request.targetAccountIds.length > 20) {
    return { valid: false, error: 'Maximum 20 target accounts allowed' };
  }
  for (const id of request.targetAccountIds) {
    if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
      return { valid: false, error: 'Invalid account ID format' };
    }
  }

  // Validate linkUrl (optional)
  const linkValidation = validateUrl(request.linkUrl as string | undefined);
  if (!linkValidation.valid) {
    return { valid: false, error: `linkUrl: ${linkValidation.error}` };
  }

  // Validate mediaUrl (optional)
  const mediaValidation = validateUrl(request.mediaUrl as string | undefined);
  if (!mediaValidation.valid) {
    return { valid: false, error: `mediaUrl: ${mediaValidation.error}` };
  }

  // Validate mediaType (optional)
  if (request.mediaType !== undefined &&
      request.mediaType !== 'image' &&
      request.mediaType !== 'video') {
    return { valid: false, error: 'mediaType must be "image" or "video"' };
  }

  // Validate mediaMeta (optional)
  let mediaMeta: MediaMeta | undefined;
  if (request.mediaMeta && typeof request.mediaMeta === 'object') {
    const meta = request.mediaMeta as Record<string, unknown>;
    mediaMeta = {
      width: typeof meta.width === 'number' ? meta.width : undefined,
      height: typeof meta.height === 'number' ? meta.height : undefined,
      durationSeconds: typeof meta.durationSeconds === 'number' ? meta.durationSeconds : undefined,
    };
  }

  return {
    valid: true,
    data: {
      workspaceId: request.workspaceId,
      content,
      linkUrl: linkValidation.sanitized,
      mediaUrl: mediaValidation.sanitized,
      mediaType: request.mediaType as 'image' | 'video' | undefined,
      mediaMeta,
      targetAccountIds: request.targetAccountIds as string[],
    },
  };
}

// Validate content for specific platform
function validateContentForPlatform(
  platform: string,
  content: string,
  hasMedia: boolean,
  mediaType?: string
): { valid: boolean; error?: string } {
  const maxLength = PLATFORM_LIMITS[platform] || 2200;

  if (content.length > maxLength) {
    return {
      valid: false,
      error: `Content exceeds ${platform} limit of ${maxLength} characters`,
    };
  }

  // Instagram requires media
  if (platform === 'instagram' && !hasMedia) {
    return {
      valid: false,
      error: 'Instagram requires an image or video',
    };
  }

  // YouTube and TikTok require video
  if (platform === 'youtube' || platform === 'tiktok') {
    if (!hasMedia || mediaType !== 'video') {
      return {
        valid: false,
        error: `${platform === 'youtube' ? 'YouTube' : 'TikTok'} requires a video file`,
      };
    }
  }

  return { valid: true };
}

// Validate workspace access
async function validateWorkspaceAccess(
  supabase: any,
  authHeader: string,
  workspaceId: string,
  requiredRoles: string[] = ['owner', 'admin', 'editor']
): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  // Extract and validate JWT
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user) {
    console.error('Auth validation error:', userError);
    return { authorized: false, error: 'Invalid authentication token' };
  }

  // Check workspace membership
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (memberError || !membership) {
    console.log('Workspace access denied:', { userId: user.id, workspaceId, error: memberError });
    return { authorized: false, error: 'Not a member of this workspace' };
  }

  // Validate role
  const role = membership.role as string;
  if (!requiredRoles.includes(role)) {
    return {
      authorized: false,
      error: `Insufficient permissions. Requires: ${requiredRoles.join(', ')}`,
    };
  }

  return { authorized: true, userId: user.id };
}

// Record the publish in posts/post_targets so the Queue page has history
async function recordPublishHistory(
  supabase: any,
  workspaceId: string,
  userId: string,
  request: PublishRequest,
  results: PublishResult[],
  accounts: any[]
) {
  try {
    const successCount = results.filter(r => r.success).length;
    const { data: post } = await supabase
      .from('posts')
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        status: successCount > 0 ? 'published' : 'failed',
        title: request.content.split('\n')[0].substring(0, 120),
        body_text: request.content,
        link_url: request.linkUrl,
        per_channel_overrides: request.mediaUrl
          ? { media_url: request.mediaUrl, media_type: request.mediaType }
          : {},
      })
      .select()
      .single();

    if (!post) return;

    const targets = results.map(r => {
      const account = accounts.find(a => a.id === r.accountId);
      return {
        post_id: post.id,
        social_account_id: r.accountId,
        platform: account?.platform || r.platform,
        status: r.success ? 'published' : 'failed',
        remote_post_id: r.postId,
        publish_attempts: 1,
        last_error_message: r.error,
        last_attempt_at: new Date().toISOString(),
        published_at: r.success ? new Date().toISOString() : null,
      };
    });
    await supabase.from('post_targets').insert(targets);
  } catch (error) {
    console.error('Failed to record publish history:', error);
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validation = validatePublishRequest(rawBody);
    if (!validation.valid || !validation.data) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { workspaceId, content, linkUrl, mediaUrl, mediaType, mediaMeta, targetAccountIds } = validation.data;

    // Validate workspace access and permissions
    const authResult = await validateWorkspaceAccess(
      supabase,
      authHeader,
      workspaceId,
      ['owner', 'admin', 'editor']
    );

    if (!authResult.authorized) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Publishing content:', {
      userId: authResult.userId,
      workspaceId,
      accountCount: targetAccountIds.length
    });

    // Get target accounts with tokens
    const { data: accounts, error: accountsError } = await supabase
      .from('social_accounts')
      .select(`
        id,
        platform,
        platform_user_id,
        display_name,
        oauth_tokens (
          access_token,
          refresh_token,
          expires_at
        )
      `)
      .eq('workspace_id', workspaceId)
      .in('id', targetAccountIds)
      .eq('status', 'connected');

    if (accountsError || !accounts?.length) {
      console.error('Accounts query error:', accountsError);
      return new Response(JSON.stringify({ error: 'No valid accounts found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download the media once and share the bytes across all platforms that
    // upload server-side (YouTube, TikTok, X, LinkedIn, Bluesky)
    let mediaBlob: Blob | null = null;
    if (mediaUrl && accounts.some(a => NEEDS_MEDIA_BYTES.has(a.platform))) {
      try {
        mediaBlob = await fetchMediaBlob(mediaUrl);
      } catch (error) {
        console.error('Media prefetch failed:', error);
        // URL-based platforms can still work; byte-based ones will retry the fetch
      }
    }

    // Publish to all platforms in parallel
    const results: PublishResult[] = await Promise.all(accounts.map(async (account: any): Promise<PublishResult> => {
      const platformValidation = validateContentForPlatform(
        account.platform,
        content,
        !!mediaUrl,
        mediaType
      );

      if (!platformValidation.valid) {
        return {
          accountId: account.id,
          platform: account.platform,
          success: false,
          error: platformValidation.error,
        };
      }

      const token = account.oauth_tokens?.[0];
      if (!token?.access_token) {
        return {
          accountId: account.id,
          platform: account.platform,
          success: false,
          error: 'No access token found',
        };
      }

      try {
        const options: PublishOptions = {
          accountId: account.platform_user_id,
          socialAccountId: account.id,
          accessToken: await decryptToken(token.access_token),
          refreshToken: token.refresh_token ? await decryptToken(token.refresh_token) : undefined,
          tokenExpiresAt: token.expires_at,
          content,
          linkUrl,
          mediaUrl,
          mediaType,
          mediaMeta,
          mediaBlob,
        };
        const result = await publishToProvider(account.platform, options, supabase);
        return {
          accountId: account.id,
          platform: account.platform,
          ...result,
        };
      } catch (error: unknown) {
        console.error(`Publish error for ${account.platform}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          accountId: account.id,
          platform: account.platform,
          success: false,
          error: errorMessage,
        };
      }
    }));

    // Record history so the Queue page can show past publishes
    await recordPublishHistory(supabase, workspaceId, authResult.userId!, validation.data, results, accounts);

    // Log audit entry for publish action
    try {
      await supabase.from('audit_logs').insert({
        workspace_id: workspaceId,
        actor_user_id: authResult.userId,
        action: 'publish_content',
        entity_type: 'social_post',
        details: {
          platforms: results.map(r => r.platform),
          success_count: results.filter(r => r.success).length,
          failure_count: results.filter(r => !r.success).length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
      // Don't fail the request for audit log errors
    }

    // Determine overall status
    const successCount = results.filter(r => r.success).length;
    const status = successCount === results.length ? 'published'
      : successCount > 0 ? 'partial'
      : 'failed';

    return new Response(JSON.stringify({
      success: successCount > 0,
      status,
      results,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: results.length - successCount,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Social publish error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
