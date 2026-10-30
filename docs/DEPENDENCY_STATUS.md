# Dependency status

Checked 2026-10-30 against `main` at `1535a78`, after the Lucide, TypeScript and Zod Dependabot PRs merged. The modernization branch includes those updates. Further dependency version updates remain with Dependabot.

## Outstanding blockers

- `npm ci` fails: `eslint-plugin-react-hooks@5.2.0` does not accept the installed ESLint 10.2.0 peer.
- TypeScript 7.0.2 is now installed, but the current `typescript-eslint` explicitly rejects the TS 7 API. Both lint commands stop before analyzing files. A compatible parser/compiler API arrangement is still required.
- `npm ls --all` also reports `date-fns@4.4.0` as invalid for the installed `react-day-picker@8.10.2` peer range. These packages need a compatible pair of versions.
- `npm audit` reports four affected packages: two high and two moderate, zero critical. The affected packages are `zod`, `brace-expansion`, `postcss-selector-parser` and the dependent `@tailwindcss/typography`. The merged Zod 4.5.4 remains below the patched range. New PR #32 proposes Zod 4.6.6 and brace-expansion 5.0.12; verify its resulting audit rather than assuming it clears every finding.

Relevant advisories: [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [brace-expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), [PostCSS selector parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf). Audit counts can change when advisory data or the lockfile changes; verify them again after updates.

## Dependabot progress during this task

| PR | Observed state |
| --- | --- |
| [25](https://github.com/samimiettinen/shortwork/pull/25) | Merged: TypeScript 7.0.2; introduced the ESLint API incompatibility above |
| [27](https://github.com/samimiettinen/shortwork/pull/27) | Merged: Zod 4.5.4; additional security update still needed |
| [29](https://github.com/samimiettinen/shortwork/pull/29) | Merged: lucide-react 1.39.0; removed brand icon imports are handled by local licensed SVG components in this branch |
| [26](https://github.com/samimiettinen/shortwork/pull/26) | Open: next-themes 0.4.6 |
| [28](https://github.com/samimiettinen/shortwork/pull/28) | Open: tailwind-merge 3.6.0 |
| [32](https://github.com/samimiettinen/shortwork/pull/32) | Open: Zod 4.6.6 and brace-expansion 5.0.12 |

The first inspection found five stale open PRs with no check runs; three subsequently merged into `main` while this work was underway. The application branch was rebased and retested. Review major versions and peer compatibility together, and require the new checks before release.

The configuration now groups compatible patch/minor updates and checks npm daily; major updates stay separate. GitHub Actions are checked weekly. This takes effect when the configuration reaches the default branch. Supabase edge imports have a Deno lockfile; review and refresh that lock explicitly when edge dependencies change because npm Dependabot updates do not maintain remote Deno imports.

## Validation while waiting

For local diagnosis only, the current lockfile was installed with `npm ci --legacy-peer-deps --ignore-scripts` on Node 25.9.0. This is not the supported install path and is not configured in CI. On the updated dependency base, type checks, production build, 22 contract/provider tests, three mocked browser flows and isolated SQL assertions pass. Publishing lint passed on the earlier TS 5 baseline; it is currently blocked by the merged TS 7 API incompatibility. CI targets Node 24 and must be checked independently.

After Dependabot updates land:

1. Start from a clean checkout on Node 24 and run plain `npm ci`.
2. Confirm `npm ls --all` has no invalid peers and review a fresh `npm audit`.
3. Run all commands from README and the database CI job.
4. Recheck major-version behavior in the forms and calendar, not just the dependency diff.
5. Deploy to a test environment, connect real provider accounts and verify uploads and scheduled dispatch there before releasing to production.
