import { PHYSICS } from "./physicsConstants";

export interface BallState {
  y: number;
  previousY: number;
  velocityY: number;
  angle: number; // world-space angle of the ball (the tower is what rotates)
  lastBouncePlatformId: number | null;
  lastBounceAt: number; // performance.now()
}

export interface Platform {
  id: number;
  y: number; // top of the platform
  gapStart: number; // rad, LOCAL space of the tower
  gapSize: number; // rad
  dangerStart: number; // rad, or -1 if none
  dangerSize: number;
  breakable: boolean;
  broken: boolean;
}

const TWO_PI = Math.PI * 2;

export function normalizeAngle(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

export function angleBetween(
  angle: number,
  start: number,
  size: number,
): boolean {
  if (size <= 0) return false;
  const a = normalizeAngle(angle);
  const s = normalizeAngle(start);
  const end = s + size;
  if (end <= TWO_PI) return a >= s && a <= end;
  // wraps across 0/2π
  return a >= s || a <= normalizeAngle(end);
}

export function isAngleInsideGap(
  ballAngle: number,
  gapStart: number,
  gapSize: number,
  towerRotation: number,
): boolean {
  const local = normalizeAngle(ballAngle - towerRotation);
  return angleBetween(local, gapStart, gapSize);
}

export function isAngleInsideDangerZone(
  ballAngle: number,
  dangerStart: number,
  dangerSize: number,
  towerRotation: number,
): boolean {
  if (dangerStart < 0) return false;
  const local = normalizeAngle(ballAngle - towerRotation);
  return angleBetween(local, dangerStart, dangerSize);
}

export type CollisionResult =
  | { type: "none" }
  | { type: "bounce"; platform: Platform }
  | { type: "pass"; platform: Platform }
  | { type: "gameover"; platform: Platform }
  | { type: "break"; platform: Platform };

export function checkPlatformCollision(
  ball: BallState,
  platform: Platform,
  towerRotation: number,
  now: number,
): CollisionResult {
  if (platform.broken) return { type: "none" };
  if (ball.velocityY >= 0) return { type: "none" };

  const top = platform.y;
  const prevBottom = ball.previousY - PHYSICS.BALL_RADIUS;
  const currBottom = ball.y - PHYSICS.BALL_RADIUS;

  // swept: ball's base was at/above the top last step and is strictly below now.
  // Strict checks on both sides prevent re-detection on subsequent substeps.
  const crossed = prevBottom >= top && currBottom < top;
  if (!crossed) return { type: "none" };

  // per-platform cooldown (prevents double bounce)
  if (
    ball.lastBouncePlatformId === platform.id &&
    now - ball.lastBounceAt < PHYSICS.COLLISION_COOLDOWN_MS
  ) {
    return { type: "none" };
  }

  if (
    isAngleInsideGap(
      ball.angle,
      platform.gapStart,
      platform.gapSize,
      towerRotation,
    )
  ) {
    return { type: "pass", platform };
  }
  if (
    isAngleInsideDangerZone(
      ball.angle,
      platform.dangerStart,
      platform.dangerSize,
      towerRotation,
    )
  ) {
    return { type: "gameover", platform };
  }
  if (platform.breakable) return { type: "break", platform };
  return { type: "bounce", platform };
}

// Fixed physics step — called inside the accumulator loop.
export function stepPhysics(
  ball: BallState,
  platforms: Platform[],
  towerRotation: number,
  dt: number,
  now: number,
  onEvent: (r: CollisionResult) => void,
): void {
  ball.previousY = ball.y;
  ball.velocityY = Math.max(
    ball.velocityY + PHYSICS.GRAVITY * dt,
    PHYSICS.MAX_FALL_SPEED,
  );
  ball.y += ball.velocityY * dt;

  if (ball.velocityY >= 0) return;

  for (const p of platforms) {
    if (p.y > ball.previousY + PHYSICS.BALL_RADIUS) continue;
    if (p.y < ball.y - PHYSICS.BALL_RADIUS - PHYSICS.PLATFORM_THICKNESS) continue;

    const result = checkPlatformCollision(ball, p, towerRotation, now);
    if (result.type === "none") continue;

    if (result.type === "bounce" || result.type === "break") {
      // resolve penetration so the ball never sits inside the platform
      ball.y = p.y + PHYSICS.BALL_RADIUS + PHYSICS.COLLISION_EPSILON;
      ball.velocityY = PHYSICS.BOUNCE_VELOCITY;
      ball.lastBouncePlatformId = p.id;
      ball.lastBounceAt = now;
      if (result.type === "break") p.broken = true;
    }
    onEvent(result);
    break; // at most one resolved collision per step
  }
}

export function createBallState(y = 0): BallState {
  return {
    y,
    previousY: y,
    velocityY: 0,
    angle: 0,
    lastBouncePlatformId: null,
    lastBounceAt: 0,
  };
}

export function resetBallState(ball: BallState, y = 0): void {
  ball.y = y;
  ball.previousY = y;
  ball.velocityY = 0;
  ball.lastBouncePlatformId = null;
  ball.lastBounceAt = 0;
}
