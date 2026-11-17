# Starfall Salvage — build log

## Build session

- **Date:** Mon 2026-11-16, ~12:00–12:15 WIB (build session in this workspace)
- **Competition:** best-game-01 — deadline Thu 19 Nov 2026 01:00 WIB, $1,000 total, escrowed
- **Builder:** subagent session for the parent agent; kit at `~/workspace/makefun/kits/best-game-01/best-game-01-kit/`
- **Environment:** Node v24.22.1 (rules: Node 22.18+ required, and RULES.txt says a newer release such as 24 or 26 is fine), Google Chrome 157 (headless, for screenshots and play-testing)

## What was built

Entry at `~/workspace/makefun/entries/best-game-01/`:

- `main.ts` — Node 22, stdlib only. Copies `game/` + `screenshots/` to `/output`, writes `dossier.json` via `vendor/makefun-game.ts`.
- `vendor/makefun-game.ts` — kit copy, byte-identical (sha256 verified).
- `game/index.html`, `game/src/main.js` — boot + fixed 1/60 s loop, 5 screens (title, play, paused, game over, victory).
- `game/src/world.js` — rules: ship, 4 enemy types, waves with quotas, boss every 5th wave, combo, shards, power-ups (shield/rapid/bomb), particles, popups, victory at wave 10.
- `game/src/render.js` — canvas drawing: parallax starfield, nebulae, glowing bullets/orbs/shards, ship with engine flame and shield ring, HUD, panels, boss health bar, screen shake.
- `game/src/shots.js` — staged screenshot scenes with a real autopilot that plays the actual rules forward from a seeded world.
- `game/src/input.js` — keyboard (arrows/WASD, Space fire, B bomb, P pause, M mute) + pointer drag steering.
- `game/src/audio.js` — WebAudio synthesized SFX, no audio files.
- `game/src/config.js`, `game/src/random.js` — tuning + seeded RNG (mulberry32).
- `screenshots/1-start.jpg`, `2-play.jpg`, `3-boss.jpg`, `4-end.jpg` — real renders of this game in headless Chrome 157 at 1280x720, converted to JPEG quality 85 (49, 30, 37, 35 KiB).
- `LICENSE` (MIT), `README.md` (3 make.fun badges), `.makefun/owner.json` (`{"wallet": "8pFyEMQmk8y4zAiuefwnKFEcwFbPPHu6KatX9cZZZ2tY"}`), `serve.ts` (dev server only), `shots.json`.

## Game concept

**Starfall Salvage** — a top-down arena shooter. Pilot the salvage ship through
10 waves: drifting asteroids, homing weavers, orb-lobbing spitters, and a
dreadnaught boss (radial bursts, health bar) every 5th wave. Blast enemies for
star shards, build a combo multiplier up to x6, grab shield / rapid-fire /
bomb power-ups. Clear wave 10 to win the sector, then keep flying endless.
Score, wave, ships, combo meter, bombs, timers and boss bar are all in the HUD.

## Decisions

1. **Original game, not the starter.** The starter (Block Dodger, house ladder level 2) was used only as the architecture reference (fixed-step loop, seeded RNG, `?shot=` staging, dossier hand-in). Every game file was written fresh for this entry: different genre mechanics (shooting, waves, boss, combo, power-ups), different renderer, different world.
2. **Screenshots via CDP, not `--virtual-time-budget`.** Chrome's `--screenshot --virtual-time-budget` captured a blank frame (the CSS background only) — it shoots before requestAnimationFrame paint. A small Node CDP driver (`/tmp/shot.mjs`, Node's built-in WebSocket) navigates to each `?shot=` URL, waits for `window.__shotReady`, then captures. No exceptions, no console errors on any shot.
3. **Boss shot staging.** The autopilot plays waves 1–4 for real, but it dies in wave 4 (the swarm is genuinely hard). The boss scene therefore falls back to jumping straight to wave 5 through the world's own `startWave(5)` + `spawnEnemy()` and simulating the fight for real — boss, health bar, radial bursts, escorts and HUD are all genuinely simulated and rendered. If the pilot kills the dreadnaught mid-fight, a fresh one is brought in so the frame shows the boss alive. Documented here, not hidden: the frame is a real render of the game's own code, staged through its own functions.
4. **Bomb vs boss.** A bomb originally wiped everything including the boss, which both trivialised the boss fight and kept killing the boss in the staged frame. Now a bomb dents the boss for 15 HP instead of killing it.
5. **Difficulty.** Early waves were eased slightly after the first autopilot died in wave 2 (drifter 120→108, weaver 165→148, spawn interval 1.15→1.3 s, spitter orbs 210→185, boss bursts 10→8 orbs every 1.8 s). The game is still hard: the staging autopilot, which plays near-optimally, dies around wave 4–5.

