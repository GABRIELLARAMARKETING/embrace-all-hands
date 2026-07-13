// Sistema de sons para notificações do admin.
// Usa Web Audio API para gerar sons curtos por categoria — sem depender de arquivos.
// Configurações são persistidas em localStorage por administrador (por navegador).

export type NotifCategory =
  | "financial"
  | "user"
  | "affiliate"
  | "manager"
  | "support"
  | "system";

export interface SoundPrefs {
  enabled: boolean;
  volume: number; // 0..1
  criticalOnly: boolean;
  quietStart: string | null; // "22:00"
  quietEnd: string | null; // "08:00"
  perCategory: Record<NotifCategory, boolean>;
  unlocked: boolean;
}

const STORAGE_KEY = "helix.admin.notif.sound.v1";

const DEFAULT: SoundPrefs = {
  enabled: true,
  volume: 0.5,
  criticalOnly: false,
  quietStart: null,
  quietEnd: null,
  perCategory: {
    financial: true,
    user: true,
    affiliate: true,
    manager: true,
    support: true,
    system: true,
  },
  unlocked: false,
};

export function loadPrefs(): SoundPrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function savePrefs(p: SoundPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function categoryFromType(type: string): NotifCategory {
  const t = type.toLowerCase();
  if (t.includes("deposit") || t.includes("withdraw") || t.includes("payment") || t.includes("commission") || t.includes("balance") || t.includes("bonus")) return "financial";
  if (t.includes("affiliate") || t.includes("referral")) return "affiliate";
  if (t.includes("manager") || t.includes("gerente")) return "manager";
  if (t.includes("support") || t.includes("ticket") || t.includes("message")) return "support";
  if (t.includes("system") || t.includes("error") || t.includes("alert") || t.includes("security") || t.includes("webhook") || t.includes("api")) return "system";
  return "user";
}

function isInQuietHours(p: SoundPrefs, now = new Date()): boolean {
  if (!p.quietStart || !p.quietEnd) return false;
  const [sh, sm] = p.quietStart.split(":").map(Number);
  const [eh, em] = p.quietEnd.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Deve ser chamado dentro de um evento de usuário (click) para desbloquear o áudio. */
export async function unlockAudio(): Promise<boolean> {
  const c = ac();
  if (!c) return false;
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      return false;
    }
  }
  // Beep silencioso para forçar a "warm-up" da política de autoplay.
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = 0.0001;
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.02);
  const p = loadPrefs();
  savePrefs({ ...p, unlocked: true });
  return true;
}

type Tone = { freq: number; dur: number; type?: OscillatorType; slide?: number };

const CATEGORY_TONES: Record<NotifCategory, Tone[]> = {
  financial: [{ freq: 660, dur: 0.09, type: "sine" }, { freq: 880, dur: 0.14, type: "sine" }],
  user: [{ freq: 520, dur: 0.1, type: "triangle" }],
  affiliate: [{ freq: 700, dur: 0.09, type: "triangle" }, { freq: 940, dur: 0.11, type: "triangle" }],
  manager: [{ freq: 440, dur: 0.11, type: "square" }, { freq: 600, dur: 0.11, type: "square" }],
  support: [{ freq: 780, dur: 0.08, type: "sine" }, { freq: 780, dur: 0.08, type: "sine" }],
  system: [{ freq: 300, dur: 0.14, type: "sawtooth" }, { freq: 220, dur: 0.18, type: "sawtooth" }],
};

const CRITICAL_TONES: Tone[] = [
  { freq: 880, dur: 0.12, type: "square" },
  { freq: 660, dur: 0.12, type: "square" },
  { freq: 880, dur: 0.18, type: "square" },
];

async function playTones(tones: Tone[], volume: number) {
  const c = ac();
  if (!c) return;
  if (c.state === "suspended") {
    try { await c.resume(); } catch { return; }
  }
  let t = c.currentTime;
  for (const tone of tones) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tone.type ?? "sine";
    o.frequency.setValueAtTime(tone.freq, t);
    // Envelope simples para evitar "click".
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + tone.dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + tone.dur + 0.02);
    t += tone.dur + 0.03;
  }
}

export async function playNotificationSound(opts: {
  category: NotifCategory;
  severity?: "info" | "success" | "warning" | "error" | "critical";
}) {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.unlocked) return;
  if (isInQuietHours(prefs) && opts.severity !== "critical") return;
  const isCritical = opts.severity === "critical";
  if (prefs.criticalOnly && !isCritical) return;
  if (!isCritical && !prefs.perCategory[opts.category]) return;
  const tones = isCritical ? CRITICAL_TONES : CATEGORY_TONES[opts.category];
  await playTones(tones, prefs.volume);
}

export async function testSound(category: NotifCategory) {
  const prefs = loadPrefs();
  await playTones(CATEGORY_TONES[category], Math.max(prefs.volume, 0.2));
}
