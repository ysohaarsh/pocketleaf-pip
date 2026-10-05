# Levels

Each level is a `LevelDef` (`src/game/types.ts`) whose `map` is an ASCII grid of exactly
`LEVEL_ROWS` (9) rows of equal width. Levels are authored as a left-to-right list of 9-row
segments joined with `joinSegments` (`build.ts`), one idea per segment, with a comment above each.

| file      | id / label | name                                  | theme / song | width |
| --------- | ---------- | ------------------------------------- | ------------ | ----- |
| `1-1.ts`  | 1-1        | Sproutling Meadow                     | grass        | 182   |
| `1-2.ts`  | 1-2        | Hollowroot Caverns                    | cave         | 188   |
| `1-3.ts`  | 1-3        | Cloudstep Bridges                     | sky          | 185   |
| `test.ts` | T-1..T-3   | test-coins, test-enemies, test-blocks | grass        | 20–24 |

`index.ts` exports `LEVELS` (campaign order), `TEST_LEVELS` (keyed by id, loadable only with
`?test=1&level=<id>`) and `getLevelDef(id)`.

## Legend

| glyph | meaning                     | glyph | meaning                                  |
| ----- | --------------------------- | ----- | ---------------------------------------- |
| `.`   | empty                       | `P`   | player start (exactly one)               |
| `#`   | ground (solid)              | `F`   | Beacon base (exactly one)                |
| `X`   | hard block (solid)          | `m`   | Mossbug (stompable)                      |
| `B`   | brick (solid; Bloom breaks) | `x`   | Snapper (spiky — jump over, don't stomp) |
| `?`   | block → Glimmer             | `f`   | Flutter (sine flyer)                     |
| `S`   | block → Sun Seed            | `o`   | Glimmer                                  |
| `=`   | one-way platform            | `^`   | spike (hazard)                           |

Falling below row 8 is death; a pit is a run of columns with no ground.

## Design rules (enforced by `tests/unit/levels.test.ts`)

Reach (from `constants.ts`): a held jump rises ~3.5 tiles; a walking jump clears 3-tile gaps,
a running jump more. Levels are designed well inside that.

- Rows 0–1 are under the HUD and stay completely empty.
- `P` stands on solid ground. `F` stands on solid ground with ≥ 4 empty rows above it for the pole.
- Mossbugs and Snappers spawn standing on a solid tile; Flutters may float anywhere.
- No pit (columns with no solid or one-way tile in rows 3–8) is wider than 3; most are 2.
- Spike strips are at most 2 wide.
- Every reachable standing spot has at least one free tile above it (no crouching exists).
- Item blocks (`?`, `S`) sit 2–3 tiles above a reachable standing spot (classic: floor row 7,
  block row 4).
- Over plain corridors a cave ceiling may drop to row 3; wherever a jump is needed (pits, spikes,
  enemies) the ceiling is at row 2 or absent.
- Flutters hover high enough (row 2–4) that walking underneath is safe.

### Coarse reachability model

The test flood-fills over _standable cells_ (an empty, non-spike tile with a solid or one-way tile
below) from `P` and requires the Beacon's cell to be reached. Moves:

- **walk** to the adjacent standable cell at the same height;
- **jump** up 0–1 tiles within 4 columns, or 2–3 tiles within 3 columns. The source column must be
  clear from the target height minus one down to the source; the target column likewise; columns
  in between must be clear one row above the target (the arc). One-way tiles are passable upward;
- **drop** any height within 4 columns: walk/hop off at the source height (middle columns clear at
  that row), then fall straight down the target column (no solid, spike or one-way in the way).

Self-tests in the same file prove the model rejects 5-wide pits, 4-tile walls and spike strips
without headroom. The real-physics bot (`tests/unit/levelCompletion.test.ts`) is the final word.

All layouts are original.
