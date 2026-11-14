import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Delete, Check, Eraser } from "lucide-react";

export interface NumericKeypadProps {
  /** Current committed value shown when opening */
  value: number;
  onConfirm: (value: number) => void;
  onCancel?: () => void;
  label?: string;
  /** Currency / unit suffix shown in the display */
  suffix?: string;
  /** Allow decimal point (based on currency settings) */
  allowDecimal?: boolean;
  maxDecimalPlaces?: number;
  maxValue?: number;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
] as const;

function formatDisplay(raw: string, suffix?: string) {
  const shown = raw === "" ? "0" : raw;
  return suffix ? `${shown} ${suffix}` : shown;
}

export function NumericKeypad({
  value,
  onConfirm,
  onCancel,
  label = "أدخل القيمة",
  suffix,
  allowDecimal = false,
  maxDecimalPlaces = 2,
  maxValue,
}: NumericKeypadProps) {
  const [raw, setRaw] = useState(() =>
    value > 0 ? String(value) : ""
  );

  useEffect(() => {
    setRaw(value > 0 ? String(value) : "");
  }, [value]);

  const press = (key: string) => {
    setRaw((prev) => {
      if (key === "back") {
        return prev.slice(0, -1);
      }
      if (key === "clear") {
        return "";
      }
      if (key === ".") {
        if (!allowDecimal) return prev;
        if (prev.includes(".")) return prev;
        return prev === "" ? "0." : `${prev}.`;
      }
      // digit
      if (prev === "0" && key !== ".") return key;
      if (prev.includes(".")) {
        const [, frac = ""] = prev.split(".");
        if (frac.length >= maxDecimalPlaces) return prev;
      }
      const next = `${prev}${key}`;
      if (maxValue != null && Number(next) > maxValue) return prev;
      if (next.replace(".", "").length > 12) return prev;
      return next;
    });
  };

  const parsed = raw === "" || raw === "." ? 0 : Number(raw);
  const valid = Number.isFinite(parsed) && parsed >= 0;

  return (
    <div className="select-none" dir="ltr">
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card via-card to-secondary/40 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsla(var(--primary),0.14),_transparent_55%)]" />

        <div className="relative px-5 pt-5 pb-3 space-y-3">
          {label && (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground text-center">
              {label}
            </p>
          )}
          <div className="rounded-2xl border border-border/40 bg-background/70 backdrop-blur-md px-4 py-4 shadow-inner">
            <p className="font-display text-3xl sm:text-4xl font-extrabold text-center tabular-nums tracking-tight text-foreground truncate">
              {formatDisplay(raw, suffix)}
            </p>
          </div>
        </div>

        <div className="relative px-4 pb-4 space-y-2.5">
          {KEYS.map((row, ri) => (
            <div key={ri} className="grid grid-cols-3 gap-2.5">
              {row.map((key) => {
                const isDot = key === ".";
                const isBack = key === "back";
                const disabled = isDot && !allowDecimal;
                return (
                  <motion.button
                    key={key}
                    type="button"
                    whileTap={disabled ? undefined : { scale: 0.92 }}
                    disabled={disabled}
                    onClick={() => press(key)}
                    className={`h-14 sm:h-16 rounded-2xl text-xl sm:text-2xl font-extrabold transition-colors flex items-center justify-center border ${
                      isBack
                        ? "bg-destructive/10 border-destructive/25 text-destructive hover:bg-destructive/20"
                        : disabled
                          ? "bg-muted/30 border-border/30 text-muted-foreground/35 cursor-not-allowed"
                          : "bg-background/80 border-border/50 text-foreground hover:border-primary/40 hover:bg-primary/10 shadow-[0_8px_20px_-14px_rgba(0,0,0,0.45)]"
                    }`}
                    aria-label={isBack ? "حذف" : key}
                  >
                    {isBack ? <Delete className="w-5 h-5 sm:w-6 sm:h-6" /> : isDot ? "·" : key}
                  </motion.button>
                );
              })}
            </div>
          ))}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => press("clear")}
              className="h-12 sm:h-14 rounded-2xl border border-border/50 bg-secondary/60 text-sm sm:text-base font-bold text-muted-foreground hover:text-foreground hover:border-border flex items-center justify-center gap-2"
            >
              <Eraser className="w-4 h-4" />
              مسح
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              disabled={!valid}
              onClick={() => valid && onConfirm(parsed)}
              className="h-12 sm:h-14 rounded-2xl border border-primary/40 bg-primary text-primary-foreground text-sm sm:text-base font-extrabold shadow-lg shadow-primary/25 hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              تأكيد
            </motion.button>
          </div>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              إلغاء
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
