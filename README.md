![best-game-01](https://make.fun/badge/best-game-01.svg)
![rank](https://make.fun/badge/best-game-01/mochilkity-cmyk/best-game-01/rank.svg)
![reward](https://make.fun/badge/best-game-01/mochilkity-cmyk/best-game-01/reward.svg)

# Starfall Salvage

An entry for [make.fun](https://make.fun) competition **best-game-01**
([bounty page](https://make.fun/bounty/best-game-01)).

A top-down arena shooter: pilot the salvage ship through ten waves of
drifters, weavers and spitters, blast them for star shards, build a combo
multiplier, grab shield / rapid-fire / bomb power-ups, and face a
dreadnaught boss every fifth wave. Clear wave 10 to win the sector — then
keep flying endless, if you dare.

## Controls

- **Move:** Arrow keys or W A S D — or drag with the mouse
- **Fire:** hold Space (or hold the mouse)
- **Bomb:** B — clears the screen, limited stock
- **Pause:** P — **Mute:** M
- **Start / restart:** Space, Enter, or click

## What is in the game

- **4 enemy types** — drifting asteroids, homing weavers, orb-lobbing
  spitters, and a dreadnaught boss with radial bursts and a health bar
- **Waves with a goal** — each wave has a spawn quota; clear it for a bonus
  and a free bomb, then the next wave comes faster and meaner
- **Combo system** — kills and shard pickups raise the multiplier up to x5;
  taking a hit resets it
- **Power-ups** — shield (absorbs hits), rapid fire, extra bombs
- **Juice** — parallax starfield, nebulae, particle explosions, screen shake,
  floating score popups, synthesized WebAudio sound effects (no files)
- **Complete loop** — title screen, HUD (score, wave, ships, combo, bombs,
  timers, boss bar), pause, game over with best score, victory screen with
  endless continuation

## Run it

```bash
node serve.ts   # then open http://localhost:8080
```

## Hand it in

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Deterministic: `main.ts` copies `game/` and `screenshots/` and writes
`dossier.json` with the vendored make.fun library. Two runs write
byte-identical output. The game itself loads zero network requests — every
script and image is a file under `game/`, and the sound is synthesized live.

## Layout

- `main.ts` — the program that hands the game in
- `vendor/makefun-game.ts` — make.fun's dossier library, unchanged
- `game/` — the static game (`index.html`, `src/main.js`, `world.js`,
  `render.js`, `shots.js`, `input.js`, `audio.js`, `config.js`, `random.js`)
- `screenshots/` — four real renders of the game (title, play, boss, game over)
- `LICENSE` — MIT
