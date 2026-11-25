import { useMemo } from "react";
import { useGetDevicePrinters } from "@workspace/api-client-react";
import { getOrCreateDeviceKey } from "@/lib/device-id";

/** Reads per-device «virtual numeric keypad» from settings → Numbers tab. */
export function useDeviceVirtualNumericKeypad(enabled: boolean) {
  const deviceKey = useMemo(() => getOrCreateDeviceKey(), []);
  const { data: printers } = useGetDevicePrinters({
    query: {
      queryKey: ["/api/settings/printers", "virtual-numeric-keypad", deviceKey],
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
    return mine?.virtualNumericKeypad === true;
  }, [enabled, printers, deviceKey]);
}
