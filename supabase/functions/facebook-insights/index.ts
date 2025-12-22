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

    // Get Facebook Pages
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,picture,fan_count,access_token&access_token=${accessToken}`;
    console.log('Fetching Facebook pages...');
    
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();
    
    if (pagesData.error) {
      console.error('Facebook API error:', pagesData.error);
      return new Response(JSON.stringify({ 
        error: pagesData.error.message || 'Failed to fetch pages',
        code: pagesData.error.code
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pagesData.data || pagesData.data.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No Facebook Pages found',
        message: 'Please ensure you have connected a Facebook Page'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use the first page (or could let user select)
    const page = pagesData.data[0];
    const pageAccessToken = page.access_token;

    // Get page insights
    const insightsUrl = `https://graph.facebook.com/v18.0/${page.id}/insights?metric=page_impressions,page_engaged_users,page_post_engagements,page_fans&period=day&access_token=${pageAccessToken}`;
    console.log('Fetching page insights...');
    
    const insightsResponse = await fetch(insightsUrl);
    const insightsData = await insightsResponse.json();

    // Get recent posts
    const postsUrl = `https://graph.facebook.com/v18.0/${page.id}/posts?fields=id,message,created_time,permalink_url,shares,likes.summary(true),comments.summary(true)&limit=10&access_token=${pageAccessToken}`;
    console.log('Fetching recent posts...');
    
    const postsResponse = await fetch(postsUrl);
    const postsData = await postsResponse.json();

    // Format insights
    const formattedInsights = formatPageInsights(insightsData.data || []);

    const insights = {
      page: {
        id: page.id,
        name: page.name,
        picture: page.picture?.data?.url,
        fanCount: page.fan_count || 0,
      },
      metrics: formattedInsights,
      recentPosts: (postsData.data || []).map((post: any) => ({
        id: post.id,
        message: post.message,
        createdTime: post.created_time,
        permalink: post.permalink_url,
        shares: post.shares?.count || 0,
        likes: post.likes?.summary?.total_count || 0,
        comments: post.comments?.summary?.total_count || 0,
      })),
      fetchedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(insights), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Facebook insights error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatPageInsights(data: any[]) {
  const metrics: Record<string, number> = {
    impressions: 0,
    engagedUsers: 0,
    postEngagements: 0,
    fans: 0,
  };

  for (const insight of data) {
    if (insight.values && insight.values.length > 0) {
      // Sum up the last 7 days of data
      const total = insight.values.slice(-7).reduce((sum: number, v: any) => sum + (v.value || 0), 0);
      
      switch (insight.name) {
        case 'page_impressions':
          metrics.impressions = total;
          break;
        case 'page_engaged_users':
          metrics.engagedUsers = total;
          break;
        case 'page_post_engagements':
          metrics.postEngagements = total;
          break;
        case 'page_fans':
          // page_fans is a lifetime metric, take the latest value
          metrics.fans = insight.values[insight.values.length - 1]?.value || 0;
          break;
      }
    }
  }

  return metrics;
}
