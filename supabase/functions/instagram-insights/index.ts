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

    // Get Instagram Business Account ID
    const accountsUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=instagram_business_account&access_token=${accessToken}`;
    console.log('Fetching Instagram business accounts...');
    
    const accountsResponse = await fetch(accountsUrl);
    const accountsData = await accountsResponse.json();
    
    if (accountsData.error) {
      console.error('Facebook API error:', accountsData.error);
      return new Response(JSON.stringify({ 
        error: accountsData.error.message || 'Failed to fetch accounts',
        code: accountsData.error.code
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const igAccount = accountsData.data?.find((page: any) => page.instagram_business_account);
    
    if (!igAccount?.instagram_business_account?.id) {
      return new Response(JSON.stringify({ 
        error: 'No Instagram Business account found',
        message: 'Please ensure you have connected an Instagram Business or Creator account'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const igAccountId = igAccount.instagram_business_account.id;

    // Get account info
    const profileUrl = `https://graph.facebook.com/v18.0/${igAccountId}?fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count&access_token=${accessToken}`;
    const profileResponse = await fetch(profileUrl);
    const profileData = await profileResponse.json();

    // Get account insights (last 30 days)
    const insightsUrl = `https://graph.facebook.com/v18.0/${igAccountId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${accessToken}`;
    console.log('Fetching Instagram insights...');
    
    const insightsResponse = await fetch(insightsUrl);
    const insightsData = await insightsResponse.json();

    // Get recent media
    const mediaUrl = `https://graph.facebook.com/v18.0/${igAccountId}/media?fields=id,caption,media_type,permalink,thumbnail_url,timestamp,like_count,comments_count&limit=10&access_token=${accessToken}`;
    console.log('Fetching recent media...');
    
    const mediaResponse = await fetch(mediaUrl);
    const mediaData = await mediaResponse.json();

    // Format insights
    const formattedInsights = formatInsights(insightsData.data || []);

    const insights = {
      profile: {
        username: profileData.username,
        name: profileData.name,
        profilePicture: profileData.profile_picture_url,
        followersCount: profileData.followers_count || 0,
        followsCount: profileData.follows_count || 0,
        mediaCount: profileData.media_count || 0,
      },
      metrics: formattedInsights,
      recentMedia: mediaData.data || [],
      fetchedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(insights), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Instagram insights error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatInsights(data: any[]) {
  const metrics: Record<string, number> = {
    impressions: 0,
    reach: 0,
    profileViews: 0,
  };

  for (const insight of data) {
    if (insight.values && insight.values.length > 0) {
      // Sum up the last 7 days of data
      const total = insight.values.slice(-7).reduce((sum: number, v: any) => sum + (v.value || 0), 0);
      
      switch (insight.name) {
        case 'impressions':
          metrics.impressions = total;
          break;
        case 'reach':
          metrics.reach = total;
          break;
        case 'profile_views':
          metrics.profileViews = total;
          break;
      }
    }
  }

  return metrics;
}
