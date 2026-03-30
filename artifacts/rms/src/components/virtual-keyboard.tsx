import React, { useState } from "react";
import { motion } from "framer-motion";
import { Delete, CornerDownLeft } from "lucide-react";

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
  const [shift, setShift] = useState(false);
  const rows = shift ? ROWS_UPPER : ROWS_LOWER;

  const press = (key: string) => { onChange(value + key); if (shift) setShift(false); };
  const backspace = () => onChange(value.slice(0, -1));
  const space = () => onChange(value + " ");

  return (
    <div className="w-full bg-[#16181f] rounded-2xl border border-white/10 overflow-hidden shadow-xl select-none" dir="ltr">
      {/* Title bar */}
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/8">
          <span className="text-[11px] text-muted-foreground">{label}</span>
          <button
            onClick={() => setShift((s) => !s)}
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg transition-colors ${
              shift ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-white/8"
            }`}
          >
            Shift ⇧
          </button>
        </div>
      )}

      <div className="px-2.5 py-2 space-y-1.5">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1">
            {/* Shift key — only on row 3 */}
            {ri === 3 && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShift((s) => !s)}
                className={`h-9 px-3 rounded-lg text-sm font-bold transition-colors flex-shrink-0
                  ${shift ? "bg-primary text-primary-foreground" : "bg-white/8 hover:bg-white/15 border border-white/10 text-muted-foreground"}`}
              >
                ⇧
              </motion.button>
            )}

            {row.map((key) => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.85 }}
                onClick={() => press(key)}
                className="h-9 min-w-[2.1rem] flex-1 max-w-[3rem] rounded-lg bg-white/8 hover:bg-white/18 active:bg-white/25
                           border border-white/10 text-foreground font-semibold text-sm transition-colors
                           flex items-center justify-center"
              >
                {key}
              </motion.button>
            ))}

            {/* Backspace — only on row 3 */}
            {ri === 3 && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={backspace}
                className="h-9 px-3 rounded-lg bg-[#7c1d1d]/80 hover:bg-[#a02020] border border-red-900/40
                           text-red-300 transition-colors flex-shrink-0 flex items-center justify-center"
              >
                <Delete className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        ))}

        {/* Bottom: Space + Enter */}
        <div className="flex gap-1.5 pt-0.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={space}
            className="flex-1 h-9 rounded-lg bg-white/8 hover:bg-white/15 border border-white/10
                       text-muted-foreground text-xs font-semibold transition-colors"
          >
            مسافة / Space
          </motion.button>
          {onEnter && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onEnter}
              className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground
                         font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-primary/20 flex-shrink-0"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
              دخول
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
