import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useIsMobile } from "@/hooks/use-mobile";
import * as THREE from "three";
import { CONSTANTS, DEBUG_PHYSICS } from "@/game/config/constants";
import { PHYSICS } from "@/game/physicsConstants";
import { LEVELS } from "@/game/config/levels";
import { THEMES } from "@/game/config/themes";
import { generateLevel, type RingData, type SectorType } from "@/game/engine/levelGenerator";
import { helixRuntime } from "@/game/config/difficulty";

import { useGameStore } from "@/store/useGameStore";
import { PlatformRing } from "@/game/entities/PlatformRing";
import { TowerCore } from "@/game/entities/TowerCore";
import { Ball } from "@/game/entities/Ball";
import { Collectible } from "@/game/entities/Collectible";
import { Clouds } from "@/game/entities/Clouds";
import { BreakBurst, type BreakBurstHandle } from "@/game/entities/BreakBurst";
import { BallTrail, type BallTrailHandle } from "@/game/entities/BallTrail";
import { PhysicsDebugBridge, PhysicsDebugPanel } from "@/components/PhysicsDebugBridge";
import { SectorDebugBridge, SectorDebugPanel } from "@/components/SectorDebugOverlay";
import { useTowerControls } from "@/game/engine/useTowerControls";
import { SFX, playSound } from "@/utils/sound";
import { physicsDebug } from "@/game/engine/physicsDebug";

const SECTORS = CONSTANTS.SECTORS_PER_RING;
const SECTOR_ANGLE = (Math.PI * 2) / SECTORS;
const BALL_ANGLE_RADIUS = Math.asin(
  Math.min(0.95, CONSTANTS.BALL_RADIUS / CONSTANTS.BALL_TRACK_RADIUS),
);

function sectorAt(ring: RingData, normalizedBallAngle: number, offset = 0): SectorType {
  const relAngle =
    (((normalizedBallAngle - ring.rotation + offset) % (Math.PI * 2)) +
      Math.PI * 2) %
    (Math.PI * 2);
  const sectorIndex = Math.floor(relAngle / SECTOR_ANGLE) % SECTORS;
  return ring.sectors[sectorIndex];
}

function resolveContactSector(
  ring: RingData,
  normalizedBallAngle: number,
): SectorType {
  // Center sample decides bounce / danger / bonus — the ball's angular center
  // is the authoritative contact point. Colour is only cosmetic; the sector
  // TYPE from the ring model is what determines game over.
  const centerSector = sectorAt(ring, normalizedBallAngle, 0);
  if (centerSector === "danger") return "danger";
  if (centerSector === "bonus") return "bonus";
  if (centerSector === "solid") return "solid";

  // Only when the ball sits over a gap do we sample the edges — this is a
  // small forgiveness so the player can slip through gaps that align with the
  // ball's angular extents, without ever turning a safe hit into "danger".
  const edgeOffset = BALL_ANGLE_RADIUS * 0.85;
  const left = sectorAt(ring, normalizedBallAngle, -edgeOffset);
  const right = sectorAt(ring, normalizedBallAngle, edgeOffset);
  if (left === "empty" && right === "empty") return "empty";
  // Adjacent solid/bonus keeps the ball on the platform (bounce), never danger.
  if (left === "solid" || right === "solid") return "solid";
  if (left === "bonus" || right === "bonus") return "bonus";
  return "empty";
}


