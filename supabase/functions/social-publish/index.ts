import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PublishRequest {
  workspaceId: string;
  content: string;
  linkUrl?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  targetAccountIds: string[];
}

interface PublishResult {
  accountId: string;
  platform: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
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

  return {
    valid: true,
    data: {
      workspaceId: request.workspaceId,
      content,
      linkUrl: linkValidation.sanitized,
      mediaUrl: mediaValidation.sanitized,
      mediaType: request.mediaType as 'image' | 'video' | undefined,
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

  // YouTube requires video
  if (platform === 'youtube') {
    if (!hasMedia) {
      return {
        valid: false,
        error: 'YouTube requires a video file',
      };
    }
    if (mediaType !== 'video') {
      return {
        valid: false,
        error: 'YouTube only supports video content',
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

Deno.serve(async (req) => {
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

    const { workspaceId, content, linkUrl, mediaUrl, mediaType, targetAccountIds } = validation.data;

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

    // Publish to each platform
    const results: PublishResult[] = [];

    for (const account of accounts) {
      // Validate content for platform
      const platformValidation = validateContentForPlatform(
        account.platform,
        content,
        !!mediaUrl,
        mediaType
      );

      if (!platformValidation.valid) {
        results.push({
          accountId: account.id,
          platform: account.platform,
          success: false,
          error: platformValidation.error,
        });
        continue;
      }

      const token = account.oauth_tokens?.[0];
      if (!token?.access_token) {
        results.push({
          accountId: account.id,
          platform: account.platform,
          success: false,
          error: 'No access token found',
        });
        continue;
      }

      try {
        const result = await publishToProvider(
          account.platform,
          {
            accountId: account.platform_user_id,
            socialAccountId: account.id,
            accessToken: token.access_token,
            refreshToken: token.refresh_token || undefined,
            content,
            linkUrl,
            mediaUrl,
            mediaType,
          },
          supabase
        );

        results.push({
          accountId: account.id,
          platform: account.platform,
          ...result,
        });
      } catch (error: unknown) {
        console.error(`Publish error for ${account.platform}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          accountId: account.id,
          platform: account.platform,
          success: false,
          error: errorMessage,
        });
      }
    }

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

async function publishToProvider(
  platform: string,
  options: {
    accountId: string;
    socialAccountId: string;
    accessToken: string;
    refreshToken?: string;
    content: string;
    linkUrl?: string;
    mediaUrl?: string;
    mediaType?: string;
  },
  supabase: any
): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  const { accountId, socialAccountId, accessToken, content, linkUrl, mediaUrl } = options;

  switch (platform) {
    case 'facebook':
      return publishToFacebook(accountId, accessToken, content, linkUrl, mediaUrl);
    
    case 'linkedin':
      return publishToLinkedIn(accountId, accessToken, content, linkUrl, mediaUrl);
    
    case 'x':
      return publishToX(accessToken, content);
    
    case 'bluesky':
      return publishToBluesky(accountId, accessToken, options.refreshToken!, content, linkUrl);
    
    case 'instagram':
      return publishToInstagram(accountId, accessToken, content, mediaUrl);
    
    case 'tiktok':
      return { success: false, error: 'TikTok publishing requires video content - use the TikTok app' };
    
    case 'threads':
      return publishToThreads(accountId, accessToken, content, mediaUrl);
    
    case 'youtube':
      return publishToYouTube(accessToken, options.refreshToken, socialAccountId, supabase, content, mediaUrl, options.mediaType);
    
    default:
      return { success: false, error: `Unsupported platform: ${platform}` };
  }
}

async function publishToFacebook(
  pageId: string,
  accessToken: string,
  message: string,
  link?: string,
  photoUrl?: string
): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  try {
    let endpoint = `https://graph.facebook.com/v18.0/${pageId}/feed`;
    const body: Record<string, string> = { message, access_token: accessToken };

    if (photoUrl) {
      endpoint = `https://graph.facebook.com/v18.0/${pageId}/photos`;
      body.url = photoUrl;
    } else if (link) {
      body.link = link;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return {
      success: true,
      postId: data.id || data.post_id,
      postUrl: `https://facebook.com/${data.id}`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function publishToLinkedIn(
  personUrn: string,
  accessToken: string,
  text: string,
  articleUrl?: string,
  imageUrl?: string
): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  try {
    const body: any = {
      author: `urn:li:person:${personUrn}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: articleUrl ? 'ARTICLE' : 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    if (articleUrl) {
      body.specificContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        originalUrl: articleUrl,
      }];
    }

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'LinkedIn API error' };
    }

    return {
      success: true,
      postId: data.id,
      postUrl: `https://linkedin.com/feed/update/${data.id}`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function publishToX(
  accessToken: string,
  text: string
): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  try {
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function publishToBluesky(
  did: string,
  accessJwt: string,
  refreshJwt: string,
  text: string,
  linkUrl?: string
): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  try {
    // Create the post record
    const record: any = {
      $type: 'app.bsky.feed.post',
      text: linkUrl ? `${text}\n\n${linkUrl}` : text,
      createdAt: new Date().toISOString(),
    };

    // Add link card if URL provided
    if (linkUrl) {
      record.facets = [{
        index: {
          byteStart: text.length + 2,
          byteEnd: text.length + 2 + linkUrl.length,
        },
        features: [{
          $type: 'app.bsky.richtext.facet#link',
          uri: linkUrl,
        }],
      }];
    }

    const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessJwt}`,
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

    // Extract handle from DID for URL
    const handle = did.replace('did:plc:', '');
    const rkey = data.uri.split('/').pop();

    return {
      success: true,
      postId: data.uri,
      postUrl: `https://bsky.app/profile/${did}/post/${rkey}`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function publishToInstagram(
  accountId: string,
  accessToken: string,
  caption: string,
  imageUrl?: string
): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  if (!imageUrl) {
    return { success: false, error: 'Instagram requires an image or video' };
  }

  try {
    // Step 1: Create media container
    const containerResponse = await fetch(
      `https://graph.facebook.com/v18.0/${accountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: accessToken,
        }),
      }
    );

    const containerData = await containerResponse.json();

    if (containerData.error) {
      return { success: false, error: containerData.error.message };
    }

    // Step 2: Publish the container
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${accountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: accessToken,
        }),
      }
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
      return { success: false, error: publishData.error.message };
    }

    return {
      success: true,
      postId: publishData.id,
      postUrl: `https://instagram.com/p/${publishData.id}`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function publishToThreads(
  accountId: string,
  accessToken: string,
  text: string,
  mediaUrl?: string
): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  try {
    const body: Record<string, any> = {
      text,
      access_token: accessToken,
      media_type: 'TEXT',
    };

    if (mediaUrl) {
      body.media_type = 'IMAGE';
      body.image_url = mediaUrl;
    }

    // Step 1: Create container
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

    // Step 2: Publish
    const publishResponse = await fetch(
      `https://graph.threads.net/v1.0/${accountId}/threads_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: accessToken,
        }),
      }
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
      return { success: false, error: publishData.error.message };
    }

    return {
      success: true,
      postId: publishData.id,
      postUrl: `https://threads.net/t/${publishData.id}`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// Refresh YouTube access token if expired
async function refreshYouTubeToken(
  refreshToken: string,
  socialAccountId: string,
  supabase: any
): Promise<{ accessToken: string; expiresAt: Date; error?: string } | { accessToken: null; error: string; needsReconnect: boolean }> {
  const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
  const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('YouTube OAuth credentials not configured');
    return { accessToken: null, error: 'YouTube OAuth credentials not configured', needsReconnect: false };
  }

  try {
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
      const errorData = await response.json().catch(() => ({}));
      console.error('YouTube token refresh failed:', errorData);
      
      // Check for invalid_grant error - means refresh token is revoked/expired
      const isTokenRevoked = 
        errorData.error === 'invalid_grant' || 
        errorData.error_description?.includes('Token has been expired or revoked') ||
        errorData.error_description?.includes('Token has been revoked') ||
        response.status === 400 || 
        response.status === 401;
      
      if (isTokenRevoked) {
        console.log('YouTube refresh token is invalid/revoked, marking account for reconnection');
        
        // Update the social account status to needs_refresh
        await supabase
          .from('social_accounts')
          .update({
            status: 'needs_refresh',
            updated_at: new Date().toISOString(),
          })
          .eq('id', socialAccountId);
        
        return { 
          accessToken: null, 
          error: 'Your YouTube connection has expired. Please reconnect your YouTube account in the Channels page.',
          needsReconnect: true 
        };
      }
      
      return { accessToken: null, error: 'Failed to refresh YouTube token', needsReconnect: false };
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

    return {
      accessToken: data.access_token,
      expiresAt,
    };
  } catch (error) {
    console.error('YouTube token refresh error:', error);
    return { accessToken: null, error: 'Network error refreshing YouTube token', needsReconnect: false };
  }
}

async function publishToYouTube(
  accessToken: string,
  refreshToken: string | undefined,
  socialAccountId: string,
  supabase: any,
  description: string,
  videoUrl?: string,
  mediaType?: string
): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  if (!videoUrl) {
    return { success: false, error: 'YouTube requires a video file' };
  }

  if (mediaType !== 'video') {
    return { success: false, error: 'YouTube only supports video content' };
  }

  let currentAccessToken = accessToken;

  // Check if we need to refresh the token
  // Get the token's expiration from the database
  const { data: tokenData } = await supabase
    .from('oauth_tokens')
    .select('expires_at')
    .eq('social_account_id', socialAccountId)
    .single();

  if (tokenData?.expires_at) {
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    // Refresh if token expires within 5 minutes
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt < fiveMinutesFromNow && refreshToken) {
      console.log('YouTube access token expired or expiring soon, refreshing...');
      const refreshed = await refreshYouTubeToken(refreshToken, socialAccountId, supabase);
      
      if (refreshed.accessToken) {
        currentAccessToken = refreshed.accessToken;
        
        // Update the token in the database
        await supabase
          .from('oauth_tokens')
          .update({
            access_token: refreshed.accessToken,
            expires_at: (refreshed as { accessToken: string; expiresAt: Date }).expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('social_account_id', socialAccountId);
        
        console.log('YouTube token refreshed successfully');
      } else {
        console.error('Failed to refresh YouTube token:', refreshed.error);
        return { success: false, error: refreshed.error || 'Failed to refresh YouTube authentication. Please reconnect your YouTube account.' };
      }
    }
  } else if (!refreshToken) {
    // No expiration data and no refresh token - try anyway but warn
    console.log('No token expiration data found, attempting with current token');
  }

  try {
    console.log('Starting YouTube video upload from URL:', videoUrl);

    // Step 1: Fetch the video from the provided URL
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      return { success: false, error: `Failed to fetch video: ${videoResponse.statusText}` };
    }

    const videoBlob = await videoResponse.blob();
    const videoSize = videoBlob.size;
    console.log('Video size:', videoSize, 'bytes');

    // Extract title from description (first line or first 100 chars)
    const lines = description.split('\n');
    const title = lines[0].substring(0, 100) || 'Uploaded via Social Publisher';

    // Step 2: Initialize resumable upload session
    const metadata = {
      snippet: {
        title,
        description,
        categoryId: '22', // People & Blogs category
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
          'Authorization': `Bearer ${currentAccessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': videoSize.toString(),
          'X-Upload-Content-Type': videoBlob.type || 'video/mp4',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initResponse.ok) {
      const errorData = await initResponse.json().catch(() => ({}));
      console.error('YouTube init upload error:', errorData);
      return { 
        success: false, 
        error: errorData.error?.message || `Failed to initialize upload: ${initResponse.statusText}` 
      };
    }

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      return { success: false, error: 'Failed to get upload URL from YouTube' };
    }

    console.log('Got resumable upload URL, uploading video...');

    // Step 3: Upload the video content
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
      console.error('YouTube video upload error:', errorData);
      return { 
        success: false, 
        error: errorData.error?.message || `Failed to upload video: ${uploadResponse.statusText}` 
      };
    }

    const uploadData = await uploadResponse.json();
    console.log('YouTube upload successful:', uploadData.id);

    return {
      success: true,
      postId: uploadData.id,
      postUrl: `https://youtube.com/watch?v=${uploadData.id}`,
    };
  } catch (error: unknown) {
    console.error('YouTube publish error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
