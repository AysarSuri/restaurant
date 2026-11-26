import { useMemo } from "react";
import { useBranch, type BranchSelection } from "@/lib/branch-context";

/**
 * Branch scoping for forms/filters:
 * - admin / manager (مدير النظام / مدير): can pick freely
 * - everyone else: branch field locked to their assigned branch
 */
export function useScopedBranch() {
  const {
    selectedBranchId,
    canViewAllBranches,
    canSwitchBranch,
    branchLabel,
    allowedBranchIds,
  } = useBranch();

  const locked = !canViewAllBranches;
  const canPickBranch = canSwitchBranch && !locked;

  const forcedBranchId = useMemo(() => {
    if (!locked) return null;
    if (typeof selectedBranchId === "number") return selectedBranchId;
    if (Array.isArray(allowedBranchIds) && allowedBranchIds.length > 0) {
      return allowedBranchIds[0];
    }
    return null;
  }, [locked, selectedBranchId, allowedBranchIds]);

  const resolveWriteBranchId = (picked: number | "" | null | undefined): number | null => {
    if (forcedBranchId != null) return forcedBranchId;
    if (picked === "" || picked == null) return null;
    return Number(picked);
  };

  const filterOptions = <T extends { id: number }>(list: T[] | undefined | null): T[] => {
    const all = list ?? [];
    if (!locked || forcedBranchId == null) return all;
    return all.filter((b) => b.id === forcedBranchId);
  };

  return {
    selectedBranchId: selectedBranchId as BranchSelection,
    canViewAllBranches,
    canPickBranch,
    locked,
    forcedBranchId,
    branchLabel,
    resolveWriteBranchId,
    filterOptions,
  };
}
