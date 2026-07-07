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

export function Collectible({ y, angle, collected, onCollect, ballRef }: Props) {
  const ref = useRef<THREE.Mesh>(null);
  const r = (CONSTANTS.TOWER_RADIUS + CONSTANTS.CORE_RADIUS) / 2;

  useFrame((state, dt) => {
    if (!ref.current || collected) return;
    ref.current.rotation.y += dt * 3;
    ref.current.position.y = y + Math.sin(state.clock.elapsedTime * 2) * 0.08;

    // Collision with ball.
    if (ballRef.current) {
      const dx = ref.current.position.x - ballRef.current.position.x;
      const dy = ref.current.position.y - ballRef.current.position.y;
      const dz = ref.current.position.z - ballRef.current.position.z;
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
