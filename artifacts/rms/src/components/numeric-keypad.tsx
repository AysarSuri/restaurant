import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Delete, Check, Eraser } from "lucide-react";

type AmountProps = {
  mode?: "amount";
  value: number;
  onConfirm: (value: number) => void;
  suffix?: string;
  allowDecimal?: boolean;
  maxDecimalPlaces?: number;
  maxValue?: number;
};

type DigitsProps = {
  mode: "digits";
  value: string;
  onConfirm: (value: string) => void;
  maxLength?: number;
  /** Show + key instead of decimal */
  allowPlus?: boolean;
};

export type NumericKeypadProps = {
  onCancel?: () => void;
  label?: string;
} & (AmountProps | DigitsProps);

const AMOUNT_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
] as const;

const DIGIT_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["+", "0", "back"],
] as const;

function formatAmountDisplay(raw: string, suffix?: string) {
  const shown = raw === "" ? "0" : raw;
  return suffix ? `${shown} ${suffix}` : shown;
}

export function NumericKeypad(props: NumericKeypadProps) {
  const { onCancel, label = "أدخل القيمة" } = props;
  const isDigits = props.mode === "digits";

  const [raw, setRaw] = useState(() => {
    if (isDigits) return props.value || "";
    return props.value > 0 ? String(props.value) : "";
  });

  useEffect(() => {
    if (isDigits) {
      setRaw(props.value || "");
    } else {
      setRaw(props.value > 0 ? String(props.value) : "");
    }
  }, [isDigits, props.value]);

  const allowDecimal = !isDigits && (props.allowDecimal ?? false);
  const maxDecimalPlaces = !isDigits ? props.maxDecimalPlaces ?? 2 : 0;
  const maxValue = !isDigits ? props.maxValue : undefined;
  const maxLength = isDigits ? props.maxLength ?? 15 : 12;
  const allowPlus = isDigits ? props.allowPlus !== false : false;
  const keys = isDigits ? DIGIT_KEYS : AMOUNT_KEYS;

  const press = (key: string) => {
    setRaw((prev) => {
      if (key === "back") return prev.slice(0, -1);
      if (key === "clear") return "";

      if (key === "+") {
        if (!allowPlus) return prev;
        if (prev.includes("+")) return prev;
        return prev === "" ? "+" : prev;
      }

      if (key === ".") {
        if (!allowDecimal) return prev;
        if (prev.includes(".")) return prev;
        return prev === "" ? "0." : `${prev}.`;
      }

      if (!isDigits && prev === "0" && key !== ".") return key;
      if (!isDigits && prev.includes(".")) {
        const [, frac = ""] = prev.split(".");
        if (frac.length >= maxDecimalPlaces) return prev;
      }

      const next = `${prev}${key}`;
      if (!isDigits && maxValue != null && Number(next) > maxValue) return prev;
      if (isDigits) {
        const digitsOnly = next.replace(/\D/g, "");
        if (digitsOnly.length > maxLength) return prev;
      } else if (next.replace(".", "").length > maxLength) {
        return prev;
      }
      return next;
    });
  };

  const amountParsed = raw === "" || raw === "." ? 0 : Number(raw);
  const amountValid = Number.isFinite(amountParsed) && amountParsed >= 0;
  const digitsValid = raw.replace(/\D/g, "").length >= 1;

  const display = isDigits
    ? raw || "—"
    : formatAmountDisplay(raw, props.mode !== "digits" ? props.suffix : undefined);

  const confirm = () => {
    if (isDigits) {
      if (!digitsValid) return;
      props.onConfirm(raw.trim());
      return;
    }
    if (!amountValid) return;
    props.onConfirm(amountParsed);
  };

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
              {display}
            </p>
          </div>
        </div>

        <div className="relative px-4 pb-4 space-y-2.5">
          {keys.map((row, ri) => (
            <div key={ri} className="grid grid-cols-3 gap-2.5">
              {row.map((key) => {
                const isDot = key === ".";
                const isPlus = key === "+";
                const isBack = key === "back";
                const disabled =
                  (isDot && !allowDecimal) || (isPlus && !allowPlus);
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
                    {isBack ? (
                      <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
                    ) : isDot ? (
                      "·"
                    ) : (
                      key
                    )}
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
              disabled={isDigits ? !digitsValid : !amountValid}
              onClick={confirm}
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
