/**
 * Frontend OAuth provider registry.
 *
 * Secrets (client id/secret) live only in Supabase Edge Function env —
 * never in Vite. Auth URLs are started by `social-auth`; this file is the
 * single source of scopes, callback paths, and UI metadata so Lovable and
 * GitHub stay aligned.
 *
 * Canonical edge-function copy: supabase/functions/_shared/social-providers.ts
 * (Deno cannot import from src/). Keep the two files' scopes in sync.
 */

export type SocialProviderId =
  | "youtube"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "x"
  | "tiktok"
  | "threads";

export const APP_OAUTH_CALLBACK_BASE = "/api/auth/callback";

export interface SocialProviderConfig {
  id: SocialProviderId;
  displayName: string;
  group: "google" | "meta" | "tiktok" | "other";
  authUrl: string;
  tokenUrl: string;
  scopes: readonly string[];
  scopeDelimiter: " " | ",";
  /** SPA route registered as an optional OAuth redirect URI */
  callbackPath: string;
  /** Existing Supabase function callback (default, already registered) */
  edgeCallbackPath: string;
  usesPkce: boolean;
  refreshable: boolean;
  accessType?: "offline";
  prompt?: "consent";
}

const GRAPH_VERSION = "v25.0";

export const SOCIAL_PROVIDERS: Record<SocialProviderId, SocialProviderConfig> = {
  youtube: {
    id: "youtube",
    displayName: "YouTube",
    group: "google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    scopeDelimiter: " ",
    callbackPath: `${APP_OAUTH_CALLBACK_BASE}/youtube`,
    edgeCallbackPath: "/functions/v1/social-auth/callback/youtube",
    usesPkce: false,
    refreshable: true,
    accessType: "offline",
    prompt: "consent",
  },
  facebook: {
    id: "facebook",
    displayName: "Facebook",
    group: "meta",
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
    callbackPath: `${APP_OAUTH_CALLBACK_BASE}/facebook`,
    edgeCallbackPath: "/functions/v1/social-auth/callback/facebook",
    usesPkce: false,
    refreshable: false,
  },
  instagram: {
    id: "instagram",
    displayName: "Instagram",
    group: "meta",
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
    callbackPath: `${APP_OAUTH_CALLBACK_BASE}/instagram`,
    edgeCallbackPath: "/functions/v1/social-auth/callback/instagram",
    usesPkce: false,
    refreshable: false,
  },
  linkedin: {
    id: "linkedin",
    displayName: "LinkedIn",
    group: "other",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social"],
    scopeDelimiter: " ",
    callbackPath: `${APP_OAUTH_CALLBACK_BASE}/linkedin`,
    edgeCallbackPath: "/functions/v1/social-auth/callback/linkedin",
    usesPkce: false,
    refreshable: false,
  },
  x: {
    id: "x",
    displayName: "X",
    group: "other",
    authUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"],
    scopeDelimiter: " ",
    callbackPath: `${APP_OAUTH_CALLBACK_BASE}/x`,
    edgeCallbackPath: "/functions/v1/social-auth/callback/x",
    usesPkce: true,
    refreshable: true,
  },
  tiktok: {
    id: "tiktok",
    displayName: "TikTok",
    group: "tiktok",
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "video.upload", "video.publish"],
    scopeDelimiter: ",",
    callbackPath: `${APP_OAUTH_CALLBACK_BASE}/tiktok`,
    edgeCallbackPath: "/functions/v1/social-auth/callback/tiktok",
    usesPkce: true,
    refreshable: true,
  },
  threads: {
    id: "threads",
    displayName: "Threads",
    group: "meta",
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
    callbackPath: `${APP_OAUTH_CALLBACK_BASE}/threads`,
    edgeCallbackPath: "/functions/v1/social-auth/callback/threads",
    usesPkce: false,
    refreshable: true,
  },
};

/** YouTube, Meta (IG + FB) and TikTok — personal publishing integrations */
export const PRIORITY_CONNECT_PLATFORMS = [
  "youtube",
  "facebook",
  "instagram",
  "tiktok",
] as const satisfies readonly SocialProviderId[];

export function frontendCallbackPath(provider: string): string {
  return `${APP_OAUTH_CALLBACK_BASE}/${provider}`;
}
