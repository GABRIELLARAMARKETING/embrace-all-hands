import { forwardRef, useMemo } from "react";
import * as THREE from "three";
import { CONSTANTS } from "@/game/config/constants";
import { SKINS, type SkinId } from "@/game/config/skins";

interface Props {
  skinId: SkinId;
  fever: boolean;
}

export const Ball = forwardRef<THREE.Mesh, Props>(function Ball(
  { skinId, fever },
  ref,
) {
  const skin = SKINS[skinId];
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: skin.color,
        emissive: fever ? "#ffcc33" : skin.emissive,
        emissiveIntensity: fever ? 1.4 : 0.4,
        metalness: skin.metalness,
        roughness: skin.roughness,
      }),
    [fever, skin.color, skin.emissive, skin.metalness, skin.roughness],
  );

  return (
    <mesh ref={ref} material={material} castShadow>
      <sphereGeometry args={[CONSTANTS.BALL_RADIUS, 32, 32]} />
    </mesh>
  );
});
