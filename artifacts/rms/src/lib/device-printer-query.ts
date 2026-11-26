import { useMemo } from "react";
import {
  getGetDevicePrintersQueryKey,
  useGetDevicePrinters,
  type DevicePrinter,
} from "@workspace/api-client-react";
import { getOrCreateDeviceKey } from "@/lib/device-id";

/** Shared with Settings + virtual pad hosts so toggles apply immediately. */
export const DEVICE_PRINTERS_QUERY_KEY = [
  ...getGetDevicePrintersQueryKey(),
  "all-devices",
] as const;

export const DEVICE_PRINTERS_REQUEST = {
  headers: { "x-branch-id": "all" },
} as const;

/**
 * Resolve the thermal printer for this browser device, preferring the row
 * that matches the active branch (Settings → Printers · branch + device).
 */
export function resolveDevicePrinter(
  printers: DevicePrinter[] | null | undefined,
  deviceKey: string,
  branchId?: number | "all" | null
): DevicePrinter | null {
  const list = printers ?? [];
  const forDevice = list.filter((p) => p.deviceKey === deviceKey);
  if (forDevice.length === 0) return null;

  const active = forDevice.filter((p) => p.isActive !== false);
  const pool = active.length > 0 ? active : forDevice;
  const bid = typeof branchId === "number" ? branchId : null;

  if (bid != null) {
    const byBranch = pool.find((p) => p.branchId === bid);
    if (byBranch) return byBranch;
  }

  return pool[0] ?? null;
}

/** A4 printer name from Settings → Printers for this device (A4 reports only). */
export function useDeviceA4PrinterName(branchId?: number | "all" | null) {
  const deviceKey = useMemo(() => getOrCreateDeviceKey(), []);
  const { data: printers } = useGetDevicePrinters({
    query: { queryKey: DEVICE_PRINTERS_QUERY_KEY },
    request: DEVICE_PRINTERS_REQUEST,
  });
  return useMemo(() => {
    const row = resolveDevicePrinter(printers, deviceKey, branchId ?? null);
    return row?.a4PrinterName?.trim() || null;
  }, [printers, deviceKey, branchId]);
}
