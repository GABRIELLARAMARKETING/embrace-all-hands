import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const POOL_SIZE = 8; // 6–8 esferas fantasma
const LIFE_MS = 320;
const SPAWN_INTERVAL_MS = 32; // ~30Hz de amostragem
const VEL_THRESHOLD = 12;

export interface BallTrailHandle {
  /** Chame a cada frame com a posição atual da bola e a |velocityY|. */
  update: (x: number, y: number, z: number, absVelY: number, dtMs: number) => void;
  reset: () => void;
}

type Ghost = {
  active: boolean;
  age: number;
  x: number; y: number; z: number;
};

interface Props {
  color?: THREE.ColorRepresentation;
  radius?: number;
}

export const BallTrail = forwardRef<BallTrailHandle, Props>(function BallTrail(
  { color = "#ff3d7f", radius = 0.42 },
  ref,
) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const pool = useMemo<Ghost[]>(
    () =>
      Array.from({ length: POOL_SIZE }, () => ({
        active: false,
        age: 0,
        x: 0,
        y: 0,
        z: 0,
      })),
    [],
  );
  const spawnAccum = useRef(0);

  const geometry = useMemo(() => new THREE.SphereGeometry(radius * 0.92, 12, 12), [radius]);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    [color],
  );

  // Buffers reutilizáveis — nunca alocados no useFrame.
  const tmpMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(), []);
  const hiddenScale = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useImperativeHandle(ref, () => ({
    update: (x, y, z, absVelY, dtMs) => {
      if (absVelY <= VEL_THRESHOLD) {
        spawnAccum.current = 0;
        return;
      }
      spawnAccum.current += dtMs;
      while (spawnAccum.current >= SPAWN_INTERVAL_MS) {
        spawnAccum.current -= SPAWN_INTERVAL_MS;
        // procura slot mais antigo (ou inativo) para reciclar
        let target = 0;
        let oldestAge = -1;
        for (let i = 0; i < pool.length; i++) {
          const g = pool[i];
          if (!g.active) {
            target = i;
            oldestAge = Infinity;
            break;
          }
          if (g.age > oldestAge) {
            oldestAge = g.age;
            target = i;
          }
        }
        const g = pool[target];
        g.active = true;
        g.age = 0;
        g.x = x; g.y = y; g.z = z;
      }
    },
    reset: () => {
      spawnAccum.current = 0;
      for (let i = 0; i < pool.length; i++) pool[i].active = false;
    },
  }));

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const ms = dt * 1000;
    let anyActive = false;
    for (let i = 0; i < pool.length; i++) {
      const g = pool[i];
      if (!g.active) {
        tmpMatrix.compose(tmpPos.set(0, 0, 0), tmpQuat.identity(), hiddenScale);
        mesh.setMatrixAt(i, tmpMatrix);
        continue;
      }
      g.age += ms;
      if (g.age >= LIFE_MS) {
        g.active = false;
        tmpMatrix.compose(tmpPos.set(0, 0, 0), tmpQuat.identity(), hiddenScale);
        mesh.setMatrixAt(i, tmpMatrix);
        continue;
      }
      anyActive = true;
      const t = 1 - g.age / LIFE_MS; // 1 -> 0
      const s = 0.55 + t * 0.45;
      tmpPos.set(g.x, g.y, g.z);
      tmpScale.set(s, s, s);
      tmpMatrix.compose(tmpPos, tmpQuat.identity(), tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // opacidade média baseada nos ativos (aproximação leve — mantém 1 material)
    material.opacity = anyActive ? 0.35 : 0;
    mesh.visible = anyActive;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, POOL_SIZE]}
      frustumCulled={false}
    />
  );
});
