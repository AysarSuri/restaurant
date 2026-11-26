import { useEffect, useMemo, useRef, useState } from "react";
import { useGetDevicePrinters } from "@workspace/api-client-react";
import { getOrCreateDeviceKey } from "@/lib/device-id";
import {
  DEVICE_PRINTERS_QUERY_KEY,
  DEVICE_PRINTERS_REQUEST,
} from "@/lib/device-printer-query";
import {
  getLocalClickSound,
  hasLocalClickSoundPref,
  resolveClickSoundEnabled,
} from "@/lib/device-pad-prefs";

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new AC();
  }
  return sharedAudioCtx;
}

/** Short crisp click — no external audio asset required. */
export function playUiClickSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.045);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    /* ignore autoplay / audio errors */
  }
}

function isClickableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  const hit = el.closest(
    "button, [role='button'], input[type='button'], input[type='submit'], input[type='reset'], a[href]"
  );
  if (!hit) return false;
  if (hit instanceof HTMLButtonElement && hit.disabled) return false;
  if (hit instanceof HTMLInputElement && hit.disabled) return false;
  if (hit.getAttribute("aria-disabled") === "true") return false;
  return true;
}

/**
 * Per-device click sound from Settings → Other.
 * Local preference wins over API so the toggle never silently flips off.
 */
export function useDeviceClickSound(enabled: boolean) {
  const deviceKey = useMemo(() => getOrCreateDeviceKey(), []);
  const [localTick, setLocalTick] = useState(0);
  const { data: printers } = useGetDevicePrinters({
    query: {
      queryKey: DEVICE_PRINTERS_QUERY_KEY,
      staleTime: 5_000,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
    request: DEVICE_PRINTERS_REQUEST,
  });

  useEffect(() => {
    const sync = () => setLocalTick((n) => n + 1);
    window.addEventListener("rms-click-sound-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rms-click-sound-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const wantSound = useMemo(() => {
    if (!enabled) return false;
    if (hasLocalClickSoundPref()) return getLocalClickSound();
    const mine =
      (printers ?? []).find((p) => p.deviceKey === deviceKey && p.isActive !== false) ??
      (printers ?? []).find((p) => p.deviceKey === deviceKey) ??
      null;
    return resolveClickSoundEnabled(mine?.clickSound, deviceKey, mine?.deviceKey ?? null);
  }, [enabled, printers, deviceKey, localTick]);

  const wantSoundRef = useRef(wantSound);
  wantSoundRef.current = wantSound;

  useEffect(() => {
    if (!wantSound) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!wantSoundRef.current) return;
      if (e.button !== 0) return;
      if (!isClickableTarget(e.target)) return;
      playUiClickSound();
    };

    const unlock = () => {
      const ctx = getAudioContext();
      if (ctx?.state === "suspended") void ctx.resume();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerdown", unlock, true);
    };
  }, [wantSound]);
}
