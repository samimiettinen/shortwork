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

    // Get the most recent OAuth token for this account
    const { data: tokenData, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('social_account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('Token fetch error:', tokenError);
      return new Response(JSON.stringify({ error: 'Account not found or not connected' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = tokenData.access_token;

    // Get channel info
    console.log('Fetching YouTube channel info...');
    const channelUrl = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true';
    const channelResponse = await fetch(channelUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    const channelData = await channelResponse.json();
    
    if (channelData.error) {
      console.error('YouTube API error:', channelData.error);
      return new Response(JSON.stringify({ 
        error: channelData.error.message || 'Failed to fetch channel info',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const channel = channelData.items?.[0];
    if (!channel) {
      return new Response(JSON.stringify({ 
        error: 'No YouTube channel found',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stats = channel.statistics || {};

    // Get recent videos
    console.log('Fetching recent videos...');
    const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&maxResults=10&order=date`;
    const videosResponse = await fetch(videosUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    const videosData = await videosResponse.json();
    const videoIds = (videosData.items || []).map((v: any) => v.id.videoId).filter(Boolean);

    // Get video statistics
    let videosWithStats: any[] = [];
    if (videoIds.length > 0) {
      const videoStatsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}`;
      const videoStatsResponse = await fetch(videoStatsUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const videoStatsData = await videoStatsResponse.json();
      
      videosWithStats = (videoStatsData.items || []).map((video: any) => ({
        id: video.id,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
        publishedAt: video.snippet.publishedAt,
        views: parseInt(video.statistics?.viewCount || '0'),
        likes: parseInt(video.statistics?.likeCount || '0'),
        comments: parseInt(video.statistics?.commentCount || '0'),
      }));
    }

    const insights = {
      channel: {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnail: channel.snippet.thumbnails?.medium?.url || channel.snippet.thumbnails?.default?.url,
        customUrl: channel.snippet.customUrl,
      },
      metrics: {
        subscribers: parseInt(stats.subscriberCount || '0'),
        totalViews: parseInt(stats.viewCount || '0'),
        videoCount: parseInt(stats.videoCount || '0'),
      },
      recentVideos: videosWithStats,
      fetchedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(insights), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('YouTube insights error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
