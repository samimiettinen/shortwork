import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  encodeState,
  decodeState,
  generateCodeVerifier,
  codeChallengeS256,
  OAuthState,
} from "../_shared/oauth-state.ts";

const GRAPH_VERSION = 'v25.0';

// Provider configurations
const PROVIDERS = {
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/userinfo.profile'],
    scopeDelimiter: ' ',
    clientKeyParam: 'client_id',
  },
  facebook: {
    authUrl: `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list', 'publish_video', 'business_management'],
    scopeDelimiter: ',',
    clientKeyParam: 'client_id',
  },
  instagram: {
    authUrl: `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement', 'business_management'],
    scopeDelimiter: ',',
    clientKeyParam: 'client_id',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['openid', 'profile', 'w_member_social'],
    scopeDelimiter: ' ',
    clientKeyParam: 'client_id',
  },
  x: {
    authUrl: 'https://x.com/i/oauth2/authorize',
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    // media.write is required for video/image upload via the v2 media endpoints
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
    scopeDelimiter: ' ',
    clientKeyParam: 'client_id',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.publish'],
    // TikTok uses comma-separated scopes and client_key instead of client_id
    scopeDelimiter: ',',
    clientKeyParam: 'client_key',
  },
  threads: {
    authUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    scopes: [
      'threads_basic',
      'threads_content_publish',
      'threads_manage_insights',
      'threads_manage_replies',
      'threads_read_replies'
    ],
    scopeDelimiter: ',',
    clientKeyParam: 'client_id',
  },
};

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

// Verify the caller is the authenticated user and a member of the workspace
async function verifyCaller(
  req: Request,
  supabase: any,
  userId: string,
  workspaceId: string
): Promise<{ ok: boolean; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { ok: false, error: 'Missing authorization header' };

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user || user.id !== userId) {
    return { ok: false, error: 'Invalid authentication' };
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
    return { ok: false, error: 'Not authorized for this workspace' };
  }

  return { ok: true };
}

