# ShortWork platform and deployment setup

This guide describes the implemented integration paths as of 2026-10-30. Account access, quotas and provider review remain deployment-specific. See [dependency status](DEPENDENCY_STATUS.md) before attempting a release.

## Server configuration

Set the following as Supabase edge-function secrets. Never put them in `VITE_*` variables.

| Secret | Purpose |
| --- | --- |
| `APP_URL` | Deployed frontend origin, also used for OAuth return URLs and allowed origins |
| `OAUTH_STATE_SECRET` | HMAC signing key for OAuth state; configure a dedicated random value |
| `TOKEN_ENCRYPTION_KEY` | Encryption for stored OAuth credentials; use a random 64-character hex key and retain it across deploys |
| `OAUTH_FRONTEND_CALLBACK` | Optional `true` selects the SPA callback routes; default uses the function callback |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | Google OAuth client with YouTube Data API enabled |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | Meta app with Facebook Login and Page permissions |
| `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` | Meta credentials for Instagram via Facebook Login |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn app with Share on LinkedIn and OpenID Connect |
| `LINKEDIN_API_VERSION` | Optional version override, default `202610`; review against LinkedIn’s versioning policy |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | Confidential OAuth 2.0 client with media and posting access |
| `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET` | TikTok **client key** and client secret; the environment variable keeps the `_CLIENT_ID` name |
| `THREADS_CLIENT_ID`, `THREADS_CLIENT_SECRET` | Threads API app credentials |

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the edge runtime. The browser needs only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Without a token encryption key, legacy code can store plaintext; configure the key before connecting accounts. Never replace or discard a deployed key without migrating the existing encrypted tokens.

Default provider redirect URI:

```text
https://<project-ref>.supabase.co/functions/v1/social-auth/callback/<provider>
```

If `OAUTH_FRONTEND_CALLBACK=true`, register this form instead:

```text
https://<frontend-origin>/api/auth/callback/<provider>
```

Use provider IDs `youtube`, `facebook`, `instagram`, `linkedin`, `x`, `tiktok`, `threads`. The SPA forwards codes to the server; client secrets remain server-side. Bluesky uses an App Password rather than these OAuth callbacks.

## Deploy in order

1. Resolve the dependency gates, run checks and verify the target Supabase project.
2. Apply pending database migrations. The `20261030…` migrations add accurate post outcomes, request IDs, post URLs, atomic queue functions, permissions and an explicitly private media bucket. The older hardening migration also tolerates a dashboard-only scheduler hook being absent on fresh installs.
3. Configure secrets and deploy `social-auth`, `social-publish` and `publish-scheduled`, including their shared modules. Existing connected TikTok accounts are marked as inbox handoffs rather than auto-publish channels.
4. Configure the scheduler below and confirm that it runs with empty and test queues.
5. Release the frontend with its public environment variables. Keep SPA rewrites for application routes and optional OAuth callbacks.
6. Test one controlled clip on each real destination, including visibility, returned IDs, Queue status, reconnects and a scheduled post. Automated mocks do not test provider approval, billing, runtime quotas, live credentials or production deployment.

The endpoint requires a logged-in workspace owner, admin or editor and checks every requested channel. Only the service role can create and claim delivery jobs. Authenticated callers can cancel a scheduled request through `cancel_publish_request` before a target is claimed.

## Enable scheduled publishing

The repository enables `pg_cron` and `pg_net` and creates `app_config.scheduler_token`. Configure a worker URL for the actual project, then schedule the HTTP call in the Supabase SQL editor. The existing `app_config` table is service-only; do not grant browser access.

```sql
INSERT INTO public.app_config(key, value)
VALUES ('publish_worker_url', 'https://<project-ref>.supabase.co/functions/v1/publish-scheduled')
ON CONFLICT (key) DO UPDATE SET value = excluded.value;

SELECT cron.schedule(
  'shortwork-publish-scheduled',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_config WHERE key = 'publish_worker_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_config WHERE key = 'scheduler_token')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);
```

