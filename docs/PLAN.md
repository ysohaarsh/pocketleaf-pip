# PLAN — Pip & the Pocket Kingdom on POCKETLEAF

## 1. Spec in brief

An original Canvas-2D platformer (160×144, 4 shades, 16 px tiles, 60 Hz fixed step) inside an
original React handheld shell ("POCKETLEAF"): D-pad, A/B, START/SELECT, power switch, LED, speaker
grille, settings (volume/mute/LCD fx/palette), fullscreen, responsive desktop/phone portrait/landscape.
Hero Pip (small ↔ Bloom via Sun Seed), enemies Mossbug (stompable), Snapper (spiky), Flutter (sine
flyer), Glimmer coins, ? blocks, bricks, one-way platforms, spikes, pits, a Beacon at each level end.
Three hand-made levels (1-1 grass, 1-2 cave, 1-3 sky). Web Audio 4-channel chip synth with original
SFX and songs. Keyboard, touch/mouse, gamepad. Deterministic engine with unit tests, bot-verified
level completion, Playwright e2e incl. visual baselines and perf smoke, CI + GitHub Pages deploy.

## 2. Decisions (defaults chosen, no questions asked)

| Decision                    | Choice                                                                          | Why                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Level height                | exactly 9 rows (`LEVEL_ROWS`), horizontal scrolling only                        | matches 10×9 screen; camera y fixed                                                                      |
| HUD                         | 2 text rows (16 px) drawn over the top of the playfield                         | levels keep the top 1–2 rows mostly sky                                                                  |
| Player hitbox               | 10×14 for both forms; Bloom sprite adds a leaf crown                            | no crouch needed in 1-tile gaps                                                                          |
| Glimmers                    | a tile (`Tile.Glimmer`) collected on overlap                                    | cheap, deterministic                                                                                     |
| LCD ghosting                | blend in _shade-index space_ then quantise → canvas still has exactly 4 colours | lets the 4-colour pixel test run with LCD on; dot-grid/grain/vignette are a CSS overlay above the canvas |
| Boot sequence               | engine scene `boot` drawn on canvas in palette                                  | same pixel pipeline; skippable                                                                           |
| Time                        | real seconds (300)                                                              | simple                                                                                                   |
| Game over → CONTINUE        | restart current level, 3 lives, score reset to 0                                | classic                                                                                                  |
| Test-only levels            | in the bundle but loadable only with `?test=1&level=<id>`                       | e2e runs against the production build                                                                    |
| Visual-verification browser | Playwright scripts (Playwright MCP not installed in this environment)           | same engine, scripted                                                                                    |
| State updates               | `step` mutates and returns the world; tests clone with `structuredClone`        | no per-tick allocation                                                                                   |

## 3. Architecture

```
 ┌──────────────── React shell (src/shell, App.tsx) ────────────────┐
 │ Console ─ Screen(canvas + CSS LCD overlay) ─ Dpad ─ AB ─ Meta ─ Settings │
 │      │ useSyncExternalStore(host.subscribe/getSnapshot)            │
 │      │ useSyncExternalStore(host.input.subscribe/getHeld) → button depress │
 └──────┼───────────────────────────────────────────────────────────┘
        │ GameHost (src/engine/api.ts)
 ┌──────▼──────────── runtime.ts (DOM glue) ─────────────────────────┐
 │ loop.ts rAF + fixed-dt accumulator ─► input.sample() ─► step(world)│
 │ keyboard.ts / gamepad.ts / touch.ts ─► InputHub                    │
 │ world.events ─► AudioEngine (src/audio) / localStorage high score  │
 │ renderer.ts: rasterize(world) → Uint8Array 160×144 shades → blit   │
 │ debug/testHooks.ts → window.__GAME__ (dev or ?test=1)              │
 └──────┬────────────────────────────────────────────────────────────┘
        │ pure, deterministic
 ┌──────▼────────── src/game ───────────────────────────────────────┐
 │ world.ts createWorld/step (scene state machine in scenes/*)       │
 │ player.ts physics.ts collision.ts enemies.ts items.ts blocks.ts   │
 │ camera.ts levelParser.ts levels/*.ts constants.ts types.ts        │
 └───────────────────────────────────────────────────────────────────┘
```

## 4. Module interfaces (authoritative source: the .ts files)

- `src/game/types.ts` — `Buttons`, `InputFrame`, `Tile`, `LevelDef`, `ParsedLevel`, `Body`, `Player`,
  `Enemy`, `Item`, `Bump`, `Particle`, `SceneId`, `SfxId`, `SongId`, `GameEvent`, `World`, `Sprite`,
  `SpriteId`, `TRANSPARENT`.
- `src/input/InputState.ts` — `InputHub { setSource, setButton, clearSource, clearAll, getHeld, subscribe, sample }`.
- `src/engine/api.ts` — `GameHost`, `GameSnapshot`, `Settings`, `PALETTES`, `HostOptions`.
- `src/audio/types.ts` — `AudioEngine { unlock, unlocked, playSfx, playMusic, setVolume, setMuted, dispose }`.

Engine (feat/engine) must export:

```ts
// src/game/world.ts
export function createWorld(opts: {
  seed: number;
  levelOrder: readonly string[];
  startLevel?: string;
  highScore: number;
  freezeAnim: boolean;
  skipToLevel?: boolean;
}): World;
export function step(world: World, input: InputFrame): World; // one 1/60 s tick
export function hashWorld(world: World): string; // deterministic replay hash
// src/game/levelRegistry (engine side): getLevelDef(id) looks in LEVELS then TEST_LEVELS
// src/engine/renderer.ts
export function rasterize(world: World, fb: Uint8Array): void; // pure, testable
export function createBlitter(canvas: HTMLCanvasElement): Blitter; // DOM glue
// src/engine/runtime.ts
export function createGameHost(opts: HostOptions, audio: AudioEngine): GameHost;
```