function GameLogic({
  onFirstInput,
  cameraDistance,
}: {
  onFirstInput: () => void;
  cameraDistance: number;
}) {
  const currentLevel = useGameStore((s) => s.currentLevel);
  
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

  const generated = useMemo(() => {
    const hx = helixRuntime.get().settings;
    const progression = 0.7 + 0.3 * hx.difficultyProgressionRate;
    const obstacleRate = Math.min(
      0.9,
      Math.max(0, level.obstacleRate * hx.obstacleDensity * (0.6 + 0.4 * hx.obstacleFrequency) * progression),
    );
    const gap = Math.max(1, Math.round(level.gapSize * hx.gapSize));
    const gravityMult = level.gravityMult * hx.gravity;
    return generateLevel(level.id, level.platformCount, obstacleRate, gap, gravityMult, level.coinRate);
  }, [level]);



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
  const dangerHitFrames = useRef(0);

  const passedSincelastBounce = useRef(0);
  const feverUntil = useRef(0);
  const spinVelocity = useRef(0);
  const accumulator = useRef(0);
  const debugSteps = useRef(0);
  const burstRef = useRef<BreakBurstHandle>(null);
  const trailRef = useRef<BallTrailHandle>(null);
  const [collectedCoins, setCollectedCoins] = useState<Set<number>>(new Set());
  const [fever, setFever] = useState(false);
  const finishedRef = useRef(false);
  // Floor-break mechanic.
  const [breakingRings, setBreakingRings] = useState<Map<number, number>>(new Map());
  const brokenRingsRef = useRef<Set<number>>(new Set());
  const breakingRingsRef = useRef<Map<number, number>>(new Map());
  const deepestRingRef = useRef<number>(-1);

  const active = gameState === "playing";

  useTowerControls(towerRotation, active, onFirstInput);

  // Reset on level start.
  useEffect(() => {
    if (gameState !== "playing") return;
    finishedRef.current = false;
    velocity.current = 0;
    lastBounceRing.current = -1;
    collisionCooldownUntil.current = 0;
    dangerHitFrames.current = 0;

    passedSincelastBounce.current = 0;
    feverUntil.current = 0;
    setCollectedCoins(new Set());
    setFever(false);
    towerRotation.current = 0;
    currentRotation.current = 0;
    bounceSquash.current = 0;
    spinVelocity.current = 0;
    accumulator.current = 0;
    trailRef.current?.reset();
    if (ballRef.current) {
      ballRef.current.position.set(0, 0.5, CONSTANTS.BALL_TRACK_RADIUS);
      ballRef.current.rotation.set(0, 0, 0);
      ballRef.current.scale.set(1, 1, 1);
    }
    cameraTargetY.current = 0.5 + CONSTANTS.CAMERA_HEIGHT_OFFSET;
    brokenRingsRef.current = new Set();
    breakingRingsRef.current = new Map();
    deepestRingRef.current = -1;
    setBreakingRings(new Map());
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

    const dt = Math.min(deltaRaw, PHYSICS.MAX_DELTA);

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
    if (velocity.current > 0) dangerHitFrames.current = 0;


    // ---------- Physics: fixed timestep + accumulator (anti-tunneling, deterministic) ----------
    const sdt = PHYSICS.FIXED_STEP;
    accumulator.current += dt;

    let dbgCollided = false;
    let dbgSector = "-";
    let dbgRing = -1;
    let dbgPrev = ball.position.y;
    let stepsTaken = 0;

    while (
      accumulator.current >= sdt &&
      stepsTaken < PHYSICS.MAX_SUBSTEPS &&
      !finishedRef.current
    ) {
      accumulator.current -= sdt;
      stepsTaken++;

      // Gravity + clamp.
      velocity.current += generated.gravity * sdt;
      velocity.current *= Math.exp(-CONSTANTS.AIR_FRICTION * sdt);
      if (velocity.current < CONSTANTS.MAX_FALL_SPEED) {
        velocity.current = CONSTANTS.MAX_FALL_SPEED;
      }

      const prevY = ball.position.y;
      const nextY = prevY + velocity.current * sdt;
      if (stepsTaken === 1) dbgPrev = prevY;

      let landedY: number | null = null;

      // Only test platform collisions while descending.
      if (velocity.current < 0) {
        // A shape do setor é construída no plano XY e rotacionada com Rx(-PI/2),
        // o que espelha o ângulo (XZ = -planar). A bola está no ângulo de mundo +PI/2,
        // logo em espaço planar do anel: -(PI/2) - rotação da torre.
        const ballAngle = -currentRotation.current - Math.PI / 2;
        const normalizedAngle =
          ((ballAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

        for (let i = 0; i < generated.rings.length; i++) {
          const ring = generated.rings[i];
          const ringTopY = ring.y + CONSTANTS.PLATFORM_HEIGHT / 2;

          const prevBottom = prevY - CONSTANTS.BALL_RADIUS;
          const nextBottom = nextY - CONSTANTS.BALL_RADIUS;

          if (prevBottom < ringTopY) continue;
          if (nextBottom > ringTopY) continue;

          // Broken/breaking rings have no collision — but still count as descent.
          const isGone =
            brokenRingsRef.current.has(i) || breakingRingsRef.current.has(i);

          // Descent tracker: whenever the ball crosses a new deeper ring,
          // break every ring above it that is still active.
          if (i > deepestRingRef.current) {
            const prevDeepest = deepestRingRef.current;
            deepestRingRef.current = i;
            const now = state.clock.elapsedTime;
            for (let k = Math.max(0, prevDeepest); k < i; k++) {
              if (
                brokenRingsRef.current.has(k) ||
                breakingRingsRef.current.has(k)
              )
                continue;
              breakingRingsRef.current.set(k, now);
              playSound("platform_break");
              const kRing = generated.rings[k];
              burstRef.current?.burst(
                0,
                kRing.y + CONSTANTS.PLATFORM_HEIGHT / 2,
                CONSTANTS.BALL_TRACK_RADIUS,
                THEMES[themeId].accent,
              );
              cameraShake.current = Math.max(cameraShake.current, 0.45);
              addScore(1);
              // Moeda fictícia sobe na tela a cada degrau quebrado (+R$ 1,00).
              import("@/components/CoinPopLayer").then((m) =>
                m.spawnCoinPop(1),
              );
              window.setTimeout(() => {
                breakingRingsRef.current.delete(k);
                brokenRingsRef.current.add(k);
                setBreakingRings(new Map(breakingRingsRef.current));
              }, 230);
            }
            setBreakingRings(new Map(breakingRingsRef.current));
          }

          if (isGone) continue;

          if (
            i === lastBounceRing.current &&
            state.clock.elapsedTime < collisionCooldownUntil.current
          ) {
            continue;
          }

          const sector = resolveContactSector(ring, normalizedAngle);

          dbgSector = sector;
          dbgRing = i;

          if (DEBUG_PHYSICS) {
            console.log("[phys] cross ring", i, "sector", sector, {
              prevY,
              nextY,
              velY: velocity.current,
              normalizedAngle,
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



          const impactSpeed = Math.abs(velocity.current);
          landedY = ringTopY + CONSTANTS.BALL_RADIUS + CONSTANTS.COLLISION_EPSILON;
          lastBounceRing.current = i;
          collisionCooldownUntil.current =
            state.clock.elapsedTime + CONSTANTS.COLLISION_COOLDOWN;
          const hxBall = helixRuntime.get().settings.ballSpeed;
          velocity.current = Math.min(
            CONSTANTS.MAX_BOUNCE_VELOCITY * hxBall,
            Math.max(
              CONSTANTS.BOUNCE_VELOCITY * hxBall,
              impactSpeed * CONSTANTS.BOUNCE_RESTITUTION *
                (1 - CONSTANTS.IMPACT_FRICTION),
            ),
          );

          spinVelocity.current = Math.min(
            28,
            (impactSpeed / CONSTANTS.BALL_RADIUS) *
              (1 - CONSTANTS.IMPACT_FRICTION),
          );
          bounceSquash.current = 1;
          cameraShake.current = Math.max(cameraShake.current, 0.15);
          SFX.bounce();
          if (isFever) {
            burstRef.current?.burst(
              ball.position.x,
              ringTopY,
              ball.position.z,
              "#ff3d7f",
            );
          }
          resetCombo();
          passedSincelastBounce.current = 0;
          if (sector === "bonus") collectCoin(3);
          dbgCollided = true;
          break;
        }
      }

      ball.position.y = landedY !== null ? landedY : nextY;
    }
    // Spiral-of-death guard: if we hit the substep cap, drop leftover time.
    if (stepsTaken === PHYSICS.MAX_SUBSTEPS) accumulator.current = 0;
    debugSteps.current = stepsTaken;


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

    // Rotação visual desativada (esfera lisa não precisa) — ref mantida p/ reset.
    void spinVelocity;

    // Deformação bem sutil: quique quase rígido, esticada leve na queda.
    bounceSquash.current = Math.max(0, bounceSquash.current - dt * 9);
    const squash = bounceSquash.current * 0.14;
    const fallStretch = Math.max(0, Math.min(0.07, -velocity.current * 0.005));
    const sx = 1 + squash - fallStretch * 0.5;
    const sy = 1 - squash + fallStretch;
    ball.scale.set(sx, sy, sx);

    // Trail desativado — visual minimalista. (Componente mantido para reativação futura.)

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
    const cameraT = 1 - Math.pow(1 - CONSTANTS.CAMERA_LERP, dt * 60);
    // Camera segue apenas descendo — nunca sobe quando a bola quica (padrão do gênero).
    const desiredCamY = ball.position.y + CONSTANTS.CAMERA_HEIGHT_OFFSET;
    const nextCamY = THREE.MathUtils.lerp(
      cameraTargetY.current,
      desiredCamY,
      cameraT,
    );
    cameraTargetY.current = Math.min(cameraTargetY.current, nextCamY);
    cameraShake.current = Math.max(0, cameraShake.current - dt * 2.5);
    const shake = cameraShake.current;
    const camSx = shake ? (Math.random() - 0.5) * shake * 0.4 : 0;
    const camSy = shake ? (Math.random() - 0.5) * shake * 0.4 : 0;
    state.camera.position.set(
      camSx,
      cameraTargetY.current + camSy,
      cameraDistance,
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
        {generated.rings.map((ring, i) => {
          if (brokenRingsRef.current.has(i)) return null;
          const breakingSince = breakingRings.get(i) ?? null;
          return (
            <PlatformRing
              key={i}
              ring={ring}
              themeId={themeId}
              breakingSince={breakingSince}
            />
          );
        })}
        {/* moedas removidas do jogo */}

      </group>

      <Ball ref={ballRef} ballTheme={theme.ball} fever={fever} />
      <BreakBurst ref={burstRef} />
      <BallTrail ref={trailRef} />
      <PhysicsDebugBridge
        ballRef={ballRef}
        velocityRef={velocity}
        accumulatorRef={accumulator}
        stepsRef={debugSteps}
        towerRotationRef={currentRotation}
      />
      <SectorDebugBridge
        rings={generated.rings}
        ballRef={ballRef}
        towerRotationRef={currentRotation}
      />
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
      className="absolute inset-0 bg-cover bg-center"
      style={{
        backgroundImage: `url(${theme.bgImage}), ${theme.bgGradient}`,
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
          near: 0.1,
          far: 1000,
        }}
        style={{ touchAction: "none" }}
      >
        <Suspense fallback={null}>
          {idle ? <MenuIdleScene /> : <GameLogic onFirstInput={onFirstInput} cameraDistance={CONSTANTS.CAMERA_DISTANCE} />}
        </Suspense>
      </Canvas>
      <PhysicsDebugPanel />
      <SectorDebugPanel />
    </div>
  );
}
