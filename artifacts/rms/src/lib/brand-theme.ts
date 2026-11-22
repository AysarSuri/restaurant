export const BRAND_PRIMARY_STORAGE_KEY = "rms-theme-primary";

const BRAND_PRIMARY_RE = /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/;

/** Apply brand primary HSL (e.g. "38 92% 50%") to CSS variables. */
export function applyBrandPrimary(themePrimary: string, opts?: { persist?: boolean }) {
  const value = themePrimary.trim();
  if (!BRAND_PRIMARY_RE.test(value)) return;
  const root = document.documentElement;
  root.style.setProperty("--primary", value);
  root.style.setProperty("--accent", value);
  root.style.setProperty("--ring", value);
  root.style.setProperty("--warning", value);
  if (opts?.persist !== false) {
    try {
      localStorage.setItem(BRAND_PRIMARY_STORAGE_KEY, value);
    } catch {
      /* private mode / quota */
    }
  }
}

/** Apply last saved brand color before React paints (avoids amber flash). */
export function applyCachedBrandPrimary() {
  try {
    const cached = localStorage.getItem(BRAND_PRIMARY_STORAGE_KEY)?.trim();
    if (cached && BRAND_PRIMARY_RE.test(cached)) {
      applyBrandPrimary(cached, { persist: false });
    }
  } catch {
    /* ignore */
  }
}

export function hexToHslComponents(hex: string): string | null {
  const raw = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function hslComponentsToHex(hsl: string): string {
  const m = hsl.trim().match(/^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/);
  if (!m) return "#f59e0b";
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const THEME_PRESETS: { id: string; label: string; primary: string }[] = [
  { id: "amber", label: "ذهبي", primary: "38 92% 50%" },
  { id: "emerald", label: "زمردي", primary: "152 76% 40%" },
  { id: "sky", label: "سماوي", primary: "199 89% 48%" },
  { id: "blue", label: "أزرق", primary: "221 83% 48%" },
  { id: "rose", label: "وردي", primary: "346 77% 50%" },
  { id: "violet", label: "بنفسجي", primary: "262 83% 58%" },
  { id: "orange", label: "برتقالي", primary: "24 95% 53%" },
  { id: "teal", label: "تركوازي", primary: "173 80% 40%" },
  { id: "slate", label: "رمادي فولاذي", primary: "215 20% 45%" },
];
