import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONSTANTS } from "@/game/config/constants";
import type { ThemeId } from "@/game/config/themes";
import { THEMES } from "@/game/config/themes";

interface Props {
  height: number;
  themeId: ThemeId;
}

export function TowerCore({ height, themeId }: Props) {
  const theme = THEMES[themeId];
  const ref = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.tower,
        roughness: 0.5,
        metalness: 0.3,
      }),
    [theme.tower],
  );

  useFrame(() => {
    if (ref.current) material.color.set(theme.tower);
  });

  return (
    <mesh
      ref={ref}
      material={material}
      position={[0, -height / 2, 0]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[CONSTANTS.CORE_RADIUS * 0.85, CONSTANTS.CORE_RADIUS * 0.85, height + 2, 24]} />
    </mesh>
  );
}
