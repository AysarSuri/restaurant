import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Delete, Eraser, X } from "lucide-react";
import { useI18n } from "@/i18n";

export type KeyboardLang = "ar" | "en" | "ku";

export interface MultilingualKeyboardProps {
  value: string;
  onConfirm: (value: string) => void;
  onCancel?: () => void;
  /** Live text updates while typing (on-screen or physical keyboard) */
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  defaultLang?: KeyboardLang;
  /** Hide the visible text field (e.g. when an external search field is shown) */
  showInput?: boolean;
}

const LANGS: { id: KeyboardLang; labelKey: string; short: string; dir: "rtl" | "ltr" }[] = [
  { id: "ar", labelKey: "lang.ar", short: "ع", dir: "rtl" },
  { id: "en", labelKey: "lang.en", short: "EN", dir: "ltr" },
  { id: "ku", labelKey: "lang.ku", short: "ک", dir: "rtl" },
];

/** Arabic — common PC / phone letter rows */
const AR_ROWS = [
  ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "٠"],
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "ة"],
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
  ["ئ", "ء", "ؤ", "ر", "لا", "ى", "ة", "و", "ز", "ظ", "د", "ذ"],
];

const AR_SHIFT = [
  ["!", "@", "#", "$", "%", "^", "&", "*", ")", "("],
  ["َ", "ً", "ُ", "ٌ", "لإ", "إ", "‘", "÷", "×", "؛", "<", ">"],
  ["ِ", "ٍ", "]", "[", "لأ", "أ", "ـ", "،", "/", ":", '"'],
  ["~", "ْ", "}", "{", "لآ", "آ", "'", ",", ".", "؟", "ـ", "ـ"],
];

/** English QWERTY */
const EN_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "?"],
];

const EN_SHIFT = [
  ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M", ";", ":", "/"],
];

/**
 * Badini Kurdish in Arabic script (Duhok–Zakho) — not Latin Hawar.
 * Extra letters: ە ێ ۆ پ ڤ گ چ ژ ڕ ڵ ۊ ئ
 */
const KU_ROWS = [
  ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "٠"],
  ["ق", "و", "ە", "ر", "ت", "ی", "ئ", "ح", "ۆ", "پ", "ۊ"],
  ["ا", "س", "د", "ف", "گ", "ه", "ژ", "ک", "ل", "ێ"],
  ["ز", "خ", "ج", "ڤ", "ب", "ن", "م", "چ", "ڕ", "ڵ"],
];

const KU_SHIFT = [
  ["!", "@", "#", "$", "٪", "^", "&", "*", ")", "("],
  ["`", "،", ".", "؛", "؟", "'", '"', "\\", "/", "}"],
  ["{", "]", "[", "ـ", "،", ":", "؛", "«", "»", "ـ"],
  ["~", "ْ", "}", "{", "لآ", "آ", "'", ",", ".", "؟"],
];

function rowsFor(lang: KeyboardLang, shift: boolean) {
  if (lang === "en") return shift ? EN_SHIFT : EN_ROWS;
  if (lang === "ku") return shift ? KU_SHIFT : KU_ROWS;
  return shift ? AR_SHIFT : AR_ROWS;
}

