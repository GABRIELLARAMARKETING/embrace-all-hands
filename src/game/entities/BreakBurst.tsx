import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const POOL_SIZE = 64; // suporta ~4 bursts simultâneos (16 * 4)
const PARTICLES_PER_BURST_MIN = 12;
const PARTICLES_PER_BURST_MAX = 16;
const LIFE_MS = 600;
const GRAVITY = -18;

export interface BreakBurstHandle {
  burst: (x: number, y: number, z: number, color?: THREE.ColorRepresentation) => void;
}

type Particle = {
  active: boolean;
  age: number; // ms
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number;
  wx: number; wy: number; wz: number; // ang. vel
  color: THREE.Color;
};

// Fixed pool — sem `new` dentro do useFrame.
export const BreakBurst = forwardRef<BreakBurstHandle>(function BreakBurst(_, ref) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const pool = useMemo<Particle[]>(
    () =>
      Array.from({ length: POOL_SIZE }, () => ({
        active: false,
        age: 0,
        px: 0, py: 0, pz: 0,
        vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0, rz: 0,
        wx: 0, wy: 0, wz: 0,
        color: new THREE.Color(),
      })),
    [],
  );

  const geometry = useMemo(() => new THREE.TetrahedronGeometry(0.14, 0), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: false,
        roughness: 0.55,
        metalness: 0.15,
        flatShading: true,
      }),
    [],
  );

  // Buffers reutilizáveis — nunca alocados no loop.
  const tmpMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpEuler = useMemo(() => new THREE.Euler(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(), []);
  const hiddenScale = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const defaultColor = useMemo(() => new THREE.Color("#ff3d7f"), []);

  // Contadores para evitar varrer todo o pool sem necessidade.
  const activeCount = useRef(0);
  const maxUsedIdx = useRef(-1); // último índice já tocado (para "esconder" só uma vez)
  const matrixDirty = useRef(false);
  const colorDirty = useRef(false);

  const hideSlot = (mesh: THREE.InstancedMesh, i: number) => {
    tmpMatrix.compose(tmpPos.set(0, 0, 0), tmpQuat.identity(), hiddenScale);
    mesh.setMatrixAt(i, tmpMatrix);
    matrixDirty.current = true;
  };

  useImperativeHandle(ref, () => ({
    burst: (x, y, z, color) => {
      const mesh = meshRef.current;
      const count =
        PARTICLES_PER_BURST_MIN +
        Math.floor(Math.random() * (PARTICLES_PER_BURST_MAX - PARTICLES_PER_BURST_MIN + 1));
      const col = color !== undefined ? defaultColor.clone().set(color) : defaultColor;
      let spawned = 0;
      for (let i = 0; i < pool.length && spawned < count; i++) {
        const p = pool[i];
        if (p.active) continue;
        p.active = true;
        p.age = 0;
        p.px = x; p.py = y; p.pz = z;
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * Math.PI * 0.9;
        const speed = 3 + Math.random() * 4;
        p.vx = Math.cos(theta) * Math.cos(phi) * speed;
        p.vy = Math.sin(phi) * speed + 2;
        p.vz = Math.sin(theta) * Math.cos(phi) * speed;
        p.rx = Math.random() * Math.PI;
        p.ry = Math.random() * Math.PI;
        p.rz = Math.random() * Math.PI;
        p.wx = (Math.random() - 0.5) * 12;
        p.wy = (Math.random() - 0.5) * 12;
        p.wz = (Math.random() - 0.5) * 12;
        p.color.copy(col);
        activeCount.current++;
        if (i > maxUsedIdx.current) maxUsedIdx.current = i;
        // Cor só muda no spawn — escreve uma vez, marca buffer dirty.
        if (mesh) {
          mesh.setColorAt(i, p.color);
          colorDirty.current = true;
        }
        spawned++;
      }
    },
  }));

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Fast-path: nada ativo, não escreve nada nem toca buffers.
    if (activeCount.current === 0) {
      if (mesh.visible) mesh.visible = false;
      return;
    }

    const ms = dt * 1000;
    const limit = maxUsedIdx.current + 1; // itera só até o slot mais alto já usado
    for (let i = 0; i < limit; i++) {
      const p = pool[i];
      if (!p.active) continue;
      p.age += ms;
      if (p.age >= LIFE_MS) {
        p.active = false;
        activeCount.current--;
        hideSlot(mesh, i);
        continue;
      }
      p.vy += GRAVITY * dt;
      p.px += p.vx * dt;
      p.py += p.vy * dt;
      p.pz += p.vz * dt;
      p.rx += p.wx * dt;
      p.ry += p.wy * dt;
      p.rz += p.wz * dt;
      const t = 1 - p.age / LIFE_MS;
      const s = t > 0.001 ? t : 0.001;
      tmpPos.set(p.px, p.py, p.pz);
      tmpEuler.set(p.rx, p.ry, p.rz);
      tmpQuat.setFromEuler(tmpEuler);
      tmpScale.set(s, s, s);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);
      matrixDirty.current = true;
    }

    // Todo o pool zerou — reseta o cursor para o fast-path da próxima frame.
    if (activeCount.current === 0) maxUsedIdx.current = -1;

    if (matrixDirty.current) {
      mesh.instanceMatrix.needsUpdate = true;
      matrixDirty.current = false;
    }
    if (colorDirty.current && mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
      colorDirty.current = false;
    }
    mesh.visible = true;
  });


  // instanceColor precisa ser inicializado — passando null cria buffer no primeiro setColorAt.
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, POOL_SIZE]}
      frustumCulled={false}
    >
      <instancedBufferAttribute
        attach="instanceColor"
        args={[new Float32Array(POOL_SIZE * 3), 3]}
      />
    </instancedMesh>
  );
});