Inspect `cron.job` first and replace an existing job with that name instead of creating multiple schedules. Inspect `cron.job_run_details` and `net._http_response` to confirm both dispatch and HTTP results. A successful cron dispatch alone does not mean a provider publish succeeded.

The worker claims one due destination per invocation with `FOR UPDATE SKIP LOCKED`; multiple destinations are dispatched over successive runs. It rechecks the author’s role, account connection and workspace media ownership at execution time. Interrupted deliveries older than ten minutes are marked for review on a later worker run. Outcomes with uncertain remote side effects are not automatically resent, avoiding duplicate public posts.

## Provider setup

| Provider | Connection and publishing requirements |
| --- | --- |
| YouTube | Enable YouTube Data API and connect the owning Google account. Offline access and refresh are implemented. The composer selects visibility, defaulting to private. A separate title or network override can be used; otherwise the first caption line becomes the title. The made-for-kids choice is sent with the upload. Provider processing and audit restrictions may still limit visibility. |
| Instagram | Professional account linked to a managed Facebook Page. Facebook Login grants `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, and `business_management`. The composer also controls whether the Reel appears in the feed. Users outside app roles may require Meta review and verification. |
| Facebook | A managed Page, not a personal profile. The connector resolves Page tokens. The adapter uses its Reels route for vertical 3–90 second clips and regular Page video otherwise. |
| LinkedIn | Personal profile with `openid`, `profile`, `w_member_social`. Video initialize/upload/finalize waits for `AVAILABLE` before creating a post. Company Page authoring is not implemented. The default API version is `202610`; [LinkedIn publishes and sunsets versions](https://learn.microsoft.com/en-us/linkedin/marketing/versioning). |
| X | OAuth 2.0 with `tweet.read`, `tweet.write`, `users.read`, `media.write`, `offline.access`. Reconnect accounts missing media access. The adapter uploads chunks, confirms processing and creates the post. Developer-plan access and billing must be checked in the account portal. |
| Threads | Threads app scopes from the shared provider registry. The adapter waits for an explicit finished container status before publication. |
| Bluesky | Handle plus an App Password. Sessions are refreshed and videos pass through the video service. The standard-mode 3-minute/100 MiB profile is an application limit, not a claim about Bluesky’s current maximum. |
| TikTok | Login Kit plus Content Posting API **Upload**, with `video.upload`. The app uses chunked `FILE_UPLOAD` to `/v2/post/publish/inbox/video/init/`. The user opens the inbox notification to add the caption, choose visibility and publish. This is [TikTok’s documented upload handoff](https://developers.tiktok.com/doc/content-posting-api-reference-upload-video). The app does not use Direct Post or choose privacy for the creator. |

TikTok Direct Post has separate review and user-experience requirements, including current creator information and explicit privacy selection. Review the [official sharing guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines) before implementing that feature.

YouTube quotas should be read from the project console and [current API documentation](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert). Older copies of this guide’s “1,600 units per upload” calculation were stale; no fixed daily upload allowance is promised here.

## Media storage and limits

- `social-media` is private. Each upload path begins with its workspace UUID. Only that workspace’s media is accepted; arbitrary remote media URLs are rejected.
- The browser probes duration and dimensions with an object URL, releases that URL, uploads the file and obtains a preview URL. It rejects unreadable metadata instead of silently scheduling a broken video.
- Saved requests store `media_path`, `media_type`, `media_meta`, `platform_overrides`, the master title, YouTube visibility/audience and Instagram feed preference in `per_channel_overrides`. The server creates fresh signed URLs at dispatch. Legacy internal storage URLs are accepted only after checking the origin, bucket and workspace folder.
- URL-based providers fetch a signed URL. The server reads media once for validation and shares the blob with byte-upload providers. Reads enforce allowed MIME types, the 100 MiB cap and a timeout; codec compatibility still needs provider validation.
- Detaching media does not delete a file that an accepted or uncertain request might still reference. Establish a retention/cleanup job that excludes files referenced by active requests before deleting abandoned uploads.
- There is no transcoding, cropping, caption generation or long-running media service. The short-video limits keep this within the current edge-function design; high-volume or large-media processing needs a dedicated worker.
