// Physics tunables — mobile gets a stronger bounce and softer gravity so the
// ball keeps a safe margin above platforms while the player drags to rotate.
const isMobile =
  typeof window !== "undefined" &&
  (window.innerWidth <= 768 ||
    (typeof navigator !== "undefined" &&
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)));

export const PHYSICS = {
  GRAVITY: isMobile ? -24 : -28,
  BOUNCE_VELOCITY: isMobile ? 16.5 : 14,
  MAX_FALL_SPEED: isMobile ? -26 : -28,
  BALL_RADIUS: isMobile ? 0.44 : 0.42,
  PLATFORM_SPACING: 3.2,
  PLATFORM_THICKNESS: 0.55,
  COLLISION_EPSILON: isMobile ? 0.06 : 0.02,
  MAX_DELTA: 1 / 30,
  FIXED_STEP: 1 / 120,
  MAX_SUBSTEPS: 6,
  COLLISION_COOLDOWN_MS: isMobile ? 160 : 120,
  TOWER_ROTATION_SENSITIVITY: 0.0072,
  ROTATION_DAMPING: 0.88,
  // Number of consecutive danger-zone contacts required before losing.
  // Prevents a single grazing touch during a drag from ending the run.
  DANGER_CONFIRM_FRAMES: isMobile ? 2 : 1,
} as const;

export const IS_MOBILE = isMobile;
