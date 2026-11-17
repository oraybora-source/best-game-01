// LENTERA LAUT — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720, surfaceY: 64 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Depth zones: the deeper you go, the darker it gets, the richer the pearls, the hungrier the sea. */
export const ZONE = {
  shallows: { top: 64, bottom: 264, name: 'Shallows', oxygenDrain: 1.0 },
  twilight: { top: 264, bottom: 484, name: 'Twilight', oxygenDrain: 1.4 },
  abyss: { top: 484, bottom: 720, name: 'The Abyss', oxygenDrain: 1.8 },
};

export const DIVER = {
  radius: 14,
  accel: 1500,
  maxSpeed: 260,
  drag: 2.2,
  sprintMult: 1.5,
  sprintOxygenMult: 1.8,
  invulnerable: 2.0,
};

export const LIVES = 3;

/** Win when this many pearls have been banked in total (cumulative, never spent). */
export const WIN_TARGET = 500;

export const OXYGEN = { base: 60, tankBonus: 25 };
export const BATTERY = { base: 100, lampBonus: 40, drain: 0.6, surfaceRecharge: 4 };

export const LIGHT = {
  baseRange: 260,
  lampBonus: 40,
  coneHalf: 0.55,
  /** How far away a shark notices the diver when the lamp is on / off. */
  attractOn: 420,
  attractOff: 120,
};

export const PEARL = {
  small: { value: 5, count: 5, radius: 9, color: '#eaf6ff', respawn: 8 },
  medium: { value: 15, count: 3, radius: 11, color: '#ffd76a', respawn: 12 },
  large: { value: 30, count: 2, radius: 13, color: '#ff9ecf', respawn: 20 },
  heart: { value: 100, count: 1, radius: 16, color: '#7ef0ff', respawn: 45 },
};

export const SHARK = {
  baseSpeed: 130,
  speedPerDive: 20,
  maxSpeed: 220,
  spawnInterval: 7,
  maxCount: 4,
  radius: 26,
  /** Fraction of carried pearls scattered when a shark hits you. */
  dropFraction: 0.3,
};

export const WARDEN = {
  radius: 34,
  speed: 60,
  patrolTop: 560,
  patrolBottom: 690,
  retreatSeconds: 10,
};

/** Upgrades bought at the surface with banked pearls (balance only; the win total is never spent). */
export const UPGRADES = {
  tank: { name: 'Tank', levels: 3, costs: [50, 100, 150], desc: '+25s oxygen' },
  lamp: { name: 'Lamp', levels: 3, costs: [50, 100, 150], desc: '+40 battery, wider light' },
  fins: { name: 'Fins', levels: 3, costs: [50, 100, 150], desc: '+15% swim speed' },
};

export const PALETTE = {
  backdrop: '#04121f',
  waterTop: '#14607a',
  waterMid: '#0b3a55',
  waterBottom: '#04101f',
  surface: '#7fe0e8',
  sand: '#3a4a5e',
  coralA: '#ff7b54',
  coralB: '#ff5e8a',
  coralC: '#7fe0c3',
  weed: '#2e7d6b',
  pearlSmall: '#eaf6ff',
  pearlMedium: '#ffd76a',
  pearlLarge: '#ff9ecf',
  pearlHeart: '#7ef0ff',
  diver: '#ffb347',
  diverDark: '#e08a2e',
  helmet: '#ffe9b0',
  light: '#ffd76a',
  shark: '#1c2b3a',
  sharkEye: '#ff5e5e',
  warden: '#2a1e3a',
  wardenLure: '#7ef0ff',
  glowfish: '#9be8ff',
  glowfishB: '#ffe08a',
  bubble: '#bfe9ff',
  panel: '#061828',
  panelEdge: '#2a6a86',
  text: '#eaf6ff',
  muted: '#8fb8c9',
  danger: '#ff6b6b',
  good: '#7fe0c3',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lentera-laut.best';
