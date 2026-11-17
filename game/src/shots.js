// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (keep clear of enemies and orbs, chase the nearest shard,
// fire constantly), so the frame is what a short game really looks like and the
// same seed always gives the same frame. The boss scene fast-forwards through
// the early waves until the wave-5 dreadnaught is in the fight.

import { FIELD, PLAYER, STEP } from './config.js';
import { EVENT_OVER, KIND_BOSS, KIND_DRIFTER, KIND_SPITTER, KIND_WEAVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 60;
/** The play scene stops once wave 3 is properly under way, not at a fixed
 * clock time — a fixed time can land in the quiet gap between two waves. */
const PLAY_MIN_WAVE = 3;
const PLAY_MIN_ENEMIES = 5;
const BOSS_FIGHT_SECONDS = 9;
const BOSS_LIMIT_SECONDS = 420;
const END_LIMIT_SECONDS = 600;

/**
 * How far ahead, in seconds, the autopilot checks each way it could move: the
 * play scene's pilot looks well ahead and keeps its ships; the end scene's
 * looks only a moment ahead and never fires, so it is caught out once the
 * swarm thickens, as a hurried player is.
 */
const HORIZON_PLAY = 0.7;
const HORIZON_END = 0.25;
const SAMPLE = 1 / 30;
const DIRECTIONS = [
  { x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 },
  { x: 0, y: -1 }, { x: 0, y: 1 },
  { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
];

/** Danger at (x, y) over the next `horizon` seconds: near enemies and orbs.
 * Weavers steer toward the ship, so their future position is predicted along
 * that bearing rather than along their current velocity. */
function dangerAt(state, x, y, horizon) {
  let danger = 0;
  for (const e of state.enemies) {
    if (!e.active) continue;
    let px = e.x;
    let py = e.y;
    if (e.kind === 1) {
      // Weaver: closing on the ship's current position.
      const dx = state.player.x - e.x;
      const dy = state.player.y - e.y;
      const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      px = e.x + (dx / len) * e.vy * horizon;
      py = e.y + (dy / len) * e.vy * horizon;
    } else if (e.kind === 0) {
      px = e.x + e.vx * horizon;
      py = e.y + e.vy * horizon;
    }
    const dx = px - x;
    const dy = py - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const near = e.r + 38;
    if (d < near) danger += (1 - d / near) * (e.kind === 3 ? 3 : e.kind === 1 ? 1.6 : 1);
  }
  for (const o of state.orbs) {
    if (!o.active) continue;
    const px = o.x + o.vx * horizon;
    const py = o.y + o.vy * horizon;
    const dx = px - x;
    const dy = py - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 48) danger += 1 - d / 48;
  }
  return danger;
}

/** The safest of the nine ways to move, biased toward the nearest shard and
 * toward a firing lane (an enemy straight above, where bullets will land). */
function autopilot(state, horizon) {
  const p = state.player;
  let shard = null;
  let shardD = Infinity;
  for (const s of state.shards) {
    if (!s.active) continue;
    const dx = s.x - p.x;
    const dy = s.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < shardD) { shardD = d; shard = s; }
  }
  let best = DIRECTIONS[0];
  let bestScore = -Infinity;
  for (const dir of DIRECTIONS) {
    const nx = Math.min(FIELD.width - 24, Math.max(24, p.x + dir.x * PLAYER.speed * 0.35));
    const ny = Math.min(FIELD.height - 24, Math.max(90, p.y + dir.y * PLAYER.speed * 0.35));
    let score = -dangerAt(state, nx, ny, horizon) * 120;
    // Firing lane: an enemy above, near this x, is worth holding — except
    // the boss, whose radial bursts come straight down the same lane.
    for (const e of state.enemies) {
      if (!e.active || e.kind === 3 || e.y > ny - 40) continue;
      if (Math.abs(e.x - nx) < 46) score += 7;
    }
    if (shard !== null) {
      const before = Math.abs(shard.x - p.x) + Math.abs(shard.y - p.y);
      const after = Math.abs(shard.x - nx) + Math.abs(shard.y - ny);
      score += (before - after) * 0.08;
    }
    // Prefer the lower half of the field, where the ship belongs.
    score -= Math.max(0, 420 - ny) * 0.02;
    if (score > bestScore) { bestScore = score; best = dir; }
  }
  return best;
}

