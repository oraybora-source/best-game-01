// LENTERA LAUT — the screenshot scenes behind ?shot=start|play|deep|end.
// Each one plays the real rules forward from a fresh world, steered by a simple
// autopilot (flee nearby sharks and the Warden, surface when the air runs low,
// otherwise chase the best pearl by value over distance), so the frame is what a
// short game really looks like and the same seed always gives the same frame.
// The 'deep' scene places the diver in the abyss first — a position reachable by
// swimming down — and plays the real rules from there, so the Warden and the
// Heart pearl are in the frame.
import { FIELD, STEP, ZONE } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 12;
const DEEP_SECONDS = 3;
const END_LIMIT_SECONDS = 600;
const FLEE_RADIUS = 150;

function bestPearl(state) {
  const d = state.diver;
  let best = null;
  let bestScore = -1;
  for (const p of state.pearls) {
    if (!p.active) continue;
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const score = p.value / (dist + 40);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function threat(state) {
  const d = state.diver;
  let tx = 0;
  let ty = 0;
  let found = false;
  for (const s of state.sharks) {
    if (!s.active) continue;
    const dx = d.x - s.x;
    const dy = d.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < FLEE_RADIUS) {
      tx += dx / (dist || 1);
      ty += dy / (dist || 1);
      found = true;
    }
  }
  const w = state.warden;
  if (w.retreat <= 0) {
    const dx = d.x - w.x;
    const dy = d.y - w.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < FLEE_RADIUS) {
      tx += dx / (dist || 1);
      ty += dy / (dist || 1);
      found = true;
    }
  }
  return found ? { x: tx, y: ty } : null;
}

/** The autopilot's steering for one step: a direction, whether to sprint, never a lamp toggle. */
function autopilot(state) {
  const d = state.diver;
  const flee = threat(state);
  let tx;
  let ty;
  if (flee) {
    tx = flee.x;
    ty = flee.y;
  } else if (state.oxygen < 18) {
    tx = FIELD.width / 2 - d.x;
    ty = FIELD.surfaceY - d.y;
  } else {
    const pearl = bestPearl(state);
    if (pearl) {
      tx = pearl.x - d.x;
      ty = pearl.y - d.y;
    } else {
      tx = FIELD.width / 2 - d.x;
      ty = (ZONE.twilight.top + ZONE.twilight.bottom) / 2 - d.y;
    }
  }
  const len = Math.sqrt(tx * tx + ty * ty) || 1;
  const sprint = len > 250 && state.oxygen > 30;
  return { x: tx / len, y: ty / len, sprint, lightToggle: false };
}

function stepFor(seconds, world, pilot) {
  const steps = Math.round(seconds / STEP);
  let events = 0;
  for (let i = 0; i < steps; i += 1) {
    const input = pilot ? autopilot(world.state) : { x: 0, y: 0, sprint: false, lightToggle: false };
    events |= world.step(STEP, input, input.sprint, input.lightToggle);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best
 * score to show. 'start' is the title, 'play' a mid-dive, 'deep' the abyss with the
 * Warden, 'end' a finished game (victory if the autopilot banks 500, else game over).
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    stepFor(PLAY_SECONDS, world, true);
    return { screen: SCREEN_PLAY, best: world.state.banked };
  }
  if (name === 'deep') {
    world.state.diver.x = FIELD.width / 2;
    world.state.diver.y = 620;
    world.state.diver.vx = 0;
    world.state.diver.vy = 0;
    stepFor(DEEP_SECONDS, world, true);
    return { screen: SCREEN_PLAY, best: world.state.banked };
  }
  if (name === 'end') {
    const keys = ['tank', 'lamp', 'fins'];
    let keyIndex = 0;
    const limit = Math.round(END_LIMIT_SECONDS / STEP);
    let events = 0;
    for (let i = 0; i < limit; i += 1) {
      const input = autopilot(world.state);
      events |= world.step(STEP, input, input.sprint, input.lightToggle);
      // Spend the balance on upgrades as it grows, cheapest first, in rotation.
      if (world.buyUpgrade(keys[keyIndex % keys.length])) keyIndex += 1;
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    const won = world.state.won;
    const over = world.state.over;
    return {
      screen: won ? SCREEN_WIN : over ? SCREEN_OVER : SCREEN_PLAY,
      best: world.state.banked,
    };
  }
  // 'start' and anything else: a living reef behind the title.
  stepFor(START_SECONDS, world, false);
  return { screen: SCREEN_TITLE, best: 0 };
}
