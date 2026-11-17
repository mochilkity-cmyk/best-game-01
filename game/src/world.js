// The game's rules and state, with no drawing and no browser in it: the ship,
// the waves of enemies, bullets, shards, power-ups, combo and score. step()
// advances one fixed step and returns what happened as bit flags, so the caller
// can react without the world knowing about screens or sound. The pools are
// allocated once, at boot; nothing here allocates after createWorld returns.

import {
  BOMBS_MAX, BOMBS_START, COMBO, ENEMY, FIELD, LIVES, ORB, PLAYER,
  POOL, POWERUP, SHARD, WAVE, WIN_WAVE,
} from './config.js';

export const KIND_DRIFTER = 0;
export const KIND_WEAVER = 1;
export const KIND_SPITTER = 2;
export const KIND_BOSS = 3;

export const EVENT_HIT = 1;
export const EVENT_SHARD = 2;
export const EVENT_OVER = 4;
export const EVENT_WAVE = 8;
export const EVENT_WIN = 16;
export const EVENT_BOMB = 32;
export const EVENT_POWER = 64;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: 0, y: 0, invulnerable: 0, shield: 0, rapid: 0,
    shieldTime: 0, rapidTime: 0, fireTimer: 0,
  };
  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({ active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, r: 0, hp: 0, maxHp: 0, shotTimer: 0, spin: 0, phase: 0 });
  }
  const bullets = [];
  for (let i = 0; i < POOL.bullets; i += 1) bullets.push({ active: false, x: 0, y: 0 });
  const orbs = [];
  for (let i = 0; i < POOL.orbs; i += 1) orbs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  const shards = [];
  for (let i = 0; i < POOL.shards; i += 1) shards.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, size: 0, color: 0 });
  const popups = [];
  for (let i = 0; i < POOL.popups; i += 1) popups.push({ active: false, x: 0, y: 0, life: 0, text: '', color: '' });
  const powerups = [];
  for (let i = 0; i < POOL.powerups; i += 1) powerups.push({ active: false, kind: '', x: 0, y: 0 });
  const stars = [];
  for (let layer = 0; layer < 3; layer += 1) {
    for (let i = 0; i < 46; i += 1) {
      stars.push({ x: random() * FIELD.width, y: random() * FIELD.height, layer, size: layer === 0 ? 1 : layer === 1 ? 2 : 3 });
    }
  }

  const state = {
    player, enemies, bullets, orbs, shards, particles, popups, powerups, stars,
    score: 0, lives: LIVES, wave: 1, combo: 0, comboTimer: 0, bombs: BOMBS_START,
    kills: 0, shardsGot: 0, elapsed: 0, shake: 0, boss: null,
    remaining: 0, spawnTimer: 0, clearTimer: 0, clearing: false, victory: false,
    banner: '', bannerTimer: 0,
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height - 110;
    player.invulnerable = 0;
    player.shield = 0;
    player.rapid = 0;
    player.shieldTime = 0;
    player.rapidTime = 0;
    player.fireTimer = 0;
    for (const list of [enemies, bullets, orbs, shards, particles, popups, powerups]) {
      for (const item of list) item.active = false;
    }
    state.score = 0;
    state.lives = LIVES;
    state.wave = 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.bombs = BOMBS_START;
    state.kills = 0;
    state.shardsGot = 0;
    state.elapsed = 0;
    state.shake = 0;
    state.boss = null;
    state.clearing = false;
    state.clearTimer = 0;
    state.victory = false;
    startWave(1);
  }

  function waveQuota(wave) {
    return WAVE.baseQuota + WAVE.quotaPerWave * (wave - 1);
  }

  function waveInterval(wave) {
    return Math.max(WAVE.minInterval, WAVE.spawnInterval * WAVE.intervalScale ** (wave - 1));
  }

  function startWave(wave) {
    state.wave = wave;
    state.remaining = waveQuota(wave);
    state.spawnTimer = 0.8;
    state.clearing = false;
    state.clearTimer = 0;
    state.banner = wave % 5 === 0 ? `WAVE ${wave} — DREADNAUGHT` : `WAVE ${wave}`;
    state.bannerTimer = 2.2;
    if (wave % 5 === 0) state.remaining += 0; // the boss arrives with the wave
  }

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function anyActive(list) {
    for (let i = 0; i < list.length; i += 1) if (list[i].active) return true;
    return false;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.max = 0.45 + random() * 0.4;
      p.life = p.max;
      p.size = 2 + random() * 3;
      p.color = color;
    }
  }

  function popup(x, y, text, color) {
    const p = free(popups);
    if (p === null) return;
    p.active = true;
    p.x = x; p.y = y;
    p.life = 0.9;
    p.text = text;
    p.color = color;
  }

  function spawnEnemy(kind) {
    const e = free(enemies);
    if (e === null) return;
    const def = kind === KIND_DRIFTER ? ENEMY.drifter
      : kind === KIND_WEAVER ? ENEMY.weaver
      : kind === KIND_SPITTER ? ENEMY.spitter : ENEMY.boss;
    e.active = true;
    e.kind = kind;
    e.r = def.radius;
    e.hp = def.hp + Math.floor((state.wave - 1) / 4);
    e.maxHp = e.hp;
    e.spin = random() * Math.PI * 2;
    e.phase = random() * Math.PI * 2;
    e.shotTimer = 1 + random();
    if (kind === KIND_BOSS) {
      e.x = FIELD.width / 2;
      e.y = -def.radius;
      e.vx = 0;
      e.vy = def.speed;
      state.boss = e;
      return;
    }
    e.x = 40 + random() * (FIELD.width - 80);
    e.y = -def.radius - random() * 60;
    e.vx = (random() - 0.5) * 60;
    e.vy = def.speed * (0.9 + random() * 0.3) * (1 + (state.wave - 1) * 0.04);
  }

  function pickKind() {
    const wave = state.wave;
    const roll = random();
    if (wave >= 3 && roll < 0.18) return KIND_SPITTER;
    if (wave >= 2 && roll < 0.45) return KIND_WEAVER;
    return KIND_DRIFTER;
  }

  function dropShards(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const s = free(shards);
      if (s === null) return;
      s.active = true;
      s.x = x + (random() - 0.5) * 36;
      s.y = y + (random() - 0.5) * 20;
      s.vx = (random() - 0.5) * 90;
      s.vy = 40 + random() * 60;
    }
  }

  function dropPowerup(x, y) {
    if (random() > POWERUP.dropChance) return;
    const p = free(powerups);
    if (p === null) return;
    p.active = true;
    p.kind = POWERUP.kinds[Math.floor(random() * POWERUP.kinds.length)];
    p.x = x;
    p.y = y;
  }

  function killEnemy(e, award) {
    e.active = false;
    if (e.kind === KIND_BOSS) state.boss = null;
    state.kills += 1;
    const def = e.kind === KIND_DRIFTER ? ENEMY.drifter
      : e.kind === KIND_WEAVER ? ENEMY.weaver
      : e.kind === KIND_SPITTER ? ENEMY.spitter : ENEMY.boss;
    if (award) {
      const mult = 1 + state.combo;
      const gained = def.score * mult;
      state.score += gained;
      state.combo = Math.min(COMBO.max, state.combo + 1);
      state.comboTimer = COMBO.decay;
      popup(e.x, e.y, `+${gained}`, '#ffd23e');
    }
    burst(e.x, e.y, e.kind === KIND_BOSS ? 4 : e.kind === KIND_WEAVER ? 2 : e.kind === KIND_SPITTER ? 3 : 1, e.kind === KIND_BOSS ? 42 : 14, e.kind === KIND_BOSS ? 320 : 200);
    dropShards(e.x, e.y, def.shards);
    dropPowerup(e.x, e.y);
  }

  function fireOrb(x, y, vx, vy) {
    const o = free(orbs);
    if (o === null) return;
    o.active = true;
    o.x = x; o.y = y;
    o.vx = vx; o.vy = vy;
  }

  function hurtPlayer() {
    if (player.shield > 0) {
      player.shield -= 1;
      state.shake = Math.max(state.shake, 0.25);
      burst(player.x, player.y, 5, 18, 240);
      return EVENT_HIT;
    }
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = Math.max(state.shake, 0.5);
    burst(player.x, player.y, 2, 26, 280);
    if (state.lives <= 0) return EVENT_HIT | EVENT_OVER;
    return EVENT_HIT;
  }

  function useBomb() {
    if (state.bombs <= 0 || state.clearing) return 0;
    state.bombs -= 1;
    state.shake = 0.8;
    for (const e of enemies) {
      if (!e.active) continue;
      // A bomb wipes the swarm, but the dreadnaught is armoured: it only
      // takes a heavy dent, so the boss fight cannot be skipped with a bomb.
      if (e.kind === KIND_BOSS) {
        e.hp -= 15;
        burst(e.x, e.y, 4, 20, 300);
        if (e.hp <= 0) killEnemy(e, false);
        continue;
      }
      killEnemy(e, false);
      state.score += 25;
    }
    for (const o of orbs) o.active = false;
    burst(player.x, player.y, 5, 40, 420);
    return EVENT_BOMB;
  }

  function applyPowerup(kind) {
    if (kind === 'shield') {
      player.shield = Math.min(2, player.shield + 1);
      player.shieldTime = POWERUP.shieldTime;
    } else if (kind === 'rapid') {
      player.rapid = 1;
      player.rapidTime = POWERUP.rapidTime;
    } else if (kind === 'bomb') {
      state.bombs = Math.min(BOMBS_MAX, state.bombs + 1);
    }
    return EVENT_POWER;
  }

  /**
   * One fixed step. `move` is {x, y} in -1..1 (keys, or a pointer target
   * resolved by the caller), `firing` and `bomb` are this frame's presses.
   * With `harmless` set (the title screen's backdrop) things drift but
   * nothing shoots, scores or touches the player.
   */
  function step(dt, move, firing, bomb, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.8);

    // The starfield always drifts, even behind the title.
    for (const s of stars) {
      s.y += (14 + s.layer * 22) * dt;
      if (s.y > FIELD.height + 4) {
        s.y = -4;
        s.x = random() * FIELD.width;
      }
    }

    // The ship.
    player.x = Math.min(FIELD.width - 24, Math.max(24, player.x + move.x * PLAYER.speed * dt));
    player.y = Math.min(FIELD.height - 24, Math.max(90, player.y + move.y * PLAYER.speed * dt));
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.shieldTime > 0) {
      player.shieldTime -= dt;
      if (player.shieldTime <= 0) player.shield = 0;
    }
    if (player.rapidTime > 0) {
      player.rapidTime -= dt;
      if (player.rapidTime <= 0) player.rapid = 0;
    }

    if (harmless) {
      // Title backdrop: drifters only, no scoring, no collisions.
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(KIND_DRIFTER);
        state.spawnTimer = 1.1;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        e.y += e.vy * dt;
        e.x += e.vx * dt;
        if (e.y > FIELD.height + 40) e.active = false;
      }
      return 0;
    }

    if (bomb) events |= useBomb();

    // Firing.
    player.fireTimer -= dt;
    if (firing && player.fireTimer <= 0) {
      const b = free(bullets);
      if (b !== null) {
        b.active = true;
        b.x = player.x;
        b.y = player.y - 26;
        player.fireTimer = player.rapid ? PLAYER.rapidInterval : PLAYER.fireInterval;
      }
    }

    // Spawning: boss waves open with the boss, then the regular quota.
    if (!state.clearing) {
      if (state.wave % 5 === 0 && state.boss === null && state.remaining === waveQuota(state.wave) && !anyActive(enemies)) {
        spawnEnemy(KIND_BOSS);
      }
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.remaining > 0) {
        spawnEnemy(pickKind());
        state.remaining -= 1;
        state.spawnTimer = waveInterval(state.wave);
      }
    }

    // Bullets.
    for (const b of bullets) {
      if (!b.active) continue;
      b.y -= PLAYER.bulletSpeed * dt;
      if (b.y < -20) { b.active = false; continue; }
      for (const e of enemies) {
        if (!e.active) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (e.r + 8) * (e.r + 8)) {
          b.active = false;
          e.hp -= 1;
          burst(b.x, b.y, 0, 4, 120);
          if (e.hp <= 0) killEnemy(e, true);
          break;
        }
      }
    }

    // Enemies.
    for (const e of enemies) {
      if (!e.active) continue;
      e.spin += dt * 2;
      if (e.kind === KIND_DRIFTER) {
        e.y += e.vy * dt;
        e.x += e.vx * dt + Math.sin(state.elapsed * 2 + e.phase) * 12 * dt;
        if (e.x < e.r) { e.x = e.r; e.vx = Math.abs(e.vx); }
        if (e.x > FIELD.width - e.r) { e.x = FIELD.width - e.r; e.vx = -Math.abs(e.vx); }
        if (e.y > FIELD.height + 50) e.active = false;
      } else if (e.kind === KIND_WEAVER) {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        e.x += (dx / len) * e.vy * dt;
        e.y += (dy / len) * e.vy * dt * 0.8 + 30 * dt;
        if (e.y > FIELD.height + 50) e.active = false;
      } else if (e.kind === KIND_SPITTER) {
        e.y += e.vy * dt;
        if (e.y > 150) e.y = 150;
        e.x += Math.sin(state.elapsed + e.phase) * 40 * dt;
        e.shotTimer -= dt;
        if (e.shotTimer <= 0) {
          e.shotTimer = ENEMY.spitter.shotInterval;
          const dx = player.x - e.x;
          const dy = player.y - e.y;
          const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          fireOrb(e.x, e.y + e.r, (dx / len) * ORB.speed, (dy / len) * ORB.speed);
        }
      } else if (e.kind === KIND_BOSS) {
        if (e.y < 130) e.y += 200 * dt;
        else {
          e.x = FIELD.width / 2 + Math.sin(state.elapsed * 0.7) * 380;
          e.shotTimer -= dt;
          if (e.shotTimer <= 0) {
            e.shotTimer = ENEMY.boss.shotInterval;
            for (let i = 0; i < 8; i += 1) {
              const a = (i / 8) * Math.PI * 2 + state.elapsed;
              fireOrb(e.x, e.y + 40, Math.cos(a) * ORB.speed * 0.8, Math.sin(a) * ORB.speed * 0.8);
            }
          }
        }
      }
      // Collision with the ship.
      if (player.invulnerable === 0 && dist2(e.x, e.y, player.x, player.y) < (e.r + 16) * (e.r + 16)) {
        const wasBoss = e.kind === KIND_BOSS;
        if (!wasBoss) {
          e.hp = 0;
          killEnemy(e, false);
        }
        events |= hurtPlayer();
        if (events & EVENT_OVER) return events;
      }
    }

    // Enemy orbs.
    for (const o of orbs) {
      if (!o.active) continue;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) { o.active = false; continue; }
      if (player.invulnerable === 0 && dist2(o.x, o.y, player.x, player.y) < (ORB.radius + 16) * (ORB.radius + 16)) {
        o.active = false;
        events |= hurtPlayer();
        if (events & EVENT_OVER) return events;
      }
    }

    // Shards: fall, magnetise, collect.
    for (const s of shards) {
      if (!s.active) continue;
      const d2 = dist2(s.x, s.y, player.x, player.y);
      if (d2 < SHARD.magnet * SHARD.magnet) {
        const d = Math.max(1, Math.sqrt(d2));
        s.vx += ((player.x - s.x) / d) * 900 * dt;
        s.vy += ((player.y - s.y) / d) * 900 * dt;
      } else {
        s.vy = Math.min(SHARD.speed, s.vy + 60 * dt);
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > FIELD.height + 20) { s.active = false; continue; }
      if (d2 < SHARD.collect * SHARD.collect) {
        s.active = false;
        state.shardsGot += 1;
        const gained = 10 * (1 + state.combo);
        state.score += gained;
        state.combo = Math.min(COMBO.max, state.combo + 1);
        state.comboTimer = COMBO.decay;
        popup(s.x, s.y, `+${gained}`, '#ffd23e');
        events |= EVENT_SHARD;
      }
    }

    // Power-ups.
    for (const p of powerups) {
      if (!p.active) continue;
      p.y += POWERUP.fallSpeed * dt;
      if (p.y > FIELD.height + 20) { p.active = false; continue; }
      if (dist2(p.x, p.y, player.x, player.y) < 34 * 34) {
        p.active = false;
        events |= applyPowerup(p.kind);
        popup(p.x, p.y, p.kind === 'shield' ? 'SHIELD!' : p.kind === 'rapid' ? 'RAPID FIRE!' : 'BOMB +1', '#6ec6ff');
      }
    }

    // Combo decay.
    if (state.combo > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // Particles and popups.
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    for (const p of popups) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.y -= 42 * dt;
    }

    // Wave clear: quota spent and nothing left alive.
    if (!state.clearing && state.remaining <= 0 && !anyActive(enemies) && !anyActive(orbs)) {
      state.clearing = true;
      state.clearTimer = 2.4;
      const bonus = 200 + state.wave * 100;
      state.score += bonus;
      state.bombs = Math.min(BOMBS_MAX, state.bombs + 1);
      popup(FIELD.width / 2, FIELD.height / 2 - 40, `WAVE ${state.wave} CLEAR  +${bonus}`, '#5ef2c8');
      events |= EVENT_WAVE;
      if (state.wave >= WIN_WAVE) {
        state.victory = true;
        return events | EVENT_WIN;
      }
    }
    if (state.clearing) {
      state.clearTimer -= dt;
      if (state.clearTimer <= 0) startWave(state.wave + 1);
    }

    return events;
  }

  reset();
  return { state, reset, step, startWave, spawnEnemy };
}
