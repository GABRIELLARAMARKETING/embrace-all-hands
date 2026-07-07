import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONSTANTS } from "@/game/config/constants";
import type { RingData, SectorType } from "@/game/engine/levelGenerator";

const SECTORS = CONSTANTS.SECTORS_PER_RING;
const SECTOR_ANGLE = (Math.PI * 2) / SECTORS;
const BALL_ANGLE_RADIUS = Math.asin(
  Math.min(0.95, CONSTANTS.BALL_RADIUS / CONSTANTS.BALL_TRACK_RADIUS),
);

const COLORS: Record<SectorType, string> = {
  solid: "#38d17a",
  danger: "#ff3d5a",
  bonus: "#ffb84a",
  empty: "#1a1a1a",
};

interface Props {
  rings: RingData[];
  ballRef: React.RefObject<THREE.Mesh | null>;
  towerRotationRef: React.RefObject<number>;
}

/** R3F -> DOM bridge: paints 16 sector dots for the nearest ring below the ball. */
export function SectorDebugBridge({ rings, ballRef, towerRotationRef }: Props) {
  const last = useRef(0);
  useFrame((state) => {
    const now = state.clock.elapsedTime * 1000;
    if (now - last.current < 120) return;
    last.current = now;
    const wrap = document.getElementById("__sector_dbg__");
    if (!wrap || !ballRef.current) return;

    const by = ballRef.current.position.y;
    // Find the ring directly under the ball (largest ring.y <= by).
    let target: RingData | null = null;
    for (const r of rings) {
      if (r.y <= by && (!target || r.y > target.y)) target = r;
    }
    if (!target) {
      wrap.textContent = "no ring below";
      return;
    }

    const ballAngle = -towerRotationRef.current - Math.PI / 2;
    const normalized = ((ballAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const rel =
      (((normalized - target.rotation) % (Math.PI * 2)) + Math.PI * 2) %
      (Math.PI * 2);
    const activeIdx = Math.floor(rel / SECTOR_ANGLE) % SECTORS;

    // Sector indices touched by the ball's angular footprint (center + edges).
    const touched = new Set<number>();
    for (const off of [0, -BALL_ANGLE_RADIUS * 0.85, BALL_ANGLE_RADIUS * 0.85]) {
      const r =
        (((normalized - target.rotation + off) % (Math.PI * 2)) +
          Math.PI * 2) %
        (Math.PI * 2);
      touched.add(Math.floor(r / SECTOR_ANGLE) % SECTORS);
    }

    let html = `<div style="margin-bottom:4px">ring y=${target.y.toFixed(2)} · Δy=${(by - target.y).toFixed(2)}</div>`;
    html += `<div style="display:flex;gap:2px;flex-wrap:wrap">`;
    for (let i = 0; i < SECTORS; i++) {
      const s = target.sectors[i];
      const isActive = i === activeIdx;
      const isTouched = touched.has(i);
      const border = isActive
        ? "2px solid #fff"
        : isTouched
          ? "1px solid #ffffff88"
          : "1px solid #ffffff22";
      html += `<span title="${i}:${s}" style="width:14px;height:14px;background:${COLORS[s]};border:${border};border-radius:3px;display:inline-block"></span>`;
    }
    html += `</div>`;
    html += `<div style="margin-top:4px;opacity:.8">under ball: [${activeIdx}] ${target.sectors[activeIdx]}</div>`;
    wrap.innerHTML = html;
  });
  return null;
}

/** DOM panel toggled with 'O'. */
export function SectorDebugPanel() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "o") setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!open) return null;
  return (
    <div
      id="__sector_dbg__"
      className="pointer-events-none absolute right-3 top-24 z-30 rounded-md border border-white/15 bg-black/60 px-2 py-1.5 font-mono text-[10px] leading-tight text-white/90 backdrop-blur-sm"
    >
      awaiting frame…
    </div>
  );
}
