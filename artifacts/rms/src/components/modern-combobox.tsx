import React, { useMemo, useState } from "react";
import { Check, ChevronDown, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ComboboxOption = {
  value: string;
  label: string;
  subtitle?: string;
  icon?: LucideIcon;
};

type ModernComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  label?: string;
  hint?: string;
  icon?: LucideIcon;
  searchable?: boolean;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  customPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  dir?: "rtl" | "ltr";
  /** Compact trigger for denser filter rows */
  size?: "md" | "sm";
  labelClassName?: string;
  valueClassName?: string;
};

export function ModernCombobox({
  value,
  onChange,
  options,
  placeholder,
  label,
  hint,
  icon: TriggerIcon,
  searchable = true,
  searchPlaceholder,
  allowCustom = false,
  customPlaceholder,
  emptyText,
  disabled = false,
  className,
  dir: dirProp,
  size = "md",
  labelClassName,
  valueClassName,
}: ModernComboboxProps) {
  const { t, dir: localeDir } = useI18n();
  const dir = dirProp ?? localeDir;
  const compact = size === "sm";
  const resolvedPlaceholder = placeholder ?? t("common.choose");
  const resolvedSearch = searchPlaceholder ?? t("common.search");
  const resolvedCustom = customPlaceholder ?? t("settings.customValue");
  const resolvedEmpty = emptyText ?? t("common.noResults");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customDraft, setCustomDraft] = useState("");

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label || (value ? value : resolvedPlaceholder);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.subtitle?.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  const commitCustom = () => {
    const next = customDraft.trim();
    if (!next) return;
    onChange(next);
    setCustomDraft("");
    setQuery("");
    setOpen(false);
  };

  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <div className={cn("flex items-end justify-between gap-2", compact ? "mb-1" : "mb-1.5")}>
          <label
            className={cn(
              "block font-semibold text-foreground",
              compact ? "text-[11px] text-muted-foreground" : "text-sm",
              labelClassName
            )}
          >
            {label}
          </label>
          {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
        </div>
      ) : null}

      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (disabled) return;
          setOpen(next);
          if (!next) {
            setQuery("");
            setCustomDraft("");
          }
        }}
        dir={dir}
      >
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "group relative flex w-full items-center overflow-hidden border text-start transition-all duration-200",
              compact ? "h-10 gap-2 rounded-xl ps-2 pe-2.5" : "h-12 gap-2.5 rounded-xl ps-2.5 pe-3",
              "bg-gradient-to-l from-primary/12 via-card/85 to-card/95 backdrop-blur-md",
              "border-primary/25 shadow-[0_8px_22px_-14px_hsla(var(--primary),0.5)]",
              "hover:border-primary/45 hover:shadow-[0_12px_26px_-12px_hsla(var(--primary),0.55)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
              "data-[state=open]:border-primary/55 data-[state=open]:bg-primary/10",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            {TriggerIcon ? (
              <span
                className={cn(
                  "flex flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-600 text-primary-foreground shadow-md shadow-primary/25",
                  compact ? "h-7 w-7" : "h-8 w-8"
                )}
              >
                <TriggerIcon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
              </span>
            ) : null}
            <span className="min-w-0 flex-1 leading-tight">
              <span
                className={cn(
                  "block truncate font-bold",
                  compact ? "text-xs" : "text-sm",
                  selected || value ? "text-foreground" : "text-muted-foreground",
                  valueClassName
                )}
                dir={selected || !value ? dir : "ltr"}
              >
                {displayLabel}
              </span>
              {selected?.subtitle && !compact ? (
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {selected.subtitle}
                </span>
              ) : null}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 flex-shrink-0 text-primary/80 transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className={cn(
            "z-[90] min-w-[18rem] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border/70",
            "bg-popover/95 p-0 text-popover-foreground shadow-2xl shadow-black/20 backdrop-blur-xl"
          )}
        >
          <div className="border-b border-border/60 bg-gradient-to-l from-primary/10 via-transparent to-transparent px-3.5 py-3">
            <DropdownMenuLabel className="p-0 text-sm font-extrabold text-foreground">
              {label || t("common.chooseOption")}
            </DropdownMenuLabel>
            {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
          </div>

          {searchable ? (
            <div className="border-b border-border/50 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute end-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={resolvedSearch}
                  className="h-10 w-full rounded-xl border border-border/70 bg-background/70 pe-9 ps-3 text-sm outline-none focus:border-primary/50"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          ) : null}

          <div className="max-h-[min(16rem,45vh)] space-y-1 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">{resolvedEmpty}</p>
            ) : (
              filtered.map((option) => {
                const active = value === option.value;
                const Icon = option.icon;
                return (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => {
                      onChange(option.value);
                      setQuery("");
                    }}
                    className={cn(
                      "cursor-pointer items-start gap-3 rounded-xl border border-transparent px-2.5 py-2.5",
                      "focus:bg-primary/10 data-[highlighted]:bg-primary/10",
                      active && "border-primary/25 bg-primary/10"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border",
                        active
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/70 bg-secondary/80 text-foreground"
                      )}
                    >
                      {Icon ? <Icon className="h-4 w-4" /> : <Check className={cn("h-4 w-4", !active && "opacity-0")} />}
                    </span>
                    <span className="min-w-0 flex-1 text-start">
                      <span className="block truncate text-sm font-bold" dir={dir === "ltr" ? "ltr" : undefined}>
                        {option.label}
                      </span>
                      {option.subtitle ? (
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {option.subtitle}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "mt-1.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
                        active ? "bg-primary text-primary-foreground" : "text-transparent"
                      )}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  </DropdownMenuItem>
                );
              })
            )}
          </div>

          {allowCustom ? (
            <>
              <DropdownMenuSeparator className="my-0 bg-border/70" />
              <div className="space-y-2 p-2">
                <p className="px-1 text-[11px] font-semibold text-muted-foreground">{resolvedCustom}</p>
                <div className="flex gap-2">
                  <input
                    value={customDraft}
                    onChange={(e) => setCustomDraft(e.target.value)}
                    placeholder={t("keyboard.typeHere")}
                    dir="ltr"
                    className="h-10 flex-1 rounded-xl border border-border/70 bg-background/70 px-3 text-sm outline-none focus:border-primary/50"
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitCustom();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={commitCustom}
                    className="h-10 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground hover:brightness-110"
                  >
                    {t("common.apply")}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
