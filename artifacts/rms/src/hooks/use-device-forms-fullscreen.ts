import { useEffect, useMemo } from "react";
import { useGetDevicePrinters } from "@workspace/api-client-react";
import { getOrCreateDeviceKey } from "@/lib/device-id";
import {
  DEVICE_PRINTERS_QUERY_KEY,
  DEVICE_PRINTERS_REQUEST,
} from "@/lib/device-printer-query";

function isFullscreenActive() {
  return Boolean(document.fullscreenElement);
}

async function enterFullscreen() {
  const el = document.documentElement;
  if (!el.requestFullscreen || isFullscreenActive()) return;
  try {
    await el.requestFullscreen();
  } catch {
    /* Browser may require a user gesture — retry on next interaction */
  }
}

async function exitFullscreen() {
  if (!document.exitFullscreen || !isFullscreenActive()) return;
  try {
    await document.exitFullscreen();
  } catch {
    /* ignore */
  }
}

/**
 * Applies per-device «forms fullscreen» from settings → Other tab.
 * When enabled for this machine, keeps the app in browser fullscreen across forms.
 */
export function useDeviceFormsFullscreen(enabled: boolean) {
  const deviceKey = useMemo(() => getOrCreateDeviceKey(), []);
  const { data: printers } = useGetDevicePrinters({
    query: {
      queryKey: DEVICE_PRINTERS_QUERY_KEY,
      staleTime: 5_000,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
    request: DEVICE_PRINTERS_REQUEST,
  });

  const wantFullscreen = useMemo(() => {
    if (!enabled) return false;
    const mine =
      (printers ?? []).find((p) => p.deviceKey === deviceKey && p.isActive !== false) ??
      (printers ?? []).find((p) => p.deviceKey === deviceKey) ??
      null;
    return mine?.formsFullscreen === true;
  }, [enabled, printers, deviceKey]);

  useEffect(() => {
    if (!wantFullscreen) {
      void exitFullscreen();
      return;
    }

    void enterFullscreen();

    const onInteract = () => {
      if (wantFullscreen && !isFullscreenActive()) {
        void enterFullscreen();
      }
    };
    const onFsChange = () => {
      /* If user exits FS while setting is on, next click re-enters */
    };

    window.addEventListener("pointerdown", onInteract, { capture: true });
    window.addEventListener("keydown", onInteract, { capture: true });
    document.addEventListener("fullscreenchange", onFsChange);

    return () => {
      window.removeEventListener("pointerdown", onInteract, { capture: true });
      window.removeEventListener("keydown", onInteract, { capture: true });
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [wantFullscreen]);
}
