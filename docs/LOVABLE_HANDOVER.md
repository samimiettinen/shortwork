# ShortWork maintenance handover

Read [README](../README.md), [platform setup](PLATFORM_SETUP.md) and [dependency status](DEPENDENCY_STATUS.md) before editing or releasing the app.

The browser and queue use the same publishing contract in `supabase/functions/_shared/publishing-contract.ts`. The unified composer keeps one uploaded master through Publish/Schedule mode changes. Network overrides store individual captions, titles and publishing times. `platformVariant` resolves them for both API validation and actual delivery. Browser upload and metadata handling live in `src/lib/social/media.ts`. Both compose modes call `social-publish`; scheduling never creates posts, targets and jobs through three separate browser inserts.

`create_publish_request` creates the request atomically and deduplicates its client request ID. The endpoint saves one target outcome per provider. `claim_publish_job` claims one scheduled target under row locks, and `rollup_publish_status` serializes aggregate updates. Keep those boundaries when changing the UI. Job state must not be writable from the browser.

`publishToProvider` is the shared publishing engine for all destinations. Do not duplicate it in the endpoint or worker. Preserve explicit media-processing checks: an upload acknowledgement or a polling timeout is not proof that a post exists. Save returned IDs and links. Use action-needed outcomes for accepted TikTok handoffs and uncertain delivery, and inspect the platform before retrying.

TikTok currently uses **inbox upload**. The user finishes editing and publication in TikTok; it is not an automatically published private or public post. YouTube visibility and audience are chosen in Compose; visibility defaults to private. Instagram’s feed choice is preserved. LinkedIn supports personal profiles and defaults to API version `202610`; review the provider’s supported versions before changing it.

Uploaded media is private and identified by a workspace storage path. Re-sign at delivery time; never store a short-lived preview URL as the only reference. Do not restore unrestricted external media URLs or expose service keys, client secrets, token encryption keys or scheduler tokens to Vite.

npm is the frontend package manager. Dependabot maintains version upgrades; fix compatible peer pairs and require plain `npm ci` before release. The diagnostic `--legacy-peer-deps` install is not a supported setup or CI workaround. Keep the edge Deno lockfile under review separately.

The frontend and functions must be deployed together with their migrations. The browser requires the new RPCs and outcome columns. A Lovable frontend publish does not apply database migrations or configure cron. Full production publishing remains unverified until real credentials, provider access and controlled account tests have passed.
