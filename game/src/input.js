// LENTERA LAUT — keyboard and pointer input. Held keys give a steering direction
// (8-way); one-shot presses (start, pause, lamp, shop buys) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost and never
// counted twice. Holding the pointer steers the diver toward it, so the game is
// playable with the mouse alone.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_LIGHT = 4;
export const ACTION_BUY1 = 8;
export const ACTION_BUY2 = 16;
export const ACTION_BUY3 = 32;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const LIGHT = new Set(['KeyF', 'KeyL']);
const BUY1 = new Set(['Digit1', 'Numpad1']);
const BUY2 = new Set(['Digit2', 'Numpad2']);
const BUY3 = new Set(['Digit3', 'Numpad3']);

export function createInput(target) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let sprint = false;
  let actions = 0;
  let pointerDown = false;
  let pointerX = 0;
  let pointerY = 0;

  function fieldPoint(clientX, clientY) {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    const ox = (window.innerWidth - FIELD.width * scale) / 2;
    const oy = (window.innerHeight - FIELD.height * scale) / 2;
    return { x: (clientX - ox) / scale, y: (clientY - oy) / scale };
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (SPRINT.has(event.code)) sprint = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (LIGHT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_LIGHT;
    } else if (BUY1.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BUY1;
    } else if (BUY2.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BUY2;
    } else if (BUY3.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BUY3;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (SPRINT.has(event.code)) sprint = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
    sprint = false;
    pointerDown = false;
  });
  target.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });

  return {
    /** Steering direction as {x, y}, each -1..1, from keys or from the held pointer. */
    direction(diver) {
      const kx = (right ? 1 : 0) - (left ? 1 : 0);
      const ky = (down ? 1 : 0) - (up ? 1 : 0);
      if (kx !== 0 || ky !== 0) {
        const len = Math.sqrt(kx * kx + ky * ky);
        return { x: kx / len, y: ky / len };
      }
      if (pointerDown && diver) {
        const p = fieldPoint(pointerX, pointerY);
        const dx = p.x - diver.x;
        const dy = p.y - diver.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 24) return { x: dx / len, y: dy / len };
      }
      return { x: 0, y: 0 };
    },
    sprint() {
      return sprint;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
