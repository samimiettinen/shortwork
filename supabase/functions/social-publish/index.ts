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
  hasMedia: boolean
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
        !!mediaUrl
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
            accessToken: token.access_token,
            refreshToken: token.refresh_token || undefined,
            content,
            linkUrl,
            mediaUrl,
            mediaType,
          }
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
    accessToken: string;
    refreshToken?: string;
    content: string;
    linkUrl?: string;
    mediaUrl?: string;
    mediaType?: string;
  }
): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  const { accountId, accessToken, content, linkUrl, mediaUrl } = options;

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
