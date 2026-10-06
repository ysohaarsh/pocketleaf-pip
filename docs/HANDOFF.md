# Handoff — project status (updated 2026-10-06)

Read this first in a new session. Contracts and design decisions live in [PLAN.md](PLAN.md).

## Where things stand

- **v1.0.0 shipped.** Tag `v1.0.0` on `main` (commit 97c8d59). All feature branches merged; working
  tree clean; agent worktrees removed.
- **Repo:** https://github.com/ysohaarsh/pocketleaf-pip (public, `gh` authenticated as `ysohaarsh`).
- **Live (GitHub Pages):** https://ysohaarsh.github.io/pocketleaf-pip/ — `deploy.yml` runs only
  after the `CI` workflow succeeds on `main` (`workflow_run`). The `github-pages` environment had to
  allow branch `main` (it defaulted to `master`).
- **Live (Vercel):** https://pocketleaf-pip.vercel.app — project `pocketleaf-pip` in team
  `yadavharsh715-7698s-projects`, Git-connected to the repo, so every push to `main` deploys to
  production. These deploys are NOT gated on CI (Pages is); to gate, turn off auto-deploy and deploy
  from CI with a `VERCEL_TOKEN` secret. The Vercel MCP connector lacks project-create permission;
  the CLI (`npx vercel`, logged in as `yadavharsh715-7698`) works.
- **Tests:** `npm run check` green — 385 unit tests, 74 e2e (Chromium, WebKit, mobile), 99% line
  coverage of `src/game` + `src/engine`. CI passed twice in a row with zero flaky tests.
- **Bundle:** 93 KB gzipped JS. Perf smoke: ~16.7 ms avg frame locally, ≤ 25 ms allowed on CI.

## Next up (not started)

1. Listen to the audio in a real browser and tune mix levels (only tested with a fake AudioContext).
2. Difficulty tuning — bot routes run straight through; levels may be easy.
3. Ideas: level editor, Tiled import, more worlds, README GIF.

## Gotchas learned the hard way

- **Visual baselines are per platform.** macOS ones are recorded locally (`npm run e2e:update`).
  Linux ones come from CI: run `gh workflow run CI --ref main` (manual dispatch runs only the
  `update-snapshots` job), `gh run download <id>`, copy only the `*/linux/` folders into
  `tests/e2e/__screenshots__/`, commit. Any visual change needs both sets refreshed.
- **Headless WebKit on CI** can stall rAF for a cold page and emit stray native blur events. The
  e2e harness (`tests/e2e/fixtures.ts`) drops _trusted_ blur/visibilitychange and waits for focus
  plus advancing ticks before input. Don't remove these; blur behaviour is tested with synthetic
  events. CI always uploads the Playwright report (traces of first failures) for debugging flakes.
- **Level or physics changes** → rerun `npx tsx scripts/genBotTracks.ts` and commit
  `tests/fixtures/botTracks.json`, or `levelCompletion.test.ts` fails.
- **Enter is always START**, even when a toolbar button has focus (closing settings returns focus to
  its toggle); toolbar buttons activate with Space.
- `rm` is aliased to interactive in this shell — use `/bin/rm -f` in scripts.
- Keep port 4173 free before running e2e (Playwright's webServer uses it; `pkill -f "vite preview"`).

## Intentional choices (don't "fix")

Classic Green hexes, the slide-down boot wordmark + chime, and the "WORLD 1-1" card are as the
original spec dictated. Spikes kill instantly even in Bloom form. Music keeps playing through pause.
Pinch-zoom is blocked on phones (spec: no zoom while playing). The console's sage/forest/amber look,
lowercase wordmark and single-row HUD were changed deliberately to avoid resembling existing products.
