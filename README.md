# ShortWork

Prepare, publish and schedule short videos across social channels from a React app backed by Supabase. ShortWork began as Sami Miettinen’s Harvard CS50 final project.

| Destination | Implemented delivery |
| --- | --- |
| YouTube | Resumable video upload; choose private, unlisted or public. Eligible vertical or square videos can become Shorts. |
| Instagram | Reels for professional accounts linked to a Facebook Page. |
| Facebook | Managed Page Reels for eligible short vertical videos; otherwise Page video. |
| LinkedIn | Native video on the connected personal profile. |
| X | Video upload followed by a post, subject to developer account access. |
| Threads | Video container, processing check and publish. |
| Bluesky | Video service upload and a native video post. |
| TikTok | Send to the creator’s inbox; finish the caption, visibility and publication in TikTok. |

These are implemented API paths. Live publishing still requires the correct credentials, account permissions, provider approval and a controlled test on each connected account. Automated tests use mocked provider responses; they do not establish production readiness.

## Run locally

Use **Node.js 24 LTS**, npm, and **Deno 2** for edge checks and tests. npm and `package-lock.json` are the frontend dependency source of truth.

```sh
git clone https://github.com/samimiettinen/shortwork.git
cd shortwork
nvm use
cp .env.example .env.local
# Fill in the public Supabase URL and publishable key.
npm ci
npm run dev
```

The development app runs at `http://localhost:8080`. Provider client secrets, token encryption keys and the Supabase service role key belong only in edge-function secrets.

**Dependency work is pending:** as checked on 2026-10-30, clean `npm ci` fails on existing peer conflicts, and the lockfile has outstanding audit findings. Dependabot owns the version updates. See [dependency status](docs/DEPENDENCY_STATUS.md); the normal installation and CI commands intentionally expose these blockers.

## Publish a short video

1. Create or join a workspace and connect accounts in **Channels**. Publishing requires owner, admin or editor access.
2. Open **Compose**, write a caption, upload the video and select destinations. Use the master caption or customize a shorter version, title and optional publishing time for each network.
3. Review the live 9:16 preview and each network’s readiness. Reel/Short mode requires a vertical MP4; use **4–90 seconds, 1080 × 1920, H.264 + AAC, up to 100 MiB** for the shared master including this app’s Facebook Reels route. Standard mode retains the app’s 3-minute profile, with 140 seconds for X.
4. Choose YouTube visibility and its made-for-kids setting if relevant, and whether an Instagram Reel also appears in the feed. YouTube starts as private. TikTok requires completion in its app; the planned caption can be copied from the results or Queue.
5. Use **Select all connected** and **Quick Publish**, or choose a default date/time in **Schedule** and optional network-specific times. Changing modes preserves the same uploaded master. Track each channel’s result in **Queue**.

Scheduling requires a deployed worker and cron configuration. Each worker invocation claims one target, so a post with several destinations can take several minutes to dispatch. See [platform and deployment setup](docs/PLATFORM_SETUP.md).

The [Metricool workflow analysis](docs/METRICOOL_WORKFLOW.md) maps the public reference features to this implementation and records the remaining gaps.

## Delivery behavior

- The browser uploads to a private workspace folder. Requests store the storage path; expiring preview URLs are not used as permanent media references.
- Validation is shared by the browser, publishing API and scheduled worker.
- A request ID prevents an unchanged in-session retry from sending the same saved request again. Editing the draft or reloading creates a new request; inspect Queue before submitting a new copy after an uncertain response.
- Posts, targets and scheduled jobs are created in a single database transaction. Workers claim jobs with row locks.
- Queue distinguishes published, partial, failed and action-needed outcomes and stores returned post links. TikTok inbox uploads and interrupted deliveries require attention.
- Uncertain delivery is never automatically resent. Check the remote account before submitting another attempt. Canceling is available until a scheduled target is claimed.

## Development checks

```sh
npm run typecheck
npm run lint:publishing
npm test                 # Deno contract and mocked provider tests
npm run check:edge
npx playwright install chromium
npm run test:e2e         # mocked Supabase; includes a tiny generated video fixture
npm run build
```

`npm run lint` also inspects legacy parts of the app and currently reports existing errors outside the publishing work. CI keeps frontend installation, publishing checks, edge tests and SQL assertions visible as separate jobs. The database test fixture checks the publishing migrations against the original schema; it is not a full Supabase deployment test.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/components/social/` | One master composer for publishing, scheduling and per-network variants |
| `src/lib/social/` | Browser upload, request and platform helpers |
| `supabase/functions/_shared/` | Shared contract, media validation, delivery and provider adapters |
| `supabase/functions/social-auth/` | Server-side account connection and OAuth exchange |
| `supabase/functions/social-publish/` | Authenticated immediate and scheduled requests |
| `supabase/functions/publish-scheduled/` | Scheduler-authenticated queue worker |
| `supabase/migrations/` | Schema, permissions and publishing functions |
| `e2e/`, `tests/database/` | Browser flows and SQL assertions |

The frontend uses React, TypeScript, Vite, Tailwind CSS, shadcn/ui and Supabase. Routes load on demand so analytics and administration code do not inflate the initial page bundle.

## Deployment and editing

Apply migrations, configure server secrets, deploy edge functions and configure the scheduler before releasing the corresponding frontend. [PLATFORM_SETUP.md](docs/PLATFORM_SETUP.md) gives the order and provider requirements. Keep the OAuth registry copies in `src/config/socialProviders.ts` and `supabase/functions/_shared/social-providers.ts` aligned; `config/socialProviders.ts` is a compatibility re-export.

The existing [Lovable project](https://lovable.dev/projects/5c813f69-b2a5-4e45-9592-246ab9531464) can also edit the repository. Read the [maintenance handover](docs/LOVABLE_HANDOVER.md) before making changes there. A frontend publish alone does not deploy database migrations or prove that provider credentials and permissions work.
