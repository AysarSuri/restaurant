import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui-elements";
import VirtualKeyboard from "@/components/virtual-keyboard";
import { useAuth } from "@/App";
import { useLocation } from "wouter";

const ROLES = [
  { value: "admin",   label: "مدير النظام", labelEn: "Admin",   icon: "🛡️", activeClass: "bg-gradient-to-br from-purple-600 to-purple-800 border-purple-400 ring-2 ring-purple-500/30", inactiveClass: "bg-card/40 border-border hover:border-purple-400/60", redirect: "/" },
  { value: "manager", label: "مدير",         labelEn: "Manager", icon: "👔", activeClass: "bg-gradient-to-br from-blue-600 to-blue-800 border-blue-400 ring-2 ring-blue-500/30",     inactiveClass: "bg-card/40 border-border hover:border-blue-400/60",   redirect: "/" },
  { value: "cashier", label: "كاشير",        labelEn: "Cashier", icon: "💰", activeClass: "bg-gradient-to-br from-amber-600 to-amber-800 border-amber-400 ring-2 ring-amber-500/30", inactiveClass: "bg-card/40 border-border hover:border-amber-400/60", redirect: "/cashier" },
  { value: "kitchen", label: "مطبخ",         labelEn: "Kitchen", icon: "👨‍🍳", activeClass: "bg-gradient-to-br from-red-600 to-red-800 border-red-400 ring-2 ring-red-500/30",       inactiveClass: "bg-card/40 border-border hover:border-red-400/60",   redirect: "/kds" },
  { value: "table",   label: "طاولة / نادل", labelEn: "Waiter",  icon: "🍽️", activeClass: "bg-gradient-to-br from-green-600 to-green-800 border-green-400 ring-2 ring-green-500/30", inactiveClass: "bg-card/40 border-border hover:border-green-400/60", redirect: "/table-order" },
] as const;

export type RoleType = (typeof ROLES)[number]["value"];

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (!selectedRole) { setError("اختر الدور أولاً"); return; }
    if (!name.trim())  { setError("أدخل اسمك"); return; }
    const role = ROLES.find((r) => r.value === selectedRole)!;
    login({ name: name.trim(), role: selectedRole });
    navigate(role.redirect);
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[130px] pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-3 relative z-10">

        {/* ── Logo row (compact) ── */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
            <ChefHat className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">المطعم الذكي</h1>
            <p className="text-xs text-primary font-display tracking-widest uppercase">RMS 2026</p>
          </div>
        </div>

        {/* ── Role cards ── */}
        <div className="w-full max-w-xl grid grid-cols-5 gap-2">
          {ROLES.map((role) => {
            const isActive = selectedRole === role.value;
            return (
              <motion.button
                key={role.value}
                whileTap={{ scale: 0.94 }}
                onClick={() => { setSelectedRole(role.value); setError(""); }}
                className={`flex flex-col items-center py-3 px-1 rounded-xl border-2 transition-all duration-150 ${
                  isActive ? role.activeClass : role.inactiveClass
                }`}
              >
                <span className="text-2xl mb-1">{role.icon}</span>
                <span className="font-bold text-xs leading-tight text-center">{role.label}</span>
                <span className={`text-[9px] font-display tracking-wider ${isActive ? "text-white/70" : "text-muted-foreground"}`}>
                  {role.labelEn}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* ── Name display field ── */}
        <div className="w-full max-w-xl space-y-2">
          <div className={`w-full h-11 px-4 rounded-xl border-2 flex items-center transition-all
            ${name ? "border-primary bg-primary/5" : "border-border bg-secondary/40"}`}
          >
            <span className={`flex-1 text-sm font-semibold ${name ? "text-foreground" : "text-muted-foreground"}`}>
              {name || "انقر على الحروف في لوحة المفاتيح لإدخال اسمك..."}
            </span>
            {name && (
              <button onClick={() => setName("")} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1">
                ✕
              </button>
            )}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-destructive text-xs bg-destructive/10 px-3 py-1.5 rounded-lg"
              >
                ⚠️ {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ── Virtual Keyboard (always visible) ── */}
        <div className="w-full max-w-xl">
          <VirtualKeyboard
            value={name}
            onChange={(v) => { setName(v); setError(""); }}
            onEnter={handleLogin}
            label="لوحة المفاتيح — اسم الموظف"
          />
        </div>

        {/* ── Login button ── */}
        <Button
          className="w-full max-w-xl h-11 text-base"
          onClick={handleLogin}
          disabled={!selectedRole || !name.trim()}
        >
          تسجيل الدخول
        </Button>
      </div>
    </div>
  );
}
