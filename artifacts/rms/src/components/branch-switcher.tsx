import React, { useMemo, useState } from "react";
import { Building2, Check, ChevronDown, MapPin, Store } from "lucide-react";
import { useGetBranches } from "@workspace/api-client-react";
import { useBranch, type BranchSelection } from "@/lib/branch-context";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BranchOption = {
  id: BranchSelection;
  label: string;
  subtitle?: string;
  kind: "all" | "branch";
};

export function BranchSwitcher({ compact = false }: { compact?: boolean }) {
  const {
    selectedBranchId,
    setSelectedBranchId,
    canSwitchBranch,
    canViewAllBranches,
    branchLabel,
    allowedBranchIds,
  } = useBranch();
  const { data: branches } = useGetBranches();
  const [open, setOpen] = useState(false);

  const options = useMemo<BranchOption[]>(() => {
    const next: BranchOption[] = [];
    if (canViewAllBranches) {
      next.push({
        id: "all",
        label: "كل الفروع",
        subtitle: "عرض موحّد لكل المواقع",
        kind: "all",
      });
    }
    const list = (branches ?? []).filter((b) => b.isActive !== false);
    for (const b of list) {
      if (allowedBranchIds !== "all" && !allowedBranchIds.includes(b.id)) continue;
      next.push({
        id: b.id,
        label: b.name,
        subtitle: b.address?.trim() || undefined,
        kind: "branch",
      });
    }
    return next;
  }, [allowedBranchIds, branches, canViewAllBranches]);

  const selected = options.find((o) => o.id === selectedBranchId);

  const triggerClass = cn(
    "group relative inline-flex items-center gap-2.5 overflow-hidden border text-start transition-all duration-200",
    "bg-gradient-to-l from-primary/15 via-card/80 to-card/90 backdrop-blur-md",
    "border-primary/25 shadow-[0_8px_24px_-12px_hsla(var(--primary),0.45)]",
    "hover:border-primary/45 hover:shadow-[0_12px_28px_-10px_hsla(var(--primary),0.55)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    "data-[state=open]:border-primary/55 data-[state=open]:bg-primary/10",
    compact ? "h-10 rounded-xl ps-2 pe-2.5" : "h-11 rounded-2xl ps-2.5 pe-3"
  );

  const iconWrapClass = cn(
    "relative flex flex-shrink-0 items-center justify-center rounded-xl",
    "bg-gradient-to-br from-primary to-amber-600 text-primary-foreground shadow-md shadow-primary/25",
    compact ? "h-7 w-7" : "h-8 w-8"
  );

  if (!canSwitchBranch && selectedBranchId !== "all") {
    return (
      <div className={cn(triggerClass, "pointer-events-none cursor-default opacity-95")} title={branchLabel}>
        <span className={iconWrapClass}>
          <Store className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground">الفرع الحالي</p>
          <p className={cn("truncate font-bold text-foreground", compact ? "max-w-[7.5rem] text-xs" : "max-w-[11rem] text-sm")}>
            {branchLabel}
          </p>
        </div>
      </div>
    );
  }

  if (!canSwitchBranch) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} dir="rtl">
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass} aria-label="اختيار الفرع">
          <span className={iconWrapClass}>
            <Building2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground">اختيار الفرع</p>
            <p className={cn("truncate font-bold text-foreground", compact ? "max-w-[7.5rem] text-xs" : "max-w-[11rem] text-sm")}>
              {selected?.label ?? branchLabel}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "ms-0.5 h-4 w-4 flex-shrink-0 text-primary/80 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={cn(
          "z-[80] w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border/70",
          "bg-popover/95 p-0 text-popover-foreground shadow-2xl shadow-black/20 backdrop-blur-xl"
        )}
      >
        <div className="border-b border-border/60 bg-gradient-to-l from-primary/10 via-transparent to-transparent px-3.5 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-extrabold text-foreground">
            الفروع المتاحة
          </DropdownMenuLabel>
          <p className="mt-0.5 text-[11px] text-muted-foreground">اختر الفرع لتصفية البيانات والعمليات</p>
        </div>

        <div className="max-h-[min(18rem,50vh)] space-y-1 overflow-y-auto p-2">
          {options.map((option, index) => {
            const isSelected = selectedBranchId === option.id;
            return (
              <React.Fragment key={String(option.id)}>
                {option.kind === "branch" && index > 0 && options[index - 1]?.kind === "all" ? (
                  <DropdownMenuSeparator className="my-1.5 bg-border/70" />
                ) : null}
                <DropdownMenuItem
                  onSelect={() => setSelectedBranchId(option.id)}
                  className={cn(
                    "cursor-pointer items-start gap-3 rounded-xl border border-transparent px-2.5 py-2.5",
                    "focus:bg-primary/10 data-[highlighted]:bg-primary/10",
                    isSelected && "border-primary/25 bg-primary/10"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border",
                      option.kind === "all"
                        ? "border-primary/30 bg-primary/15 text-primary"
                        : "border-border/70 bg-secondary/80 text-foreground"
                    )}
                  >
                    {option.kind === "all" ? <Store className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block truncate text-sm font-bold text-foreground">{option.label}</span>
                    {option.subtitle ? (
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0 opacity-70" />
                        <span className="truncate">{option.subtitle}</span>
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "mt-1.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-colors",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-transparent text-transparent"
                    )}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                </DropdownMenuItem>
              </React.Fragment>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
