import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Delete, Eraser } from "lucide-react";

export type KeyboardLang = "ar" | "en" | "ckb";

export interface MultilingualKeyboardProps {
  value: string;
  onConfirm: (value: string) => void;
  onCancel?: () => void;
  label?: string;
  placeholder?: string;
  defaultLang?: KeyboardLang;
}

const LANGS: { id: KeyboardLang; label: string; short: string; dir: "rtl" | "ltr" }[] = [
  { id: "ar", label: "العربية", short: "ع", dir: "rtl" },
  { id: "en", label: "English", short: "EN", dir: "ltr" },
  { id: "ckb", label: "کوردی ناوەندی", short: "کورد", dir: "rtl" },
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
 * Central Kurdish (Sorani) — Windows-like Arabic-script layout
 * Includes پ چ ڕ ژ ڤ گ ک ڵ ۆ ە ێ ئ
 */
const CKB_ROWS = [
  ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "٠"],
  ["ق", "و", "ە", "ر", "ت", "ی", "ێ", "وو", "ۆ", "پ"],
  ["ا", "س", "د", "ف", "گ", "ه", "ژ", "ک", "ل", "ڵ"],
  ["ز", "خ", "ج", "ڤ", "ب", "ن", "م", "چ", "ڕ", "ئ"],
];

const CKB_SHIFT = [
  ["!", "@", "#", "$", "%", "^", "&", "*", ")", "("],
  ["ء", "ؤ", "ة", "ث", "ذ", "ض", "ص", "ط", "ظ", "غ"],
  ["أ", "ش", "ع", "ح", "ة", "ھ", "؛", ":", '"', "،"],
  ["ـ", "؟", ".", ",", "ي", "ى", "ك", "ة", "لا", "آ"],
];

function rowsFor(lang: KeyboardLang, shift: boolean) {
  if (lang === "en") return shift ? EN_SHIFT : EN_ROWS;
  if (lang === "ckb") return shift ? CKB_SHIFT : CKB_ROWS;
  return shift ? AR_SHIFT : AR_ROWS;
}

export function MultilingualKeyboard({
  value,
  onConfirm,
  onCancel,
  label = "أدخل النص",
  placeholder = "اكتب هنا…",
  defaultLang = "ar",
}: MultilingualKeyboardProps) {
  const [text, setText] = useState(value || "");
  const [lang, setLang] = useState<KeyboardLang>(defaultLang);
  const [shift, setShift] = useState(false);

  useEffect(() => {
    setText(value || "");
  }, [value]);

  const langMeta = LANGS.find((l) => l.id === lang) ?? LANGS[0];
  const rows = useMemo(() => rowsFor(lang, shift), [lang, shift]);

  const press = (key: string) => {
    setText((prev) => prev + key);
    if (shift && lang === "en") setShift(false);
  };

  const backspace = () => setText((prev) => prev.slice(0, -1));
  const clear = () => setText("");
  const space = () => setText((prev) => `${prev} `);

  return (
    <div className="select-none">
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card via-card to-secondary/35 shadow-[0_28px_70px_-30px_rgba(0,0,0,0.6)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsla(var(--primary),0.12),_transparent_58%)]" />

        <div className="relative px-4 sm:px-5 pt-4 sm:pt-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </p>
            <div className="inline-flex rounded-full border border-border/60 bg-background/70 p-0.5">
              {LANGS.map((l) => {
                const active = lang === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setLang(l.id);
                      setShift(false);
                    }}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={l.label}
                  >
                    {l.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-2xl border border-border/40 bg-background/75 backdrop-blur-md px-4 py-3.5 shadow-inner min-h-[4.5rem]"
            dir={langMeta.dir}
          >
            <p
              className={`text-lg sm:text-xl font-bold leading-relaxed break-words ${
                text ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              {text || placeholder}
            </p>
            <p className="mt-2 text-[10px] font-semibold text-muted-foreground">
              {langMeta.label}
            </p>
          </div>
        </div>

        <div className="relative px-3 sm:px-5 py-4 sm:py-5 space-y-2 sm:space-y-2.5" dir="ltr">
          {rows.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-1.5 sm:gap-2">
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

          <div className="flex gap-2 sm:gap-2.5 pt-1.5">
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
              مسافة
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={backspace}
              className="h-14 px-4 sm:px-5 rounded-2xl border border-destructive/25 bg-destructive/10 text-destructive flex-shrink-0 flex items-center justify-center"
              aria-label="حذف"
            >
              <Delete className="w-6 h-6" />
            </motion.button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={clear}
              className="h-14 rounded-2xl border border-border/50 bg-secondary/60 text-sm sm:text-base font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
            >
              <Eraser className="w-5 h-5" />
              مسح
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => onConfirm(text.trim())}
              className="h-14 rounded-2xl border border-primary/40 bg-primary text-primary-foreground text-sm sm:text-base font-extrabold shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
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
