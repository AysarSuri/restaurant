import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Input, cn } from "@/components/ui-elements";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n";
import { parseDateParts, toIsoDate, usesYmdSlash } from "@/lib/date-format";

type YmdDateInputProps = {
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
};

type DatePartsState = { year: string; month: string; day: string };

function pad2(n: string | number) {
  return String(n).padStart(2, "0");
}

function partsFromIso(value: string): DatePartsState {
  const p = parseDateParts(value);
  if (!p) return { year: "", month: "", day: "" };
  return {
    year: String(p.year),
    month: pad2(p.month),
    day: pad2(p.day),
  };
}

function isoToDate(iso: string): Date | undefined {
  const p = parseDateParts(iso);
  if (!p) return undefined;
  return new Date(p.year, p.month - 1, p.day);
}

function digitsOnly(raw: string, max: number) {
  return raw.replace(/\D/g, "").slice(0, max);
}

function normalizeParts(parts: DatePartsState): DatePartsState {
  let { year, month, day } = parts;
  if (month) {
    const n = Number(month);
    if (n >= 1 && n <= 12) month = pad2(n);
  }
  if (day) {
    const n = Number(day);
    if (n >= 1 && n <= 31) day = pad2(n);
  }
  return { year, month, day };
}

/**
 * Three boxes: Year / Month / Day (LTR) for Arabic & Kurdish.
 * Value stays ISO yyyy-mm-dd for the API.
 */
export function YmdDateInput({
  value,
  onChange,
  className,
  id,
  disabled,
  required,
}: YmdDateInputProps) {
  const { locale } = useI18n();
  const slashYmd = usesYmdSlash(locale);
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState<DatePartsState>(() => partsFromIso(value));
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef(false);

  useEffect(() => {
    if (editingRef.current) return;
    setParts(partsFromIso(value));
  }, [value]);

  const selected = useMemo(() => isoToDate(value), [value]);

  const tryCommit = (next: DatePartsState) => {
    const normalized = normalizeParts(next);
    if (normalized.year.length !== 4 || !normalized.month || !normalized.day) return;
    const iso = toIsoDate(`${normalized.year}/${normalized.month}/${normalized.day}`);
    if (iso && iso !== value) onChange(iso);
  };

  const finishEditingSoon = () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      const stillInside =
        active === yearRef.current ||
        active === monthRef.current ||
        active === dayRef.current;
      if (stillInside) return;

      editingRef.current = false;
      setParts((prev) => {
        const normalized = normalizeParts(prev);
        const iso = toIsoDate(
          `${normalized.year}/${normalized.month}/${normalized.day}`
        );
        if (iso) {
          if (iso !== value) onChange(iso);
          return partsFromIso(iso);
        }
        return value ? partsFromIso(value) : { year: "", month: "", day: "" };
      });
    }, 0);
  };

  const updatePart = (key: keyof DatePartsState, raw: string, max: number) => {
    editingRef.current = true;
    const digits = digitsOnly(raw, max);
    const next = { ...parts, [key]: digits };
    setParts(next);

    if (key === "year" && digits.length === 4) {
      monthRef.current?.focus();
      monthRef.current?.select();
    } else if (key === "month" && digits.length === 2) {
      dayRef.current?.focus();
      dayRef.current?.select();
    }

    tryCommit(next);
  };

  const onSegmentKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    key: "year" | "month" | "day"
  ) => {
    if (e.key === "ArrowRight" || (e.key === "/" && key !== "day")) {
      e.preventDefault();
      if (key === "year") {
        monthRef.current?.focus();
        monthRef.current?.select();
      } else if (key === "month") {
        dayRef.current?.focus();
        dayRef.current?.select();
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (key === "day") {
        monthRef.current?.focus();
        monthRef.current?.select();
      } else if (key === "month") {
        yearRef.current?.focus();
        yearRef.current?.select();
      }
      return;
    }
    if (e.key === "Backspace" && e.currentTarget.value === "") {
      e.preventDefault();
      if (key === "day") monthRef.current?.focus();
      else if (key === "month") yearRef.current?.focus();
    }
  };

  if (!slashYmd) {
    return (
      <Input
        id={id}
        type="date"
        className={className}
        dir="ltr"
        lang="en"
        value={value}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const boxClass = cn(
    "h-full min-h-0 border-0 bg-transparent p-0 m-0 shadow-none rounded-md",
    "text-center font-bold tabular-nums tracking-wide text-foreground",
    "outline-none focus:bg-primary/10",
    "disabled:cursor-not-allowed disabled:opacity-50"
  );

  return (
    <div
      className={cn(
        "flex h-12 w-full items-stretch overflow-hidden rounded-xl border-2 border-border bg-background/50 transition-all duration-200",
        "focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      dir="ltr"
    >
      <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5 px-1.5 sm:gap-1 sm:px-2.5">
        {/* Year (left) */}
        <input
          ref={yearRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          required={required}
          aria-label="السنة"
          placeholder="yyyy"
          maxLength={4}
          value={parts.year}
          className={cn(boxClass, "w-[4.5ch]")}
          onFocus={(e) => {
            editingRef.current = true;
            e.target.select();
          }}
          onBlur={finishEditingSoon}
          onChange={(e) => updatePart("year", e.target.value, 4)}
          onKeyDown={(e) => onSegmentKeyDown(e, "year")}
        />
        <span
          className="select-none text-[1.1em] font-black text-muted-foreground/80"
          aria-hidden
        >
          /
        </span>
        {/* Month (middle) */}
        <input
          ref={monthRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-label="الشهر"
          placeholder="mm"
          maxLength={2}
          value={parts.month}
          className={cn(boxClass, "w-[2.8ch]")}
          onFocus={(e) => {
            editingRef.current = true;
            e.target.select();
          }}
          onBlur={finishEditingSoon}
          onChange={(e) => updatePart("month", e.target.value, 2)}
          onKeyDown={(e) => onSegmentKeyDown(e, "month")}
        />
        <span
          className="select-none text-[1.1em] font-black text-muted-foreground/80"
          aria-hidden
        >
          /
        </span>
        {/* Day (right) */}
        <input
          ref={dayRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-label="اليوم"
          placeholder="dd"
          maxLength={2}
          value={parts.day}
          className={cn(boxClass, "w-[2.8ch]")}
          onFocus={(e) => {
            editingRef.current = true;
            e.target.select();
          }}
          onBlur={finishEditingSoon}
          onChange={(e) => updatePart("day", e.target.value, 2)}
          onKeyDown={(e) => onSegmentKeyDown(e, "day")}
        />
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "inline-flex w-10 shrink-0 items-center justify-center border-s border-border/60",
              "text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-colors",
              "touch-manipulation disabled:pointer-events-none"
            )}
            aria-label="اختيار التاريخ"
            tabIndex={-1}
          >
            <CalendarIcon className="h-[18px] w-[18px]" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end" sideOffset={6} dir="ltr">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={selected}
            defaultMonth={selected}
            onSelect={(day) => {
              if (!day) return;
              const iso = toIsoDate(day);
              if (!iso) return;
              editingRef.current = false;
              setParts(partsFromIso(iso));
              onChange(iso);
              setOpen(false);
            }}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
