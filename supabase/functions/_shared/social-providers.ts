// Keep scopes and URLs aligned with src/config/socialProviders.ts.
// Deno edge functions cannot import from the Vite src/ tree.

export const GRAPH_VERSION = "v25.0";

export type SocialProviderId =
  | "youtube"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "x"
  | "tiktok"
  | "threads";

export type OAuthRedirectMode = "frontend" | "edge";

export interface ProviderOAuthConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  scopeDelimiter: string;
  clientKeyParam: "client_id" | "client_key";
  usesPkce: boolean;
}

export const PROVIDERS: Record<SocialProviderId, ProviderOAuthConfig> = {
  youtube: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    scopeDelimiter: " ",
    clientKeyParam: "client_id",
    usesPkce: false,
  },
  facebook: {
    authUrl: `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    scopes: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "publish_video",
      "business_management",
    ],
    scopeDelimiter: ",",
    clientKeyParam: "client_id",
    usesPkce: false,
  },
  instagram: {
    authUrl: `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "business_management",
    ],
    scopeDelimiter: ",",
    clientKeyParam: "client_id",
    usesPkce: false,
  },
  linkedin: {
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social"],
    scopeDelimiter: " ",
    clientKeyParam: "client_id",
    usesPkce: false,
  },
  x: {
    authUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"],
    scopeDelimiter: " ",
    clientKeyParam: "client_id",
    usesPkce: true,
  },
  tiktok: {
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "video.upload", "video.publish"],
    scopeDelimiter: ",",
    clientKeyParam: "client_key",
    usesPkce: true,
  },
  threads: {
    authUrl: "https://threads.net/oauth/authorize",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
    scopes: [
      "threads_basic",
      "threads_content_publish",
      "threads_manage_insights",
      "threads_manage_replies",
      "threads_read_replies",
    ],
    scopeDelimiter: ",",
    clientKeyParam: "client_id",
    usesPkce: false,
  },
};

export function resolveRedirectMode(): OAuthRedirectMode {
  return Deno.env.get("OAUTH_FRONTEND_CALLBACK") === "true" ? "frontend" : "edge";
}

export function getOAuthRedirectUri(
  provider: string,
  mode: OAuthRedirectMode = "edge",
): string {
  const appUrl = (Deno.env.get("APP_URL") || "").replace(/\/$/, "");
  if (mode === "frontend" && appUrl) {
    return `${appUrl}/api/auth/callback/${provider}`;
  }
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-auth/callback/${provider}`;
}

export function isKnownProvider(provider: string): provider is SocialProviderId {
  return provider in PROVIDERS;
}
