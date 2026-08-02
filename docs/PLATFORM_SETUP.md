# ShortWork — Platform Setup Guide

ShortWork publishes short videos to all major platforms through their official
APIs. Each platform needs a developer app + credentials configured as Supabase
Edge Function secrets (`Project Settings → Edge Functions → Secrets`).

## Environment variables (Supabase Edge Function secrets)

| Variable | Used for |
|---|---|
| `APP_URL` | Where OAuth callbacks redirect back to (your deployed app URL) |
| `OAUTH_STATE_SECRET` | (optional) HMAC key for signing OAuth state; falls back to the service role key |
| `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` | Google Cloud OAuth client (YouTube Data API v3 enabled) |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Meta app (Facebook Login product) |
| `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET` | Same Meta app credentials as Facebook (Facebook Login variant) |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn app with "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect" products |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X developer app, OAuth 2.0 (confidential client) |
| `TIKTOK_CLIENT_ID` / `TIKTOK_CLIENT_SECRET` | TikTok developer app **client_key / client_secret** (env names keep the `_CLIENT_ID` convention, but the value is TikTok's *client key*) |
| `THREADS_CLIENT_ID` / `THREADS_CLIENT_SECRET` | Meta "Threads API" app credentials |

Redirect URI to register with **every** provider:

```
https://<your-project-ref>.supabase.co/functions/v1/social-auth/callback/<provider>
```

e.g. `https://ehoawfmrfkcciqlzknvq.supabase.co/functions/v1/social-auth/callback/tiktok`

## Per-platform requirements (verified July 2026)

### YouTube — works out of the box
- Google Cloud project with **YouTube Data API v3** enabled.
- Scopes: `youtube.upload`, `youtube.readonly`, `userinfo.profile`.
- **Quota:** each upload costs 1600 units of the 10,000/day default → ~6
  uploads/day. Request a quota extension for more.
- If the OAuth consent screen is in *Testing* mode, refresh tokens expire after
  7 days — publish the consent screen to production.
- Shorts are auto-detected: vertical/square video **≤ 3 minutes**. No special
  flag or `#Shorts` tag needed.

### TikTok — Direct Post (Content Posting API)
- TikTok for Developers app with **Login Kit** + **Content Posting API**
  products, Direct Post configuration.
- Scopes: `user.info.basic`, `video.publish` (comma-separated; TikTok uses
  `client_key`, which the code handles).
- **Until the app passes TikTok's Content Posting audit, every post is forced
  to private (SELF_ONLY) visibility** and max 5 users/24h may post. Apply for
  the audit in the developer portal — it requires screen recordings of the
  consent/preview UX.
- The integration uses chunked FILE_UPLOAD (PULL_FROM_URL would require
  DNS-verifying the storage domain, which is impossible for `*.supabase.co`;
  if you front the storage bucket with e.g. `media.neuvottelija.fi`, verify
  that domain in the TikTok portal and PULL_FROM_URL becomes an option).
- Specs: MP4/WebM/MOV, H.264, ≤ 4GB, ≤ 10 min (per-creator cap comes from the
  API, commonly 5 min). Access token 24h, refresh token 365 days (rotates —
  handled automatically).

### Instagram — Reels via Facebook Login
- Requires an **Instagram professional account linked to a Facebook Page**.
- Meta app with Facebook Login; scopes `instagram_basic`,
  `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`
  (+ `business_management` if the assets live in Business Manager).
- **App Review (Advanced Access) + Business Verification** are required before
  users without a role on the app can connect. For your own account, adding
  yourself as app admin/tester in Development Mode is enough.
- Connecting resolves all linked IG professional accounts automatically.
  Long-lived user token lasts ~60 days; reconnect when flagged (Meta has no
  refresh grant).
- Reels specs: MP4/MOV, H.264/HEVC, 9:16 recommended, 3s–15min, ≤1GB, moov
  atom at front. Quota: 100 API posts per rolling 24h.
- The video URL must be publicly fetchable (Supabase public bucket URLs work).

### Facebook — Page Reels + page videos
- Same Meta app; scopes `pages_show_list`, `pages_read_engagement`,
  `pages_manage_posts`, `publish_video`.
- Connecting stores a **Page access token per Page** (never expires when
  derived from a long-lived user token — handled automatically).
- Vertical videos 3–90s go to **Reels**; anything else goes to regular page
  video (`file_url` ingestion). Reels: 9:16, ≥540×960, 24–60fps, <1GB.
- If the app has "Require app secret" enabled, disable it or add
  `appsecret_proof` support.

### LinkedIn
- LinkedIn app with **Share on LinkedIn** and **Sign In with LinkedIn using
  OpenID Connect** products. Scopes: `openid`, `profile`, `w_member_social`.
- Native video upload via the versioned REST API (`/rest/videos`
  initialize → upload parts → finalize → `/rest/posts`).
- Tokens last 60 days and standard apps cannot refresh programmatically —
  reconnect when flagged.
- The `LinkedIn-Version` header is pinned in `_shared/publishers.ts`
  (`LINKEDIN_VERSION`) — bump it periodically (must be ≤ 1 year old).

### X (Twitter)
- X developer app with OAuth 2.0. Scopes now include **`media.write`**
  (required for video upload) — **existing X connections must be reconnected**
  to pick up the new scope.
- Video: chunked upload via `/2/media/upload/initialize|append|finalize`,
  `media_category=tweet_video`, then `/2/tweets` with `media_ids`.
- Access tokens last 2h; refresh (with rotation) is automatic via
  `offline.access`.
- Note API tier limits: the free tier allows limited posts/month; media upload
  requirements vary by tier — check the developer portal.

### Threads
- Meta "Threads API" use case app. Scopes: `threads_basic`,
  `threads_content_publish` (+ insights/replies for analytics).
- Short-lived tokens are exchanged for 60-day tokens automatically at connect
  time and refreshed (`th_refresh_token`) before publishing.
- Video: container with `media_type=VIDEO` + `video_url` (public URL), polled
  until processed, then published. Max 5 min video.

### Bluesky
- No developer app needed — connect with handle + **App Password**
  (Settings → Privacy and Security → App Passwords).
- Video: uploaded through the Bluesky video service (`video.bsky.app`) with a
  service-auth token, then embedded as `app.bsky.embed.video`. Limits: ≤100MB,
  ≤3 min. Sessions are refreshed automatically before each publish.

## Media hosting

Uploaded media goes to the public `social-media` storage bucket. Platforms
that pull from URL (Instagram, Facebook, Threads) fetch it directly; platforms
that need bytes (YouTube, TikTok, X, LinkedIn, Bluesky) are streamed the file
by the edge function (downloaded once per publish, shared across platforms).
Max upload size is 100MB (edge function memory bound).

## Recommended short-video format (works everywhere)

- **MP4, H.264 + AAC, 1080×1920 (9:16), 24–60fps, ≤ 90 seconds, ≤ 100MB**
- ≤ 90s keeps Facebook Reels eligibility; ≤ 3min keeps YouTube Shorts
  classification; ≤ 3min is the Bluesky cap; X free-tier caps at 2:20.
- Write the first line of your post text as the title (used by YouTube,
  TikTok, LinkedIn and Facebook); keep the whole text ≤ 280 chars if X is a
  target.
