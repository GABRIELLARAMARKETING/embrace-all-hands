// Central tunables. Adjust here — do not scatter magic numbers.
// Mobile detection: mobile devices get a stronger bounce, softer gravity and a
// touch more collision tolerance so drag-to-rotate never causes false losses.
const IS_MOBILE =
  typeof window !== "undefined" &&
  (window.innerWidth <= 768 ||
    (typeof navigator !== "undefined" &&
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)));

export const CONSTANTS = {
  // Geometry
  TOWER_RADIUS: 2.1,
  CORE_RADIUS: 0.65,
  BALL_RADIUS: 0.18,
  BALL_TRACK_RADIUS: 1.38,
  PLATFORM_HEIGHT: 0.22,
  PLATFORM_SPACING: IS_MOBILE ? 1.42 : 1.25,
  SECTORS_PER_RING: 8,

  // Physics
  GRAVITY: IS_MOBILE ? -21 : -24,
  BOUNCE_VELOCITY: IS_MOBILE ? 6.6 : 5.35,
  BOUNCE_RESTITUTION: 0.62,
  IMPACT_FRICTION: 0.14,
  AIR_FRICTION: 0.28,
  SPIN_FRICTION: 0.82,
  MAX_BOUNCE_VELOCITY: IS_MOBILE ? 7.4 : 6.25,
  MAX_FALL_SPEED: -13.5,

  // Controls
  ROTATION_SENSITIVITY: 0.009, // mouse / pen
  TOUCH_ROTATION_SENSITIVITY: 0.011, // touch feels a hair snappier
  ROTATION_SMOOTHING: 0.35,
  KEYBOARD_ROTATION_SPEED: 2.8,

  // Combo / fever
  CASH_FEVER_THRESHOLD: 4,
  CASH_FEVER_DURATION: 2,

  // Camera
  CAMERA_LERP: 0.08,
  CAMERA_HEIGHT_OFFSET: IS_MOBILE ? 7.6 : 7.0,
  CAMERA_DISTANCE: IS_MOBILE ? 7.2 : 6.72, // TOWER_RADIUS (2.1) * 3.2 — Helix Jump classic framing
  CAMERA_LOOK_AT_OFFSET: -4.0,

  // Rewards
  COIN_REWARD_LEVEL: 25,

  // Physics stability
  PHYSICS_MAX_STEP: 1 / 240,
  PHYSICS_MAX_DELTA: 1 / 30,
  COLLISION_COOLDOWN: IS_MOBILE ? 0.1 : 0.07,
  COLLISION_EPSILON: IS_MOBILE ? 0.06 : 0.035,
  // Consecutive danger contacts required before losing (drag debounce).
  DANGER_CONFIRM_FRAMES: IS_MOBILE ? 2 : 1,
} as const;

export const IS_MOBILE_DEVICE = IS_MOBILE;


// Virtual coin symbol — NOT real currency.
export const COIN_SYMBOL = "✦";

// Debug overlay + console logs (rename kept as alias for existing imports).
export const DEBUG_GAMEPLAY = false;
export const DEBUG_PHYSICS = DEBUG_GAMEPLAY;


