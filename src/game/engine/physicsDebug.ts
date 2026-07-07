import { DEBUG_GAMEPLAY } from "@/game/config/constants";

export interface PhysicsDebugState {
  prevY: number;
  currentY: number;
  velocityY: number;
  sector: string;
  ringIndex: number;
  inGap: boolean;
  collided: boolean;
  cooldown: number;
  combo: number;
  fps: number;
}

export const physicsDebug: PhysicsDebugState = {
  prevY: 0,
  currentY: 0,
  velocityY: 0,
  sector: "-",
  ringIndex: -1,
  inGap: false,
  collided: false,
  cooldown: 0,
  combo: 0,
  fps: 0,
};

export const DEBUG_ENABLED = DEBUG_GAMEPLAY;

