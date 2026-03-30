import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, ChevronDown, Eye, EyeOff, Lock, User } from "lucide-react";
import { useGetEmployees } from "@workspace/api-client-react";
import { Button } from "@/components/ui-elements";
import VirtualKeyboard from "@/components/virtual-keyboard";
import { useAuth } from "@/App";
import { useLocation } from "wouter";

type Employee = { id: number; name: string; role: string; isActive: boolean };

/* ─── Role configuration ─────────────────────────────────────── */
const ROLES = [
  { value: "admin",   label: "مدير النظام", labelEn: "Admin",   icon: "🛡️", empRole: "admin",   color: "from-purple-600 to-purple-700", ring: "ring-purple-500/40 border-purple-400", fade: "border-border hover:border-purple-400/60", redirect: "/" },
  { value: "manager", label: "مدير",         labelEn: "Manager", icon: "👔", empRole: "manager", color: "from-blue-600 to-blue-700",     ring: "ring-blue-500/40 border-blue-400",     fade: "border-border hover:border-blue-400/60",   redirect: "/" },
  { value: "cashier", label: "كاشير",        labelEn: "Cashier", icon: "💰", empRole: "cashier", color: "from-amber-500 to-amber-700",   ring: "ring-amber-500/40 border-amber-400",   fade: "border-border hover:border-amber-400/60", redirect: "/cashier" },
  { value: "kitchen", label: "مطبخ",         labelEn: "Kitchen", icon: "👨‍🍳", empRole: "kitchen", color: "from-red-600 to-red-700",       ring: "ring-red-500/40 border-red-400",       fade: "border-border hover:border-red-400/60",   redirect: "/kds" },
  { value: "table",   label: "طاولة / نادل", labelEn: "Waiter",  icon: "🍽️", empRole: "waiter",  color: "from-green-600 to-green-700",   ring: "ring-green-500/40 border-green-400",   fade: "border-border hover:border-green-400/60", redirect: "/table-order" },
] as const;

export type RoleType = (typeof ROLES)[number]["value"];

const DEMO_PIN = "1234"; // default PIN for all employees

