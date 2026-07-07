import { forwardRef, useMemo } from "react";
import * as THREE from "three";
import { CONSTANTS } from "@/game/config/constants";
import { SKINS, type SkinId } from "@/game/config/skins";

interface Props {
  skinId: SkinId;
  fever: boolean;
}

// Esfera lisa, cor sólida, acabamento fosco — design minimalista.
export const Ball = forwardRef<THREE.Mesh, Props>(function Ball(
  { skinId, fever },
  ref,
) {
  const skin = SKINS[skinId];
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: skin.color,
        emissive: fever ? "#ffcc33" : "#000000",
        emissiveIntensity: fever ? 0.6 : 0,
        metalness: 0,
        roughness: 0.65,
        flatShading: false,
      }),
    [fever, skin.color],
  );

  return (
    <mesh ref={ref} material={material} castShadow>
      <sphereGeometry args={[CONSTANTS.BALL_RADIUS, 24, 24]} />
    </mesh>
  );
});
