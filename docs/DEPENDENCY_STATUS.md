# Dependency status

Checked 2026-10-30 against `main` at `b789576` and its npm lockfile. Dependency version updates remain with Dependabot while the application changes are reviewed.

## Outstanding blockers

- `npm ci` fails: `eslint-plugin-react-hooks@5.2.0` does not accept the installed ESLint 10.2.0 peer.
- `npm ls --all` also reports `date-fns@4.4.0` as invalid for the installed `react-day-picker@8.10.2` peer range. These packages need a compatible pair of versions.
- `npm audit` reports four affected packages: two high and two moderate, zero critical. The affected packages are `zod`, `brace-expansion`, `postcss-selector-parser` and the dependent `@tailwindcss/typography`. Do not assume the existing Zod PR is sufficient: its proposed 4.5.4 is below the patched range reported by the audit.

Relevant advisories: [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [brace-expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), [PostCSS selector parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf). Audit counts can change when advisory data or the lockfile changes; verify them again after updates.

## Open Dependabot PRs at inspection

| PR | Update |
| --- | --- |
| [25](https://github.com/samimiettinen/shortwork/pull/25) | TypeScript 5.9.3 → 7.0.2 |
| [26](https://github.com/samimiettinen/shortwork/pull/26) | next-themes 0.3.0 → 0.4.6 |
| [27](https://github.com/samimiettinen/shortwork/pull/27) | Zod 3.25.76 → 4.5.4 |
| [28](https://github.com/samimiettinen/shortwork/pull/28) | tailwind-merge 3.5.0 → 3.6.0 |
| [29](https://github.com/samimiettinen/shortwork/pull/29) | lucide-react 0.462.0 → 1.39.0 |

All five were last updated on October 18 and had no GitHub check runs when inspected. Dependabot proposals do not apply themselves to `main`. Review major versions and peer compatibility together, and require the new checks before merging.

The configuration now groups compatible patch/minor updates and checks npm daily; major updates stay separate. GitHub Actions are checked weekly. This takes effect when the configuration reaches the default branch. Supabase edge imports have a Deno lockfile; review and refresh that lock explicitly when edge dependencies change because npm Dependabot updates do not maintain remote Deno imports.

## Validation while waiting

For local diagnosis only, the current lockfile was installed with `npm ci --legacy-peer-deps --ignore-scripts`. This is not the supported install path and is not configured in CI. Type checks, the production build, publishing lint, mocked provider/browser tests and isolated SQL assertions were run with that limitation recorded.

After Dependabot updates land:

1. Start from a clean checkout on Node 24 and run plain `npm ci`.
2. Confirm `npm ls --all` has no invalid peers and review a fresh `npm audit`.
3. Run all commands from README and the database CI job.
4. Recheck major-version behavior in the forms and calendar, not just the dependency diff.
5. Deploy to a test environment, connect real provider accounts and verify uploads and scheduled dispatch there before releasing to production.
