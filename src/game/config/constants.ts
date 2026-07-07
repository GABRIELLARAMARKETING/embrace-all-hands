// Central tunables. Adjust here — do not scatter magic numbers.
export const CONSTANTS = {
  // Geometry
  TOWER_RADIUS: 2.1,
  CORE_RADIUS: 0.65,
  BALL_RADIUS: 0.32,
  PLATFORM_HEIGHT: 0.22,
  PLATFORM_SPACING: 1.25,
  SECTORS_PER_RING: 8,

  // Physics
  GRAVITY: -22,
  BOUNCE_VELOCITY: 5.6, // peak ≈ 0.71 < PLATFORM_SPACING (1.25) → no re-ascend past ring
  MAX_FALL_SPEED: -13,

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
  CAMERA_HEIGHT_OFFSET: 3.2,
  CAMERA_DISTANCE: 6.5,
  CAMERA_LOOK_AT_OFFSET: -1.0,

  // Rewards
  COIN_REWARD_LEVEL: 25,

  // Physics stability
  PHYSICS_MAX_STEP: 1 / 120,
  PHYSICS_MAX_DELTA: 1 / 30,
  COLLISION_COOLDOWN: 0.08,
  COLLISION_EPSILON: 0.025,
} as const;

// Virtual coin symbol — NOT real currency.
export const COIN_SYMBOL = "✦";

// Debug overlay + console logs (rename kept as alias for existing imports).
export const DEBUG_GAMEPLAY = false;
export const DEBUG_PHYSICS = DEBUG_GAMEPLAY;


