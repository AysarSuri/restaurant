import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, Keyboard } from "lucide-react";
import { Button } from "@/components/ui-elements";
import VirtualKeyboard from "@/components/virtual-keyboard";
import { useAuth } from "@/App";
import { useLocation } from "wouter";

const ROLES = [
  {
    value: "admin",
    label: "مدير النظام",
    labelEn: "Admin",
    icon: "🛡️",
    color: "from-purple-600 to-purple-800",
    activeBorder: "border-purple-400 ring-2 ring-purple-500/40",
    inactiveBorder: "border-border hover:border-purple-500/50",
    desc: "صلاحيات كاملة على النظام",
    redirect: "/",
  },
  {
    value: "manager",
    label: "مدير",
    labelEn: "Manager",
    icon: "👔",
    color: "from-blue-600 to-blue-800",
    activeBorder: "border-blue-400 ring-2 ring-blue-500/40",
    inactiveBorder: "border-border hover:border-blue-500/50",
    desc: "إدارة الطلبات والتقارير",
    redirect: "/",
  },
  {
    value: "cashier",
    label: "كاشير",
    labelEn: "Cashier",
    icon: "💰",
    color: "from-amber-600 to-amber-800",
    activeBorder: "border-amber-400 ring-2 ring-amber-500/40",
    inactiveBorder: "border-border hover:border-amber-500/50",
    desc: "استلام وتأكيد الطلبات",
    redirect: "/cashier",
  },
  {
    value: "kitchen",
    label: "مطبخ",
    labelEn: "Kitchen",
    icon: "👨‍🍳",
    color: "from-red-600 to-red-800",
    activeBorder: "border-red-400 ring-2 ring-red-500/40",
    inactiveBorder: "border-border hover:border-red-500/50",
    desc: "شاشة عرض الطلبات للمطبخ",
    redirect: "/kds",
  },
  {
    value: "table",
    label: "طاولة / نادل",
    labelEn: "Waiter",
    icon: "🍽️",
    color: "from-green-600 to-green-800",
    activeBorder: "border-green-400 ring-2 ring-green-500/40",
    inactiveBorder: "border-border hover:border-green-500/50",
    desc: "تسجيل طلبات الطاولات",
    redirect: "/table-order",
  },
] as const;

export type RoleType = (typeof ROLES)[number]["value"];

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);

  const handleLogin = () => {
    if (!selectedRole) { setError("الرجاء اختيار الدور أولاً"); return; }
    if (!name.trim()) { setError("الرجاء إدخال اسمك"); return; }
    const role = ROLES.find((r) => r.value === selectedRole)!;
    login({ name: name.trim(), role: selectedRole });
    navigate(role.redirect);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-y-auto">
      {/* Background glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/8 rounded-full blur-[150px] pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-start pt-10 pb-6 px-4 relative z-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-primary/30">
            <ChefHat className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold">المطعم الذكي</h1>
          <p className="text-primary font-display tracking-widest text-sm uppercase mt-1">RMS 2026</p>
          <p className="text-muted-foreground mt-2 text-sm">اختر دورك للدخول إلى النظام</p>
        </motion.div>

        <div className="w-full max-w-2xl space-y-5">
          {/* Role Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          >
            {ROLES.map((role) => {
              const isActive = selectedRole === role.value;
              return (
                <motion.button
                  key={role.value}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setSelectedRole(role.value); setError(""); }}
                  className={`relative p-5 rounded-2xl border-2 text-center transition-all duration-200 overflow-hidden
                    ${isActive
                      ? `bg-gradient-to-br ${role.color} ${role.activeBorder} shadow-xl`
                      : `bg-card/50 ${role.inactiveBorder}`
                    }`}
                >
                  <div className="text-4xl mb-2">{role.icon}</div>
                  <div className="font-bold text-base">{role.label}</div>
                  <div className={`text-[10px] font-display tracking-widest uppercase ${isActive ? "text-white/70" : "text-muted-foreground"}`}>
                    {role.labelEn}
                  </div>
                  <div className={`text-xs mt-1.5 ${isActive ? "text-white/80" : "text-muted-foreground"}`}>
                    {role.desc}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Name input card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-5 space-y-4"
          >
            {/* Display field */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-muted-foreground">اسم الموظف</label>
              <div
                onClick={() => { setShowKeyboard(true); setError(""); }}
                className={`w-full h-12 px-4 rounded-xl border-2 flex items-center cursor-pointer transition-all
                  ${showKeyboard
                    ? "border-primary bg-primary/5 shadow-sm shadow-primary/20"
                    : "border-border bg-secondary/50 hover:border-primary/50"
                  }`}
              >
                <span className={`text-base flex-1 font-semibold ${name ? "text-foreground" : "text-muted-foreground"}`}>
                  {name || "انقر للكتابة..."}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowKeyboard((v) => !v); }}
                  className={`transition-colors ${showKeyboard ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                  title="إظهار/إخفاء لوحة المفاتيح"
                >
                  <Keyboard className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  key="err"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-destructive text-sm bg-destructive/10 px-4 py-2 rounded-xl"
                >
                  ⚠️ {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Login button */}
            <Button
              className="w-full h-12 text-base gap-2"
              onClick={handleLogin}
              disabled={!selectedRole || !name.trim()}
            >
              تسجيل الدخول
            </Button>
          </motion.div>

          {/* Virtual Keyboard */}
          <AnimatePresence>
            {showKeyboard && (
              <motion.div
                key="kbd"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
              >
                <VirtualKeyboard
                  value={name}
                  onChange={(v) => { setName(v); setError(""); }}
                  onEnter={handleLogin}
                  label="لوحة المفاتيح — اسم الموظف"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 font-display">
          Restaurant Management System © 2026
        </p>
      </div>
    </div>
  );
}
