import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Provider configurations
const PROVIDERS = {
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
  },
  instagram: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement'],
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['openid', 'profile', 'w_member_social'],
  },
  x: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.publish'],
  },
  threads: {
    authUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    scopes: ['threads_basic', 'threads_content_publish'],
  },
};

interface OAuthState {
  userId: string;
  workspaceId: string;
  provider: string;
  returnUrl: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Expected paths: /social-auth/connect/:provider or /social-auth/callback/:provider
  const action = pathParts[1]; // 'connect' or 'callback'
  const provider = pathParts[2];

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'connect') {
      return await handleConnect(req, provider, supabase);
    } else if (action === 'callback') {
      return await handleCallback(req, provider, supabase);
    } else if (action === 'bluesky-auth') {
      return await handleBlueskyAuth(req, supabase);
    } else if (action === 'disconnect') {
      return await handleDisconnect(req, provider, supabase);
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: unknown) {
    console.error('Social auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleConnect(req: Request, provider: string, supabase: any) {
  const body = await req.json();
  const { userId, workspaceId, returnUrl } = body;

  if (!userId || !workspaceId) {
    return new Response(JSON.stringify({ error: 'Missing userId or workspaceId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const providerConfig = PROVIDERS[provider as keyof typeof PROVIDERS];
  if (!providerConfig) {
    return new Response(JSON.stringify({ error: `Unsupported provider: ${provider}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create state token for security
  const state: OAuthState = { userId, workspaceId, provider, returnUrl: returnUrl || '/channels' };
  const stateToken = btoa(JSON.stringify(state));

  // Get environment variables for this provider
  const clientId = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`);
  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-auth/callback/${provider}`;

  if (!clientId) {
    return new Response(JSON.stringify({ 
      error: `${provider} integration not configured`,
      message: `Please configure ${provider.toUpperCase()}_CLIENT_ID in your environment variables`
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: providerConfig.scopes.join(' '),
    state: stateToken,
  });

  // Provider-specific parameters
  if (provider === 'x') {
    params.set('code_challenge', 'challenge');
    params.set('code_challenge_method', 'plain');
  }

  const authUrl = `${providerConfig.authUrl}?${params.toString()}`;

  return new Response(JSON.stringify({ authUrl }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCallback(req: Request, provider: string, supabase: any) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateToken = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    const returnUrl = stateToken ? JSON.parse(atob(stateToken)).returnUrl : '/channels';
    return Response.redirect(`${returnUrl}?error=${encodeURIComponent(error)}`, 302);
  }

  if (!code || !stateToken) {
    return new Response('Missing code or state', { status: 400, headers: corsHeaders });
  }

  let state: OAuthState;
  try {
    state = JSON.parse(atob(stateToken));
  } catch {
    return new Response('Invalid state', { status: 400, headers: corsHeaders });
  }

  const providerConfig = PROVIDERS[provider as keyof typeof PROVIDERS];
  const clientId = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${provider.toUpperCase()}_CLIENT_SECRET`);
  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-auth/callback/${provider}`;

  if (!clientId || !clientSecret) {
    return Response.redirect(`${state.returnUrl}?error=provider_not_configured`, 302);
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token error:', tokenData);
      return Response.redirect(`${state.returnUrl}?error=${encodeURIComponent(tokenData.error)}`, 302);
    }

    // Get user profile based on provider
    const accountData = await getProviderAccountData(provider, tokenData);

    // Save to database
    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        workspace_id: state.workspaceId,
        platform: provider,
        platform_user_id: accountData.providerAccountId,
        display_name: accountData.displayName,
        handle: accountData.handle,
        avatar_url: accountData.avatarUrl,
        account_type: accountData.accountType,
        autopublish_capable: true,
        status: 'connected',
        last_connected_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id,platform,platform_user_id',
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      return Response.redirect(`${state.returnUrl}?error=database_error`, 302);
    }

    // Store tokens separately (more secure)
    // In production, encrypt these tokens
    const { error: tokenError } = await supabase
      .from('oauth_tokens')
      .upsert({
        social_account_id: dbError ? null : undefined, // Handle if we have the account ID
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_in 
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() 
          : null,
        scope: providerConfig.scopes.join(' '),
      });

    // Redirect back to app
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173';
    return Response.redirect(`${appUrl}${state.returnUrl}?connected=${provider}`, 302);
  } catch (err) {
    console.error('Callback error:', err);
    return Response.redirect(`${state.returnUrl}?error=callback_failed`, 302);
  }
}

async function getProviderAccountData(provider: string, tokenData: any) {
  const accessToken = tokenData.access_token;

  switch (provider) {
    case 'facebook':
    case 'instagram': {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me?fields=id,name,picture&access_token=${accessToken}`
      );
      const data = await response.json();
      return {
        providerAccountId: data.id,
        displayName: data.name,
        avatarUrl: data.picture?.data?.url,
        accountType: 'page' as const,
      };
    }
    case 'linkedin': {
      const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      return {
        providerAccountId: data.sub,
        displayName: data.name,
        avatarUrl: data.picture,
        accountType: 'personal' as const,
      };
    }
    case 'x': {
      const response = await fetch('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      return {
        providerAccountId: data.data.id,
        displayName: data.data.name,
        handle: `@${data.data.username}`,
        accountType: 'personal' as const,
      };
    }
    default:
      return {
        providerAccountId: 'unknown',
        displayName: 'Unknown Account',
        accountType: 'personal' as const,
      };
  }
}

async function handleBlueskyAuth(req: Request, supabase: any) {
  const body = await req.json();
  const { identifier, appPassword, userId, workspaceId } = body;

  if (!identifier || !appPassword || !userId || !workspaceId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Create session with Bluesky
    const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: appPassword }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return new Response(JSON.stringify({ 
        error: 'Authentication failed',
        message: errorData.message || 'Invalid credentials'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionData = await response.json();

    // Save to database
    const { data: account, error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        workspace_id: workspaceId,
        platform: 'bluesky',
        platform_user_id: sessionData.did,
        display_name: sessionData.handle,
        handle: `@${sessionData.handle}`,
        account_type: 'personal',
        autopublish_capable: true,
        status: 'connected',
        last_connected_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id,platform,platform_user_id',
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      return new Response(JSON.stringify({ error: 'Failed to save account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store tokens
    await supabase.from('oauth_tokens').upsert({
      social_account_id: account.id,
      access_token: sessionData.accessJwt,
      refresh_token: sessionData.refreshJwt,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      account: {
        id: account.id,
        displayName: sessionData.handle,
        handle: `@${sessionData.handle}`,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Bluesky auth error:', error);
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleDisconnect(req: Request, provider: string, supabase: any) {
  const body = await req.json();
  const { accountId, workspaceId } = body;

  if (!accountId || !workspaceId) {
    return new Response(JSON.stringify({ error: 'Missing accountId or workspaceId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Delete the social account (cascades to tokens)
    const { error } = await supabase
      .from('social_accounts')
      .delete()
      .eq('id', accountId)
      .eq('workspace_id', workspaceId);

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to disconnect account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    return new Response(JSON.stringify({ error: 'Failed to disconnect' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
