// LENTERA LAUT — drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin filled with
// the backdrop colour. The signature look is dark water against the diver's warm lantern:
// a radial darkness mask centred on the diver, a light cone in the facing direction, and
// glowing pearls, fish and lures in the dark.
import { FIELD, FONT, LIGHT, LIVES, PALETTE, UPGRADES, WARDEN, WIN_TARGET, ZONE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_SURFACE = 'surface';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 128, line: 32, bottom: 64 };

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function zoneName(y) {
    if (y < ZONE.twilight.top) return ZONE.shallows.name;
    if (y < ZONE.abyss.top) return ZONE.twilight.name;
    return ZONE.abyss.name;
  }

  function drawWater(state) {
    const g = context.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.waterTop);
    g.addColorStop(0.45, PALETTE.waterMid);
    g.addColorStop(1, PALETTE.waterBottom);
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // God rays from the surface, swaying gently with time.
    context.save();
    context.globalAlpha = 0.10;
    context.fillStyle = '#bfe9ff';
    for (let i = 0; i < 5; i += 1) {
      const x = 120 + i * 240 + Math.sin(state.elapsed * 0.3 + i * 1.7) * 30;
      context.beginPath();
      context.moveTo(x, FIELD.surfaceY);
      context.lineTo(x + 70, FIELD.surfaceY);
      context.lineTo(x + 190, 520);
      context.lineTo(x + 60, 520);
      context.closePath();
      context.fill();
    }
    context.restore();

    // The surface: a bright wavy line and the sky glow above it.
    context.fillStyle = PALETTE.surface;
    context.globalAlpha = 0.85;
    for (let x = 0; x < FIELD.width; x += 16) {
      const y = FIELD.surfaceY + Math.sin(x * 0.02 + state.elapsed * 2) * 3;
      context.fillRect(x, y, 16, 3);
    }
    context.globalAlpha = 1;
    context.fillStyle = '#0a2a3d';
    context.fillRect(0, 0, FIELD.width, FIELD.surfaceY - 6);
    context.fillStyle = '#9fd8e8';
    context.fillRect(0, FIELD.surfaceY - 6, FIELD.width, 2);
  }

  function drawReef(state) {
    // Seabed.
    context.fillStyle = PALETTE.sand;
    context.beginPath();
    context.moveTo(0, FIELD.height);
    context.lineTo(0, 692);
    for (let x = 0; x <= FIELD.width; x += 80) {
      context.lineTo(x, 692 + Math.sin(x * 0.01 + 2) * 6);
    }
    context.lineTo(FIELD.width, FIELD.height);
    context.closePath();
    context.fill();

    // Corals: branching stalks in warm colours.
    for (const c of state.corals) {
      const sway = Math.sin(state.elapsed * 0.7 + c.phase) * 4;
      const color = [PALETTE.coralA, PALETTE.coralB, PALETTE.coralC][c.color];
      context.strokeStyle = color;
      context.lineWidth = 5;
      context.lineCap = 'round';
      for (let b = 0; b < c.branches; b += 1) {
        const spread = (b - (c.branches - 1) / 2) * 14;
        context.beginPath();
        context.moveTo(c.x, c.baseY);
        context.quadraticCurveTo(
          c.x + spread * 0.4 + sway, c.baseY - c.height * 0.6,
          c.x + spread + sway, c.baseY - c.height,
        );
        context.stroke();
      }
      context.fillStyle = color;
      context.beginPath();
      context.arc(c.x + sway, c.baseY - c.height, 4, 0, Math.PI * 2);
      context.fill();
    }

    // Seaweed swaying.
    context.strokeStyle = PALETTE.weed;
    context.lineWidth = 4;
    context.lineCap = 'round';
    for (const w of state.weeds) {
      const sway = Math.sin(state.elapsed * 1.1 + w.phase) * 10;
      context.beginPath();
      context.moveTo(w.x, w.baseY);
      context.quadraticCurveTo(w.x + sway * 0.4, w.baseY - w.height * 0.6, w.x + sway, w.baseY - w.height);
      context.stroke();
    }
  }

  function drawPearl(p, lightOn) {
    const def = [PALETTE.pearlSmall, PALETTE.pearlMedium, PALETTE.pearlLarge, PALETTE.pearlHeart][p.kind];
    const glow = lightOn ? 0.9 : 0.3;
    const halo = context.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.radius * 3.2);
    halo.addColorStop(0, def);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    context.save();
    context.globalAlpha = glow;
    context.fillStyle = halo;
    context.beginPath();
    context.arc(p.x, p.y, p.radius * 3.2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.fillStyle = def;
    context.beginPath();
    context.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.9)';
    context.beginPath();
    context.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.3, 0, Math.PI * 2);
    context.fill();
  }

  function drawGlowfish(f) {
    const color = f.color === 0 ? PALETTE.glowfish : PALETTE.glowfishB;
    const halo = context.createRadialGradient(f.x, f.y, 1, f.x, f.y, 16);
    halo.addColorStop(0, color);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = halo;
    context.beginPath();
    context.arc(f.x, f.y, 16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(f.x, f.y, 7, 3.5, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(f.x - f.dir * 7, f.y);
    context.lineTo(f.x - f.dir * 13, f.y - 4);
    context.lineTo(f.x - f.dir * 13, f.y + 4);
    context.closePath();
    context.fill();
  }

  function drawShark(s) {
    const angle = Math.atan2(s.vy, s.vx);
    context.save();
    context.translate(s.x, s.y);
    context.rotate(angle);
    context.fillStyle = PALETTE.shark;
    context.beginPath();
    context.ellipse(0, 0, 34, 12, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(-30, 0);
    context.lineTo(-48, -14);
    context.lineTo(-48, 14);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(-6, -10);
    context.lineTo(4, -26);
    context.lineTo(12, -10);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.sharkEye;
    context.beginPath();
    context.arc(20, -4, 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawWarden(w) {
    context.save();
    context.translate(w.x, w.y);
    context.fillStyle = PALETTE.warden;
    context.beginPath();
    context.arc(0, 0, WARDEN.radius, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(-WARDEN.radius, 0);
    context.lineTo(-WARDEN.radius - 22, -16);
    context.lineTo(-WARDEN.radius - 22, 16);
    context.closePath();
    context.fill();
    // Big jaw.
    context.fillStyle = '#120a1e';
    context.beginPath();
    context.ellipse(14, 12, 20, 10, 0.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#eaf6ff';
    for (let i = 0; i < 5; i += 1) {
      context.beginPath();
      context.moveTo(0 + i * 8, 4);
      context.lineTo(4 + i * 8, 12);
      context.lineTo(8 + i * 8, 4);
      context.closePath();
      context.fill();
    }
    // The lure: a stalk with a glowing bulb — it looks like a pearl on purpose.
    const lureX = 26;
    const lureY = -WARDEN.radius - 6;
    context.strokeStyle = PALETTE.warden;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(10, -20);
    context.quadraticCurveTo(20, -WARDEN.radius - 12, lureX, lureY);
    context.stroke();
    const halo = context.createRadialGradient(lureX, lureY, 1, lureX, lureY, 26);
    halo.addColorStop(0, PALETTE.wardenLure);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = halo;
    context.beginPath();
    context.arc(lureX, lureY, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.wardenLure;
    context.beginPath();
    context.arc(lureX, lureY, 6, 0, Math.PI * 2);
    context.fill();
    // Glowing eye.
    context.fillStyle = '#ff5e5e';
    context.beginPath();
    context.arc(16, -10, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawDiver(state, world) {
    const d = state.diver;
    const blink = d.invulnerable > 0 && Math.floor(d.invulnerable * 10) % 2 === 0;
    if (blink) return;
    context.save();
    context.translate(d.x, d.y);
    context.rotate(d.facing);
    // Fins.
    context.fillStyle = PALETTE.diverDark;
    context.beginPath();
    context.moveTo(-12, -6);
    context.lineTo(-26, -12);
    context.lineTo(-26, 12);
    context.lineTo(-12, 6);
    context.closePath();
    context.fill();
    // Body.
    context.fillStyle = PALETTE.diver;
    context.beginPath();
    context.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
    context.fill();
    // Tank.
    context.fillStyle = '#c8d6e0';
    context.fillRect(-14, -14, 20, 6);
    // Helmet.
    context.fillStyle = PALETTE.helmet;
    context.beginPath();
    context.arc(12, 0, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#9fd8e8';
    context.beginPath();
    context.arc(14, 0, 5, 0, Math.PI * 2);
    context.fill();
    // The lantern, held ahead.
    context.fillStyle = '#3a2a12';
    context.fillRect(20, -4, 8, 8);
    context.fillStyle = PALETTE.light;
    context.beginPath();
    context.arc(30, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // Lantern halo + light cone (drawn in world space, additive).
    if (d.lightOn) {
      const range = world.lightRange();
      const lx = d.x + Math.cos(d.facing) * 30;
      const ly = d.y + Math.sin(d.facing) * 30;
      context.save();
      context.globalCompositeOperation = 'lighter';
      const halo = context.createRadialGradient(lx, ly, 4, lx, ly, range * 0.55);
      halo.addColorStop(0, 'rgba(255, 215, 106, 0.30)');
      halo.addColorStop(1, 'rgba(255, 215, 106, 0)');
      context.fillStyle = halo;
      context.beginPath();
      context.arc(lx, ly, range * 0.55, 0, Math.PI * 2);
      context.fill();
      // Cone.
      const cone = context.createLinearGradient(lx, ly, lx + Math.cos(d.facing) * range, ly + Math.sin(d.facing) * range);
      cone.addColorStop(0, 'rgba(255, 215, 106, 0.34)');
      cone.addColorStop(1, 'rgba(255, 215, 106, 0)');
      context.fillStyle = cone;
      context.beginPath();
      context.moveTo(lx, ly);
      context.arc(lx, ly, range, d.facing - LIGHT.coneHalf, d.facing + LIGHT.coneHalf);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  function drawDarkness(state) {
    const d = state.diver;
    const depth = clamp01((d.y - FIELD.surfaceY) / (FIELD.height - FIELD.surfaceY));
    const range = 260;
    const inner = d.lightOn ? range * 0.45 : 40;
    const outer = d.lightOn ? range * 1.5 : 210;
    const outerAlpha = d.lightOn ? 0.22 + depth * 0.5 : 0.3 + depth * 0.55;
    const g = context.createRadialGradient(d.x, d.y, inner, d.x, d.y, outer);
    g.addColorStop(0, 'rgba(2, 8, 18, 0)');
    g.addColorStop(1, `rgba(2, 8, 18, ${outerAlpha.toFixed(3)})`);
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawBubbles(state) {
    context.fillStyle = PALETTE.bubble;
    for (const b of state.bubbles) {
      if (!b.active) continue;
      context.globalAlpha = 0.55;
      context.beginPath();
      context.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawSparkles(state) {
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    for (const s of state.sparkles) {
      if (!s.active) continue;
      const a = (s.life / s.max) * 0.9;
      context.globalAlpha = a;
      const r = 4 + (1 - s.life / s.max) * 10;
      context.beginPath();
      context.moveTo(s.x - r, s.y);
      context.lineTo(s.x + r, s.y);
      context.moveTo(s.x, s.y - r);
      context.lineTo(s.x, s.y + r);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function bar(x, y, w, h, frac, fill, label, valueText) {
    context.fillStyle = 'rgba(4, 18, 31, 0.75)';
    context.fillRect(x - 2, y - 2, w + 4, h + 4);
    context.fillStyle = '#0a2a3d';
    context.fillRect(x, y, w, h);
    context.fillStyle = fill;
    context.fillRect(x, y, Math.max(0, w * clamp01(frac)), h);
    text(label, x, y + h + 4, 13, PALETTE.muted, 'left');
    if (valueText) text(valueText, x + w, y + h + 4, 13, PALETTE.text, 'right');
  }

  function drawHud(state, world) {
    const d = state.diver;
    context.textBaseline = 'top';
    const maxO = world.maxOxygen();
    const maxB = world.maxBattery();
    bar(24, 20, 220, 16, state.oxygen / maxO, state.oxygen < 15 ? PALETTE.danger : '#4fc3f7', 'OXYGEN', `${Math.ceil(state.oxygen)}s`);
    bar(24, 58, 220, 16, state.battery / maxB, d.lightOn ? PALETTE.light : PALETTE.muted, 'LAMP (F)', d.lightOn ? 'ON' : 'OFF');
    // Lives.
    text('LIVES', FIELD.width - 24, 20, 13, PALETTE.muted, 'right');
    for (let i = 0; i < LIVES; i += 1) {
      context.fillStyle = i < state.lives ? '#ff6b81' : 'rgba(255,255,255,0.15)';
      const cx = FIELD.width - 24 - i * 26;
      context.beginPath();
      context.arc(cx - 16, 44, 8, 0, Math.PI * 2);
      context.arc(cx - 4, 44, 8, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(cx - 24, 46);
      context.lineTo(cx + 4, 46);
      context.lineTo(cx - 10, 62);
      context.closePath();
      context.fill();
    }
    // Carried pearls and banked total.
    context.fillStyle = PALETTE.pearlMedium;
    context.beginPath();
    context.arc(FIELD.width - 200, 92, 8, 0, Math.PI * 2);
    context.fill();
    text(`Carried ${state.carried}`, FIELD.width - 186, 84, 20, PALETTE.text, 'left');
    text(`Banked ${state.banked} / ${WIN_TARGET}`, FIELD.width - 24, 108, 20, PALETTE.good, 'right');
    // Depth + zone.
    const depthM = Math.max(0, Math.round((d.y - FIELD.surfaceY) / 10));
    text(`${zoneName(d.y)}  •  ${depthM}m  •  Dive ${Math.max(1, state.dive)}`, FIELD.width / 2, 20, 20, PALETTE.text, 'center');
    // Depth meter on the right edge.
    const meterX = FIELD.width - 10;
    const meterTop = 150;
    const meterH = 380;
    context.fillStyle = 'rgba(4, 18, 31, 0.75)';
    context.fillRect(meterX - 3, meterTop - 3, 8, meterH + 6);
    context.fillStyle = '#0a2a3d';
    context.fillRect(meterX - 1, meterTop, 4, meterH);
    context.fillStyle = '#4fc3f7';
    const frac = clamp01((d.y - FIELD.surfaceY) / (FIELD.height - FIELD.surfaceY));
    context.fillRect(meterX - 1, meterTop, 4, Math.max(4, meterH * frac));
    // Controls hint, on a dark strip so it reads over the reef.
    context.fillStyle = 'rgba(4, 18, 31, 0.6)';
    context.fillRect(0, FIELD.height - 28, FIELD.width, 28);
    context.textBaseline = 'alphabetic';
    text('WASD / arrows to swim  •  Shift to sprint  •  F lamp  •  P pause', 24, FIELD.height - 10, 15, PALETTE.muted, 'left');
    context.textBaseline = 'top';
  }

  function drawPanel(title, lines, prompt, extra) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom + (extra || 0);
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(4, 18, 31, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 76, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 23, PALETTE.light, 'center');
    context.textBaseline = 'top';
  }

  function drawShopRows(state, y, x, width) {
    const keys = ['tank', 'lamp', 'fins'];
    context.textBaseline = 'alphabetic';
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const def = UPGRADES[key];
      const level = state.upgrades[key];
      const maxed = level >= def.levels;
      const cost = maxed ? 0 : def.costs[level];
      const affordable = !maxed && state.balance >= cost;
      const rowY = y + i * 34;
      context.fillStyle = affordable ? PALETTE.text : PALETTE.muted;
      text(`[${i + 1}] ${def.name} ${def.desc}`, x, rowY, 20, affordable ? PALETTE.text : PALETTE.muted, 'left');
      const pips = '●'.repeat(level) + '○'.repeat(def.levels - level);
      text(pips, x + width * 0.62, rowY, 20, PALETTE.light, 'left');
      text(maxed ? 'MAX' : `$${cost}`, x + width, rowY, 20, maxed ? PALETTE.good : affordable ? PALETTE.good : PALETTE.danger, 'right');
    }
    context.textBaseline = 'top';
  }

  /** Paint one frame: water, reef, creatures, diver, darkness, then HUD or a panel. */
  function draw(state, screen, best, world) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWater(state);
    drawReef(state);
    for (const p of state.pearls) if (p.active) drawPearl(p, state.diver.lightOn);
    for (const f of state.glowfish) drawGlowfish(f);
    for (const s of state.sharks) if (s.active) drawShark(s);
    drawWarden(state.warden);
    drawDiver(state, world);
    drawBubbles(state);
    drawSparkles(state);
    drawDarkness(state);
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'LENTERA LAUT',
        [
          'Dive by lantern-light. Bring the pearls home.',
          'Swim with WASD or arrows — hold Shift to sprint.',
          'Your lamp draws treasure — and sharks. Press F to douse it.',
          'Surface to bank your pearls. Bank 500 to become Master of the Reef.',
          '',
          `Best ${best}`,
        ],
        'Press Space or click to dive',
      );
      return;
    }
    drawHud(state, world);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The reef will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_SURFACE) {
      const lines = [
        `Banked ${state.banked} of ${WIN_TARGET} pearls  •  Balance $${state.balance}`,
        'Spend your balance on upgrades, then dive again.',
        '',
        '',
        '',
      ];
      const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
      const x = (FIELD.width - PANEL.width) / 2;
      const y = (FIELD.height - height) / 2;
      context.fillStyle = 'rgba(4, 18, 31, 0.55)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.fillStyle = PALETTE.panel;
      context.fillRect(x, y, PANEL.width, height);
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      context.strokeRect(x, y, PANEL.width, height);
      context.textBaseline = 'alphabetic';
      text('Back at the Surface', FIELD.width / 2, y + 76, 42, PALETTE.text, 'center');
      text(lines[0], FIELD.width / 2, y + PANEL.top, 21, PALETTE.muted, 'center');
      text(lines[1], FIELD.width / 2, y + PANEL.top + 32, 21, PALETTE.muted, 'center');
      drawShopRows(state, y + PANEL.top + 92, x + 48, PANEL.width - 96);
      text('Press Space to dive again', FIELD.width / 2, y + height - 34, 23, PALETTE.light, 'center');
      context.textBaseline = 'top';
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'The Reef Claims You',
        [`Banked ${state.banked} of ${WIN_TARGET} pearls.`, `Best ${best}`, ''],
        'Press Space or click to dive again',
      );
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        'Master of the Reef!',
        [`You banked ${state.banked} pearls — the reef is yours.`, `Best ${best}`, ''],
        'Press Space or click to dive again',
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
