import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChefHat, User, Lock } from "lucide-react";
import { Button, Input } from "@/components/ui-elements";
import { useAuth } from "@/App";
import { useLocation } from "wouter";

const ROLES = [
  {
    value: "admin",
    label: "مدير النظام",
    labelEn: "Admin",
    icon: "🛡️",
    color: "from-purple-600 to-purple-800",
    border: "border-purple-500/50 hover:border-purple-400",
    desc: "صلاحيات كاملة على النظام",
    redirect: "/",
  },
  {
    value: "manager",
    label: "مدير",
    labelEn: "Manager",
    icon: "👔",
    color: "from-blue-600 to-blue-800",
    border: "border-blue-500/50 hover:border-blue-400",
    desc: "إدارة الطلبات والتقارير",
    redirect: "/",
  },
  {
    value: "cashier",
    label: "كاشير",
    labelEn: "Cashier",
    icon: "💰",
    color: "from-amber-600 to-amber-800",
    border: "border-amber-500/50 hover:border-amber-400",
    desc: "استلام وتأكيد الطلبات",
    redirect: "/cashier",
  },
  {
    value: "kitchen",
    label: "مطبخ",
    labelEn: "Kitchen",
    icon: "👨‍🍳",
    color: "from-red-600 to-red-800",
    border: "border-red-500/50 hover:border-red-400",
    desc: "شاشة عرض الطلبات للمطبخ",
    redirect: "/kds",
  },
  {
    value: "table",
    label: "طاولة / نادل",
    labelEn: "Waiter",
    icon: "🍽️",
    color: "from-green-600 to-green-800",
    border: "border-green-500/50 hover:border-green-400",
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

  const handleLogin = () => {
    if (!selectedRole) { setError("الرجاء اختيار الدور أولاً"); return; }
    if (!name.trim()) { setError("الرجاء إدخال اسمك"); return; }

    const role = ROLES.find(r => r.value === selectedRole)!;
    login({ name: name.trim(), role: selectedRole });
    navigate(role.redirect);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-primary/30">
            <ChefHat className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">المطعم الذكي</h1>
          <p className="text-primary font-display tracking-widest text-sm uppercase mt-1">RMS 2026</p>
          <p className="text-muted-foreground mt-3">اختر دورك للدخول إلى النظام</p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {ROLES.map((role) => (
            <motion.button
              key={role.value}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setSelectedRole(role.value); setError(""); }}
              className={`relative p-5 rounded-2xl border-2 text-center transition-all duration-200 overflow-hidden
                ${selectedRole === role.value
                  ? `bg-gradient-to-br ${role.color} border-white/30 shadow-xl`
                  : `bg-card/50 ${role.border} border-border`
                }`}
            >
              {selectedRole === role.value && (
                <motion.div
                  layoutId="selected-role"
                  className="absolute inset-0 bg-white/5 rounded-2xl"
                  initial={false}
                />
              )}
              <div className="text-4xl mb-2">{role.icon}</div>
              <div className="font-bold text-base">{role.label}</div>
              <div className="text-[10px] font-display opacity-70 tracking-widest uppercase">{role.labelEn}</div>
              <div className={`text-xs mt-1.5 ${selectedRole === role.value ? "text-white/80" : "text-muted-foreground"}`}>
                {role.desc}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Name Input */}
        <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">
              <User className="w-4 h-4 inline me-1 text-primary" />
              اسم الموظف
            </label>
            <Input
              placeholder="أدخل اسمك..."
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="h-12 text-base"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-destructive text-sm bg-destructive/10 px-4 py-2 rounded-xl"
            >
              ⚠️ {error}
            </motion.p>
          )}

          <Button
            className="w-full h-12 text-lg gap-2"
            onClick={handleLogin}
            disabled={!selectedRole || !name.trim()}
          >
            <Lock className="w-5 h-5" />
            تسجيل الدخول
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4 font-display">
          Restaurant Management System © 2026
        </p>
      </motion.div>
    </div>
  );
}
