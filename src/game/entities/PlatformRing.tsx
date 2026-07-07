import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONSTANTS } from "@/game/config/constants";
import type { RingData, SectorType } from "@/game/engine/levelGenerator";
import { THEMES, type ThemeId } from "@/game/config/themes";

interface Props {
  ring: RingData;
  themeId: ThemeId;
  breakingSince?: number | null;
}

const BREAK_DURATION = 0.75;

const SECTORS = CONSTANTS.SECTORS_PER_RING;
const SECTOR_ANGLE = (Math.PI * 2) / SECTORS;

function sectorGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const r = CONSTANTS.TOWER_RADIUS;
  const ir = CONSTANTS.CORE_RADIUS;
  const a = SECTOR_ANGLE * 0.98; // small gap between sectors for visual seams
  shape.moveTo(Math.cos(0) * ir, Math.sin(0) * ir);
  shape.lineTo(Math.cos(0) * r, Math.sin(0) * r);
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * a;
    shape.lineTo(Math.cos(t) * r, Math.sin(t) * r);
  }
  for (let i = steps; i >= 0; i--) {
    const t = (i / steps) * a;
    shape.lineTo(Math.cos(t) * ir, Math.sin(t) * ir);
  }
  return new THREE.ExtrudeGeometry(shape, {
    depth: CONSTANTS.PLATFORM_HEIGHT,
    bevelEnabled: false,
  });
}

// Single shared geometry per app to save memory.
let SHARED_GEO: THREE.ExtrudeGeometry | null = null;
function getGeo() {
  if (!SHARED_GEO) SHARED_GEO = sectorGeometry();
  return SHARED_GEO;
}

export function PlatformRing({ ring, themeId, breakingSince = null }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const theme = THEMES[themeId];

  const materials = useMemo(
    () => ({
      solid: new THREE.MeshStandardMaterial({
        color: theme.platformNormal,
        roughness: 0.4,
        metalness: 0.2,
      }),
      danger: new THREE.MeshStandardMaterial({
        color: theme.platformDanger,
        emissive: new THREE.Color(theme.platformDanger).multiplyScalar(0.4),
        roughness: 0.5,
      }),
      bonus: new THREE.MeshStandardMaterial({
        color: theme.platformBonus,
        emissive: new THREE.Color(theme.platformBonus).multiplyScalar(0.5),
        roughness: 0.3,
        metalness: 0.5,
      }),
    }),
    [themeId, theme.platformBonus, theme.platformDanger, theme.platformNormal],
  );

  // Pulse danger sectors + break animation.
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    materials.danger.emissiveIntensity = 0.6 + Math.sin(t * 4) * 0.3;

    if (breakingSince != null) {
      const elapsed = Math.max(0, t - breakingSince);
      const k = Math.min(1, elapsed / BREAK_DURATION);
      const s = 1 - k;
      groupRef.current.scale.set(1, Math.max(0.001, s * 0.6), 1);
      groupRef.current.rotation.y = ring.rotation + k * 2.4;
      groupRef.current.position.y = ring.y - k * 1.6;
    } else {
      groupRef.current.scale.set(1, 1, 1);
      groupRef.current.position.y = ring.y;
      groupRef.current.rotation.y = ring.rotation;
    }
  });

  return (
    <group ref={groupRef} position={[0, ring.y, 0]} rotation={[0, ring.rotation, 0]}>
      {ring.sectors.map((type, i) => {
        if (type === "empty") return null;
        const mat: SectorType extends "empty" ? never : SectorType = type;
        return (
          <mesh
            key={i}
            geometry={getGeo()}
            material={materials[mat as keyof typeof materials]}
            rotation={[-Math.PI / 2, 0, i * SECTOR_ANGLE]}
            // Extrusão vai de y=0 a y=+H após Rx(-PI/2); deslocando -H/2 o slab
            // fica centrado em ring.y e o topo visual coincide com o topo físico
            // usado na colisão (ring.y + H/2).
            position={[0, -CONSTANTS.PLATFORM_HEIGHT / 2, 0]}
            castShadow
            receiveShadow
          />
        );
      })}
    </group>
  );
}
