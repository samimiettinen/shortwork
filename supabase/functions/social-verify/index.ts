import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { GRAPH_VERSION } from "../_shared/social-providers.ts";
import { decryptToken, ensureFreshToken } from "../_shared/publishers.ts";

interface VerifyRequest {
  workspaceId: string;
  accountId?: string;
  platform?: string;
}

interface VerifyResult {
  accountId: string;
  platform: string;
  ok: boolean;
  displayName?: string;
  handle?: string;
  extra?: Record<string, unknown>;
  error?: string;
  needsReconnect?: boolean;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as VerifyRequest;
    const { workspaceId, accountId, platform } = body;
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "Missing workspaceId" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a workspace member" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let query = supabase
      .from("social_accounts")
      .select("id, platform, platform_user_id, display_name, handle, status")
      .eq("workspace_id", workspaceId);

    if (accountId) query = query.eq("id", accountId);
    if (platform) query = query.eq("platform", platform);

    const { data: accounts, error: accountsError } = await query;
    if (accountsError) throw accountsError;
    if (!accounts?.length) {
      return new Response(JSON.stringify({ error: "No matching accounts" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const results: VerifyResult[] = [];
    for (const account of accounts) {
      results.push(await verifyAccount(supabase, account));
    }

    const ok = results.every((r) => r.ok);
    return new Response(JSON.stringify({ ok, results }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("social-verify error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

async function verifyAccount(supabase: any, account: {
  id: string;
  platform: string;
  platform_user_id: string;
  display_name: string;
  handle: string | null;
  status: string;
}): Promise<VerifyResult> {
  const { data: tokenRow } = await supabase
    .from("oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("social_account_id", account.id)
    .maybeSingle();

  if (!tokenRow?.access_token) {
    return {
      accountId: account.id,
      platform: account.platform,
      ok: false,
      error: "No stored token",
      needsReconnect: true,
    };
  }

  const accessToken = await decryptToken(tokenRow.access_token);
  const refreshToken = tokenRow.refresh_token
    ? await decryptToken(tokenRow.refresh_token)
    : undefined;

  const fresh = await ensureFreshToken(account.platform, {
    accountId: account.platform_user_id,
    socialAccountId: account.id,
    accessToken,
    refreshToken,
    tokenExpiresAt: tokenRow.expires_at,
    content: "",
  }, supabase);

  if (fresh.error || fresh.needsReconnect) {
    return {
      accountId: account.id,
      platform: account.platform,
      ok: false,
      error: fresh.error || "Token refresh failed",
      needsReconnect: fresh.needsReconnect,
    };
  }

  try {
    const profile = await fetchProviderProfile(
      account.platform,
      account.platform_user_id,
      fresh.accessToken,
    );
    return {
      accountId: account.id,
      platform: account.platform,
      ok: true,
      displayName: profile.displayName || account.display_name,
      handle: profile.handle || account.handle || undefined,
      extra: profile.extra,
    };
  } catch (error) {
    return {
      accountId: account.id,
      platform: account.platform,
      ok: false,
      error: error instanceof Error ? error.message : "Profile lookup failed",
    };
  }
}

async function fetchProviderProfile(
  platform: string,
  platformUserId: string,
  accessToken: string,
): Promise<{ displayName?: string; handle?: string; extra?: Record<string, unknown> }> {
  switch (platform) {
    case "youtube": {
      const response = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,status&mine=true",
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "YouTube profile failed");
      const channel = data.items?.[0];
      if (!channel) throw new Error("No YouTube channel on this Google account");
      return {
        displayName: channel.snippet?.title,
        handle: channel.snippet?.customUrl,
        extra: { channelId: channel.id, privacyStatus: channel.status?.privacyStatus },
      };
    }
    case "facebook": {
      const response = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${platformUserId}?fields=id,name,fan_count&access_token=${accessToken}`,
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return {
        displayName: data.name,
        extra: { pageId: data.id, fanCount: data.fan_count },
      };
    }
    case "instagram": {
      const response = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${platformUserId}?fields=id,username,name&access_token=${accessToken}`,
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return {
        displayName: data.name || data.username,
        handle: data.username ? `@${data.username}` : undefined,
        extra: { igUserId: data.id },
      };
    }
    case "tiktok": {
      const response = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username",
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const data = await response.json();
      if (data.error?.code && data.error.code !== "ok") {
        throw new Error(data.error.message || "TikTok profile failed");
      }
      const user = data.data?.user;
      return {
        displayName: user?.display_name,
        handle: user?.username ? `@${user.username}` : undefined,
        extra: { openId: user?.open_id },
      };
    }
    default:
      return { displayName: platformUserId, extra: { skipped: true } };
  }
}
