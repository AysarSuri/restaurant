import { useCallback, useMemo } from "react";
import { getGetShiftsQueryKey, useGetShifts } from "@workspace/api-client-react";
import { useI18n } from "@/i18n";

/** Authoritative open flag: not closed yet (per branch in DB). */
function isShiftOpen(s: { closedAt?: string | null }) {
  return s.closedAt == null || s.closedAt === "";
}

/**
 * Blocks create/edit/delete of transactional lists when the branch
 * has no open shift (صباحية / مسائية). Open state is per-branch in DB
 * (shared across all devices), not per device.
 */
export function useOpenShiftGate(branchId: number | null | undefined) {
  const { t } = useI18n();
  const resolved =
    branchId != null && Number.isFinite(Number(branchId)) && Number(branchId) > 0
      ? Number(branchId)
      : null;

  const { data: shifts, isLoading } = useGetShifts({
    query: {
      queryKey: [
        ...getGetShiftsQueryKey(),
        "open-shift-gate",
        resolved != null ? String(resolved) : "none",
      ],
      enabled: resolved != null,
      staleTime: 2_000,
      refetchInterval: resolved != null ? 4_000 : false,
      refetchOnWindowFocus: true,
    },
    request:
      resolved != null
        ? { headers: { "x-branch-id": String(resolved) } }
        : undefined,
  });

  const hasOpenShift = useCallback(
    (id: number | null | undefined) => {
      if (id == null || !Number.isFinite(Number(id)) || Number(id) <= 0) return false;
      const bid = Number(id);
      return (shifts ?? []).some((s) => s.branchId === bid && isShiftOpen(s));
    },
    [shifts]
  );

  const openShift = useMemo(() => {
    if (resolved == null) return null;
    return (
      (shifts ?? []).find((s) => s.branchId === resolved && isShiftOpen(s)) ?? null
    );
  }, [shifts, resolved]);

  const shiftsReady = resolved == null || !(isLoading && shifts == null);
  const shiftClosed = resolved != null && shiftsReady && openShift == null;
  const blockReason = t("pos.shiftClosedBlock");

  const blockReasonFor = useCallback(
    (id: number | null | undefined) => {
      if (id == null || !Number.isFinite(Number(id)) || Number(id) <= 0) {
        return "اختر فرعاً أولاً — لا يمكن حفظ قائمة بدون فرع ووردية مفتوحة.";
      }
      if (!shiftsReady) return null;
      return hasOpenShift(id) ? null : blockReason;
    },
    [blockReason, hasOpenShift, shiftsReady]
  );

  return {
    branchId: resolved,
    openShift,
    shiftClosed,
    blockReason: shiftClosed ? blockReason : null,
    blockReasonFor,
    hasOpenShift,
    isLoading,
    shiftsReady,
  };
}
