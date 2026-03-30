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

  const press = (key: string) => {
    onChange(value + key);
    if (shift) setShift(false);
  };

  const backspace = () => onChange(value.slice(0, -1));
  const space = () => onChange(value + " ");

  return (
    <div className="w-full bg-[#1a1c22] rounded-2xl border border-white/10 overflow-hidden shadow-2xl select-none">
      {/* Title bar */}
      {label && (
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/10">
          <span className="text-xs text-muted-foreground">{label}</span>
          <button
            onClick={() => setShift((s) => !s)}
            className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
              shift ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Shift
          </button>
        </div>
      )}

      <div className="p-3 space-y-2">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1.5">
            {/* Shift key on row 3 (index 3) */}
            {ri === 3 && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setShift((s) => !s)}
                className={`h-11 px-4 rounded-xl text-sm font-bold transition-colors flex items-center gap-1
                  ${shift
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                    : "bg-white/8 text-muted-foreground hover:bg-white/15 hover:text-foreground border border-white/10"
                  }`}
              >
                ⇧
              </motion.button>
            )}

            {row.map((key) => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.88 }}
                onClick={() => press(key)}
                className="h-11 min-w-[2.5rem] px-3 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10
                           text-foreground font-semibold text-sm transition-colors flex items-center justify-center
                           relative group"
              >
                <span>{key}</span>
              </motion.button>
            ))}

            {/* Backspace on row 3 */}
            {ri === 3 && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={backspace}
                className="h-11 px-4 rounded-xl bg-[#8b1d1d]/80 hover:bg-[#b22222] border border-red-900/50
                           text-red-300 font-bold transition-colors flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        ))}

        {/* Bottom row: Space + Enter */}
        <div className="flex gap-1.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={space}
            className="flex-1 h-11 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10
                       text-muted-foreground text-sm font-semibold transition-colors"
          >
            مسافة / Space
          </motion.button>
          {onEnter && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onEnter}
              className="h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground
                         font-bold text-sm transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <CornerDownLeft className="w-4 h-4" />
              دخول
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
