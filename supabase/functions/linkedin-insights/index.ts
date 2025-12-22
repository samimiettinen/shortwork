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

    // Get user profile info
    console.log('Fetching LinkedIn user info...');
    const userUrl = 'https://api.linkedin.com/v2/userinfo';
    const userResponse = await fetch(userUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    const userData = await userResponse.json();
    
    if (userData.error) {
      console.error('LinkedIn API error:', userData);
      return new Response(JSON.stringify({ 
        error: userData.error_description || 'Failed to fetch user info',
        code: userData.error
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's posts (shares)
    console.log('Fetching LinkedIn posts...');
    const postsUrl = `https://api.linkedin.com/v2/shares?q=owners&owners=urn:li:person:${userData.sub}&count=10`;
    const postsResponse = await fetch(postsUrl, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    
    let postsData = { elements: [] };
    if (postsResponse.ok) {
      postsData = await postsResponse.json();
    } else {
      console.log('Could not fetch posts, may need additional permissions');
    }

    // Get social actions (likes, comments) for posts
    const postsWithEngagement = await Promise.all(
      (postsData.elements || []).slice(0, 5).map(async (post: any) => {
        const shareUrn = post.activity || `urn:li:share:${post.id}`;
        
        // Try to get social actions
        let likes = 0;
        let comments = 0;
        
        try {
          const likesUrl = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(shareUrn)}/likes?count=0`;
          const likesResponse = await fetch(likesUrl, {
            headers: { 
              'Authorization': `Bearer ${accessToken}`,
              'X-Restli-Protocol-Version': '2.0.0',
            },
          });
          if (likesResponse.ok) {
            const likesData = await likesResponse.json();
            likes = likesData.paging?.total || 0;
          }
        } catch (e) {
          console.log('Could not fetch likes for post');
        }

        try {
          const commentsUrl = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(shareUrn)}/comments?count=0`;
          const commentsResponse = await fetch(commentsUrl, {
            headers: { 
              'Authorization': `Bearer ${accessToken}`,
              'X-Restli-Protocol-Version': '2.0.0',
            },
          });
          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            comments = commentsData.paging?.total || 0;
          }
        } catch (e) {
          console.log('Could not fetch comments for post');
        }

        return {
          id: post.id,
          text: post.text?.text || post.commentary || '',
          createdAt: post.created?.time ? new Date(post.created.time).toISOString() : new Date().toISOString(),
          likes,
          comments,
        };
      })
    );

    const insights = {
      profile: {
        id: userData.sub,
        name: userData.name,
        email: userData.email,
        picture: userData.picture,
      },
      metrics: {
        totalPosts: postsData.elements?.length || 0,
        totalLikes: postsWithEngagement.reduce((sum, p) => sum + p.likes, 0),
        totalComments: postsWithEngagement.reduce((sum, p) => sum + p.comments, 0),
      },
      recentPosts: postsWithEngagement,
      fetchedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(insights), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('LinkedIn insights error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
