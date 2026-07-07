import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGameStore } from "@/store/useGameStore";

interface Props {
  ballRef: React.RefObject<{ position: { y: number } } | null>;
  velocityRef: React.RefObject<number>;
  accumulatorRef: React.RefObject<number>;
  stepsRef: React.RefObject<number>;
  towerRotationRef: React.RefObject<number>;
}

/** Ponte R3F -> DOM: atualiza um <div> via ref a cada 200ms, zero re-render. */
export function PhysicsDebugBridge({
  ballRef,
  velocityRef,
  accumulatorRef,
  stepsRef,
  towerRotationRef,
}: Props) {
  const lastUpdate = useRef(0);
  useFrame((state) => {
    const now = state.clock.elapsedTime * 1000;
    if (now - lastUpdate.current < 200) return;
    lastUpdate.current = now;
    const el = document.getElementById("__phys_dbg__");
    if (!el) return;
    const fps = (1 / Math.max(state.clock.getDelta() || 0.016, 0.001)).toFixed(0);
    const y = ballRef.current?.position.y ?? 0;
    el.textContent =
      `FPS ~${fps}\n` +
      `status ${useGameStore.getState().gameState}\n` +
      `ball.y ${y.toFixed(3)}\n` +
      `velY ${velocityRef.current.toFixed(3)}\n` +
      `steps ${stepsRef.current}\n` +
      `acc ${accumulatorRef.current.toFixed(4)}\n` +
      `towerRot ${towerRotationRef.current.toFixed(3)}`;
  });
  return null;
}

/** Painel DOM controlado por tecla D, sem se inscrever na física. */
export function PhysicsDebugPanel() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // "P" para o painel de física — "D" é usada para girar a torre (WASD).
      if (e.key.toLowerCase() === "p") setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!open) return null;
  return (
    <pre
      id="__phys_dbg__"
      className="pointer-events-none absolute left-3 top-24 z-30 whitespace-pre rounded-md border border-white/15 bg-black/55 px-2 py-1.5 font-mono text-[10px] leading-tight text-white/90 backdrop-blur-sm"
    >
      awaiting frame…
    </pre>
  );
}
