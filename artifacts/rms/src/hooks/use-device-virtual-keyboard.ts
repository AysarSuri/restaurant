import { useEffect, useMemo, useState } from "react";
import { useGetDevicePrinters } from "@workspace/api-client-react";
import { getOrCreateDeviceKey } from "@/lib/device-id";
import {
  DEVICE_PRINTERS_QUERY_KEY,
  DEVICE_PRINTERS_REQUEST,
} from "@/lib/device-printer-query";
import {
  getLocalPadPrefs,
  hasLocalPadPref,
  resolvePadEnabled,
} from "@/lib/device-pad-prefs";

/** Reads per-device «virtual keyboard» from settings → Keyboard tab. */
export function useDeviceVirtualKeyboard(enabled: boolean) {
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
    const bump = () => setLocalTick((n) => n + 1);
    window.addEventListener("rms-pad-prefs-changed", bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener("rms-pad-prefs-changed", bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  return useMemo(() => {
    if (!enabled) return false;
    if (hasLocalPadPref("virtualKeyboard")) {
      return getLocalPadPrefs(deviceKey).virtualKeyboard;
    }
    const mine =
      (printers ?? []).find((p) => p.deviceKey === deviceKey && p.isActive !== false) ??
      (printers ?? []).find((p) => p.deviceKey === deviceKey) ??
      null;
    return resolvePadEnabled(
      "virtualKeyboard",
      mine?.virtualKeyboard,
      deviceKey,
      mine?.deviceKey
    );
  }, [enabled, printers, deviceKey, localTick]);
}
