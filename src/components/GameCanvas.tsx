import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useIsMobile } from "@/hooks/use-mobile";
import * as THREE from "three";
import { CONSTANTS, DEBUG_PHYSICS } from "@/game/config/constants";
import { LEVELS } from "@/game/config/levels";
import { THEMES } from "@/game/config/themes";
import { generateLevel } from "@/game/engine/levelGenerator";
import { useGameStore } from "@/store/useGameStore";
import { PlatformRing } from "@/game/entities/PlatformRing";
import { TowerCore } from "@/game/entities/TowerCore";
import { Ball } from "@/game/entities/Ball";
import { Collectible } from "@/game/entities/Collectible";
import { Clouds } from "@/game/entities/Clouds";
import { useTowerControls } from "@/game/engine/useTowerControls";
import { SFX } from "@/utils/sound";
import { physicsDebug } from "@/game/engine/physicsDebug";

const SECTORS = CONSTANTS.SECTORS_PER_RING;
const SECTOR_ANGLE = (Math.PI * 2) / SECTORS;

function GameLogic({
  onFirstInput,
}: {
  onFirstInput: () => void;
}) {
  const currentLevel = useGameStore((s) => s.currentLevel);
  const selectedSkin = useGameStore((s) => s.selectedSkin);
  const selectedTheme = useGameStore((s) => s.selectedTheme);
  const gameState = useGameStore((s) => s.gameState);
  const setProgress = useGameStore((s) => s.setProgress);
  const addScore = useGameStore((s) => s.addScore);
  const bumpCombo = useGameStore((s) => s.bumpCombo);
  const resetCombo = useGameStore((s) => s.resetCombo);
  const collectCoin = useGameStore((s) => s.collectCoin);
  const loseGame = useGameStore((s) => s.loseGame);
  const completeLevel = useGameStore((s) => s.completeLevel);

  const level = LEVELS[currentLevel - 1] ?? LEVELS[0];
  const themeId = level.theme in THEMES ? level.theme : selectedTheme;

  const generated = useMemo(
    () =>
      generateLevel(
        level.id,
        level.platformCount,
        level.obstacleRate,
        level.gapSize,
        level.gravityMult,
        level.coinRate,
      ),
    [level],
  );

  const ballRef = useRef<THREE.Mesh>(null);
  const towerGroup = useRef<THREE.Group>(null);
  const towerRotation = useRef(0);
  const currentRotation = useRef(0);
  const bounceSquash = useRef(0);
  const cameraTargetY = useRef(0);
  const cameraShake = useRef(0);
  const velocity = useRef(0);
  const lastBounceRing = useRef<number>(-1);
  const collisionCooldownUntil = useRef(0);
  const passedSincelastBounce = useRef(0);
  const feverUntil = useRef(0);
  const [collectedCoins, setCollectedCoins] = useState<Set<number>>(new Set());
  const [fever, setFever] = useState(false);
  const finishedRef = useRef(false);

  const active = gameState === "playing";

  useTowerControls(towerRotation, active, onFirstInput);

  // Reset on level start.
  useEffect(() => {
    if (gameState !== "playing") return;
    finishedRef.current = false;
    velocity.current = 0;
    lastBounceRing.current = -1;
    collisionCooldownUntil.current = 0;
    passedSincelastBounce.current = 0;
    feverUntil.current = 0;
    setCollectedCoins(new Set());
    setFever(false);
    towerRotation.current = 0;
    currentRotation.current = 0;
    bounceSquash.current = 0;
    if (ballRef.current) {
      ballRef.current.position.set(0, 0.5, (CONSTANTS.TOWER_RADIUS + CONSTANTS.CORE_RADIUS) / 2);
      ballRef.current.scale.set(1, 1, 1);
    }
    cameraTargetY.current = 0;
  }, [gameState, currentLevel]);

  // Space to pause, R to restart.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        const s = useGameStore.getState();
        if (s.gameState === "playing") s.pauseGame();
        else if (s.gameState === "paused") s.resumeGame();
      }
      if (e.key.toLowerCase() === "r" && useGameStore.getState().gameState === "playing") {
        useGameStore.getState().restartGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useFrame((state, deltaRaw) => {
    if (!active || finishedRef.current) return;
    if (!ballRef.current || !towerGroup.current) return;

    const dt = Math.min(deltaRaw, CONSTANTS.PHYSICS_MAX_DELTA);

    // Smooth rotation: framerate-independent lerp toward the input target.
    const smoothT = 1 - Math.pow(1 - CONSTANTS.ROTATION_SMOOTHING, dt * 60);
    currentRotation.current = THREE.MathUtils.lerp(
      currentRotation.current,
      towerRotation.current,
      smoothT,
    );
    towerGroup.current.rotation.y = currentRotation.current;

    const isFever = state.clock.elapsedTime < feverUntil.current;
    if (isFever !== fever) setFever(isFever);

    const ball = ballRef.current;

    // ---------- Physics with fixed substeps (anti-tunneling) ----------
    const steps = Math.max(1, Math.ceil(dt / CONSTANTS.PHYSICS_MAX_STEP));
    const sdt = dt / steps;

    let dbgCollided = false;
    let dbgSector = "-";
    let dbgRing = -1;
    let dbgPrev = ball.position.y;

    for (let step = 0; step < steps; step++) {
      if (finishedRef.current) break;

      // Gravity + clamp.
      velocity.current += generated.gravity * sdt;
      if (velocity.current < CONSTANTS.MAX_FALL_SPEED) {
        velocity.current = CONSTANTS.MAX_FALL_SPEED;
      }

      const prevY = ball.position.y;
      const nextY = prevY + velocity.current * sdt;
      if (step === 0) dbgPrev = prevY;

      let landedY: number | null = null;

      // Only test platform collisions while descending.
      if (velocity.current < 0) {
        const ballAngle = -currentRotation.current + Math.PI / 2;
        const normalizedAngle =
          ((ballAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

        for (let i = 0; i < generated.rings.length; i++) {
          const ring = generated.rings[i];
          const ringTopY = ring.y + CONSTANTS.PLATFORM_HEIGHT / 2;

          const prevBottom = prevY - CONSTANTS.BALL_RADIUS;
          const nextBottom = nextY - CONSTANTS.BALL_RADIUS;

          if (prevBottom < ringTopY) continue;
          if (nextBottom > ringTopY) continue;

          if (
            i === lastBounceRing.current &&
            state.clock.elapsedTime < collisionCooldownUntil.current
          ) {
            continue;
          }

          const relAngle =
            (((normalizedAngle - ring.rotation) % (Math.PI * 2)) +
              Math.PI * 2) %
            (Math.PI * 2);
          const sectorIndex =
            Math.floor(relAngle / SECTOR_ANGLE) % SECTORS;
          const sector = ring.sectors[sectorIndex];

          dbgSector = sector;
          dbgRing = i;

          if (DEBUG_PHYSICS) {
            console.log("[phys] cross ring", i, "sector", sector, {
              prevY,
              nextY,
              velY: velocity.current,
              relAngle,
            });
          }

          if (sector === "empty") {
            passedSincelastBounce.current += 1;
            addScore(10);
            if (
              passedSincelastBounce.current >= CONSTANTS.CASH_FEVER_THRESHOLD &&
              !isFever
            ) {
              feverUntil.current =
                state.clock.elapsedTime + CONSTANTS.CASH_FEVER_DURATION;
              passedSincelastBounce.current = 0;
              bumpCombo();
              addScore(50);
            }
            continue;
          }

          if (sector === "danger") {
            if (isFever) continue;
            cameraShake.current = 0.6;
            finishedRef.current = true;
            loseGame();
            return;
          }

          landedY = ringTopY + CONSTANTS.BALL_RADIUS + CONSTANTS.COLLISION_EPSILON;
          lastBounceRing.current = i;
          collisionCooldownUntil.current =
            state.clock.elapsedTime + CONSTANTS.COLLISION_COOLDOWN;
          velocity.current = CONSTANTS.BOUNCE_VELOCITY;
          bounceSquash.current = 1;
          cameraShake.current = Math.max(cameraShake.current, 0.15);
          SFX.bounce();
          resetCombo();
          passedSincelastBounce.current = 0;
          if (sector === "bonus") collectCoin(3);
          dbgCollided = true;
          break;
        }
      }

      ball.position.y = landedY !== null ? landedY : nextY;
    }

    if (DEBUG_PHYSICS) {
      physicsDebug.prevY = dbgPrev;
      physicsDebug.currentY = ball.position.y;
      physicsDebug.velocityY = velocity.current;
      physicsDebug.sector = dbgSector;
      physicsDebug.ringIndex = dbgRing;
      physicsDebug.inGap = dbgSector === "empty";
      physicsDebug.collided = dbgCollided;
      physicsDebug.cooldown = Math.max(
        0,
        collisionCooldownUntil.current - state.clock.elapsedTime,
      );
      physicsDebug.fps = 1 / Math.max(deltaRaw, 0.0001);
      physicsDebug.combo = useGameStore.getState().combo;
    }

    // ---------- Post-physics visuals ----------

    // Squash on impact, stretch on fast falling.
    bounceSquash.current = Math.max(0, bounceSquash.current - dt * 6);
    const squash = bounceSquash.current * 0.35;
    const fallStretch = Math.max(0, Math.min(0.2, -velocity.current * 0.012));
    const sx = 1 + squash - fallStretch * 0.5;
    const sy = 1 - squash + fallStretch;
    ball.scale.set(sx, sy, sx);

    // Progress bar (based on descent depth).
    const p = Math.min(1, Math.abs(ball.position.y) / generated.totalHeight);
    setProgress(p);

    // Reached bottom?
    if (ball.position.y < -generated.totalHeight + 0.5) {
      finishedRef.current = true;
      completeLevel();
      return;
    }

    // Camera follow + subtle shake (camera is purely visual — never touches physics).
    cameraTargetY.current = THREE.MathUtils.lerp(
      cameraTargetY.current,
      ball.position.y + CONSTANTS.CAMERA_HEIGHT_OFFSET,
      CONSTANTS.CAMERA_LERP,
    );
    cameraShake.current = Math.max(0, cameraShake.current - dt * 2.5);
    const shake = cameraShake.current;
    const camSx = shake ? (Math.random() - 0.5) * shake * 0.4 : 0;
    const camSy = shake ? (Math.random() - 0.5) * shake * 0.4 : 0;
    state.camera.position.set(
      camSx,
      cameraTargetY.current + camSy,
      CONSTANTS.CAMERA_DISTANCE,
    );
    state.camera.lookAt(0, ball.position.y + CONSTANTS.CAMERA_LOOK_AT_OFFSET, 0);
  });

  const theme = THEMES[themeId];

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight
        position={[0, 0, 3]}
        intensity={0.6}
        color={theme.accent}
      />

      <Clouds count={8} />

      <group ref={towerGroup}>
        <TowerCore height={generated.totalHeight + 4} themeId={themeId} />
        {generated.rings.map((ring, i) => (
          <PlatformRing key={i} ring={ring} themeId={themeId} />
        ))}
        {generated.rings.map((ring, i) =>
          ring.hasCoin ? (
            <Collectible
              key={`c-${i}`}
              y={ring.y + CONSTANTS.PLATFORM_SPACING / 2}
              angle={ring.coinAngle}
              collected={collectedCoins.has(i)}
              onCollect={() => {
                setCollectedCoins((prev) => {
                  if (prev.has(i)) return prev;
                  const next = new Set(prev);
                  next.add(i);
                  return next;
                });
                collectCoin(1);
              }}
              ballRef={ballRef}
            />
          ) : null,
        )}
      </group>

      <Ball ref={ballRef} skinId={selectedSkin} fever={fever} />
    </>
  );
}

function MenuIdleScene() {
  const group = useRef<THREE.Group>(null);
  const themeId = useGameStore((s) => s.selectedTheme);
  const theme = THEMES[themeId];

  const rings = useMemo(
    () =>
      generateLevel(1, 14, 0.15, 2, 1, 0.3).rings,
    [],
  );

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.3;
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={0.9} />
      <pointLight position={[0, 2, 3]} intensity={0.5} color={theme.accent} />
      <Clouds count={5} />
      <group ref={group} position={[0, 3, 0]}>
        <TowerCore height={20} themeId={themeId} />
        {rings.map((r, i) => (
          <PlatformRing key={i} ring={r} themeId={themeId} />
        ))}
      </group>
    </>
  );
}

interface Props {
  onFirstInput: () => void;
  idle?: boolean;
}

export function GameCanvas({ onFirstInput, idle }: Props) {
  const themeId = useGameStore((s) => s.selectedTheme);
  const theme = THEMES[themeId];
  const isMobile = useIsMobile();

  return (
    <div
      className="absolute inset-0"
      style={{
        background: theme.bgGradient,
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <Canvas
        shadows={!isMobile}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
        camera={{
          position: [0, CONSTANTS.CAMERA_HEIGHT_OFFSET, CONSTANTS.CAMERA_DISTANCE],
          fov: 55,
        }}
        style={{ touchAction: "none" }}
      >
        <Suspense fallback={null}>
          {idle ? <MenuIdleScene /> : <GameLogic onFirstInput={onFirstInput} />}
        </Suspense>
      </Canvas>
    </div>
  );
}