Content (feat/content) must export:

```ts
// src/engine/sprites.ts
export function getSprite(id: SpriteId): Sprite;
// src/engine/font.ts
export const FONT: BitmapFont; // 5×7 glyphs, advance 6
// src/game/levelParser.ts
export function parseLevel(def: LevelDef): ParsedLevel; // throws LevelError on bad maps
export function validateLevel(def: LevelDef): string[]; // [] when valid
// src/game/levels/index.ts
export const LEVELS: readonly LevelDef[]; // 1-1, 1-2, 1-3
export const TEST_LEVELS: Readonly<Record<string, LevelDef>>; // 'test-coins', …
```

Audio (feat/audio): `src/audio/index.ts` `createAudioEngine(): AudioEngine`, plus pure
`src/audio/scheduler.ts` (note → time math, tested with a fake clock/context).

Shell (feat/shell): `src/App.tsx`, `src/main.tsx`, `src/shell/**`, `src/input/touch.ts`.

### Level legend

| glyph | meaning            | glyph | meaning                              |
| ----- | ------------------ | ----- | ------------------------------------ |
| `.`   | empty              | `P`   | player start (exactly one)           |
| `#`   | ground (solid)     | `F`   | Beacon (exactly one; pole base tile) |
| `X`   | hard block (solid) | `m`   | Mossbug                              |
| `B`   | brick              | `x`   | Snapper                              |
| `?`   | ? block → Glimmer  | `f`   | Flutter                              |
| `S`   | ? block → Sun Seed | `o`   | Glimmer                              |
| `=`   | one-way platform   | `^`   | spike (hazard)                       |

Falling below the map is death. Reach (from constants): held jump ≈ 3.5 tiles high, tap ≈ 2 tiles;
walk-jump clears gaps ≤ 3 tiles, run-jump ≤ 5 tiles.

### Engine ⇄ shell contract details

- Visible canvas: `data-testid="screen"`; the host sets `data-ready="1"` after the first frame.
- On-screen controls: `data-testid="btn-up|btn-down|btn-left|btn-right|btn-a|btn-b|btn-start|btn-select"`,
  `power-switch`, `settings-toggle`, `fullscreen-toggle`; each has an `aria-label` and
  `data-pressed="true|false"` mirroring `host.input.getHeld()`.
- URL params: `?test=1` (seed 1 unless `&seed=`, LCD off, frozen anims, `window.__GAME__`),
  `?level=<id>`, `?seed=<n>`.
- `window.__GAME__` (dev or test): getters `scene`, `tick`, `player {x,y,vx,vy,form,onGround}`,
  `coins`, `score`, `lives`, `levelId`, `timeLeft`, `stats {frames, avgFrameMs, maxFrameMs, longTasks}`;
  methods `world()`.

## 5. Milestones

1. M0 Scaffold — tooling, contracts, hooks, CLAUDE.md, first commit.
2. M1 Parallel workstreams — shell, engine, content, audio, tests-ci (each green in its worktree).
3. M2 Integrate — merge shell+engine, content, audio, tests-ci; `npm run check` after each.
4. M3 Feel & completability — bot tracks for every level, tune constants.
5. M4 Visual verification — scripted browser pass, screenshots, defect fixes.
6. M5 Ship — GitHub repo, CI, Pages, README, v1.0.0 tag.
7. M6 Self-review — adversarial break-it pass, a11y, bundle size, final evidence.

## 6. Workstreams & file ownership (no overlaps)

| branch             | owns                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| feat/shell         | `src/App.tsx`, `src/main.tsx`, `src/shell/**`, `src/input/touch.ts`, `tests/unit/shell*`                                                                                                                                                          |
| feat/engine        | `src/engine/{loop,renderer,runtime}.ts`, `src/engine/prng.ts`, `src/game/{world,physics,collision,player,camera,enemies,items,blocks,constants}.ts`, `src/game/scenes/**`, `src/input/{keyboard,gamepad}.ts`, `src/debug/**`, matching unit tests |
| feat/content       | `src/engine/{sprites,font}.ts`, `src/game/levelParser.ts`, `src/game/levels/**`, `tests/unit/{levels,sprites,font}*`                                                                                                                              |
| feat/audio         | `src/audio/**`, `tests/unit/audio*`                                                                                                                                                                                                               |
| feat/tests-ci      | `tests/e2e/**`, `playwright.config.ts`, `.github/**`, `README.md`, `CREDITS.md`, `LICENSE`                                                                                                                                                        |
| main (integration) | contracts, `scripts/**`, `tests/unit/levelCompletion*`, `tests/fixtures/**`                                                                                                                                                                       |

## 7. Risks

| Risk                                   | Mitigation                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Parallel branches drift from contracts | contracts committed before fan-out; stubs compile; review agent after merges |
| Levels uncompletable after tuning      | search bot generates tracks; test replays fixtures; regenerate on change     |
| Visual baselines differ across OS      | per-platform baselines (Playwright default suffix); CI regenerates its own   |
| Audio autoplay restrictions            | unlock on first gesture; engine tolerates locked audio                       |
| WebKit/mobile flakiness                | `data-ready` + test hooks instead of timing; frozen anims                    |
| Perf with LCD fx                       | ghosting on 23k-element typed arrays, fx overlay in CSS; perf smoke test     |
| Touch ghost clicks/scroll              | Pointer Events, `touch-action:none`, pointer capture, `preventDefault`       |
