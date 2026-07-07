import { PHYSICS } from "./physicsConstants";
import { stepPhysics, type BallState, type CollisionResult, type Platform } from "./physics";

export interface FrameAccumulator {
  value: number;
}

export function createAccumulator(): FrameAccumulator {
  return { value: 0 };
}

/**
 * Advances physics for one render frame using a fixed timestep + accumulator.
 * Mirrors the loop in GameCanvas.useFrame — kept pure so it can be tested.
 *
 * - `rawDelta` is clamped to PHYSICS.MAX_DELTA.
 * - Runs at most PHYSICS.MAX_SUBSTEPS steps; drops leftover time on saturation
 *   (spiral-of-death guard).
 * Returns the number of substeps actually taken.
 */
export function runFrame(
  ball: BallState,
  platforms: Platform[],
  towerRotation: number,
  rawDelta: number,
  now: number,
  acc: FrameAccumulator,
  onEvent: (r: CollisionResult) => void,
): number {
  const delta = Math.min(rawDelta, PHYSICS.MAX_DELTA);
  acc.value += delta;
  let steps = 0;
  while (acc.value >= PHYSICS.FIXED_STEP && steps < PHYSICS.MAX_SUBSTEPS) {
    acc.value -= PHYSICS.FIXED_STEP;
    steps++;
    stepPhysics(ball, platforms, towerRotation, PHYSICS.FIXED_STEP, now, onEvent);
  }
  if (steps === PHYSICS.MAX_SUBSTEPS) acc.value = 0;
  return steps;
}
