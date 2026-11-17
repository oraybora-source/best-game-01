// LENTERA LAUT — boot and the one loop: input is read every frame, the world advances
// in fixed 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play, paused, surface
// (the shop between dives), game over and victory.
//
// ?seed=N fixes the pearl and reef layout. ?shot=start|play|deep|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_BANK, EVENT_COLLECT, EVENT_HIT, EVENT_OVER, EVENT_OXYGEN, EVENT_WIN,
} from './world.js';
import {
  ACTION_BUY1, ACTION_BUY2, ACTION_BUY3, ACTION_CONFIRM, ACTION_LIGHT, ACTION_PAUSE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SURFACE, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    audio.click();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Diving. ${LIVES} lives. Bank 500 pearls to win.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.banked > best) {
      best = world.state.banked;
      saveBest(best);
    }
    announce(`Game over. Banked ${world.state.banked}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    audio.win();
    if (world.state.banked > best) {
      best = world.state.banked;
      saveBest(best);
    }
    announce(`Master of the Reef! Banked ${world.state.banked}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_SURFACE) {
        audio.click();
        screen = SCREEN_PLAY;
        announce('Diving again.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_SURFACE) {
      if (actions & ACTION_BUY1 && world.buyUpgrade('tank')) audio.buy();
      else if (actions & ACTION_BUY2 && world.buyUpgrade('lamp')) audio.buy();
      else if (actions & ACTION_BUY3 && world.buyUpgrade('fins')) audio.buy();
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, false);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const lightToggle = Boolean(actions & ACTION_LIGHT);
    const dir = input.direction(world.state.diver);
    const events = world.step(STEP, dir, input.sprint(), lightToggle);
    if (events & EVENT_COLLECT) audio.collect();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_OXYGEN) announce('Out of air! Rescued to the surface.');
    if (events & EVENT_BANK) {
      audio.bank();
      if (!world.state.won) {
        screen = SCREEN_SURFACE;
        announce(`Banked. ${world.state.banked} of 500. Buy upgrades, or dive again.`);
      }
    }
    if (events & EVENT_WIN) winGame();
    else if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // The lamp toggle is a one-shot: only the first step in this frame may use it,
      // or one press would flip the lamp once per simulated step.
      let stepActions = actions;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(stepActions);
        stepActions &= ~ACTION_LIGHT;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world);
  }

  // Leaving the tab pauses a running game rather than letting the air run out unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lentera Laut. Press Space or click to dive.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
