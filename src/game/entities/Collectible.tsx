import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { CONSTANTS } from "@/game/config/constants";

interface Props {
  y: number;
  angle: number;
  collected: boolean;
  onCollect: () => void;
  ballRef: React.RefObject<THREE.Mesh | null>;
}

// Vetor reutilizável — evita alocação dentro do useFrame.
const COIN_WORLD = new THREE.Vector3();

export function Collectible({ y, angle, collected, onCollect, ballRef }: Props) {
  const ref = useRef<THREE.Mesh>(null);
  const r = (CONSTANTS.TOWER_RADIUS + CONSTANTS.CORE_RADIUS) / 2;

  useFrame((state, dt) => {
    if (!ref.current || collected) return;
    ref.current.rotation.y += dt * 3;
    ref.current.position.y = y + Math.sin(state.clock.elapsedTime * 2) * 0.08;

    // Collision with ball — comparar em espaço de MUNDO: a moeda vive dentro
    // do grupo da torre (coords locais) e a bola vive fora dele (coords de mundo).
    if (ballRef.current) {
      ref.current.getWorldPosition(COIN_WORLD);
      const dx = COIN_WORLD.x - ballRef.current.position.x;
      const dy = COIN_WORLD.y - ballRef.current.position.y;
      const dz = COIN_WORLD.z - ballRef.current.position.z;
      if (dx * dx + dy * dy + dz * dz < 0.3 * 0.3) onCollect();
    }
  });

  if (collected) return null;

  return (
    <mesh
      ref={ref}
      position={[Math.cos(angle) * r, y, Math.sin(angle) * r]}
      castShadow
    >
      <octahedronGeometry args={[0.16, 0]} />
      <meshStandardMaterial
        color="#ffd700"
        emissive="#ffaa00"
        emissiveIntensity={0.8}
        metalness={1}
        roughness={0.2}
      />
    </mesh>
  );
}
