import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ThreadsInsight {
  name: string;
  period: string;
  values: { value: number }[];
  title: string;
  description: string;
  id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { accountId, metric } = await req.json();

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

    // Get user insights
    const userInsightsUrl = `https://graph.threads.net/v1.0/me/threads_insights?metric=views,likes,replies,reposts,quotes,followers_count&access_token=${accessToken}`;
    
    console.log('Fetching user insights...');
    const userInsightsResponse = await fetch(userInsightsUrl);
    const userInsightsData = await userInsightsResponse.json();
    
    if (userInsightsData.error) {
      console.error('Threads API error:', userInsightsData.error);
      return new Response(JSON.stringify({ 
        error: userInsightsData.error.message || 'Failed to fetch insights',
        code: userInsightsData.error.code
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get recent media posts
    const mediaUrl = `https://graph.threads.net/v1.0/me/threads?fields=id,text,timestamp,permalink,like_count,reply_count,repost_count,quote_count&limit=10&access_token=${accessToken}`;
    
    console.log('Fetching recent posts...');
    const mediaResponse = await fetch(mediaUrl);
    const mediaData = await mediaResponse.json();

    // Format the response
    const insights = {
      userMetrics: formatUserInsights(userInsightsData.data || []),
      recentPosts: mediaData.data || [],
      fetchedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(insights), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Threads insights error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatUserInsights(data: ThreadsInsight[]) {
  const metrics: Record<string, number> = {};
  
  for (const insight of data) {
    if (insight.values && insight.values.length > 0) {
      metrics[insight.name] = insight.values[0].value;
    }
  }

  return {
    views: metrics.views || 0,
    likes: metrics.likes || 0,
    replies: metrics.replies || 0,
    reposts: metrics.reposts || 0,
    quotes: metrics.quotes || 0,
    followers: metrics.followers_count || 0,
  };
}
