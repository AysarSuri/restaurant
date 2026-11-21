import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setBranchIdGetter, useGetBranches } from "@workspace/api-client-react";
import { useAuth, type AuthUser } from "@/App";
import { useI18n } from "@/i18n";

export type BranchSelection = number | "all";

interface BranchContextType {
  selectedBranchId: BranchSelection;
  setSelectedBranchId: (id: BranchSelection) => void;
  canViewAllBranches: boolean;
  canSwitchBranch: boolean;
  branchLabel: string;
  allowedBranchIds: number[] | "all";
}

const BranchContext = createContext<BranchContextType>({
  selectedBranchId: "all",
  setSelectedBranchId: () => {},
  canViewAllBranches: false,
  canSwitchBranch: false,
  branchLabel: "",
  allowedBranchIds: "all",
});

export function useBranch() {
  return useContext(BranchContext);
}

function persistUserBranch(user: AuthUser, selectedBranchId: BranchSelection, branchName?: string) {
  const next: AuthUser = {
    ...user,
    selectedBranchId,
    branchName: branchName ?? user.branchName,
  };
  localStorage.setItem("rms-user", JSON.stringify(next));
  return next;
}

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { user, login } = useAuth();
  const queryClient = useQueryClient();
  const { data: branches } = useGetBranches({
    query: { enabled: Boolean(user), queryKey: ["branches", "scoped"] },
  });

  const canViewAllBranches =
    user?.role === "admin" ||
    user?.role === "manager" ||
    Boolean(user?.allBranches);

  const allowedBranchIds: number[] | "all" = canViewAllBranches
    ? "all"
    : user?.branchIds ?? [];

  const [selectedBranchId, setSelectedState] = useState<BranchSelection>(() => {
    if (!user) return "all";
    return user.selectedBranchId ?? (canViewAllBranches ? "all" : user.branchIds?.[0] ?? "all");
  });

  // Sync when user logs in/out
  useEffect(() => {
    if (!user) {
      setSelectedState("all");
      return;
    }
    const next =
      user.selectedBranchId ??
      (user.role === "admin" || user.role === "manager" || user.allBranches
        ? "all"
        : user.branchIds?.[0] ?? "all");
    setSelectedState(next);
  }, [user?.name, user?.role, user?.selectedBranchId, user?.allBranches, user?.branchIds?.join(",")]);

  useEffect(() => {
    setBranchIdGetter(() => {
      if (!user) return null;
      return selectedBranchId;
    });
    return () => setBranchIdGetter(null);
  }, [user, selectedBranchId]);

  const setSelectedBranchId = useCallback(
    (id: BranchSelection) => {
      if (!user) return;
      if (id !== "all") {
        if (allowedBranchIds !== "all" && !allowedBranchIds.includes(id)) return;
      } else if (!canViewAllBranches) {
        return;
      }
      setSelectedState(id);
      const name =
        id === "all"
          ? t("auth.allBranches")
          : branches?.find((b) => b.id === id)?.name;
      login(persistUserBranch(user, id, name));
      queryClient.invalidateQueries();
    },
    [user, allowedBranchIds, canViewAllBranches, branches, login, queryClient, t]
  );

  const canSwitchBranch =
    Boolean(user) &&
    (canViewAllBranches ||
      (Array.isArray(allowedBranchIds) && allowedBranchIds.length > 1));

  const branchLabel = useMemo(() => {
    if (selectedBranchId === "all") return t("auth.allBranches");
    return (
      branches?.find((b) => b.id === selectedBranchId)?.name ??
      user?.branchName ??
      t("branch.fallback", { n: selectedBranchId })
    );
  }, [selectedBranchId, branches, user?.branchName, t]);

  const value = useMemo(
    () => ({
      selectedBranchId,
      setSelectedBranchId,
      canViewAllBranches,
      canSwitchBranch,
      branchLabel,
      allowedBranchIds,
    }),
    [
      selectedBranchId,
      setSelectedBranchId,
      canViewAllBranches,
      canSwitchBranch,
      branchLabel,
      allowedBranchIds,
    ]
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}
