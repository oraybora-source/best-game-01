// LENTERA LAUT — the game's rules and state, with no drawing and no browser in it:
// the diver, the pearls, the sharks, the Warden, oxygen, battery, banking and upgrades.
// step() advances one fixed step and returns what happened as bit flags, so the caller can
// react without the world knowing about screens or sound. Nothing here allocates after
// createWorld returns.
import {
  BATTERY, DIVER, FIELD, LIGHT, LIVES, OXYGEN, PEARL, SHARK, STEP, UPGRADES, WARDEN, WIN_TARGET, ZONE,
} from './config.js';

export const EVENT_COLLECT = 1;
export const EVENT_BANK = 2;
export const EVENT_HIT = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_OXYGEN = 32;

const KIND_SMALL = 0;
const KIND_MEDIUM = 1;
const KIND_LARGE = 2;
const KIND_HEART = 3;

const KIND_DEFS = [PEARL.small, PEARL.medium, PEARL.large, PEARL.heart];
const KIND_ZONES = [ZONE.shallows, ZONE.twilight, ZONE.abyss, ZONE.abyss];
const KIND_COUNTS = [PEARL.small.count, PEARL.medium.count, PEARL.large.count, PEARL.heart.count];

function zoneOf(y) {
  if (y < ZONE.twilight.top) return ZONE.shallows;
  if (y < ZONE.abyss.top) return ZONE.twilight;
  return ZONE.abyss;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function createWorld(random) {
  const diver = {
    x: FIELD.width / 2, y: FIELD.surfaceY + 10, vx: 0, vy: 0,
    facing: Math.PI / 2, invulnerable: 0, lightOn: true,
  };
  const pearls = [];
  for (let kind = 0; kind < 4; kind += 1) {
    for (let n = 0; n < KIND_COUNTS[kind]; n += 1) {
      pearls.push({
        active: false, kind, x: 0, baseY: 0, y: 0, phase: random() * Math.PI * 2,
        respawn: 0, value: KIND_DEFS[kind].value, radius: KIND_DEFS[kind].radius,
      });
    }
  }
  const sharks = [];
  for (let i = 0; i < SHARK.maxCount; i += 1) {
    sharks.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, speed: 0, wander: 0 });
  }
  const warden = { x: 640, y: 620, dir: 1, retreat: 0, phase: 0 };
  const glowfish = [];
  for (let i = 0; i < 10; i += 1) {
    glowfish.push({
      x: random() * FIELD.width, y: 120 + random() * 520, speed: 20 + random() * 30,
      dir: random() < 0.5 ? -1 : 1, phase: random() * Math.PI * 2,
      color: random() < 0.6 ? 0 : 1,
    });
  }
  const bubbles = [];
  for (let i = 0; i < 24; i += 1) bubbles.push({ active: false, x: 0, y: 0, vy: 0, r: 0, life: 0 });
  const sparkles = [];
  for (let i = 0; i < 32; i += 1) sparkles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0 });
  const corals = [];
  for (let i = 0; i < 14; i += 1) {
    corals.push({
      x: 30 + random() * (FIELD.width - 60), baseY: FIELD.height - 4,
      height: 24 + random() * 44, branches: 2 + Math.floor(random() * 3),
      color: Math.floor(random() * 3), phase: random() * Math.PI * 2,
    });
  }
  const weeds = [];
  for (let i = 0; i < 22; i += 1) {
    weeds.push({
      x: 20 + random() * (FIELD.width - 40), baseY: FIELD.height - 4,
      height: 30 + random() * 50, phase: random() * Math.PI * 2,
    });
  }

  const state = {
    diver, pearls, sharks, warden, glowfish, bubbles, sparkles, corals, weeds,
    carried: 0, carriedCount: 0, banked: 0, balance: 0, lives: LIVES,
    oxygen: OXYGEN.base, battery: BATTERY.base, dive: 0, diving: false,
    upgrades: { tank: 0, lamp: 0, fins: 0 }, elapsed: 0,
    sharkTimer: SHARK.spawnInterval, bubbleTimer: 0, over: false, won: false,
  };

  function maxOxygen() { return OXYGEN.base + OXYGEN.tankBonus * state.upgrades.tank; }
  function maxBattery() { return BATTERY.base + BATTERY.lampBonus * state.upgrades.lamp; }
  function lightRange() { return LIGHT.baseRange + LIGHT.lampBonus * state.upgrades.lamp; }
  function maxSpeed() { return DIVER.maxSpeed * (1 + 0.15 * state.upgrades.fins); }

  function placePearl(pearl) {
    const zone = KIND_ZONES[pearl.kind];
    pearl.x = 60 + random() * (FIELD.width - 120);
    pearl.baseY = zone.top + 24 + random() * (zone.bottom - zone.top - 48);
    pearl.y = pearl.baseY;
    pearl.active = true;
    pearl.respawn = 0;
  }

  function spawnBubble() {
    for (const b of bubbles) {
      if (b.active) continue;
      b.active = true;
      b.x = diver.x + (random() - 0.5) * 10;
      b.y = diver.y - 10;
      b.vy = 30 + random() * 25;
      b.r = 2 + random() * 3;
      b.life = 0;
      return;
    }
  }

  function spawnSparkle(x, y) {
    let made = 0;
    for (const s of sparkles) {
      if (s.active || made >= 6) continue;
      s.active = true;
      s.x = x;
      s.y = y;
      const a = random() * Math.PI * 2;
      s.vx = Math.cos(a) * (30 + random() * 50);
      s.vy = Math.sin(a) * (30 + random() * 50);
      s.life = 0.5;
      s.max = 0.5;
      made += 1;
    }
  }

  function reset() {
    diver.x = FIELD.width / 2;
    diver.y = FIELD.surfaceY + 10;
    diver.vx = 0;
    diver.vy = 0;
    diver.facing = Math.PI / 2;
    diver.invulnerable = 0;
    diver.lightOn = true;
    for (const p of pearls) placePearl(p);
    for (const s of sharks) s.active = false;
    warden.x = 640;
    warden.y = 620;
    warden.dir = 1;
    warden.retreat = 0;
    warden.phase = 0;
    for (const b of bubbles) b.active = false;
    for (const s of sparkles) s.active = false;
    state.carried = 0;
    state.carriedCount = 0;
    state.banked = 0;
    state.balance = 0;
    state.lives = LIVES;
    state.oxygen = maxOxygen();
    state.battery = maxBattery();
    state.dive = 0;
    state.diving = false;
    state.upgrades = { tank: 0, lamp: 0, fins: 0 };
    state.elapsed = 0;
    state.sharkTimer = SHARK.spawnInterval;
    state.bubbleTimer = 0;
    state.over = false;
    state.won = false;
  }

  function buyUpgrade(key) {
    const def = UPGRADES[key];
    const level = state.upgrades[key];
    if (level >= def.levels) return false;
    const cost = def.costs[level];
    if (state.balance < cost) return false;
    state.balance -= cost;
    state.upgrades[key] = level + 1;
    if (key === 'tank') state.oxygen = maxOxygen();
    if (key === 'lamp') state.battery = maxBattery();
    return true;
  }

  function freeShark() {
    for (const s of sharks) if (!s.active) return s;
    return null;
  }

  function spawnShark() {
    const s = freeShark();
    if (s === null) return;
    const fromLeft = random() < 0.5;
    s.active = true;
    s.x = fromLeft ? -40 : FIELD.width + 40;
    s.y = 300 + random() * 380;
    s.vx = 0;
    s.vy = 0;
    s.speed = Math.min(SHARK.maxSpeed, SHARK.baseSpeed + SHARK.speedPerDive * state.dive);
    s.wander = random() * Math.PI * 2;
  }

  /**
   * One fixed step. `input` is {x, y} (a direction, -1..1 each), `sprint` a boolean,
   * `lightToggle` a one-shot press. Returns event bit flags.
   */
  function step(dt, input, sprint, lightToggle) {
    let events = 0;
    state.elapsed += dt;
    if (diver.invulnerable > 0) diver.invulnerable = Math.max(0, diver.invulnerable - dt);

    if (lightToggle && state.battery > 0) diver.lightOn = !diver.lightOn;
    if (diver.lightOn && state.battery <= 0) diver.lightOn = false;

    const surfaced = diver.y <= FIELD.surfaceY + 8;
    if (surfaced) {
      state.diving = false;
      state.oxygen = Math.min(maxOxygen(), state.oxygen + 10 * dt);
      state.battery = Math.min(maxBattery(), state.battery + BATTERY.surfaceRecharge * dt);
      if (state.carried > 0) {
        state.banked += state.carried;
        state.balance += state.carried;
        state.carried = 0;
        state.carriedCount = 0;
        events |= EVENT_BANK;
        if (state.banked >= WIN_TARGET && !state.won) {
          state.won = true;
          events |= EVENT_WIN;
        }
      }
    } else {
      const zone = zoneOf(diver.y);
      const drain = zone.oxygenDrain * (sprint ? DIVER.sprintOxygenMult : 1);
      state.oxygen -= drain * dt;
      if (diver.lightOn) state.battery = Math.max(0, state.battery - BATTERY.drain * dt);
      if (!state.diving && diver.y > FIELD.surfaceY + 40) {
        state.diving = true;
        state.dive += 1;
      }
      if (state.oxygen <= 0) {
        // Out of air deep down: rescued to the surface, but it costs a life.
        // The rescue brings your haul up with you, so it is banked at once.
        state.oxygen = maxOxygen() * 0.5;
        diver.y = FIELD.surfaceY + 10;
        diver.vx = 0;
        diver.vy = 0;
        diver.invulnerable = DIVER.invulnerable;
        state.lives -= 1;
        events |= EVENT_OXYGEN;
        if (state.carried > 0) {
          state.banked += state.carried;
          state.balance += state.carried;
          state.carried = 0;
          state.carriedCount = 0;
          events |= EVENT_BANK;
          if (state.banked >= WIN_TARGET && !state.won) {
            state.won = true;
            events |= EVENT_WIN;
          }
        }
        if (state.lives <= 0) {
          state.over = true;
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    // Diver movement: inertia, drag, speed cap.
    const speedCap = maxSpeed() * (sprint ? DIVER.sprintMult : 1);
    const accel = DIVER.accel * (sprint ? DIVER.sprintMult : 1);
    diver.vx += input.x * accel * dt;
    diver.vy += input.y * accel * dt;
    const drag = Math.exp(-DIVER.drag * dt);
    diver.vx *= drag;
    diver.vy *= drag;
    const speed = Math.sqrt(diver.vx * diver.vx + diver.vy * diver.vy);
    if (speed > speedCap) {
      diver.vx = (diver.vx / speed) * speedCap;
      diver.vy = (diver.vy / speed) * speedCap;
    }
    diver.x += diver.vx * dt;
    diver.y += diver.vy * dt;
    diver.x = Math.min(FIELD.width - 16, Math.max(16, diver.x));
    diver.y = Math.min(FIELD.height - 16, Math.max(FIELD.surfaceY - 4, diver.y));
    if (speed > 20) diver.facing = Math.atan2(diver.vy, diver.vx);

    // Bubbles from the diver.
    state.bubbleTimer -= dt;
    if (state.bubbleTimer <= 0 && !surfaced) {
      spawnBubble();
      state.bubbleTimer = 0.4;
    }

    // Pearls: bob, collect, respawn.
    for (const p of pearls) {
      if (!p.active) {
        p.respawn -= dt;
        if (p.respawn <= 0) placePearl(p);
        continue;
      }
      p.y = p.baseY + Math.sin(state.elapsed * 1.5 + p.phase) * 6;
      if (dist(diver.x, diver.y, p.x, p.y) < DIVER.radius + p.radius) {
        p.active = false;
        p.respawn = KIND_DEFS[p.kind].respawn;
        state.carried += p.value;
        state.carriedCount += 1;
        spawnSparkle(p.x, p.y);
        events |= EVENT_COLLECT;
      }
    }

    // Sharks: spawn, hunt the light, hit.
    state.sharkTimer -= dt;
    const maxSharks = Math.min(SHARK.maxCount, 1 + Math.floor(state.dive / 2));
    let activeSharks = 0;
    for (const s of sharks) if (s.active) activeSharks += 1;
    if (state.sharkTimer <= 0 && activeSharks < maxSharks && state.diving) {
      spawnShark();
      state.sharkTimer = SHARK.spawnInterval;
    }
    const attract = diver.lightOn ? LIGHT.attractOn : LIGHT.attractOff;
    for (const s of sharks) {
      if (!s.active) continue;
      const d = dist(s.x, s.y, diver.x, diver.y);
      if (d < attract && state.diving) {
        const tx = (diver.x - s.x) / (d || 1);
        const ty = (diver.y - s.y) / (d || 1);
        s.vx += tx * 260 * dt;
        s.vy += ty * 260 * dt;
      } else {
        s.wander += (random() - 0.5) * 2 * dt;
        s.vx += Math.cos(s.wander) * 60 * dt;
        s.vy += Math.sin(s.wander) * 60 * dt;
      }
      const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      const cap = s.speed * (d < attract && state.diving ? 1 : 0.5);
      if (sp > cap) {
        s.vx = (s.vx / sp) * cap;
        s.vy = (s.vy / sp) * cap;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.y = Math.min(700, Math.max(120, s.y));
      if (s.x < -80 || s.x > FIELD.width + 80) s.active = false;
      if (state.diving && diver.invulnerable === 0 && dist(s.x, s.y, diver.x, diver.y) < SHARK.radius + DIVER.radius) {
        s.active = false;
        state.carried = Math.floor(state.carried * (1 - SHARK.dropFraction));
        state.lives -= 1;
        diver.invulnerable = DIVER.invulnerable;
        diver.vx += (diver.x - s.x) * 4;
        diver.vy += (diver.y - s.y) * 4 - 120;
        events |= EVENT_HIT;
        if (state.lives <= 0) {
          state.over = true;
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    // The Warden patrols the abyss; its lure glows like a pearl.
    if (warden.retreat > 0) {
      warden.retreat -= dt;
      warden.x += (80 - warden.x) * dt * 0.5;
      warden.y += (690 - warden.y) * dt * 0.5;
    } else {
      warden.phase += dt;
      warden.x = 640 + Math.sin(warden.phase * 0.25) * 340;
      warden.y = 620 + Math.sin(warden.phase * 0.5) * 55;
      const wd = dist(warden.x, warden.y, diver.x, diver.y);
      if (state.diving && diver.y > ZONE.abyss.top && wd < 300) {
        const tx = (diver.x - warden.x) / (wd || 1);
        const ty = (diver.y - warden.y) / (wd || 1);
        warden.x += tx * WARDEN.speed * dt * 0.5;
        warden.y += ty * WARDEN.speed * dt * 0.5;
      }
      if (state.diving && diver.invulnerable === 0 && wd < WARDEN.radius + DIVER.radius) {
        warden.retreat = WARDEN.retreatSeconds;
        state.carried = Math.floor(state.carried * (1 - SHARK.dropFraction));
        state.lives -= 1;
        diver.invulnerable = DIVER.invulnerable;
        diver.vx += (diver.x - warden.x) * 5;
        diver.vy -= 160;
        events |= EVENT_HIT;
        if (state.lives <= 0) {
          state.over = true;
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    // Ambient glowfish drift and wrap around.
    for (const f of glowfish) {
      f.x += f.dir * f.speed * dt;
      f.y += Math.sin(state.elapsed * 0.8 + f.phase) * 8 * dt;
      if (f.x < -20) { f.x = FIELD.width + 20; f.dir = -1; }
      if (f.x > FIELD.width + 20) { f.x = -20; f.dir = 1; }
    }

    // Bubbles rise and pop at the surface.
    for (const b of bubbles) {
      if (!b.active) continue;
      b.y -= b.vy * dt;
      b.x += Math.sin(state.elapsed * 3 + b.r * 10) * 6 * dt;
      b.life += dt;
      if (b.y < FIELD.surfaceY + 4 || b.life > 12) b.active = false;
    }

    // Sparkles expand and fade.
    for (const s of sparkles) {
      if (!s.active) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) s.active = false;
    }

    return events;
  }

  reset();
  return {
    state, reset, step, buyUpgrade,
    maxOxygen, maxBattery, lightRange, maxSpeed,
  };
}
