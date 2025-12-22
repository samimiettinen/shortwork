import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { accountId } = await req.json();

    if (!accountId) {
      return new Response(JSON.stringify({ error: 'Missing accountId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the OAuth token for this account
    const { data: tokenData, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('social_account_id', accountId)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('Token fetch error:', tokenError);
      return new Response(JSON.stringify({ error: 'Account not found or not connected' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = tokenData.access_token;

    // Get user info
    console.log('Fetching X user info...');
    const userUrl = 'https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url,description,created_at';
    const userResponse = await fetch(userUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    const userData = await userResponse.json();
    
    if (userData.errors) {
      console.error('X API error:', userData.errors);
      return new Response(JSON.stringify({ 
        error: userData.errors[0]?.message || 'Failed to fetch user info',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = userData.data;
    const publicMetrics = user.public_metrics || {};

    // Get recent tweets
    console.log('Fetching recent tweets...');
    const tweetsUrl = `https://api.twitter.com/2/users/${user.id}/tweets?max_results=10&tweet.fields=public_metrics,created_at`;
    const tweetsResponse = await fetch(tweetsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
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

    const insights = {
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
    };

    return new Response(JSON.stringify(insights), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('X insights error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
