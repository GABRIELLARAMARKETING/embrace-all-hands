import { describe, it, expect } from "vitest";
import { PHYSICS } from "@/game/physicsConstants";
import {
  createBallState,
  stepPhysics,
  type CollisionResult,
  type Platform,
} from "@/game/physics";
import { createAccumulator, runFrame } from "@/game/frameLoop";

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

function simulate(fps: number, seconds: number, platforms: Platform[], startY = 5) {
  const ball = createBallState(startY);
  const acc = createAccumulator();
  const events: CollisionResult["type"][] = [];
  const frameDt = 1 / fps;
  const frames = Math.round(seconds / frameDt);
  let now = 0;
  for (let f = 0; f < frames; f++) {
    now += frameDt * 1000;
    runFrame(ball, platforms, 0, frameDt, now, acc, (r) => events.push(r.type));
  }
  return { ball, events };
}

describe("frameLoop — accumulator integration", () => {
  it("A. one frame with delta = FIXED_STEP runs exactly 1 substep and matches direct stepPhysics", () => {
    const plat = makePlatform({ id: 1, y: 0 });
    const ball1 = createBallState(1.2);
    ball1.velocityY = -6;
    const ball2 = createBallState(1.2);
    ball2.velocityY = -6;
    const acc = createAccumulator();
    const evtA: string[] = [];
    const evtB: string[] = [];

    const steps = runFrame(ball1, [plat], 0, PHYSICS.FIXED_STEP, 0, acc, (r) =>
      evtA.push(r.type),
    );
    stepPhysics(ball2, [plat], 0, PHYSICS.FIXED_STEP, 0, (r) => evtB.push(r.type));

    expect(steps).toBe(1);
    expect(ball1.y).toBeCloseTo(ball2.y, 10);
    expect(ball1.velocityY).toBeCloseTo(ball2.velocityY, 10);
    expect(evtA).toEqual(evtB);
    expect(acc.value).toBeCloseTo(0, 10);
  });

  it("B. one large frame (MAX_DELTA) equals N direct stepPhysics calls of FIXED_STEP", () => {
    const plat = makePlatform({ id: 2, y: 0 });
    const bigDelta = PHYSICS.MAX_DELTA; // 1/30
    const expectedSteps = Math.floor(bigDelta / PHYSICS.FIXED_STEP); // 4

    const ballA = createBallState(3);
    const accA = createAccumulator();
    const evA: string[] = [];
    const stepsTaken = runFrame(ballA, [plat], 0, bigDelta, 0, accA, (r) =>
      evA.push(r.type),
    );

    const ballB = createBallState(3);
    const evB: string[] = [];
    for (let i = 0; i < expectedSteps; i++) {
      stepPhysics(ballB, [plat], 0, PHYSICS.FIXED_STEP, 0, (r) => evB.push(r.type));
    }

    expect(stepsTaken).toBe(expectedSteps);
    expect(ballA.y).toBeCloseTo(ballB.y, 10);
    expect(ballA.velocityY).toBeCloseTo(ballB.velocityY, 10);
    expect(evA).toEqual(evB);
  });

  it("C. crossing detected in the correct substep of a multi-substep frame (no tunneling)", () => {
    const plat = makePlatform({ id: 3, y: 0 });
    const ball = createBallState(plat.y + PHYSICS.BALL_RADIUS + 0.05);
    ball.velocityY = -6;
    const acc = createAccumulator();
    const events: CollisionResult["type"][] = [];
    runFrame(ball, [plat], 0, PHYSICS.MAX_DELTA, 0, acc, (r) => events.push(r.type));
    expect(events.filter((e) => e === "bounce").length).toBe(1);
    expect(ball.y).toBeGreaterThanOrEqual(plat.y + PHYSICS.BALL_RADIUS);
  });

  it("D. gap traversal in the middle of a multi-substep frame produces exactly one 'pass'", () => {
    const plat = makePlatform({
      id: 4,
      y: 0,
      gapStart: 0,
      gapSize: Math.PI / 2,
    });
    const ball = createBallState(plat.y + PHYSICS.BALL_RADIUS + 0.05);
    ball.velocityY = -6;
    ball.angle = 0.4; // inside gap
    const acc = createAccumulator();
    const events: CollisionResult["type"][] = [];
    runFrame(ball, [plat], 0, PHYSICS.MAX_DELTA, 0, acc, (r) => events.push(r.type));
    expect(events.filter((e) => e === "pass").length).toBe(1);
    expect(events).not.toContain("bounce");
    expect(ball.y).toBeLessThan(plat.y);
  });

  it("E. determinism: 30 FPS vs 240 FPS produce identical bounce count over 3s", () => {
    const build = (): Platform[] => [
      makePlatform({ id: 10, y: 0 }),
      makePlatform({ id: 11, y: -PHYSICS.PLATFORM_SPACING }),
      makePlatform({ id: 12, y: -PHYSICS.PLATFORM_SPACING * 2 }),
      makePlatform({ id: 13, y: -PHYSICS.PLATFORM_SPACING * 3 }),
    ];
    const a = simulate(30, 3, build(), 6);
    const b = simulate(240, 3, build(), 6);
    const bouncesA = a.events.filter((e) => e === "bounce").length;
    const bouncesB = b.events.filter((e) => e === "bounce").length;
    expect(bouncesA).toBeGreaterThan(0);
    expect(bouncesA).toBe(bouncesB);
  });

  it("F. accumulator saturation (spiral-of-death guard) drops leftover time", () => {
    const plat = makePlatform({ id: 5, y: -100 }); // far away, no collision
    const ball = createBallState(5);
    const acc = createAccumulator();
    acc.value = 999; // simulate a huge stall built up by previous frames
    const steps = runFrame(ball, [plat], 0, PHYSICS.FIXED_STEP, 0, acc, () => {});
    expect(steps).toBe(PHYSICS.MAX_SUBSTEPS);
    expect(acc.value).toBe(0);
  });

  it("G. per-platform cooldown holds across substeps within the same frame", () => {
    // Force the ball to sit at the surface with negative velocity so multiple
    // substeps could each trigger a bounce — cooldown must limit it to 1.
    const plat = makePlatform({ id: 6, y: 0 });
    const ball = createBallState(plat.y + PHYSICS.BALL_RADIUS + 0.01);
    ball.velocityY = -2;
    const acc = createAccumulator();
    const events: CollisionResult["type"][] = [];
    // 3 consecutive frames within the 120ms cooldown window
    for (let i = 0; i < 3; i++) {
      runFrame(ball, [plat], 0, PHYSICS.FIXED_STEP, i * 10, acc, (r) =>
        events.push(r.type),
      );
      // Force ball back to a crossing state to attempt a second bounce
      ball.y = plat.y + PHYSICS.BALL_RADIUS - 0.005;
      ball.previousY = plat.y + PHYSICS.BALL_RADIUS + 0.005;
      ball.velocityY = -2;
    }
    expect(events.filter((e) => e === "bounce").length).toBe(1);
  });
});
