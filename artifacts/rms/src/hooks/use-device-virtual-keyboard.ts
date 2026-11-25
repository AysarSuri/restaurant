import { useMemo } from "react";
import { useGetDevicePrinters } from "@workspace/api-client-react";
import { getOrCreateDeviceKey } from "@/lib/device-id";

/** Reads per-device «virtual keyboard» from settings → Keyboard tab. */
export function useDeviceVirtualKeyboard(enabled: boolean) {
  const deviceKey = useMemo(() => getOrCreateDeviceKey(), []);
  const { data: printers } = useGetDevicePrinters({
    query: {
      queryKey: ["/api/settings/printers", "virtual-keyboard", deviceKey],
      staleTime: 5_000,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
    request: {
      headers: { "x-branch-id": "all" },
    },
  });

  return useMemo(() => {
    if (!enabled) return false;
    const mine =
      (printers ?? []).find((p) => p.deviceKey === deviceKey && p.isActive !== false) ??
      (printers ?? []).find((p) => p.deviceKey === deviceKey) ??
      null;
    return mine?.virtualKeyboard === true;
  }, [enabled, printers, deviceKey]);
}
