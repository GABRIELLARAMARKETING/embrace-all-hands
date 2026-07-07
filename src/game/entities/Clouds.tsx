import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  count?: number;
}

// Simple decorative low-poly clouds drifting slowly.
export function Clouds({ count = 6 }: Props) {
  const group = useRef<THREE.Group>(null);
  const positions = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (Math.random() - 0.5) * 24,
        y: -i * 6 - Math.random() * 4,
        z: (Math.random() - 0.5) * 14 - 6,
        s: 0.8 + Math.random() * 0.6,
        speed: 0.1 + Math.random() * 0.15,
      })),
    [count],
  );

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      child.position.x += positions[i].speed * dt;
      if (child.position.x > 14) child.position.x = -14;
    });
  });

  return (
    <group ref={group}>
      {positions.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]} scale={p.s}>
          <mesh>
            <dodecahedronGeometry args={[0.8, 0]} />
            <meshStandardMaterial color="white" transparent opacity={0.85} />
          </mesh>
          <mesh position={[0.7, -0.1, 0]}>
            <dodecahedronGeometry args={[0.6, 0]} />
            <meshStandardMaterial color="white" transparent opacity={0.85} />
          </mesh>
          <mesh position={[-0.7, -0.1, 0]}>
            <dodecahedronGeometry args={[0.55, 0]} />
            <meshStandardMaterial color="white" transparent opacity={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
