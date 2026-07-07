import { forwardRef, useMemo } from "react";
import * as THREE from "three";
import { CONSTANTS } from "@/game/config/constants";
import { FALLBACK_BALL, type ThemeBall } from "@/game/config/themes";

interface Props {
  ballTheme?: ThemeBall;
  fever: boolean;
}

// Esfera lisa cuja cor vem do tema ativo. Puramente visual — não afeta física.
export const Ball = forwardRef<THREE.Mesh, Props>(function Ball(
  { ballTheme, fever },
  ref,
) {
  const bt = ballTheme ?? FALLBACK_BALL;
  const material = useMemo(() => {
    const emissiveColor = fever ? "#ffcc33" : bt.emissive;
    const emissiveIntensity = fever
      ? Math.max(0.6, bt.emissiveIntensity)
      : bt.emissiveIntensity;
    return new THREE.MeshStandardMaterial({
      color: bt.color,
      emissive: emissiveColor,
      emissiveIntensity,
      metalness: bt.metalness,
      roughness: bt.roughness,
    });
  }, [
    fever,
    bt.color,
    bt.emissive,
    bt.emissiveIntensity,
    bt.metalness,
    bt.roughness,
  ]);

  return (
    <mesh ref={ref} material={material} castShadow>
      <sphereGeometry args={[CONSTANTS.BALL_RADIUS, 32, 32]} />
    </mesh>
  );
});
