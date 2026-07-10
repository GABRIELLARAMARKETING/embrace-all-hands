import { describe, it, expect, beforeEach } from "vitest";
import {
  checkPlatformCollision,
  createBallState,
  type Platform,
} from "@/game/physics";
import { PHYSICS } from "@/game/physicsConstants";
import { useGameStore } from "@/store/useGameStore";

function dangerPlatform(): Platform {
  return {
    id: 1,
    y: 0,
    gapStart: 0,
    gapSize: 0,
    dangerStart: 0,
    dangerSize: Math.PI * 2, // toda a plataforma é danger
    breakable: false,
    broken: false,
  };
}

describe("danger sector → loseGame", () => {
  beforeEach(() => {
    useGameStore.setState({
      gameState: "menu",
      score: 0,
      coins: 0,
      combo: 0,
      bestComboRun: 0,
      progress: 0,
    });
  });

  it("checkPlatformCollision retorna 'gameover' quando o ângulo cai em zona de perigo", () => {
    const platform = dangerPlatform();
    const ball = createBallState(platform.y + PHYSICS.BALL_RADIUS + 0.05);
    ball.previousY = platform.y + PHYSICS.BALL_RADIUS + 0.05;
    ball.y = platform.y - 0.01;
    ball.velocityY = -8;
    ball.angle = 0;

    const result = checkPlatformCollision(ball, platform, 0, performance.now());
    expect(result.type).toBe("gameover");
  });

  it("loseGame() muda o estado do jogador imediatamente para 'gameOver'", () => {
    const store = useGameStore.getState();
    store.startGame(1);
    expect(useGameStore.getState().gameState).toBe("playing");

    // Simula o efeito de tocar num setor de perigo.
    useGameStore.getState().loseGame();

    expect(useGameStore.getState().gameState).toBe("gameOver");
  });
});
