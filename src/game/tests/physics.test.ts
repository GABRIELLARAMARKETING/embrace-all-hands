import { describe, it, expect } from "vitest";
import { PHYSICS } from "@/game/physicsConstants";
import {
  angleBetween,
  checkPlatformCollision,
  createBallState,
  isAngleInsideGap,
  normalizeAngle,
  resetBallState,
  stepPhysics,
  type BallState,
  type CollisionResult,
  type Platform,
} from "@/game/physics";

function makePlatform(overrides: Partial<Platform> = {}): Platform {
  return {
    id: 0,
    y: 0,
    gapStart: 0,
    gapSize: 0,
    dangerStart: -1,
    dangerSize: 0,
    breakable: false,
    broken: false,
    ...overrides,
  };
}

// Position a ball crossing the top of `platform` this step: previousBottom
// sits just above the top, current bottom sits just below.
function makeCrossingBall(
  platformTop: number,
  velocityY = -8,
  angle = 0,
): BallState {
  const b = createBallState(platformTop + PHYSICS.BALL_RADIUS - 0.005);
  b.previousY = platformTop + PHYSICS.BALL_RADIUS + 0.005;
  b.velocityY = velocityY;
  b.angle = angle;
  return b;
}

// Fall the ball from `startY` for `duration` seconds at `fps` using the fixed
// timestep accumulator (like the real game loop).
function runFall(
  fps: number,
  duration: number,
  platforms: Platform[],
  startY = 5,
): { bounces: number; passes: number } {
  const ball = createBallState(startY);
  const frameDt = 1 / fps;
  const totalFrames = Math.round(duration / frameDt);
  let bounces = 0;
  let passes = 0;
  let now = 0;
  let acc = 0;

  for (let f = 0; f < totalFrames; f++) {
    now += frameDt * 1000;
    const delta = Math.min(frameDt, PHYSICS.MAX_DELTA);
    acc += delta;
    let steps = 0;
    while (acc >= PHYSICS.FIXED_STEP && steps < PHYSICS.MAX_SUBSTEPS) {
      stepPhysics(ball, platforms, 0, PHYSICS.FIXED_STEP, now, (r) => {
        if (r.type === "bounce" || r.type === "break") bounces++;
        if (r.type === "pass") passes++;
      });
      acc -= PHYSICS.FIXED_STEP;
      steps++;
    }
    if (steps === PHYSICS.MAX_SUBSTEPS) acc = 0;
  }
  return { bounces, passes };
}

