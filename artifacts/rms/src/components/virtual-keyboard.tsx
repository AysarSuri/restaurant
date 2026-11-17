import React, { useState } from "react";
import { motion } from "framer-motion";
import { Delete, CornerDownLeft } from "lucide-react";
import { useI18n } from "@/i18n";

interface VirtualKeyboardProps {
  value: string;
  onChange: (val: string) => void;
  onEnter?: () => void;
  label?: string;
}

const ROWS_LOWER = [
  ["1","2","3","4","5","6","7","8","9","0","-","="],
  ["q","w","e","r","t","y","u","i","o","p","[","]"],
  ["a","s","d","f","g","h","j","k","l",";","'"],
  ["z","x","c","v","b","n","m",",",".","/"],
];

const ROWS_UPPER = [
  ["!","@","#","$","%","^","&","*","(",")","_","+"],
  ["Q","W","E","R","T","Y","U","I","O","P","{","}"],
  ["A","S","D","F","G","H","J","K","L",":",'"'],
  ["Z","X","C","V","B","N","M","<",">","?"],
];

export default function VirtualKeyboard({ value, onChange, onEnter, label }: VirtualKeyboardProps) {
  const { t } = useI18n();
  const [shift, setShift] = useState(false);
  const rows = shift ? ROWS_UPPER : ROWS_LOWER;

  const press = (key: string) => { onChange(value + key); if (shift) setShift(false); };
  const backspace = () => onChange(value.slice(0, -1));
  const space = () => onChange(value + " ");

  return (
    <div className="w-full bg-card rounded-2xl border border-border shadow-xl select-none" dir="ltr">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-xs text-muted-foreground">{label}</span>
          <button
            onClick={() => setShift(s => !s)}
            className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${
              shift ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-muted"
            }`}
          >
            Shift ⇧
          </button>
        </div>
      )}

      <div className="px-3 py-3 space-y-2">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-2">
            {/* Shift — row 3 */}
            {ri === 3 && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShift(s => !s)}
                className={`rounded-xl text-xl font-bold transition-colors flex-shrink-0 flex items-center justify-center
                  ${shift ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70 border border-border text-muted-foreground"}`}
                style={{ height: "65px", width: "110px" }}
              >
                ⇧
              </motion.button>
            )}

            {row.map((key) => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.82 }}
                onClick={() => press(key)}
                className="rounded-xl bg-muted hover:bg-muted/70 active:bg-accent
                           border border-border text-foreground font-bold text-xl transition-colors
                           flex items-center justify-center shadow-sm flex-shrink-0"
                style={{ height: "65px", width: "80px" }}
              >
                {key}
              </motion.button>
            ))}

            {/* Backspace — row 3 */}
            {ri === 3 && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={backspace}
                className="rounded-xl bg-destructive/20 hover:bg-destructive/40 border border-destructive/30
                           text-destructive transition-colors flex-shrink-0 flex items-center justify-center"
                style={{ height: "65px", width: "110px" }}
              >
                <Delete className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        ))}

        {/* Space + Enter */}
        <div className="flex gap-2 pt-1">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={space}
            className="flex-1 rounded-xl bg-muted hover:bg-muted/70 border border-border
                       text-muted-foreground text-lg font-semibold transition-colors"
            style={{ height: "65px" }}
          >
            Space
          </motion.button>
          {onEnter && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onEnter}
              className="w-[30%] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground
                         font-bold text-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/25 flex-shrink-0"
              style={{ height: "65px" }}
            >
              <CornerDownLeft className="w-5 h-5" />
              {t("auth.login")}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
