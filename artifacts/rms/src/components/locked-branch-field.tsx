import React from "react";
import { Lock, Store } from "lucide-react";
import { useScopedBranch } from "@/hooks/use-scoped-branch";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** Read-only branch chip for non-admin/manager users. */
export function LockedBranchField({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  const { t } = useI18n();
  const { branchLabel, forcedBranchId, locked } = useScopedBranch();
  if (!locked || forcedBranchId == null) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
      ) : (
        <p className="text-xs font-bold text-muted-foreground">{t("branch.current")}</p>
      )}
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-2xl border border-primary/25 bg-primary/5 px-3.5 py-3",
          "pointer-events-none select-none"
        )}
        title={t("branch.lockedToUser")}
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-600 text-primary-foreground shadow-md shadow-primary/20">
          <Store className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-foreground">{branchLabel}</p>
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mt-0.5">
            <Lock className="h-3 w-3" />
            {t("branch.lockedToUser")}
          </p>
        </div>
      </div>
    </div>
  );
}