## Bugs found and fixed during testing

1. **Space could not start the game.** Space was in both the FIRE and CONFIRM key sets, and the FIRE branch ran first, so the press never queued a confirm. Fixed: the FIRE branch now also queues confirm for Space. Verified by a live CDP play-test: Space starts the game ("Playing. 3 lives…"), the ship fires and steers, score rose to 150 in the first seconds.
2. **Ship invisible in the play shot.** The ship blinks while invulnerable after a hit; the staged frame caught it mid-blink. Fixed: `stageShot` forces `invulnerable = 0` before returning a scene.
3. **Play scene landed in a wave gap.** A fixed 26–30 s clock could land in the quiet seconds between waves. Fixed: the play scene now simulates until wave 3 is busy (≥5 enemies active).

## Test results

- **Determinism: PASS** — `main.ts` run twice into two output dirs, `diff -r` byte-identical (after the final input.js fix).
- **Gate self-check (`/tmp/gate-check-game.mjs`): 28 passed, 0 failed** — game/ 10 entries / 56,716 bytes, no symlinks, index.html 813 bytes; no http/fetch/bare/node: references in any reachable script; 4 screenshots, each ≤256 KiB, all 1280x720 JPEG; dossier 263,423 bytes (≤1.5 MiB), text 57,374 bytes, 4 images; /output 17 entries / 472,969 bytes; vendor byte-identical; owner.json wallet correct; README carries 3 badges; no secrets in source.
- **Live play-test (CDP, real keyboard events): PASS** — title → Space → "Playing. 3 lives…", ship fires and steers, score increases, zero exceptions, zero console errors. All four `?shot=` scenes render with no exceptions and no console errors.
- **Not tested:** the server-side gate and the AI judge — there is no local grade for this bounty; gate + judge outcomes only surface after a real submission (1 of 10 total). The win screen (wave 10 clear) was not screenshotted or play-tested end-to-end — reaching wave 10 takes several minutes of skilled play; the victory code path shares the same panel renderer as the verified game-over screen.

## Remaining blockers (for the parent)

1. **Transcript gate — biggest risk.** No transcript bundle exists for this build; none was fabricated. Parent must bundle the real recorded sessions before `check`/`submit` can pass (≥30% authored lines, ≥5 assistant turns, run record required from 17 Nov, Muse `--muse-usage` rows where applicable). This build session started after the competition opened (15 Nov 18:00 UTC), so the window rule is satisfied.
2. **No GitHub repo yet** — this directory is not a git repo. Parent must create the public repo (after 2026-11-15T18:00:00Z opening), commit, set GitHub About website + `makefun` topic. README badges assume owner `karlinafitri176-bit` / repo `best-game-01` — update if the real repo name differs, or `repo_readme` fails.
3. **Deadline is very tight** — Thu 19 Nov 01:00 WIB. Submit early enough to allow a fix-and-resubmit cycle within the 5/day, 10-total budget.
4. **Judge is subjective and screenshot-led** — only the top 10 places pay ($400/$200/$120/$40); the field is expected to be 10,000–15,000 entries with the final cut at place 40.
