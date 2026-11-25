import { getOrCreateDeviceKey } from "@/lib/device-id";

const KEYBOARD_KEY = "rms-virtual-keyboard";
const NUMERIC_KEY = "rms-virtual-numeric-keypad";

type PadPrefs = {
  virtualKeyboard: boolean;
  virtualNumericKeypad: boolean;
};

function readFlag(storageKey: string): boolean | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw == null) return null;
    return raw === "1" || raw === "true";
  } catch {
    return null;
  }
}

function writeFlag(storageKey: string, value: boolean) {
  try {
    localStorage.setItem(storageKey, value ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

/** Local prefs for THIS browser/device — survives API/schema lag. */
export function getLocalPadPrefs(deviceKey = getOrCreateDeviceKey()): PadPrefs {
  void deviceKey;
  return {
    virtualKeyboard: readFlag(KEYBOARD_KEY) === true,
    virtualNumericKeypad: readFlag(NUMERIC_KEY) === true,
  };
}

export function hasLocalPadPref(
  which: "virtualKeyboard" | "virtualNumericKeypad"
): boolean {
  const key = which === "virtualKeyboard" ? KEYBOARD_KEY : NUMERIC_KEY;
  return readFlag(key) != null;
}

export function setLocalPadPrefs(patch: Partial<PadPrefs>) {
  if (patch.virtualKeyboard != null) writeFlag(KEYBOARD_KEY, patch.virtualKeyboard);
  if (patch.virtualNumericKeypad != null) {
    writeFlag(NUMERIC_KEY, patch.virtualNumericKeypad);
  }
  try {
    window.dispatchEvent(new CustomEvent("rms-pad-prefs-changed"));
  } catch {
    /* ignore */
  }
}

/** Prefer local override for this device; fall back to API row. */
export function resolvePadEnabled(
  which: "virtualKeyboard" | "virtualNumericKeypad",
  apiValue: boolean | null | undefined,
  deviceKey: string,
  rowDeviceKey: string | null | undefined
): boolean {
  const isMine = rowDeviceKey != null && rowDeviceKey === deviceKey;
  if (isMine && hasLocalPadPref(which)) {
    return getLocalPadPrefs(deviceKey)[which];
  }
  return Boolean(apiValue);
}
