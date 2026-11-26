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

  /** Only system admin + manager may view/switch all branches. */
  const canViewAllBranches =
    user?.role === "admin" || user?.role === "manager";

  const allowedBranchIds: number[] | "all" = canViewAllBranches
    ? "all"
    : user?.branchIds ?? [];

  const forcedBranchForUser = (u: AuthUser | null | undefined): BranchSelection => {
    if (!u) return "all";
    const canPickAny = u.role === "admin" || u.role === "manager";
    if (canPickAny) return u.selectedBranchId ?? "all";
    const ids = u.branchIds ?? [];
    if (typeof u.selectedBranchId === "number" && ids.includes(u.selectedBranchId)) {
      return u.selectedBranchId;
    }
    return ids[0] ?? "all";
  };

  const [selectedBranchId, setSelectedState] = useState<BranchSelection>(() =>
    forcedBranchForUser(user)
  );

  // Sync when user logs in/out — non-admin/manager always locked to their branch
  useEffect(() => {
    if (!user) {
      setSelectedState("all");
      return;
    }
    const next = forcedBranchForUser(user);
    setSelectedState((prev) => (prev === next ? prev : next));
    if (
      !(user.role === "admin" || user.role === "manager") &&
      typeof next === "number" &&
      user.selectedBranchId !== next
    ) {
      const name = branches?.find((b) => b.id === next)?.name ?? user.branchName;
      login(persistUserBranch(user, next, name));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on identity/assignment only
  }, [
    user?.name,
    user?.role,
    user?.selectedBranchId,
    user?.allBranches,
    user?.branchIds?.join(","),
    branches,
  ]);

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
      // Only system admin / manager may change branch
      if (!canViewAllBranches) return;
      if (id !== "all") {
        if (allowedBranchIds !== "all" && !allowedBranchIds.includes(id)) return;
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

  /** Non-admin / non-manager never switch — their menus stay on their branch. */
  const canSwitchBranch = Boolean(user) && canViewAllBranches;

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
