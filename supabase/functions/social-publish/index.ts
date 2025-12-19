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

    // Get auth header to verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: PublishRequest = await req.json();
    const { workspaceId, content, linkUrl, mediaUrl, mediaType, targetAccountIds } = body;

    if (!workspaceId || !content || !targetAccountIds?.length) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      return new Response(JSON.stringify({ error: 'No valid accounts found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Publish to each platform
    const results: PublishResult[] = [];

    for (const account of accounts) {
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
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
