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
    // Estilo simples: cor sólida fosca, sem brilho metálico nem emissivo.
    // Só ganha um leve glow durante o fever.
    return new THREE.MeshStandardMaterial({
      color: bt.color,
      emissive: fever ? new THREE.Color("#ffcc33") : new THREE.Color("#000000"),
      emissiveIntensity: fever ? 0.5 : 0,
      metalness: 0,
      roughness: 1,
    });
  }, [fever, bt.color]);

  // Escala apenas visual — a física continua usando CONSTANTS.BALL_RADIUS.
  return (
    <mesh ref={ref} material={material} scale={0.7} castShadow>
      <sphereGeometry args={[CONSTANTS.BALL_RADIUS, 24, 24]} />
    </mesh>
  );
});
