import { getGetDevicePrintersQueryKey } from "@workspace/api-client-react";

/** Shared with Settings + virtual pad hosts so toggles apply immediately. */
export const DEVICE_PRINTERS_QUERY_KEY = [
  ...getGetDevicePrintersQueryKey(),
  "all-devices",
] as const;

export const DEVICE_PRINTERS_REQUEST = {
  headers: { "x-branch-id": "all" },
} as const;