function activeEnemies(state) {
  let count = 0;
  for (const e of state.enemies) if (e.active) count += 1;
  return count;
}

function playFor(world, seconds, horizon, firing, stopAtBoss) {
  const limit = seconds / STEP;
  for (let index = 0; index < limit; index += 1) {
    const move = autopilot(world.state, horizon);
    // A bomb when the swarm closes in and the ship is cornered.
    const bomb = world.state.bombs > 0 && dangerAt(world.state, world.state.player.x, world.state.player.y, 0.4) > 1.2;
    const events = world.step(STEP, move, firing, bomb, false);
    if (events & EVENT_OVER) return 'over';
    if (stopAtBoss && world.state.boss !== null) return 'boss';
  }
  return 'play';
}

/** Play until wave 3 is busy (or the pilot dies, or time runs out). */
function playBusy(world, seconds, horizon) {
  const limit = seconds / STEP;
  for (let index = 0; index < limit; index += 1) {
    const move = autopilot(world.state, horizon);
    const bomb = world.state.bombs > 0 && dangerAt(world.state, world.state.player.x, world.state.player.y, 0.4) > 1.2;
    if (world.step(STEP, move, true, bomb, false) & EVENT_OVER) return 'over';
    if (world.state.wave >= PLAY_MIN_WAVE && activeEnemies(world.state) >= PLAY_MIN_ENEMIES) return 'play';
  }
  return 'play';
}

/**
 * Set `world` to the named scene (start, play, boss or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  // The staged frame is a photograph: the ship must be visible, never caught
  // mid-blink from a hit taken a moment earlier.
  const visible = (scene) => {
    world.state.player.invulnerable = 0;
    return scene;
  };
  if (name !== 'play' && name !== 'boss' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, false, false, true);
    return visible({ screen: SCREEN_TITLE, best: 0 });
  }
  if (name === 'boss') {
    // Fight through waves 1-4, then spar with the dreadnaught a while.
    const reached = playFor(world, BOSS_LIMIT_SECONDS, HORIZON_PLAY, true, true);
    if (reached === 'boss') {
      playFor(world, BOSS_FIGHT_SECONDS, HORIZON_PLAY, true, false);
    } else {
      // Fallback: the pilot did not survive to wave 5, so jump straight to
      // the dreadnaught fight and simulate it for real — the boss, its health
      // bar, its radial bursts and the swarm around it are all the game's own
      // code, staged through the world's own spawn and step functions.
      world.reset();
      world.startWave(5);
      world.spawnEnemy(KIND_BOSS);
      world.spawnEnemy(KIND_WEAVER);
      world.spawnEnemy(KIND_WEAVER);
      world.spawnEnemy(KIND_SPITTER);
      world.spawnEnemy(KIND_DRIFTER);
      world.spawnEnemy(KIND_DRIFTER);
      playFor(world, BOSS_FIGHT_SECONDS + 4, HORIZON_PLAY, true, false);
    }
    // The pilot may have killed the dreadnaught during the fight: bring in a
    // fresh one and let it descend and open fire, so the frame shows the boss
    // alive with its health bar.
    if (world.state.boss === null && world.state.lives > 0) {
      world.spawnEnemy(KIND_BOSS);
      playFor(world, 5, HORIZON_PLAY, true, false);
    }
    return visible({ screen: world.state.lives === 0 ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score });
  }
  if (name === 'end') {
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      const move = autopilot(world.state, HORIZON_END);
      if (world.step(STEP, move, false, false, false) & EVENT_OVER) break;
    }
    return visible({ screen: SCREEN_OVER, best: world.state.score });
  }
  const outcome = playBusy(world, PLAY_SECONDS, HORIZON_PLAY);
  return visible({ screen: outcome === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score });
}