async function handleConnect(req: Request, provider: string, supabase: any) {
  const body = await req.json();
  const { userId, workspaceId, returnUrl } = body;

  if (!userId || !workspaceId) {
    return new Response(JSON.stringify({ error: 'Missing userId or workspaceId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const caller = await verifyCaller(req, supabase, userId, workspaceId);
  if (!caller.ok) {
    return new Response(JSON.stringify({ error: caller.error }), {
      status: 403,
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

  // PKCE verifier for providers that require it (X)
  let codeVerifier: string | undefined;

  const params = new URLSearchParams({
    [providerConfig.clientKeyParam]: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: providerConfig.scopes.join(providerConfig.scopeDelimiter),
  });

  // Provider-specific parameters
  if (provider === 'youtube') {
    // Required to get a refresh token from Google
    params.set('access_type', 'offline');
    // Force consent screen to always show (ensures we get refresh token even if user already authorized)
    params.set('prompt', 'consent');
  }

  if (provider === 'x') {
    codeVerifier = generateCodeVerifier();
    params.set('code_challenge', await codeChallengeS256(codeVerifier));
    params.set('code_challenge_method', 'S256');
  }

  // Signed state token binds the callback to this user + workspace
  const stateToken = encodeState({
    userId,
    workspaceId,
    provider,
    returnUrl: returnUrl || '/channels',
    codeVerifier,
  });
  params.set('state', stateToken);

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
  const appUrl = Deno.env.get('APP_URL') || 'https://5c813f69-b2a5-4e45-9592-246ab9531464.lovableproject.com';

  console.log('Callback received:', { provider, hasCode: !!code, hasState: !!stateToken, error });

  const state = stateToken ? decodeState(stateToken) : null;

  if (error) {
    const returnUrl = state?.returnUrl || '/channels';
    console.log('OAuth error from provider:', error);
    return Response.redirect(`${appUrl}${returnUrl}?error=${encodeURIComponent(error)}`, 302);
  }

  if (!code || !state || state.provider !== provider) {
    return new Response('Missing or invalid code/state', { status: 400, headers: corsHeaders });
  }

  const providerConfig = PROVIDERS[provider as keyof typeof PROVIDERS];
  const clientId = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${provider.toUpperCase()}_CLIENT_SECRET`);
  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-auth/callback/${provider}`;

  console.log('Token exchange config:', { provider, hasClientId: !!clientId, hasClientSecret: !!clientSecret });

  if (!clientId || !clientSecret) {
    console.error('Missing OAuth credentials for provider:', provider);
    return Response.redirect(`${appUrl}${state.returnUrl}?error=provider_not_configured`, 302);
  }

  try {
    // Exchange code for token
    console.log('Exchanging code for token with:', providerConfig.tokenUrl);

    const tokenParams = new URLSearchParams({
      [providerConfig.clientKeyParam]: clientId,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (provider === 'x') {
      // X: confidential clients authenticate with HTTP basic auth; PKCE verifier required
      tokenHeaders['Authorization'] = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
      if (state.codeVerifier) tokenParams.set('code_verifier', state.codeVerifier);
    } else {
      tokenParams.set('client_secret', clientSecret);
    }

    const tokenResponse = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: tokenHeaders,
      body: tokenParams,
    });

    let tokenData = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status, 'hasAccessToken:', !!tokenData.access_token);

    if (tokenData.error || !tokenData.access_token) {
      console.error('Token error:', tokenData);
      const description = tokenData.error_description || tokenData.error?.message || tokenData.error || 'token_exchange_failed';
      return Response.redirect(`${appUrl}${state.returnUrl}?error=${encodeURIComponent(String(description))}`, 302);
    }

    // Threads issues a short-lived (1h) token; exchange it for a 60-day token
    if (provider === 'threads') {
      const llResponse = await fetch(
        `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${clientSecret}&access_token=${tokenData.access_token}`
      );
      const llData = await llResponse.json();
      if (llData.access_token) {
        tokenData = { ...tokenData, access_token: llData.access_token, expires_in: llData.expires_in };
      } else {
        console.error('Threads long-lived token exchange failed:', llData);
      }
    }

    // Facebook/Instagram connect at the Page level: exchange for a long-lived
    // user token, then enumerate managed Pages (and their IG business accounts)
    if (provider === 'facebook' || provider === 'instagram') {
      return await handleMetaCallback(provider, tokenData.access_token, clientId, clientSecret, state, supabase, appUrl);
    }

    // Get user profile based on provider
    const accountData = await getProviderAccountData(provider, tokenData);
    console.log('Account data retrieved:', { provider, displayName: accountData.displayName });

    const saved = await saveAccountWithToken(supabase, state.workspaceId, provider, accountData, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: providerConfig.scopes.join(providerConfig.scopeDelimiter),
    });

    if (!saved.ok) {
      return Response.redirect(`${appUrl}${state.returnUrl}?error=database_error`, 302);
    }

    // Redirect back to app
    return Response.redirect(`${appUrl}${state.returnUrl}?connected=${provider}`, 302);
  } catch (err) {
    console.error('Callback error:', err);
    return Response.redirect(`${appUrl}${state.returnUrl}?error=callback_failed`, 302);
  }
}

interface AccountData {
  providerAccountId: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  accountType: 'personal' | 'page' | 'business' | 'creator';
}

async function saveAccountWithToken(
  supabase: any,
  workspaceId: string,
  platform: string,
  accountData: AccountData,
  token: { accessToken: string; refreshToken?: string; expiresIn?: number; scope?: string }
): Promise<{ ok: boolean; accountId?: string }> {
  const { data: account, error: dbError } = await supabase
    .from('social_accounts')
    .upsert({
      workspace_id: workspaceId,
      platform,
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
    return { ok: false };
  }

  const { encryptToken } = await import("../_shared/token-crypto.ts");
  const { error: tokenError } = await supabase
    .from('oauth_tokens')
    .upsert({
      social_account_id: account.id,
      access_token: await encryptToken(token.accessToken),
      refresh_token: token.refreshToken ? await encryptToken(token.refreshToken) : null,
      expires_at: token.expiresIn
        ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
        : null,
      scope: token.scope,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'social_account_id',
    });

  if (tokenError) {
    console.error('Token storage error:', tokenError);
    return { ok: false };
  }

  return { ok: true, accountId: account.id };
}

// Facebook/Instagram: publishing requires PAGE access tokens (Facebook) or the
// Instagram professional account id + page token (Instagram). Store one
// social_account per Page / IG account, each with its own page token.
async function handleMetaCallback(
  provider: 'facebook' | 'instagram',
  userToken: string,
  clientId: string,
  clientSecret: string,
  state: OAuthState,
  supabase: any,
  appUrl: string
) {
  // 1. Exchange for a long-lived user token (~60 days); page tokens derived
  //    from it do not expire.
  const llResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${userToken}`
  );
  const llData = await llResponse.json();
  const longLivedToken = llData.access_token || userToken;
  if (!llData.access_token) {
    console.error('Long-lived token exchange failed:', llData);
  }

  // 2. Enumerate managed pages with their tokens and linked IG accounts
  const pagesResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}&limit=100&access_token=${longLivedToken}`
  );
  const pagesData = await pagesResponse.json();

  if (pagesData.error) {
    console.error('Pages fetch error:', pagesData.error);
    return Response.redirect(`${appUrl}${state.returnUrl}?error=${encodeURIComponent(pagesData.error.message)}`, 302);
  }

  const pages: any[] = pagesData.data || [];
  if (pages.length === 0) {
    return Response.redirect(`${appUrl}${state.returnUrl}?error=${encodeURIComponent('No Facebook Pages found. Publishing requires a Facebook Page (Instagram requires an Instagram professional account linked to a Page).')}`, 302);
  }

  let savedCount = 0;

  for (const page of pages) {
    if (!page.access_token) continue;

    if (provider === 'facebook') {
      const saved = await saveAccountWithToken(supabase, state.workspaceId, 'facebook', {
        providerAccountId: page.id,
        displayName: page.name,
        avatarUrl: page.picture?.data?.url,
        accountType: 'page',
      }, {
        accessToken: page.access_token,
        scope: 'pages_manage_posts,publish_video',
      });
      if (saved.ok) savedCount++;
    } else {
      const ig = page.instagram_business_account;
      if (!ig?.id) continue;
      // Instagram publishing endpoints are called with the (long-lived) USER
      // token; it lasts ~60 days and cannot be refreshed programmatically —
      // the account is flagged needs_refresh when it expires.
      const saved = await saveAccountWithToken(supabase, state.workspaceId, 'instagram', {
        providerAccountId: ig.id,
        displayName: ig.name || ig.username || page.name,
        handle: ig.username ? `@${ig.username}` : undefined,
        avatarUrl: ig.profile_picture_url,
        accountType: 'business',
      }, {
        accessToken: longLivedToken,
        expiresIn: llData.expires_in || 5184000,
        scope: 'instagram_content_publish',
      });
      if (saved.ok) savedCount++;
    }
  }

  if (savedCount === 0) {
    const reason = provider === 'instagram'
      ? 'No Instagram professional account linked to your Facebook Pages. Link one in Meta Business settings and try again.'
      : 'Could not retrieve Page access tokens.';
    return Response.redirect(`${appUrl}${state.returnUrl}?error=${encodeURIComponent(reason)}`, 302);
  }

  return Response.redirect(`${appUrl}${state.returnUrl}?connected=${provider}`, 302);
}

async function getProviderAccountData(provider: string, tokenData: any): Promise<AccountData> {
  const accessToken = tokenData.access_token;

  switch (provider) {
    case 'youtube': {
      // Get user profile
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await userResponse.json();

      // Get YouTube channel info
      const channelResponse = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const channelData = await channelResponse.json();
      const channel = channelData.items?.[0];

      return {
        providerAccountId: channel?.id || userData.id,
        displayName: channel?.snippet?.title || userData.name,
        handle: channel ? `@${channel.snippet.customUrl?.replace('@', '') || channel.id}` : undefined,
        avatarUrl: channel?.snippet?.thumbnails?.default?.url || userData.picture,
        accountType: 'creator' as const,
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
      const response = await fetch('https://api.x.com/2/users/me', {
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
    case 'threads': {
      // Get Threads user profile
      const response = await fetch(
        `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${accessToken}`
      );
      const data = await response.json();
      console.log('Threads user data:', data);
      return {
        providerAccountId: data.id,
        displayName: data.name || data.username,
        handle: `@${data.username}`,
        avatarUrl: data.threads_profile_picture_url,
        accountType: 'personal' as const,
      };
    }
    case 'tiktok': {
      // TikTok user info endpoint
      const response = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await response.json();
      console.log('TikTok user data:', data);
      return {
        providerAccountId: data.data?.user?.open_id || tokenData.open_id,
        displayName: data.data?.user?.display_name || 'TikTok User',
        handle: data.data?.user?.username ? `@${data.data.user.username}` : undefined,
        avatarUrl: data.data?.user?.avatar_url,
        accountType: 'creator' as const,
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

  const caller = await verifyCaller(req, supabase, userId, workspaceId);
  if (!caller.ok) {
    return new Response(JSON.stringify({ error: caller.error }), {
      status: 403,
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

    const saved = await saveAccountWithToken(supabase, workspaceId, 'bluesky', {
      providerAccountId: sessionData.did,
      displayName: sessionData.handle,
      handle: `@${sessionData.handle}`,
      accountType: 'personal',
    }, {
      accessToken: sessionData.accessJwt,
      refreshToken: sessionData.refreshJwt,
      // Bluesky access JWTs are short-lived; publishers refresh via refreshSession
      expiresIn: 60 * 60,
    });

    if (!saved.ok) {
      return new Response(JSON.stringify({ error: 'Failed to save account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      account: {
        id: saved.accountId,
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
  const { accountId, workspaceId, userId } = body;

  if (!accountId || !workspaceId) {
    return new Response(JSON.stringify({ error: 'Missing accountId or workspaceId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Only authenticated workspace owners/admins/editors may disconnect
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const caller = await verifyCaller(req, supabase, userId || user.id, workspaceId);
  if (!caller.ok) {
    return new Response(JSON.stringify({ error: caller.error }), {
      status: 403,
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
