import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get the authorization header to verify the requesting user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's token to verify they are an admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is an app admin using the database function
    const { data: isAdmin, error: adminCheckError } = await userClient.rpc('is_app_admin', { 
      _user_id: user.id 
    });
    
    if (adminCheckError || !isAdmin) {
      console.error('Admin check failed:', adminCheckError);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { action, targetId } = await req.json();
    console.log(`Admin action: ${action} on target: ${targetId} by user: ${user.id}`);

    // Create admin client with service role for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'delete_user') {
      // Delete user from auth (this will cascade to profiles due to trigger/FK)
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetId);
      
      if (deleteError) {
        console.error('Error deleting user:', deleteError);
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Successfully deleted user: ${targetId}`);
      return new Response(JSON.stringify({ success: true, message: 'User deleted successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } 
    
    if (action === 'delete_workspace') {
      // Delete workspace and all related data (cascades handle most)
      const { error: deleteError } = await adminClient
        .from('workspaces')
        .delete()
        .eq('id', targetId);
      
      if (deleteError) {
        console.error('Error deleting workspace:', deleteError);
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Successfully deleted workspace: ${targetId}`);
      return new Response(JSON.stringify({ success: true, message: 'Workspace deleted successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Admin delete error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
