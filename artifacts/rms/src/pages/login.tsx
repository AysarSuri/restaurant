import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, ChevronDown, Eye, EyeOff, Lock, User, Grid3x3, Sun, Moon } from "lucide-react";
import { useGetEmployees, useGetTables } from "@workspace/api-client-react";
import { Button } from "@/components/ui-elements";
import VirtualKeyboard from "@/components/virtual-keyboard";
import { useAuth, useTheme } from "@/App";
import { useLocation } from "wouter";

/* ─── Types ─────────────────────────────────────────────────── */
type ComboItem = { id: number; label: string; sublabel?: string; icon?: string };

/* ─── Role configuration ─────────────────────────────────────── */
const ROLES = [
  { value: "admin",   label: "مدير النظام", labelEn: "Admin",   icon: "🛡️", empRole: "admin",   color: "from-purple-600 to-purple-700", ring: "ring-purple-500/40 border-purple-400", fade: "border-border hover:border-purple-400/60", redirect: "/" },
  { value: "manager", label: "مدير",         labelEn: "Manager", icon: "👔", empRole: "manager", color: "from-blue-600 to-blue-700",     ring: "ring-blue-500/40 border-blue-400",     fade: "border-border hover:border-blue-400/60",   redirect: "/" },
  { value: "cashier", label: "كاشير",        labelEn: "Cashier", icon: "💰", empRole: "cashier", color: "from-amber-500 to-amber-700",   ring: "ring-amber-500/40 border-amber-400",   fade: "border-border hover:border-amber-400/60", redirect: "/cashier" },
  { value: "kitchen", label: "مطبخ",         labelEn: "Kitchen", icon: "👨‍🍳", empRole: "kitchen", color: "from-red-600 to-red-700",       ring: "ring-red-500/40 border-red-400",       fade: "border-border hover:border-red-400/60",   redirect: "/kds" },
  { value: "table",   label: "طاولة / نادل", labelEn: "Waiter",  icon: "🍽️", empRole: "waiter",  color: "from-green-600 to-green-700",   ring: "ring-green-500/40 border-green-400",   fade: "border-border hover:border-green-400/60", redirect: "/table-order" },
] as const;

export type RoleType = (typeof ROLES)[number]["value"];
const DEMO_PIN = "1234";

