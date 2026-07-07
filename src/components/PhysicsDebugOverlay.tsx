import { useEffect, useState } from "react";
import { DEBUG_ENABLED, physicsDebug } from "@/game/engine/physicsDebug";

export function PhysicsDebugOverlay() {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!DEBUG_ENABLED) return;
    let raf = 0;
    const loop = () => {
      setTick((t) => (t + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!DEBUG_ENABLED) return null;

  const d = physicsDebug;
  const row = (k: string, v: string, color?: string) => (
    <div className="flex justify-between gap-4">
      <span className="text-white/50">{k}</span>
      <span className={color ?? "text-white"}>{v}</span>
    </div>
  );

  return (
    <div className="pointer-events-none absolute left-3 top-24 z-40 min-w-[200px] rounded-lg border border-white/10 bg-black/70 p-3 font-mono text-[11px] leading-tight text-white backdrop-blur-md">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-fuchsia-300">
        PHYSICS DEBUG
      </div>
      {row("fps", d.fps.toFixed(0))}
      {row("prevY", d.prevY.toFixed(3))}
      {row("currentY", d.currentY.toFixed(3))}
      {row(
        "velocityY",
        d.velocityY.toFixed(3),
        d.velocityY < 0 ? "text-cyan-300" : "text-amber-300",
      )}
      {row("ring", d.ringIndex >= 0 ? String(d.ringIndex) : "-")}
      {row(
        "sector",
        d.sector,
        d.sector === "danger"
          ? "text-red-400"
          : d.sector === "empty"
            ? "text-emerald-300"
            : d.sector === "bonus"
              ? "text-amber-300"
              : "text-white",
      )}
      {row("inGap", d.inGap ? "yes" : "no", d.inGap ? "text-emerald-300" : "text-white/70")}
      {row("collided", d.collided ? "yes" : "no", d.collided ? "text-fuchsia-300" : "text-white/70")}
      {row("combo", String(d.combo))}
      {row("cooldown", d.cooldown > 0 ? `${d.cooldown.toFixed(2)}s` : "-")}
    </div>
  );
}
