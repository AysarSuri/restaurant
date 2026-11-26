import {
  getGetDevicePrintersQueryKey,
  type DevicePrinter,
} from "@workspace/api-client-react";

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