/* ─── Generic Combobox ───────────────────────────────────────── */
function Combobox({
  items, value, onChange, disabled, placeholder, isTable,
}: {
  items: ComboItem[];
  value: string;
  onChange: (label: string) => void;
  disabled: boolean;
  placeholder?: string;
  isTable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const inBtn = ref.current?.contains(e.target as Node);
      const inDrop = dropRef.current?.contains(e.target as Node);
      if (!inBtn && !inDrop) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    if (!open && btnRef.current) setDropRect(btnRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  };

  const active = items.find((i) => i.label === value);

  return (
    <div ref={ref} className="relative z-30">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={`w-full h-14 px-4 rounded-xl border-2 flex items-center gap-2 transition-all text-base
          ${disabled
            ? "opacity-40 cursor-not-allowed border-border bg-secondary/30"
            : "cursor-pointer border-border hover:border-primary/50 bg-secondary/40"}
          ${open ? "border-primary bg-primary/5" : ""}`}
      >
        {isTable
          ? <Grid3x3 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          : <User className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        }
        <span className={`flex-1 text-right truncate font-semibold text-base ${value ? "text-foreground" : "text-muted-foreground"}`}>
          {value || placeholder || (disabled ? "اختر الدور أولاً..." : "اختر...")}
        </span>
        {active && isTable && (
          <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-lg flex-shrink-0">
            {active.sublabel}
          </span>
        )}
        {active && !isTable && (
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
            {active.label.charAt(0)}
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && dropRect && (
          <motion.div
            ref={dropRef}
            initial={{ opacity: 0, scaleY: 0.95 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.95 }}
            style={{
              position: "fixed",
              top: dropRect.bottom + 6,
              left: dropRect.left,
              width: dropRect.width,
              transformOrigin: "top",
              zIndex: 9999,
            }}
            className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto"
          >
            {items.length === 0 ? (
              <div className="px-4 py-4 text-sm text-muted-foreground text-center">
                {isTable ? "لا توجد طاولات مسجلة" : "لا يوجد موظفون لهذا الدور"}
              </div>
            ) : (
              isTable ? (
                /* ── Table grid layout ── */
                <div className="p-3 grid grid-cols-4 gap-2">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { onChange(item.label); setOpen(false); }}
                      className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition-all text-center
                        ${value === item.label
                          ? "bg-green-600/20 border-green-500 text-green-400"
                          : "border-border bg-secondary/40 hover:border-green-500/50 hover:bg-green-500/10 text-foreground"
                        }`}
                    >
                      <span className="text-lg mb-0.5">🍽️</span>
                      <span className="font-bold text-xs">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{item.sublabel}</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                /* ── Employee list layout ── */
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { onChange(item.label); setOpen(false); }}
                    className={`w-full px-5 py-4 flex items-center gap-4 hover:bg-secondary/60 transition-colors text-right
                      ${value === item.label ? "bg-primary/10 text-primary" : "text-foreground"}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-base font-bold flex-shrink-0">
                      {item.label.charAt(0)}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="font-bold text-lg">{item.label}</div>
                      {item.sublabel && (
                        <div className="text-sm text-muted-foreground mt-0.5">{item.sublabel}</div>
                      )}
                    </div>
                  </button>
                ))
              )
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
  onFocus?: () => void;
  showPin: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div
      onClick={onFocus}
      className={`w-full h-14 px-4 rounded-xl border-2 flex items-center gap-2 cursor-default transition-all
        ${value.length > 0 ? "border-primary bg-primary/5" : "border-border bg-secondary/40 hover:border-primary/50"}`}
    >
      <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 flex items-center gap-2 justify-end" dir="ltr">
        {value.length === 0 ? (
          <span className="text-muted-foreground text-base w-full text-left">أدخل الرقم السري...</span>
        ) : (
          Array.from({ length: value.length }).map((_, i) =>
            showPin
              ? <span key={i} className="font-display font-bold text-lg text-foreground">{value[i]}</span>
              : <span key={i} className="w-3 h-3 rounded-full bg-primary inline-block" />
          )
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
  );
}

/* ─── Main Login page ────────────────────────────────────────── */
export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { data: allEmployees = [] } = useGetEmployees();
  const { data: allTables = [] } = useGetTables();

  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [selection, setSelection]     = useState(""); // employee name OR table label
  const [pin, setPin]                 = useState("");
  const [showPin, setShowPin]         = useState(false);
  const [error, setError]             = useState("");

  const roleConfig = ROLES.find((r) => r.value === selectedRole);
  const isTableRole = selectedRole === "table";

  /* Build combobox items based on selected role */
  const comboItems: ComboItem[] = isTableRole
    ? allTables.map((t) => ({
        id: t.id,
        label: `طاولة ${t.number}`,
        sublabel: `${t.location ?? ""} — سعة ${t.capacity}`,
        icon: "🍽️",
      }))
    : allEmployees
        .filter((e) => roleConfig && e.role === roleConfig.empRole && e.isActive)
        .map((e) => ({ id: e.id, label: e.name, sublabel: e.phone ?? undefined }));

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setSelection("");
    setPin("");
    setError("");
  };

  const handleLogin = () => {
    if (!selectedRole)    { setError("اختر الدور أولاً"); return; }
    if (!selection.trim()) { setError(isTableRole ? "اختر الطاولة" : "اختر اسم الموظف"); return; }
    if (!pin)             { setError("أدخل الرقم السري"); return; }
    if (pin !== DEMO_PIN) { setError("الرقم السري غير صحيح — جرب: 1234"); return; }

    login({ name: selection.trim(), role: selectedRole });
    navigate(roleConfig!.redirect);
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Background glows */}
      <div className="fixed top-0 right-0 w-[400px] h-[400px] bg-primary/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[250px] h-[250px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* ── Theme toggle — top left corner ── */}
      <button
        onClick={toggleTheme}
        title={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
        className="fixed top-3 left-3 z-50 flex items-center h-12 px-1.5 rounded-full bg-secondary border border-border hover:border-primary/40 transition-all duration-300 overflow-hidden"
        style={{ width: "7rem" }}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className={`absolute top-1.5 w-9 h-9 rounded-full shadow-md flex items-center justify-center z-10
            ${theme === "dark"
              ? "bg-gradient-to-br from-slate-700 to-slate-900 right-1.5"
              : "bg-gradient-to-br from-amber-300 to-amber-500 left-1.5"
            }`}
        >
          {theme === "dark"
            ? <Moon className="w-5 h-5 text-blue-300" />
            : <Sun  className="w-5 h-5 text-white" />
          }
        </motion.span>
        <Sun  className="w-5 h-5 text-amber-400 ms-2 opacity-60" />
        <Moon className="w-5 h-5 text-slate-400 me-2 ms-auto opacity-60" />
      </button>

      {/* ── TOP: Logo (right) + Form (left) — compact ── */}
      <div className="flex overflow-hidden min-h-0" style={{ height: "42%" }}>

        {/* ── RIGHT: Logo + Branding ── */}
        <div className="w-[24%] flex flex-col items-center justify-center px-4 py-3 relative border-l border-border/30 flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xl shadow-primary/35">
              <ChefHat className="w-9 h-9 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold leading-tight mb-0.5">المطعم الذكي</h1>
            <p className="text-primary font-display tracking-[0.25em] text-xs uppercase mb-2">RMS 2026</p>
            <p className="text-muted-foreground text-xs max-w-[170px] mx-auto leading-relaxed hidden sm:block">
              نظام إدارة المطاعم الذكي
            </p>
            <AnimatePresence mode="wait">
              {selectedRole && roleConfig && (
                <motion.div
                  key={selectedRole}
                  initial={{ opacity: 0, y: 6, scale: 0.93 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.93 }}
                  className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${roleConfig.color} text-white text-xs font-bold shadow-lg`}
                >
                  <span>{ROLES.find(r => r.value === selectedRole)?.icon}</span>
                  {roleConfig.label}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── LEFT: Form ── */}
        <div className="flex-1 flex flex-col justify-center px-5 py-2 gap-2.5 overflow-hidden">
          <div>
            <h2 className="text-base font-bold mb-0">تسجيل الدخول</h2>
            <p className="text-[11px] text-muted-foreground">اختر دورك وأدخل بياناتك</p>
          </div>

          {/* Role buttons */}
          <div className="grid grid-cols-5 gap-1.5">
            {ROLES.map((role) => {
              const isActive = selectedRole === role.value;
              return (
                <motion.button
                  key={role.value}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleRoleSelect(role.value)}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl border-2 transition-all duration-150
                    ${isActive
                      ? `bg-gradient-to-br ${role.color} ${role.ring} ring-2 shadow-lg text-white`
                      : `bg-card/40 ${role.fade} text-foreground`}`}
                >
                  <span className="text-xl mb-0.5">{role.icon}</span>
                  <span className="font-bold text-[10px] leading-tight text-center">{role.label}</span>
                  <span className={`text-[8px] font-display tracking-wider mt-0.5 ${isActive ? "text-white/70" : "text-muted-foreground"}`}>
                    {role.labelEn}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Combobox + PIN side by side */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">
                {isTableRole ? "اختر الطاولة" : "اسم الموظف"}
              </label>
              <Combobox
                items={comboItems}
                value={selection}
                onChange={(v) => { setSelection(v); setError(""); }}
                disabled={!selectedRole}
                placeholder={isTableRole ? "اختر الطاولة..." : "اختر الاسم..."}
                isTable={isTableRole}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">الرقم السري</label>
              <PinInput
                value={pin}
                onFocus={() => setError("")}
                showPin={showPin}
                onToggleShow={() => setShowPin((v) => !v)}
              />
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-destructive text-xs bg-destructive/10 px-3 py-1.5 rounded-lg border border-destructive/20"
              >
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* ── BOTTOM: Virtual Keyboard — always visible ── */}
      <div className="border-t border-border/50 bg-secondary flex-1 min-h-0 flex flex-col">
        <div className="w-full h-full px-4 pt-2 pb-2 flex flex-col">

          <div className="flex-1 min-h-0">
            <VirtualKeyboard
              value={pin}
              onChange={(v) => { setPin(v); setError(""); }}
              onEnter={handleLogin}
              label=""
            />
          </div>
        </div>
      </div>
    </div>
  );
}