/* ─── Combobox component ─────────────────────────────────────── */
function EmployeeCombobox({
  employees, value, onChange, disabled,
}: {
  employees: Employee[];
  value: string;
  onChange: (name: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const active = employees.find((e) => e.name === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full h-11 px-4 rounded-xl border-2 flex items-center gap-2 transition-all text-sm
          ${disabled ? "opacity-40 cursor-not-allowed border-border bg-secondary/30" : "cursor-pointer border-border hover:border-primary/50 bg-secondary/40"}
          ${open ? "border-primary bg-primary/5" : ""}`}
      >
        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className={`flex-1 text-right truncate font-semibold ${value ? "text-foreground" : "text-muted-foreground"}`}>
          {value || (disabled ? "اختر الدور أولاً..." : "اختر الاسم...")}
        </span>
        {active && (
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
            {active.name.charAt(0)}
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
            style={{ originY: 0 }}
            className="absolute top-full mt-1 w-full bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {employees.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                لا يوجد موظفون لهذا الدور
              </div>
            ) : (
              employees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => { onChange(emp.name); setOpen(false); }}
                  className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-secondary/60 transition-colors text-right
                    ${value === emp.name ? "bg-primary/10 text-primary" : "text-foreground"}`}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {emp.name.charAt(0)}
                  </div>
                  <span className="font-semibold flex-1">{emp.name}</span>
                  {!emp.isActive && (
                    <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">موقوف</span>
                  )}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── PIN input ──────────────────────────────────────────────── */
function PinInput({
  value, onFocus, showPin, onToggleShow,
}: {
  value: string;
  onFocus: () => void;
  showPin: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div className="relative">
      <div
        onClick={onFocus}
        className={`w-full h-11 px-4 rounded-xl border-2 flex items-center gap-2 cursor-pointer transition-all
          ${value.length > 0 ? "border-primary bg-primary/5" : "border-border bg-secondary/40 hover:border-primary/50"}`}
      >
        <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 flex items-center gap-1.5 justify-end" dir="ltr">
          {value.length === 0 ? (
            <span className="text-muted-foreground text-sm font-semibold w-full text-left">أدخل الرقم السري...</span>
          ) : (
            Array.from({ length: value.length }).map((_, i) => (
              showPin ? (
                <span key={i} className="font-display font-bold text-base text-foreground">{value[i]}</span>
              ) : (
                <span key={i} className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
              )
            ))
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleShow(); }}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          {showPin ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

/* ─── Main Login page ────────────────────────────────────────── */
export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { data: allEmployees = [] } = useGetEmployees();

  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);
  const [error, setError] = useState("");

  const roleConfig = ROLES.find((r) => r.value === selectedRole);

  // Filter employees by selected role's empRole
  const filteredEmployees = allEmployees.filter(
    (e) => roleConfig && e.role === roleConfig.empRole && e.isActive
  );

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setEmployeeName("");
    setPin("");
    setError("");
    setPinFocused(false);
  };

  const handleLogin = () => {
    if (!selectedRole) { setError("اختر الدور أولاً"); return; }
    if (!employeeName.trim()) { setError("اختر اسم الموظف"); return; }
    if (!pin) { setError("أدخل الرقم السري"); return; }
    if (pin !== DEMO_PIN) { setError("الرقم السري غير صحيح — جرب: 1234"); return; }

    login({ name: employeeName.trim(), role: selectedRole });
    navigate(roleConfig!.redirect);
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Background glows */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Top section: Logo (right) + Form (left) ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── RIGHT: Logo + Branding ── */}
        <div className="w-2/5 flex flex-col items-center justify-center p-8 relative border-l border-border/30">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="w-28 h-28 bg-gradient-to-br from-primary to-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/40">
              <ChefHat className="w-16 h-16 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold leading-tight mb-2">المطعم الذكي</h1>
            <p className="text-primary font-display tracking-[0.3em] text-sm uppercase mb-4">RMS 2026</p>
            <p className="text-muted-foreground text-sm max-w-[200px] mx-auto leading-relaxed">
              نظام إدارة المطاعم الذكي — سجل دخولك للمتابعة
            </p>

            {selectedRole && roleConfig && (
              <motion.div
                key={selectedRole}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${roleConfig.color} text-white text-sm font-bold shadow-lg`}
              >
                <span>{ROLES.find(r => r.value === selectedRole)?.icon}</span>
                {roleConfig.label}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ── LEFT: Form ── */}
        <div className="flex-1 flex flex-col justify-center px-6 py-4 gap-3">
          <div>
            <h2 className="text-lg font-bold mb-1">تسجيل الدخول</h2>
            <p className="text-xs text-muted-foreground">اختر دورك وأدخل بياناتك</p>
          </div>

          {/* Role buttons */}
          <div className="grid grid-cols-5 gap-2">
            {ROLES.map((role) => {
              const isActive = selectedRole === role.value;
              return (
                <motion.button
                  key={role.value}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => handleRoleSelect(role.value)}
                  className={`flex flex-col items-center py-3 px-1 rounded-xl border-2 transition-all duration-150 relative
                    ${isActive
                      ? `bg-gradient-to-br ${role.color} ${role.ring} ring-2 shadow-lg text-white`
                      : `bg-card/40 ${role.fade} text-foreground`
                    }`}
                >
                  <span className="text-2xl mb-1">{role.icon}</span>
                  <span className="font-bold text-[11px] leading-tight text-center">{role.label}</span>
                  <span className={`text-[9px] font-display tracking-wider mt-0.5 ${isActive ? "text-white/70" : "text-muted-foreground"}`}>
                    {role.labelEn}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Employee combobox */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">اسم الموظف</label>
            <EmployeeCombobox
              employees={filteredEmployees}
              value={employeeName}
              onChange={(name) => { setEmployeeName(name); setError(""); }}
              disabled={!selectedRole}
            />
          </div>

          {/* PIN field */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">الرقم السري</label>
            <PinInput
              value={pin}
              onFocus={() => { setPinFocused(true); setError(""); }}
              showPin={showPin}
              onToggleShow={() => setShowPin((v) => !v)}
            />
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-destructive text-xs bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20"
              >
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login button */}
          <Button
            className="w-full h-11"
            onClick={handleLogin}
            disabled={!selectedRole || !employeeName || !pin}
          >
            تسجيل الدخول
          </Button>

          <p className="text-center text-[10px] text-muted-foreground font-display">
            الرقم السري الافتراضي: <span className="text-primary font-bold">1234</span>
          </p>
        </div>
      </div>

      {/* ── BOTTOM: Virtual Keyboard — only when PIN focused ── */}
      <AnimatePresence>
        {pinFocused && (
          <motion.div
            key="keyboard"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
            className="border-t border-border/50 bg-[#13151a] flex-shrink-0"
          >
            <div className="max-w-4xl mx-auto w-full px-4 py-3">
              {/* PIN display strip */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs text-muted-foreground font-display">الرقم السري</span>
                <div className="flex items-center gap-2" dir="ltr">
                  {pin.length === 0 ? (
                    <span className="text-muted-foreground text-xs">أدخل الرقم السري...</span>
                  ) : (
                    Array.from({ length: pin.length }).map((_, i) => (
                      showPin ? (
                        <span key={i} className="font-display text-xl font-bold text-primary w-7 text-center">{pin[i]}</span>
                      ) : (
                        <span key={i} className="w-3 h-3 rounded-full bg-primary inline-block" />
                      )
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPin((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPin ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setPinFocused(false)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    إغلاق ✕
                  </button>
                </div>
              </div>

              <VirtualKeyboard
                value={pin}
                onChange={(v) => { setPin(v); setError(""); }}
                onEnter={handleLogin}
                label=""
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
