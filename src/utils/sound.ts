// Web Audio synthesized SFX — no external files.
let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function beep(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.15) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(g).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur);
  } catch {
    // ignore audio failures
  }
}

export const SFX = {
  bounce: () => beep(360, 0.09, "triangle", 0.12),
  coin: () => {
    beep(880, 0.08, "square", 0.08);
    setTimeout(() => beep(1320, 0.08, "square", 0.08), 60);
  },
  combo: () => {
    beep(660, 0.12, "sawtooth", 0.1);
    setTimeout(() => beep(990, 0.14, "sawtooth", 0.1), 80);
  },
  lose: () => beep(120, 0.5, "sawtooth", 0.2),
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.16, "triangle", 0.12), i * 100));
  },
  click: () => beep(500, 0.04, "sine", 0.06),
  platform_break: () => {
    // Crunchy shatter: quick noise-ish descending sweep + low thump.
    beep(220, 0.12, "sawtooth", 0.14);
    setTimeout(() => beep(140, 0.18, "square", 0.1), 40);
    setTimeout(() => beep(90, 0.22, "triangle", 0.12), 90);
  },
};

// Safe dispatcher so callers can request a sound by name without crashing
// if the SFX bank does not implement it.
export function playSound(name: string) {
  try {
    const fn = (SFX as unknown as Record<string, (() => void) | undefined>)[name];
    if (typeof fn === "function") fn();
  } catch {
    // ignore
  }
}

