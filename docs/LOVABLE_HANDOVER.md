# Handover prompt for Lovable

Copy-paste the prompt below into Lovable after merging branch
`claude/shortwork-social-integration-a4hcpl` into main.

---

## Context (read first, don't change these)

Multi-platform short-video publishing was just implemented on branch
`claude/shortwork-social-integration-a4hcpl` (now merged). Key facts:

- `supabase/functions/_shared/publishers.ts` is the single publishing engine:
  `publishToProvider(platform, options, supabase)` publishes video/image/text
  to youtube, tiktok, instagram (Reels), facebook (Reels + page video),
  linkedin (native video), x (v2 chunked media upload), threads and bluesky.
  It also handles token refresh (incl. refresh-token rotation) and marks
  accounts `needs_refresh` when reconnection is required. Do NOT reimplement
  or inline this logic elsewhere — import it.
- `social-auth` now: uses TikTok `client_key`, stores Facebook **Page tokens**
  (one social_account per Page), resolves Instagram professional accounts from
  linked Pages (stores the long-lived user token), exchanges Threads tokens
  for 60-day tokens, uses real PKCE for X with the `media.write` scope, and
  HMAC-signs OAuth state. Graph API is v25.0.
- `social-publish` publishes to all selected platforms in parallel, downloads
  media once, accepts `mediaMeta {width,height,durationSeconds}` from the
  frontend (used to route Facebook Reels vs page video), and records every
  quick publish into `posts` + `post_targets` (status published/failed).
- Migration `20260706000100_fix_oauth_tokens_unique.sql` deduplicates
  `oauth_tokens` and adds `UNIQUE(social_account_id)` — the upserts in
  social-auth depend on this constraint. Make sure it runs.
- `docs/PLATFORM_SETUP.md` documents all required edge-function secrets
  (YOUTUBE/FACEBOOK/INSTAGRAM/LINKEDIN/X/TIKTOK/THREADS `_CLIENT_ID` +
  `_CLIENT_SECRET`, `APP_URL`) and per-platform app-review requirements.

## Task 1 — deploy & verify

1. Run the new migration and redeploy the `social-auth` and `social-publish`
   edge functions.
2. Confirm the edge function secrets from docs/PLATFORM_SETUP.md are set.
3. In the Channels page copy, tell users with existing X, Facebook, Instagram
   or TikTok connections to **reconnect once** (X needs the new media.write
   scope; FB/IG previously stored unusable user tokens; TikTok connect was
   broken before the client_key fix).

## Task 2 — make scheduling work end to end

The database schema already exists and must not be redesigned: `posts`
(status enum includes 'scheduled', has scheduled_at, body_text, link_url,
per_channel_overrides jsonb), `post_targets` (one row per post × account,
status enum queued/publishing/published/needs_user_action/failed/skipped),
`publish_jobs` (post_target_id, run_at, status queued/processing/done/failed/
retry_scheduled, attempts, max_attempts, next_retry_at, unique
idempotency_key). Currently nothing writes or processes them except quick
publish history.

Build:

1. **Schedule tab in `src/pages/Compose.tsx`** (currently a dead mockup):
   reuse the same media-upload + channel-selection UX as `SocialPublisher`
   (extract shared pieces if useful), add date+time picker, then insert one
   `posts` row (status 'scheduled', scheduled_at in UTC, store
   `{media_url, media_type, media_meta}` in per_channel_overrides), one
   `post_targets` row per selected account (status 'queued'), and one
   `publish_jobs` row per target (run_at = scheduled_at, idempotency_key =
   `${post_id}:${post_target_id}`).
2. **New edge function `publish-scheduled`** (`verify_jwt = false` in
   config.toml, but require `Authorization: Bearer <service role key>` inside
   the handler): claim due jobs (status in queued/retry_scheduled AND
   run_at/next_retry_at <= now, small batch, mark 'processing' first to avoid
   double-runs), load the post + target + `social_accounts` + `oauth_tokens`,
   call `publishToProvider` from `../_shared/publishers.ts` with the media
   URL from per_channel_overrides, then update: post_targets (published/
   failed + remote_post_id + published_at + last_error_message),
   publish_jobs (done, or retry_scheduled with next_retry_at = now +
   2^attempts minutes until max_attempts then failed), and posts.status once
   all targets are terminal ('published' if any succeeded else 'failed').
3. **Schedule the function every minute** with a migration that enables
   pg_cron + pg_net and creates a cron job that `net.http_post`s the function
   URL with the service-role key read from Vault (document that the user must
   run `select vault.create_secret('<service-role-key>', 'service_role_key')`
   once), body `{}`.
4. **Queue page (`src/pages/Queue.tsx`,** currently a static empty state):
   list scheduled posts (posts.status='scheduled', with target platforms and
   scheduled_at), allow canceling (set post 'canceled', targets 'skipped',
   delete queued jobs), and show publish history (published/failed posts with
   per-target results and post URLs — remote_post_id is stored).

## Task 3 — platform guide page (feature improvement)

Add a "Platforms" page (route + sidebar nav) that helps choose where to
publish short videos, using a static data file `src/lib/social/platform-guide.ts`:
per platform show the video specs and API behavior already documented in
docs/PLATFORM_SETUP.md (max duration, aspect ratio, direct-publish vs
restrictions like TikTok's SELF_ONLY-until-audit, X free-tier limits, token
lifetime/reconnect cadence) plus a recommended posting checklist. Highlight
the universal format: MP4 H.264 1080×1920 9:16, ≤90s, ≤100MB, first line of
text = title. Link each platform card to its Channels connect button and its
Analytics tab.

## Task 4 — smaller fixes

1. The `*-insights` edge functions never refresh tokens, so X insights break
   2h after connect and TikTok/Threads insights go stale — refactor them to
   call `ensureFreshToken` from `../_shared/publishers.ts` before hitting the
   APIs.
2. `src/components/channels/ConnectionTroubleshooting.tsx` and the TikTok
   tooltip in Channels.tsx still say TikTok videos "need to be finalized in
   the TikTok app" — update copy: direct post is supported, but posts stay
   private (SELF_ONLY) until the TikTok app passes the Content Posting audit.
3. Surface `needsReconnect` from publish results in SocialPublisher (it's
   already returned by the backend) instead of keyword-matching error text.

## Known unverified details (watch for errors in logs)

TikTok, Instagram and Facebook flows were verified against July 2026 API
docs. The following were implemented from slightly older knowledge and should
be checked against current docs if publishing errors appear:
- X v2 media upload paths (`/2/media/upload/initialize|{id}/append|{id}/finalize`,
  STATUS polling) and free-tier media limits.
- LinkedIn `LinkedIn-Version: 202506` header (bump if LinkedIn rejects it;
  must be ≤ 12 months old) and video processing status field values.
- Threads `link_attachment` param on TEXT posts.
- Bluesky `getServiceAuth` audience `did:web:video.bsky.app` for the video
  service (if uploads 401, resolve the user's PDS DID and use that as `aud`).
