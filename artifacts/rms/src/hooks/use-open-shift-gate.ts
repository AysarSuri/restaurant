import { useCallback, useMemo } from "react";
import { getGetShiftsQueryKey, useGetShifts } from "@workspace/api-client-react";
import { useI18n } from "@/i18n";

/**
 * Blocks create/edit/delete of transactional lists when the branch
 * has no open shift (صباحية / مسائية).
 */
export function useOpenShiftGate(branchId: number | null | undefined) {
  const { t } = useI18n();
  const resolved =
    branchId != null && Number.isFinite(Number(branchId)) && Number(branchId) > 0
      ? Number(branchId)
      : null;

  const { data: shifts, isLoading } = useGetShifts({
    query: {
      queryKey: [...getGetShiftsQueryKey(), "open-shift-gate"],
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  });

  const hasOpenShift = useCallback(
    (id: number | null | undefined) => {
      if (id == null || !Number.isFinite(Number(id)) || Number(id) <= 0) return false;
      const bid = Number(id);
      return (shifts ?? []).some(
        (s) => s.branchId === bid && s.isOpen === true && !s.closedAt
      );
    },
    [shifts]
  );

  const openShift = useMemo(() => {
    if (resolved == null) return null;
    return (
      (shifts ?? []).find(
        (s) => s.branchId === resolved && s.isOpen === true && !s.closedAt
      ) ?? null
    );
  }, [shifts, resolved]);

  const shiftsReady = !(isLoading && shifts == null);
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
