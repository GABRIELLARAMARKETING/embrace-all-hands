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

function runSim(
  fps: number,
  duration: number,
  platforms: Platform[],
): { bounces: number; passes: number } {
  const ball = createBallState(5);
  ball.velocityY = 0;
  const dt = 1 / fps;
  const totalSteps = Math.floor(duration / dt);
  let bounces = 0;
  let passes = 0;
  let now = 0;

  for (let i = 0; i < totalSteps; i++) {
    now += dt * 1000;
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(PHYSICS.FIXED_STEP, remaining);
      stepPhysics(ball, platforms, 0, step, now, (r) => {
        if (r.type === "bounce" || r.type === "break") bounces++;
        if (r.type === "pass") passes++;
      });
      remaining -= step;
    }
  }
  return { bounces, passes };
}

describe("physics — pure functions", () => {
  it("1. solid platform bounces the ball (velocity → BOUNCE_VELOCITY, y → top + radius)", () => {
    const ball = createBallState(1.0);
    ball.previousY = 1.0;
    ball.velocityY = -0.5;
    // step brings it through top=0.5
    stepPhysics(
      ball,
      [makePlatform({ id: 1, y: 0.5 })],
      0,
      PHYSICS.FIXED_STEP,
      0,
      () => {},
    );
    expect(ball.velocityY).toBe(PHYSICS.BOUNCE_VELOCITY);
    expect(ball.y).toBeCloseTo(0.5 + PHYSICS.BALL_RADIUS + PHYSICS.COLLISION_EPSILON, 5);
  });

  it("2. ball aligned with the gap passes through and keeps descending", () => {
    const ball = createBallState(1.0);
    ball.previousY = 1.0;
    ball.velocityY = -2;
    const plat = makePlatform({ id: 2, y: 0.5, gapStart: 0, gapSize: Math.PI / 2 });
    let result: CollisionResult = { type: "none" };
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 0, (r) => (result = r));
    expect(result.type).toBe("pass");
    expect(ball.velocityY).toBeLessThan(0);
  });

  it("3. ball over a danger zone triggers gameover", () => {
    const ball = createBallState(1.0);
    ball.previousY = 1.0;
    ball.velocityY = -2;
    ball.angle = 0.5;
    const plat = makePlatform({
      id: 3,
      y: 0.5,
      dangerStart: 0.2,
      dangerSize: 1.0,
    });
    let result: CollisionResult = { type: "none" };
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 0, (r) => (result = r));
    expect(result.type).toBe("gameover");
  });

  it("4. terminal velocity at MAX_DELTA does not tunnel a solid platform (swept)", () => {
    const plat = makePlatform({ id: 4, y: 0 });
    const ball = createBallState(0.6);
    ball.velocityY = PHYSICS.MAX_FALL_SPEED; // fastest possible
    // simulate one big frame split into substeps
    let remaining = PHYSICS.MAX_DELTA;
    let bounced = false;
    while (remaining > 0) {
      const step = Math.min(PHYSICS.FIXED_STEP, remaining);
      stepPhysics(ball, [plat], 0, step, 0, (r) => {
        if (r.type === "bounce") bounced = true;
      });
      remaining -= step;
    }
    expect(bounced).toBe(true);
    expect(ball.y).toBeGreaterThanOrEqual(plat.y + PHYSICS.BALL_RADIUS);
  });

  it("5. determinism: 30 FPS and 120 FPS produce the same bounce count over 2s", () => {
    const platforms: Platform[] = [
      makePlatform({ id: 10, y: 0 }),
      makePlatform({ id: 11, y: -PHYSICS.PLATFORM_SPACING }),
      makePlatform({ id: 12, y: -PHYSICS.PLATFORM_SPACING * 2 }),
    ];
    const a = runSim(30, 2, platforms.map((p) => ({ ...p })));
    const b = runSim(120, 2, platforms.map((p) => ({ ...p })));
    expect(a.bounces).toBe(b.bounces);
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

  it("7. two steps on the same platform within cooldown produce only 1 bounce", () => {
    const plat = makePlatform({ id: 7, y: 0 });
    const ball = createBallState(0.6);
    ball.velocityY = -5;
    let bounces = 0;
    const onEvt = (r: CollisionResult) => {
      if (r.type === "bounce") bounces++;
    };
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 0, onEvt);
    // simulate a second step within cooldown, force ball back over the top
    ball.previousY = 0.6;
    ball.y = 0.6;
    ball.velocityY = -5;
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 50, onEvt);
    expect(bounces).toBe(1);
  });

  it("8. gap wrapping 0/2π detects angles 0.1 and 6.1 correctly", () => {
    const gapStart = 5.9;
    const gapSize = 1.2; // ends at 7.1 → wraps
    expect(isAngleInsideGap(0.1, gapStart, gapSize, 0)).toBe(true);
    expect(isAngleInsideGap(6.1, gapStart, gapSize, 0)).toBe(true);
    expect(isAngleInsideGap(3.0, gapStart, gapSize, 0)).toBe(false);
    // sanity for the primitive
    expect(angleBetween(normalizeAngle(6.1), gapStart, gapSize)).toBe(true);
  });

  it("9. breakable platform bounces once, marks broken=true and disappears", () => {
    const plat = makePlatform({ id: 9, y: 0, breakable: true });
    const ball = createBallState(0.6);
    ball.velocityY = -5;
    let result: CollisionResult = { type: "none" };
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 0, (r) => (result = r));
    expect(result.type).toBe("break");
    expect(plat.broken).toBe(true);
    // next crossing must not collide
    ball.previousY = 0.6;
    ball.y = 0.6;
    ball.velocityY = -5;
    let secondType: CollisionResult["type"] = "none";
    stepPhysics(ball, [plat], 0, PHYSICS.FIXED_STEP, 500, (r) => (secondType = r.type));
    expect(secondType).toBe("none");
  });

  it("10. changing towerRotation flips gap/solid for the same ballAngle", () => {
    const plat = makePlatform({
      id: 10,
      y: 0.5,
      gapStart: 0,
      gapSize: Math.PI / 4,
    });
    const build = () => {
      const b = createBallState(1.0);
      b.previousY = 1.0;
      b.velocityY = -2;
      b.angle = 0.3; // inside gap at rotation 0
      return b;
    };
    let r1: CollisionResult = { type: "none" };
    stepPhysics(build(), [{ ...plat }], 0, PHYSICS.FIXED_STEP, 0, (r) => (r1 = r));
    let r2: CollisionResult = { type: "none" };
    stepPhysics(build(), [{ ...plat }], Math.PI, PHYSICS.FIXED_STEP, 0, (r) => (r2 = r));
    expect(r1.type).toBe("pass");
    expect(r2.type).toBe("bounce");
  });
});