describe("physics — pure functions", () => {
  it("1. solid platform bounces the ball (velocity → BOUNCE_VELOCITY, y → top + radius)", () => {
    const plat = makePlatform({ id: 1, y: 0.5 });
    const ball = makeCrossingBall(plat.y, -8);
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 0, () => {});
    expect(ball.velocityY).toBe(PHYSICS.BOUNCE_VELOCITY);
    expect(ball.y).toBeCloseTo(
      plat.y + PHYSICS.BALL_RADIUS + PHYSICS.COLLISION_EPSILON,
      5,
    );
  });

  it("2. ball aligned with the gap passes through and keeps descending", () => {
    const plat = makePlatform({
      id: 2,
      y: 0.5,
      gapStart: 0,
      gapSize: Math.PI / 2,
    });
    const ball = makeCrossingBall(plat.y, -8, 0.3);
    let result: CollisionResult = { type: "none" };
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 0, (r) => (result = r));
    expect(result.type).toBe("pass");
    expect(ball.velocityY).toBeLessThan(0);
    expect(ball.y).toBeLessThan(plat.y + PHYSICS.BALL_RADIUS);
  });

  it("3. ball over a danger zone triggers gameover", () => {
    const plat = makePlatform({
      id: 3,
      y: 0.5,
      dangerStart: 0.2,
      dangerSize: 1.0,
    });
    const ball = makeCrossingBall(plat.y, -8, 0.5);
    let result: CollisionResult = { type: "none" };
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 0, (r) => (result = r));
    expect(result.type).toBe("gameover");
  });

  it("4. terminal velocity at MAX_DELTA does not tunnel a solid platform (swept)", () => {
    const plat = makePlatform({ id: 4, y: 0 });
    // Fall from above at the terminal speed for one full MAX_DELTA frame,
    // split into fixed substeps like the real game loop.
    const ball = createBallState(plat.y + PHYSICS.BALL_RADIUS + 0.5);
    ball.velocityY = PHYSICS.MAX_FALL_SPEED;
    let acc = PHYSICS.MAX_DELTA;
    let bounced = false;
    let steps = 0;
    while (acc >= PHYSICS.FIXED_STEP && steps < PHYSICS.MAX_SUBSTEPS) {
      stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 0, (r) => {
        if (r.type === "bounce") bounced = true;
      });
      acc -= PHYSICS.FIXED_STEP;
      steps++;
    }
    expect(bounced).toBe(true);
    expect(ball.y).toBeGreaterThanOrEqual(plat.y + PHYSICS.BALL_RADIUS);
  });

  it("5. determinism: 30 FPS and 120 FPS produce the same bounce count over 2s", () => {
    const build = (): Platform[] => [
      makePlatform({ id: 10, y: 0 }),
      makePlatform({ id: 11, y: -PHYSICS.PLATFORM_SPACING }),
      makePlatform({ id: 12, y: -PHYSICS.PLATFORM_SPACING * 2 }),
    ];
    const a = runFall(30, 2, build(), 5);
    const b = runFall(120, 2, build(), 5);
    expect(a.bounces).toBe(b.bounces);
    expect(a.bounces).toBeGreaterThan(0);
  });

  it("6. reset clears previousY, velocityY and cooldown", () => {
    const ball = createBallState(3);
    ball.previousY = 7;
    ball.velocityY = -12;
    ball.lastBouncePlatformId = 42;
    ball.lastBounceAt = 999;
    resetBallState(ball, 0);
    expect(ball.y).toBe(0);
    expect(ball.previousY).toBe(0);
    expect(ball.velocityY).toBe(0);
    expect(ball.lastBouncePlatformId).toBeNull();
    expect(ball.lastBounceAt).toBe(0);
  });

  it("7. two crossings on the same platform within cooldown produce only 1 bounce", () => {
    const plat = makePlatform({ id: 7, y: 0 });
    let bounces = 0;
    const onEvt = (r: CollisionResult) => {
      if (r.type === "bounce") bounces++;
    };
    const ball = makeCrossingBall(plat.y, -8);
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 0, onEvt);
    // Force a second crossing well within the cooldown window (< 120ms).
    ball.y = plat.y + PHYSICS.BALL_RADIUS - 0.005;
    ball.previousY = plat.y + PHYSICS.BALL_RADIUS + 0.005;
    ball.velocityY = -8;
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 50, onEvt);
    expect(bounces).toBe(1);
  });

  it("8. gap wrapping 0/2π detects angles 0.1 and 6.1 correctly", () => {
    const gapStart = 5.9;
    const gapSize = 1.2; // ends at 7.1 → wraps past 2π
    expect(isAngleInsideGap(0.1, gapStart, gapSize, 0)).toBe(true);
    expect(isAngleInsideGap(6.1, gapStart, gapSize, 0)).toBe(true);
    expect(isAngleInsideGap(3.0, gapStart, gapSize, 0)).toBe(false);
    expect(angleBetween(normalizeAngle(6.1), gapStart, gapSize)).toBe(true);
  });

  it("9. breakable platform bounces once, marks broken=true and disappears", () => {
    const plat = makePlatform({ id: 9, y: 0, breakable: true });
    let result: CollisionResult = { type: "none" };
    const ball = makeCrossingBall(plat.y, -8);
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 0, (r) => (result = r));
    expect(result.type).toBe("break");
    expect(plat.broken).toBe(true);
    // Next crossing must not collide (checkPlatformCollision short-circuits on broken).
    const ball2 = makeCrossingBall(plat.y, -8);
    let second: CollisionResult["type"] = "none";
    stepPhysics(ball2, [plat], 0, PHYSICS.FIXED_STEP, 500, (r) => (second = r.type));
    expect(second).toBe("none");
  });

  it("10. changing towerRotation flips gap/solid for the same ballAngle", () => {
    const plat = makePlatform({
      id: 10,
      y: 0.5,
      gapStart: 0,
      gapSize: Math.PI / 4,
    });
    const b1 = makeCrossingBall(plat.y, -8, 0.3); // inside gap at rot 0
    const b2 = makeCrossingBall(plat.y, -8, 0.3); // outside gap at rot π
    let r1: CollisionResult = { type: "none" };
    let r2: CollisionResult = { type: "none" };
    stepPhysics(b1, [{ ...plat }], 0, PHYSICS.FIXED_STEP, 0, (r) => (r1 = r));
    stepPhysics(b2, [{ ...plat }], Math.PI, PHYSICS.FIXED_STEP, 0, (r) => (r2 = r));
    expect(r1.type).toBe("pass");
    expect(r2.type).toBe("bounce");
  });

  it("bonus — checkPlatformCollision alone returns 'none' when going up", () => {
    const plat = makePlatform({ id: 99, y: 0 });
    const ball = makeCrossingBall(plat.y, -8);
    ball.velocityY = 5; // moving up
    expect(checkPlatformCollision(ball, plat, 0, 0).type).toBe("none");
  });
});
