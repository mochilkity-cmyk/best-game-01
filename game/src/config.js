// Starfall Salvage — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  width: 46,
  height: 38,
  speed: 430,
  fireInterval: 0.16,
  rapidInterval: 0.08,
  bulletSpeed: 640,
  invulnerable: 1.6,
};

export const LIVES = 3;
export const WIN_WAVE = 10;
export const BOMBS_START = 1;
export const BOMBS_MAX = 3;

export const ENEMY = {
  // drifter: a tumbling asteroid that falls and drifts sideways.
  drifter: { radius: 26, hp: 1, speed: 108, score: 50, shards: 1 },
  // weaver: a hunter that steers toward the ship.
  weaver: { radius: 22, hp: 2, speed: 148, score: 100, shards: 2 },
  // spitter: holds near the top and lobs slow orbs at the ship.
  spitter: { radius: 24, hp: 2, speed: 90, score: 150, shards: 2, shotInterval: 2.5 },
  // dreadnaught: the boss of every 5th wave, big, slow, radial bursts.
  boss: { radius: 74, hp: 60, speed: 46, score: 2000, shards: 12, shotInterval: 1.8 },
};

export const BULLET = { width: 6, height: 16 };
export const ORB = { radius: 8, speed: 185 };
export const SHARD = { radius: 9, speed: 150, magnet: 170, collect: 30 };

/** Combo: each kill or shard pickup adds one step; it decays after a quiet spell. */
export const COMBO = { max: 5, decay: 4.0, stepScore: 25 };

/** Seconds of play a wave's spawn quota is spread over; later waves spawn faster. */
export const WAVE = { baseQuota: 8, quotaPerWave: 3, spawnInterval: 1.3, intervalScale: 0.93, minInterval: 0.38 };

export const POWERUP = {
  kinds: ['shield', 'rapid', 'bomb'],
  shieldTime: 12,
  rapidTime: 10,
  dropChance: 0.16,
  fallSpeed: 130,
};

export const POOL = { enemies: 48, bullets: 96, orbs: 64, shards: 96, particles: 256, popups: 24, powerups: 8 };

export const PALETTE = {
  backdrop: '#070a18',
  spaceTop: '#0b1030',
  spaceBottom: '#131a3d',
  nebulaA: '#3b2a6e',
  nebulaB: '#173a5e',
  ground: '#1c2340',
  player: '#5ef2c8',
  playerDark: '#1f9d7d',
  bullet: '#ffe066',
  orb: '#ff6b9d',
  shard: '#ffd23e',
  drifter: '#b08968',
  drifterDark: '#7d5a3c',
  weaver: '#ff7a59',
  spitter: '#c77dff',
  boss: '#ff4d6d',
  bossDark: '#8f1d3a',
  shield: '#6ec6ff',
  rapid: '#ffb703',
  bomb: '#ff5964',
  panel: '#12172e',
  panelEdge: '#2c3a6e',
  text: '#f2f5ff',
  muted: '#9aa5c9',
  gold: '#ffd23e',
  danger: '#ff5964',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'starfall-salvage.best';
