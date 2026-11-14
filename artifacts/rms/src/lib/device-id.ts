const DEVICE_KEY = "rms-device-key";
const DEVICE_NAME = "rms-device-name";

export function getOrCreateDeviceKey(): string {
  try {
    let key = localStorage.getItem(DEVICE_KEY);
    if (!key) {
      key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, key);
    }
    return key;
  } catch {
    return `dev-fallback-${Date.now()}`;
  }
}

export function getStoredDeviceName(): string {
  try {
    return localStorage.getItem(DEVICE_NAME) ?? "";
  } catch {
    return "";
  }
}

export function setStoredDeviceName(name: string) {
  try {
    localStorage.setItem(DEVICE_NAME, name.trim());
  } catch {
    /* ignore */
  }
}

export function suggestDeviceName(): string {
  const stored = getStoredDeviceName();
  if (stored) return stored;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Windows/i.test(ua)) return "حاسوب Windows";
  if (/Mac/i.test(ua)) return "حاسوب Mac";
  if (/Android/i.test(ua)) return "جهاز Android";
  if (/iPhone|iPad/i.test(ua)) return "جهاز Apple";
  return "جهاز هذا الحاسوب";
}
