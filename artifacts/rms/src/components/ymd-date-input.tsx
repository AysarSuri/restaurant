import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/components/ui-elements";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseDateParts, toIsoDate } from "@/lib/date-format";

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

const PICKER_START = new Date(2000, 0);
const PICKER_END = new Date(2100, 11);

/**
 * Three boxes Year / Month / Day (LTR) + modern calendar picker.
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
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState<DatePartsState>(() => partsFromIso(value));
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => isoToDate(value) ?? new Date()
  );
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef(false);

  useEffect(() => {
    if (editingRef.current) return;
    setParts(partsFromIso(value));
  }, [value]);

  const selected = useMemo(() => isoToDate(value), [value]);

  useEffect(() => {
    if (!open) return;
    setCalendarMonth(selected ?? new Date());
  }, [open, selected]);

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
              "inline-flex w-11 shrink-0 items-center justify-center border-s border-border/60",
              "bg-gradient-to-b from-secondary/40 to-secondary/10",
              "text-primary hover:bg-primary/10 hover:text-primary transition-colors",
              "touch-manipulation disabled:pointer-events-none"
            )}
            aria-label="اختيار التاريخ من التقويم"
            tabIndex={-1}
          >
            <CalendarIcon className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "w-auto border-0 bg-transparent p-0 shadow-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          )}
          align="end"
          sideOffset={8}
          dir="ltr"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="overflow-hidden rounded-2xl border border-black/5 bg-[#f3f4f6] shadow-2xl shadow-black/15 ring-1 ring-black/5 dark:border-white/10 dark:bg-zinc-900 dark:shadow-black/50">
            <Calendar
              mode="single"
              variant="picker"
              captionLayout="dropdown"
              startMonth={PICKER_START}
              endMonth={PICKER_END}
              selected={selected}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onSelect={(day) => {
                if (!day) return;
                const iso = toIsoDate(day);
                if (!iso) return;
                editingRef.current = false;
                setParts(partsFromIso(iso));
                setCalendarMonth(day);
                onChange(iso);
                setOpen(false);
              }}
              disabled={disabled}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
