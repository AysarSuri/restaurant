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
    <div className="w-full bg-[#16181f] rounded-2xl border border-white/10 shadow-xl select-none" dir="ltr">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/8">
          <span className="text-xs text-muted-foreground">{label}</span>
          <button
            onClick={() => setShift(s => !s)}
            className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${
              shift ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-white/8"
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
                className={`h-12 px-4 rounded-xl text-base font-bold transition-colors flex-shrink-0 flex items-center justify-center min-w-[3rem]
                  ${shift ? "bg-primary text-primary-foreground" : "bg-white/8 hover:bg-white/15 border border-white/10 text-muted-foreground"}`}
              >
                ⇧
              </motion.button>
            )}

            {row.map((key) => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.82 }}
                onClick={() => press(key)}
                className="h-12 min-w-[2.4rem] flex-1 max-w-[3.6rem] rounded-xl bg-white/8 hover:bg-white/18 active:bg-white/28
                           border border-white/10 text-foreground font-bold text-base transition-colors
                           flex items-center justify-center shadow-sm"
              >
                {key}
              </motion.button>
            ))}

            {/* Backspace — row 3 */}
            {ri === 3 && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={backspace}
                className="h-12 px-4 rounded-xl bg-[#7c1d1d]/80 hover:bg-[#a02020] border border-red-900/40
                           text-red-300 transition-colors flex-shrink-0 flex items-center justify-center min-w-[3rem]"
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
            className="flex-1 h-12 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10
                       text-muted-foreground text-sm font-semibold transition-colors"
          >
            Space
          </motion.button>
          {onEnter && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onEnter}
              className="w-[30%] h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground
                         font-bold text-base transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/25 flex-shrink-0"
            >
              <CornerDownLeft className="w-5 h-5" />
              تسجيل الدخول
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
