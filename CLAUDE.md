# Pip & the Pocket Kingdom

Original pixel platformer (custom Canvas 2D engine, TypeScript) inside an original React handheld
shell called POCKETLEAF. 160x144, 4 shades, Web Audio chip synth. See docs/PLAN.md for contracts.

**Starting a new session? Read docs/HANDOFF.md first** — current status (v1.0.0 live on GitHub
Pages), next steps (Vercel deploy pending), and CI/baseline gotchas.

## Commands

- `npm run dev` — Vite dev server (http://localhost:5173; add `?test=1` for test mode)
- `npm run check` — typecheck && lint && unit && build && e2e (must be green before merging)
- `npm test` / `npm run test:watch` / `npm run coverage` — Vitest
- `npm run e2e` / `npm run e2e:update` — Playwright (Chromium, WebKit, mobile); update baselines deliberately
- `npx tsx scripts/genBotTracks.ts` — regenerate level-completion bot fixtures after physics/level changes

## Architecture rules

- `src/game/**` is PURE and DETERMINISTIC: `step(world, input)` mutates+returns world; no DOM, no
  `Date.now`, no `Math.random` (seeded PRNG in `src/engine/prng.ts`). ESLint enforces this.
- The game only knows palette indices 0..3 (`Shade`). Real colours exist only in `src/engine/api.ts`
  PALETTES and the renderer blit.
- React is never in the frame loop. The engine runs its own rAF + fixed 60 Hz accumulator and exposes
  `GameHost` (`src/engine/api.ts`); the shell subscribes with `useSyncExternalStore`.
- One `InputHub` (`src/input/InputState.ts`): keyboard/touch/gamepad write sources, the sim samples
  once per tick, on-screen buttons render from the same merged state.
- Contracts live in `src/game/types.ts`, `src/engine/api.ts`, `src/audio/types.ts`. Change them on
  purpose and update docs/PLAN.md.
- Tuning values only in `src/game/constants.ts`, with units.

## IP rules (hard)

- Original IP only. Never use names, sprites, sounds, music, layouts, fonts, or logos from existing
  commercial platformers or consoles. Banned words anywhere except README's single "inspired by
  classic 1989-era handhelds" note and this line: mario|luigi|nintendo|game ?boy|goomba|koopa|dmg.
- All art/audio/fonts are generated in code. Any third-party asset must be CC0 and in CREDITS.md.

## Testing rules

- Never weaken assertions, skip tests, or add `@ts-ignore`/`any` to get green — fix the root cause.
- New mechanics need unit tests in `tests/unit/`; user-visible flows need e2e in `tests/e2e/`.
- Level changes must keep `tests/unit/levelCompletion.test.ts` green (regenerate bot tracks).
- Hooks: PostToolUse formats edited files; Stop runs typecheck+lint+unit and blocks on failure.

## Git

- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `ci:`, `perf:`, `refactor:`, `chore:`),
  imperative, one logical change each. Feature branches merged with `--no-ff`. Never force-push main.

## When compacting

Preserve: the list of modified files, current milestone, failing tests, and the commands above.