export function MultilingualKeyboard({
  value,
  onConfirm,
  onCancel,
  onChange,
  label,
  defaultLang = "ar",
  showInput = true,
}: MultilingualKeyboardProps) {
  const { t } = useI18n();
  const resolvedLabel = label ?? t("settings.enterText");
  const langs = LANGS.map((item) => ({ ...item, label: t(item.labelKey) }));
  const [text, setText] = useState(value || "");
  const [lang, setLang] = useState<KeyboardLang>(defaultLang);
  const [shift, setShift] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(value || "");
  }, [value]);

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, []);

  const langMeta = langs.find((l) => l.id === lang) ?? langs[0];
  const rows = useMemo(() => rowsFor(lang, shift), [lang, shift]);

  const commitText = (next: string) => {
    setText(next);
    onChange?.(next);
  };

  const updateText = (updater: (prev: string) => string) => {
    setText((prev) => {
      const next = updater(prev);
      onChange?.(next);
      return next;
    });
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const press = (key: string) => {
    updateText((prev) => prev + key);
    if (shift && lang === "en") setShift(false);
    focusInput();
  };

  const backspace = () => {
    updateText((prev) => prev.slice(0, -1));
    focusInput();
  };
  const clear = () => {
    commitText("");
    focusInput();
  };
  const space = () => {
    updateText((prev) => `${prev} `);
    focusInput();
  };

  return (
    <div className="select-none" data-global-text-keyboard>
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card via-card to-secondary/35 shadow-[0_28px_70px_-30px_rgba(0,0,0,0.6)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsla(var(--primary),0.12),_transparent_58%)]" />

        <div className="relative px-4 sm:px-5 pt-4 sm:pt-5 space-y-3">
          <div className="flex items-center justify-end">
            <div className="inline-flex items-center gap-2.5 sm:gap-3 rounded-2xl border border-border/60 bg-background/80 p-1.5 shadow-sm">
              {langs.map((l) => {
                const active = lang === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setLang(l.id);
                      setShift(false);
                      focusInput();
                    }}
                    className={`min-w-[3.25rem] sm:min-w-[3.75rem] h-11 sm:h-12 px-3 sm:px-4 rounded-xl text-sm sm:text-base font-extrabold transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                    }`}
                    title={l.label}
                  >
                    {l.short}
                  </button>
                );
              })}
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="h-11 sm:h-12 w-11 sm:w-12 rounded-xl border-2 border-rose-500/45 bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 hover:border-rose-500 flex items-center justify-center flex-shrink-0 transition-colors"
                  aria-label={t("common.close")}
                  title={t("common.close")}
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          {showInput ? (
            <div
              className="rounded-2xl border border-border/40 bg-background/75 backdrop-blur-md px-4 py-2.5 shadow-inner flex items-center gap-3 min-h-14"
              dir={langMeta.dir}
              onClick={focusInput}
            >
              <input
                ref={inputRef}
                type="text"
                data-no-text-keyboard="true"
                value={text}
                onChange={(e) => commitText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onCancel?.();
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onConfirm(text.trim());
                  }
                }}
                dir={langMeta.dir}
                className="min-w-0 flex-1 bg-transparent border-0 outline-none text-lg sm:text-xl font-bold text-foreground placeholder:text-muted-foreground/30 caret-primary"
                aria-label={resolvedLabel}
              />
              <p className="flex-shrink-0 text-[10px] sm:text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                {t("keyboard.hint", { lang: langMeta.label })}
              </p>
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              data-no-text-keyboard="true"
              value={text}
              onChange={(e) => commitText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onCancel?.();
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  onConfirm(text.trim());
                }
              }}
              dir={langMeta.dir}
              className="sr-only"
              aria-label={resolvedLabel}
            />
          )}
        </div>

        <div className="relative px-3 sm:px-5 py-4 sm:py-5 space-y-2.5 sm:space-y-3" dir="ltr">
          {rows.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-2 sm:gap-2.5">
              {row.map((key) => (
                <motion.button
                  key={`${lang}-${ri}-${key}`}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => press(key)}
                  className="min-w-0 flex-1 max-w-[3.85rem] sm:max-w-[4.25rem] h-12 sm:h-14 rounded-2xl border border-border/50 bg-background/85 text-base sm:text-lg font-extrabold text-foreground hover:border-primary/45 hover:bg-primary/10 shadow-[0_6px_16px_-12px_rgba(0,0,0,0.5)] transition-colors"
                >
                  {key}
                </motion.button>
              ))}
            </div>
          ))}

          <div className="flex gap-3 sm:gap-3.5 pt-1.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setShift((s) => !s)}
              className={`h-14 px-4 sm:px-5 rounded-2xl border text-sm sm:text-base font-extrabold flex-shrink-0 ${
                shift
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/50 bg-secondary/70 text-foreground hover:border-primary/40"
              }`}
            >
              ⇧ Shift
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={space}
              className="flex-1 h-14 rounded-2xl border border-border/50 bg-background/80 text-muted-foreground text-sm sm:text-base font-bold hover:text-foreground hover:border-primary/35 flex items-center justify-center"
            >
              {t("keyboard.space")}
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={backspace}
              className="h-14 px-4 sm:px-5 rounded-2xl border border-destructive/25 bg-destructive/10 text-destructive flex-shrink-0 flex items-center justify-center"
              aria-label={t("common.delete")}
            >
              <Delete className="w-6 h-6" />
            </motion.button>
          </div>

          <div className={`grid gap-3.5 pt-1.5 ${onCancel ? "grid-cols-3" : "grid-cols-2"}`}>
            {onCancel && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={onCancel}
                className="h-14 rounded-2xl border-2 border-rose-500/50 bg-rose-500/15 text-rose-600 dark:text-rose-400 text-sm sm:text-base font-extrabold hover:bg-rose-500/25 hover:border-rose-500 flex items-center justify-center"
              >
                {t("common.cancel")}
              </motion.button>
            )}
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={clear}
              className="h-14 rounded-2xl border border-border/50 bg-secondary/60 text-sm sm:text-base font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
            >
              <Eraser className="w-5 h-5" />
              {t("common.clear")}
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => onConfirm(text.trim())}
              className="h-14 rounded-2xl border border-primary/40 bg-primary text-primary-foreground text-sm sm:text-base font-extrabold shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              {t("common.confirm")}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
