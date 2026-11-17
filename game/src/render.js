// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Everything is drawn with canvas paths and gradients
// — no images, no network. Text that holds a number is rebuilt only when the
// number changes, so a frame allocates nothing.

import { FIELD, FONT, LIVES, PALETTE, WIN_WAVE } from './config.js';
import { KIND_BOSS, KIND_DRIFTER, KIND_SPITTER, KIND_WEAVER } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** Nebula blobs: fixed positions so the backdrop is the same every visit. */
const NEBULAE = [
  { x: 220, y: 140, r: 260, color: '#3b2a6e' },
  { x: 1050, y: 420, r: 300, color: '#173a5e' },
  { x: 640, y: 640, r: 240, color: '#2a1a4e' },
  { x: 1150, y: 90, r: 180, color: '#0f2a4a' },
];

const PANEL = { width: 680, top: 150, line: 34, bottom: 78 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const waveGotLabel = cachedLabel('WAVE ');
  const killsLabel = cachedLabel('SALVAGED ');
  let bgGradient = null;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
    bgGradient = null;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawBackground(state) {
    if (bgGradient === null) {
      bgGradient = context.createLinearGradient(0, 0, 0, FIELD.height);
      bgGradient.addColorStop(0, PALETTE.spaceTop);
      bgGradient.addColorStop(1, PALETTE.spaceBottom);
    }
    context.fillStyle = bgGradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const n of NEBULAE) {
      const g = context.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, n.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = g;
      context.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    for (const s of state.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(state.elapsed * (1 + s.layer) + s.x);
      context.globalAlpha = twinkle * (0.35 + s.layer * 0.25);
      context.fillStyle = '#dfe8ff';
      context.fillRect(s.x, s.y, s.size, s.size);
    }
    context.globalAlpha = 1;
  }

  function drawShip(state) {
    const p = state.player;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0) return;
    const cx = p.x;
    const cy = p.y;
    // Engine flame, flickering with time.
    const flame = 14 + Math.sin(state.elapsed * 31) * 5;
    context.fillStyle = '#ff9f43';
    context.beginPath();
    context.moveTo(cx - 9, cy + 18);
    context.lineTo(cx, cy + 18 + flame);
    context.lineTo(cx + 9, cy + 18);
    context.closePath();
    context.fill();
    // Hull: a dart with swept wings.
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(cx, cy - 22);
    context.lineTo(cx + 13, cy + 8);
    context.lineTo(cx + 23, cy + 16);
    context.lineTo(cx + 7, cy + 14);
    context.lineTo(cx, cy + 8);
    context.lineTo(cx - 7, cy + 14);
    context.lineTo(cx - 23, cy + 16);
    context.lineTo(cx - 13, cy + 8);
    context.closePath();
    context.fill();
    context.fillStyle = '#0b1030';
    context.beginPath();
    context.arc(cx, cy - 4, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#bffbe9';
    context.beginPath();
    context.arc(cx, cy - 5, 2.5, 0, Math.PI * 2);
    context.fill();
    // Shield ring.
    if (p.shield > 0) {
      context.strokeStyle = PALETTE.shield;
      context.globalAlpha = 0.75;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(cx, cy, 34, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  function drawEnemy(e, elapsed) {
    const cx = e.x;
    const cy = e.y;
    if (e.kind === KIND_DRIFTER) {
      context.save();
      context.translate(cx, cy);
      context.rotate(e.spin * 0.4);
      context.fillStyle = PALETTE.drifter;
      context.beginPath();
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * Math.PI * 2;
        const r = e.r * (0.78 + 0.22 * Math.sin(i * 2.7 + e.phase));
        if (i === 0) context.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else context.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.drifterDark;
      context.beginPath();
      context.arc(-e.r * 0.25, -e.r * 0.2, e.r * 0.28, 0, Math.PI * 2);
      context.arc(e.r * 0.3, e.r * 0.3, e.r * 0.2, 0, Math.PI * 2);
      context.fill();
      context.restore();
    } else if (e.kind === KIND_WEAVER) {
      context.save();
      context.translate(cx, cy);
      context.rotate(Math.sin(elapsed * 3 + e.phase) * 0.5);
      context.fillStyle = PALETTE.weaver;
      context.beginPath();
      context.moveTo(0, e.r);
      context.lineTo(e.r * 0.9, -e.r * 0.4);
      context.lineTo(0, -e.r * 0.2);
      context.lineTo(-e.r * 0.9, -e.r * 0.4);
      context.closePath();
      context.fill();
      context.fillStyle = '#ffe3d6';
      context.beginPath();
      context.arc(0, 0, 5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    } else if (e.kind === KIND_SPITTER) {
      context.fillStyle = PALETTE.spitter;
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = cx + Math.cos(a) * e.r;
        const py = cy + Math.sin(a) * e.r;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      const pulse = 5 + Math.sin(elapsed * 5 + e.phase) * 2;
      context.fillStyle = '#f3e8ff';
      context.beginPath();
      context.arc(cx, cy, pulse, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === KIND_BOSS) {
      context.save();
      context.translate(cx, cy);
      context.rotate(Math.sin(elapsed * 0.8) * 0.08);
      context.fillStyle = PALETTE.bossDark;
      context.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? e.r : e.r * 0.78;
        if (i === 0) context.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else context.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.boss;
      context.beginPath();
      context.arc(0, 0, e.r * 0.55, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd6de';
      context.beginPath();
      context.arc(0, 0, e.r * 0.22, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawField(state) {
    drawBackground(state);
    for (const s of state.shards) {
      if (!s.active) continue;
      context.save();
      context.translate(s.x, s.y);
      context.rotate(state.elapsed * 3);
      context.fillStyle = PALETTE.shard;
      context.beginPath();
      context.moveTo(0, -9);
      context.lineTo(7, 0);
      context.lineTo(0, 9);
      context.lineTo(-7, 0);
      context.closePath();
      context.fill();
      context.restore();
    }
    for (const p of state.powerups) {
      if (!p.active) continue;
      const color = p.kind === 'shield' ? PALETTE.shield : p.kind === 'rapid' ? PALETTE.rapid : PALETTE.bomb;
      context.fillStyle = color;
      context.beginPath();
      context.arc(p.x, p.y, 15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0b1030';
      text(p.kind === 'shield' ? 'S' : p.kind === 'rapid' ? 'R' : 'B', p.x, p.y + 6, 16, '#0b1030', 'center');
    }
    for (const e of state.enemies) {
      if (e.active) drawEnemy(e, state.elapsed);
    }
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.fillStyle = PALETTE.bullet;
      context.fillRect(b.x - 3, b.y - 10, 6, 18);
      context.globalAlpha = 0.4;
      context.fillRect(b.x - 1.5, b.y - 22, 3, 12);
      context.globalAlpha = 1;
    }
    for (const o of state.orbs) {
      if (!o.active) continue;
      context.fillStyle = PALETTE.orb;
      context.beginPath();
      context.arc(o.x, o.y, 8, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 0.35;
      context.beginPath();
      context.arc(o.x, o.y, 13, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    for (const p of state.particles) {
      if (!p.active) continue;
      const colors = ['#ffd23e', '#ff7a59', '#c77dff', '#5ef2c8', '#6ec6ff', '#ff5964'];
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = colors[p.color] || '#ffffff';
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
    drawShip(state);
    for (const p of state.popups) {
      if (!p.active) continue;
      context.globalAlpha = Math.min(1, p.life / 0.45);
      text(p.text, p.x, p.y, 20, p.color, 'center');
    }
    context.globalAlpha = 1;
    // Wave banner.
    if (state.bannerTimer > 0) {
      context.globalAlpha = Math.min(1, state.bannerTimer);
      text(state.banner, FIELD.width / 2, 300, 44, PALETTE.text, 'center');
      context.globalAlpha = 1;
    }
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left');
    text(waveLabel(state.wave), FIELD.width / 2, 18, 30, PALETTE.text, 'center');
    // Lives as little ships.
    const firstLife = FIELD.width - 24 - LIVES * 34;
    text('SHIPS', firstLife - 14, 20, 26, PALETTE.text, 'right');
    for (let i = 0; i < LIVES; i += 1) {
      const x = firstLife + i * 34 + 17;
      context.fillStyle = i < state.lives ? PALETTE.player : '#2a3040';
      context.beginPath();
      context.moveTo(x, 22);
      context.lineTo(x + 9, 40);
      context.lineTo(x - 9, 40);
      context.closePath();
      context.fill();
    }
    // Combo meter under the score.
    if (state.combo > 0) {
      text(`COMBO x${1 + state.combo}`, 24, 56, 22, PALETTE.gold, 'left');
      context.fillStyle = '#2a3040';
      context.fillRect(24, 84, 120, 8);
      context.fillStyle = PALETTE.gold;
      context.fillRect(24, 84, 120 * (state.comboTimer / 4), 8);
    }
    // Bombs and timers, bottom-left.
    text(`BOMBS ${state.bombs}  [B]`, 24, FIELD.height - 40, 22, state.bombs > 0 ? PALETTE.bomb : PALETTE.muted, 'left');
    let timers = '';
    if (state.player.shield > 0) timers += `SHIELD ${Math.ceil(state.player.shieldTime)}s  `;
    if (state.player.rapid) timers += `RAPID ${Math.ceil(state.player.rapidTime)}s`;
    if (timers !== '') text(timers, FIELD.width - 24, FIELD.height - 40, 22, PALETTE.shield, 'right');
    // Boss health bar.
    if (state.boss !== null) {
      const bw = 420;
      const bx = (FIELD.width - bw) / 2;
      text('DREADNAUGHT', FIELD.width / 2, 58, 20, PALETTE.boss, 'center');
      context.fillStyle = '#2a3040';
      context.fillRect(bx, 82, bw, 12);
      context.fillStyle = PALETTE.boss;
      context.fillRect(bx, 82, bw * Math.max(0, state.boss.hp / state.boss.maxHp), 12);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(5, 8, 20, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 52, accent || PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.gold, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const sx = state.shake > 0 ? Math.sin(state.elapsed * 61) * state.shake * 14 : 0;
    const sy = state.shake > 0 ? Math.cos(state.elapsed * 53) * state.shake * 14 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Blast the swarm. Salvage every star shard.',
        'Move: ← → ↑ ↓ or W A S D — drag with the mouse, too.',
        'Fire: hold Space — Bomb: B — Pause: P — Mute: M',
        `Clear ${WIN_WAVE} waves to win the sector. Boss every 5th wave.`,
        '',
      ];
      lines[4] = best > 0 ? bestLabel(best) : 'No salvage yet — be the first.';
      drawPanel('STARFALL SALVAGE', lines, 'Press Space or click to launch', PALETTE.player);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The swarm will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const lines = [finalLabel(state.score), bestLabel(best), waveGotLabel(state.wave), killsLabel(state.kills)];
      drawPanel('SHIP LOST', lines, 'Press Space or click to fly again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      const lines = [finalLabel(state.score), bestLabel(best), waveGotLabel(state.wave), 'The sector is yours — keep flying, or rest.'];
      drawPanel('SECTOR CLEARED!', lines, 'Press Space to keep flying — or P to pause', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);

  /** Convert a pointer's client pixels to logical playfield coordinates. */
  function toLogical(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    return {
      x: (clientX * ratio - view.x) / view.scale,
      y: (clientY * ratio - view.y) / view.scale,
    };
  }

  return { draw, toLogical };
}
