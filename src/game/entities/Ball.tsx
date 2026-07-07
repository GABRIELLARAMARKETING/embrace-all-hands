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

  const stripeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: fever ? "#fff3a3" : "#f7f7f2",
        emissive: fever ? "#ffb000" : "#111111",
        emissiveIntensity: fever ? 0.8 : 0.05,
        metalness: 0.25,
        roughness: 0.28,
      }),
    [fever],
  );

  return (
    <mesh ref={ref} material={material} castShadow>
      <sphereGeometry args={[CONSTANTS.BALL_RADIUS, 32, 32]} />
      <mesh material={stripeMaterial} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry
          args={[CONSTANTS.BALL_RADIUS * 0.94, CONSTANTS.BALL_RADIUS * 0.035, 8, 48]}
        />
      </mesh>
      <mesh material={stripeMaterial} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry
          args={[CONSTANTS.BALL_RADIUS * 0.94, CONSTANTS.BALL_RADIUS * 0.025, 8, 40]}
        />
      </mesh>
    </mesh>
  );
});
