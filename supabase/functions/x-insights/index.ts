import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { ensureFreshToken } from "../_shared/publishers.ts";
import { decryptToken } from "../_shared/token-crypto.ts";



Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { accountId } = await req.json();
    if (!accountId) {
      return new Response(JSON.stringify({ error: 'Missing accountId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: tokenData } = await supabase
      .from('oauth_tokens')
      .select('access_token, refresh_token, expires_at, social_account_id')
      .eq('social_account_id', accountId)
      .maybeSingle();

    if (!tokenData) {
      return new Response(JSON.stringify({ error: 'Account not found or not connected' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh X access token if it's within 5 min of expiring (X access = 2h)
    const fresh = await ensureFreshToken('x', {
      accountId: '', socialAccountId: accountId, content: '',
      accessToken: await decryptToken(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? await decryptToken(tokenData.refresh_token) : undefined,
      tokenExpiresAt: tokenData.expires_at,
    }, supabase);

    if (fresh.needsReconnect) {
      return new Response(JSON.stringify({ error: fresh.error, needsReconnect: true }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const accessToken = fresh.accessToken;

    const userUrl = 'https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url,description,created_at';
    const userResponse = await fetch(userUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const userData = await userResponse.json();

    if (userData.errors) {
      console.error('X API error:', userData.errors);
      return new Response(JSON.stringify({ error: userData.errors[0]?.message || 'Failed to fetch user info' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = userData.data;
    const publicMetrics = user.public_metrics || {};

    const tweetsUrl = `https://api.twitter.com/2/users/${user.id}/tweets?max_results=10&tweet.fields=public_metrics,created_at`;
    const tweetsResponse = await fetch(tweetsUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const tweetsData = await tweetsResponse.json();

    const recentTweets = (tweetsData.data || []).map((tweet: any) => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      replies: tweet.public_metrics?.reply_count || 0,
      impressions: tweet.public_metrics?.impression_count || 0,
      quotes: tweet.public_metrics?.quote_count || 0,
    }));

    return new Response(JSON.stringify({
      profile: {
        id: user.id,
        name: user.name,
        username: user.username,
        profileImage: user.profile_image_url,
        description: user.description,
      },
      metrics: {
        followers: publicMetrics.followers_count || 0,
        following: publicMetrics.following_count || 0,
        tweets: publicMetrics.tweet_count || 0,
        listed: publicMetrics.listed_count || 0,
      },
      recentTweets,
      fetchedAt: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('X insights error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
