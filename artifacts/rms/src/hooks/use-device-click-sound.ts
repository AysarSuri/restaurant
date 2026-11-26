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

function beep(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(1100, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.07);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Short crisp click — resumes AudioContext before playing (required by browsers). */
export function playUiClickSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx
        .resume()
        .then(() => {
          try {
            beep(ctx);
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          /* ignore */
        });
      return;
    }
    beep(ctx);
  } catch {
    /* ignore autoplay / audio errors */
  }
}

function isClickableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  const hit = el.closest(
    "button, [role='button'], input[type='button'], input[type='submit'], input[type='reset'], a[href], summary"
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

    const onActivate = (e: Event) => {
      if (!wantSoundRef.current) return;
      if (e instanceof PointerEvent && e.button !== 0) return;
      if (!isClickableTarget(e.target)) return;
      playUiClickSound();
    };

    // pointerdown only — avoids double-beep with click
    window.addEventListener("pointerdown", onActivate, true);

    return () => {
      window.removeEventListener("pointerdown", onActivate, true);
    };
  }, [wantSound]);
}
