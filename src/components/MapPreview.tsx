import type { PreviewConfig, ThemeDecoration } from "@/types/theme";

interface Props {
  preview: PreviewConfig;
  intensity?: number;
}

/**
 * Pure CSS/SVG preview of a Helix tower for a given theme, driven entirely by
 * the backend preview_config so new themes require no code changes.
 */
export function MapPreview({ preview, intensity = 1 }: Props) {
  if (preview.previewImage) {
    return (
      <div
        className="relative h-full w-full overflow-hidden rounded-[18px]"
        style={{ background: preview.background }}
      >
        <img
          src={preview.previewImage}
          alt=""
          className="h-full w-full object-cover"
          style={{ opacity: 0.4 + intensity * 0.6 }}
          draggable={false}
        />
      </div>
    );
  }
  const platforms = (preview.platformColors ?? []).slice(0, 3);
  const [p0, p1, p2] = [platforms[0] ?? "#ccc", platforms[1] ?? "#999", platforms[2] ?? "#fff"];

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[18px]"
      style={{ background: preview.background }}
    >
      {(preview.decorations ?? []).map((d) => (
        <Decor key={d} kind={d} intensity={intensity} accent={preview.cardGlow} />
      ))}

      {/* Pole */}
      <div
        className="absolute left-1/2 top-[10%] h-[80%] w-[6%] -translate-x-1/2 rounded-full"
        style={{
          background: `linear-gradient(180deg, ${preview.poleColor}, ${shade(preview.poleColor, -20)})`,
          boxShadow: "inset 0 0 6px rgba(0,0,0,0.35)",
        }}
      />

      {/* Platforms */}
      {Array.from({ length: 7 }).map((_, i) => {
        const isDanger = i === 2 || i === 5;
        const colors: [string, string, string] = isDanger
          ? [preview.dangerColor, p1, preview.dangerColor]
          : [p0, p1, p2];
        return (
          <Platform key={i} top={`${18 + i * 10}%`} rotate={(i * 47) % 360} colors={colors} />
        );
      })}

      {/* Ball */}
      <div
        className="absolute left-1/2 top-[14%] h-4 w-4 -translate-x-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 30%, #fff, ${preview.ballColor})`,
          boxShadow: `0 0 12px 2px ${withAlpha(preview.cardGlow, 0.7)}`,
        }}
      />
    </div>
  );
}

function Platform({
  top,
  rotate,
  colors,
}: {
  top: string;
  rotate: number;
  colors: [string, string, string];
}) {
  return (
    <div
      className="absolute left-1/2 h-3 w-[78%] -translate-x-1/2"
      style={{
        top,
        transform: `translateX(-50%) perspective(220px) rotateX(58deg) rotateZ(${rotate}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      <div
        className="h-full w-full rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${colors[0]} 0 30%, transparent 30% 45%, ${colors[1]} 45% 78%, transparent 78% 90%, ${colors[2]} 90% 100%)`,
          boxShadow: "0 4px 8px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
}

function Decor({
  kind,
  intensity,
  accent,
}: {
  kind: ThemeDecoration;
  intensity: number;
  accent: string;
}) {
  const style = { opacity: intensity };
  if (kind === "clouds")
    return (
      <div className="absolute inset-0" style={style}>
        <div className="absolute left-2 top-3 h-3 w-8 rounded-full bg-white/80" />
        <div className="absolute right-3 top-6 h-3 w-10 rounded-full bg-white/70" />
        <div className="absolute left-4 bottom-4 h-3 w-6 rounded-full bg-white/60" />
      </div>
    );
  if (kind === "lava")
    return (
      <div className="absolute inset-0" style={style}>
        <div className="absolute bottom-0 left-0 h-8 w-full bg-gradient-to-t from-orange-500/70 to-transparent" />
        <div className="absolute right-4 top-8 h-1.5 w-1.5 rounded-full bg-orange-300 shadow-[0_0_8px_2px_rgba(255,120,40,0.9)]" />
      </div>
    );
  if (kind === "bubbles")
    return (
      <div className="absolute inset-0" style={style}>
        {[10, 30, 55, 75].map((p, i) => (
          <div
            key={i}
            className="absolute h-2 w-2 rounded-full bg-white/60"
            style={{ left: `${p}%`, top: `${20 + i * 15}%` }}
          />
        ))}
      </div>
    );
  if (kind === "stadium")
    return (
      <div className="absolute inset-0" style={style}>
        <div className="absolute inset-x-2 bottom-3 h-6 rounded-md bg-black/40 ring-1 ring-white/10" />
        <div className="absolute inset-x-4 bottom-5 h-2 rounded-sm bg-white/20" />
      </div>
    );
  if (kind === "candy")
    return (
      <div className="absolute inset-0" style={style}>
        <div className="absolute left-3 top-5 h-4 w-4 rounded-full bg-pink-300" />
        <div className="absolute right-4 top-10 h-3 w-3 rotate-45 bg-yellow-200" />
      </div>
    );
  if (kind === "grid")
    return (
      <div
        className="absolute inset-0"
        style={{
          opacity: intensity * 0.6,
          backgroundImage:
            "linear-gradient(rgba(0,240,255,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.25) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
    );
  if (kind === "snow")
    return (
      <div className="absolute inset-0" style={style}>
        {[15, 40, 65, 85].map((p, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white"
            style={{ left: `${p}%`, top: `${10 + i * 22}%` }}
          />
        ))}
      </div>
    );
  if (kind === "desert")
    return (
      <div className="absolute inset-0" style={style}>
        <div className="absolute bottom-2 left-2 h-6 w-1.5 rounded bg-emerald-700" />
        <div className="absolute right-4 top-4 h-4 w-4 rounded-full bg-yellow-200/80 shadow-[0_0_16px_4px_rgba(255,220,120,0.7)]" />
      </div>
    );
  if (kind === "stars")
    return (
      <div className="absolute inset-0" style={style}>
        {[8, 22, 44, 63, 78, 90].map((p, i) => (
          <div
            key={i}
            className="absolute h-0.5 w-0.5 rounded-full bg-white"
            style={{ left: `${p}%`, top: `${(i * 37) % 90}%`, boxShadow: `0 0 6px ${accent}` }}
          />
        ))}
      </div>
    );
  return (
    <div className="absolute inset-0" style={style}>
      <div className="absolute bottom-0 left-0 h-6 w-full bg-gradient-to-t from-emerald-900/70 to-transparent" />
      <div className="absolute left-2 bottom-3 h-3 w-6 rounded-full bg-emerald-600/80" />
    </div>
  );
}

function shade(hex: string, amt: number) {
  const c = hex.replace("#", "");
  const num = parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

function withAlpha(hex: string, a: number) {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  const num = parseInt(full, 16);
  return `rgba(${num >> 16},${(num >> 8) & 0xff},${num & 0xff},${a})`;
}
