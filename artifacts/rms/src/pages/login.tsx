import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, ChevronDown, Eye, EyeOff, Lock, User, Grid3x3, Sun, Moon, Delete, Building2 } from "lucide-react";
import { useGetEmployees, useGetTables, useGetBranches } from "@workspace/api-client-react";
import { useAuth, useTheme } from "@/App";
import { useLocation } from "wouter";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/i18n";
import {
  fullListPermissionsMap,
  listPermissionsFromEmployee,
  toLegacyMenuPermissions,
} from "@/lib/list-permissions";
type BranchPick = number | "all";

type ComboItem = { id: number; label: string; sublabel?: string; icon?: string };

const ROLES = [
  { value: "admin",   labelKey: "role.admin",   labelEn: "Admin",   icon: "🛡️", empRole: "admin",   color: "from-purple-600 to-purple-700", ring: "ring-purple-500/40 border-purple-400", fade: "border-border hover:border-purple-400/60", redirect: "/" },
  { value: "manager", labelKey: "role.manager", labelEn: "Manager", icon: "👔", empRole: "manager", color: "from-blue-600 to-blue-700",     ring: "ring-blue-500/40 border-blue-400",     fade: "border-border hover:border-blue-400/60",   redirect: "/" },
  { value: "cashier", labelKey: "role.cashier", labelEn: "Cashier", icon: "💰", empRole: "cashier", color: "from-amber-500 to-amber-700",   ring: "ring-amber-500/40 border-amber-400",   fade: "border-border hover:border-amber-400/60", redirect: "/" },
  { value: "kitchen", labelKey: "role.kitchen", labelEn: "Kitchen", icon: "👨‍🍳", empRole: "kitchen", color: "from-red-600 to-red-700",       ring: "ring-red-500/40 border-red-400",       fade: "border-border hover:border-red-400/60",   redirect: "/" },
  { value: "table",   labelKey: "role.table",   labelEn: "Waiter",  icon: "🍽️", empRole: "waiter",  color: "from-green-600 to-green-700",   ring: "ring-green-500/40 border-green-400",   fade: "border-border hover:border-green-400/60", redirect: "/" },
] as const;

export type RoleType = (typeof ROLES)[number]["value"];
/* ─── Combobox ─────────────────────────────────────────────── */
function Combobox({ items, value, onChange, disabled, placeholder, isTable }: {
  items: ComboItem[]; value: string; onChange: (l: string) => void;
  disabled: boolean; placeholder?: string; isTable?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const ref    = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    if (!open && btnRef.current) setDropRect(btnRef.current.getBoundingClientRect());
    setOpen(o => !o);
  };

  const active = items.find(i => i.label === value);

  return (
    <div ref={ref} className="relative z-30">
      <button
        ref={btnRef} type="button" disabled={disabled} onClick={handleOpen}
        className={`w-full h-12 sm:h-14 px-3 sm:px-4 rounded-xl border-2 flex items-center gap-2 transition-all text-sm sm:text-base
          ${disabled ? "opacity-40 cursor-not-allowed border-border bg-secondary/30" : "cursor-pointer border-border hover:border-primary/50 bg-secondary/40"}
          ${open ? "border-primary bg-primary/5" : ""}`}
      >
        {isTable ? <Grid3x3 className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <span className={`flex-1 text-right truncate font-semibold text-sm sm:text-base ${value ? "text-foreground" : "text-muted-foreground"}`}>
          {value || placeholder || (disabled ? t("auth.selectRoleFirstDots") : t("common.choose"))}
        </span>
        {active && !isTable && (
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
            {active.label.charAt(0)}
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && dropRect && (
          <motion.div
            ref={dropRef}
            initial={{ opacity: 0, scaleY: 0.95 }} animate={{ opacity: 1, scaleY: 1 }} exit={{ opacity: 0, scaleY: 0.95 }}
            style={{ position: "fixed", top: dropRect.bottom + 6, left: dropRect.left, width: dropRect.width, transformOrigin: "top", zIndex: 9999 }}
            className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto"
          >
            {items.length === 0 ? (
              <div className="px-4 py-4 text-sm text-muted-foreground text-center">
                {isTable ? t("auth.noTables") : t("auth.noEmployeesForRole")}
              </div>
            ) : isTable ? (
              <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {items.map(item => (
                  <button key={item.id} type="button" onClick={() => { onChange(item.label); setOpen(false); }}
                    className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition-all text-center
                      ${value === item.label ? "bg-green-600/20 border-green-500 text-green-400" : "border-border bg-secondary/40 hover:border-green-500/50 hover:bg-green-500/10 text-foreground"}`}>
                    <span className="text-lg mb-0.5">🍽️</span>
                    <span className="font-bold text-xs">{item.label}</span>
                    {item.sublabel && <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{item.sublabel}</span>}
                  </button>
                ))}
              </div>
            ) : (
              items.map(item => (
                <button key={item.id} type="button" onClick={() => { onChange(item.label); setOpen(false); }}
                  className={`w-full px-4 py-3 sm:py-4 flex items-center gap-3 hover:bg-secondary/60 transition-colors text-right
                    ${value === item.label ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                  <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {item.label.charAt(0)}
                  </div>
                  <div className="flex-1 text-right">
                    <div className="font-bold text-base">{item.label}</div>
                    {item.sublabel && <div className="text-xs text-muted-foreground">{item.sublabel}</div>}
                  </div>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Mobile QWERTY Keyboard ─────────────────────────────── */
function MobileKeyboard({
  value,
  onChange,
  onEnter,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [shifted, setShifted] = useState(false);

  const rows = [
    ["1","2","3","4","5","6","7","8","9","0"],
    ["q","w","e","r","t","y","u","i","o","p"],
    ["a","s","d","f","g","h","j","k","l"],
    ["z","x","c","v","b","n","m"],
  ];

  const press = (k: string) => {
    if (disabled) return;
    onChange(value + (shifted ? k.toUpperCase() : k));
    if (shifted) setShifted(false);
  };

  const Key = ({ k, wide = false }: { k: string; wide?: boolean }) => (
    <motion.button
      type="button" whileTap={disabled ? undefined : { scale: 0.85 }}
      disabled={disabled}
      onClick={() => press(k)}
      className={`flex-1 ${wide ? "flex-[1.5]" : ""} h-11 rounded-lg bg-card border border-border text-foreground font-bold text-base flex items-center justify-center transition-colors hover:bg-muted active:bg-primary/20 disabled:opacity-40 disabled:pointer-events-none`}
    >
      {shifted ? k.toUpperCase() : k}
    </motion.button>
  );

  return (
    <div className={`flex flex-col gap-1.5 select-none ${disabled ? "opacity-60" : ""}`} dir="ltr">
      {/* Numbers row */}
      <div className="flex gap-1">
        {rows[0].map(k => <Key key={k} k={k} />)}
      </div>
      {/* QWERTY row */}
      <div className="flex gap-1">
        {rows[1].map(k => <Key key={k} k={k} />)}
      </div>
      {/* ASDF row */}
      <div className="flex gap-1 px-3">
        {rows[2].map(k => <Key key={k} k={k} />)}
      </div>
      {/* ZXCV row with Shift + Backspace */}
      <div className="flex gap-1">
        <motion.button type="button" whileTap={disabled ? undefined : { scale: 0.85 }}
          disabled={disabled}
          onClick={() => setShifted(s => !s)}
          className={`flex-[1.3] h-11 rounded-lg border font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none
            ${shifted ? "bg-primary/30 border-primary text-primary" : "bg-secondary border-border text-foreground hover:bg-muted"}`}>
          ⇧
        </motion.button>
        {rows[3].map(k => <Key key={k} k={k} />)}
        <motion.button type="button" whileTap={disabled ? undefined : { scale: 0.85 }}
          disabled={disabled}
          onClick={() => onChange(value.slice(0, -1))}
          className="flex-[1.3] h-11 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive flex items-center justify-center hover:bg-destructive/25 transition-colors disabled:opacity-40 disabled:pointer-events-none">
          <Delete className="w-4 h-4" />
        </motion.button>
      </div>
      {/* Space + Login */}
      <div className="flex gap-1">
        <motion.button type="button" whileTap={disabled ? undefined : { scale: 0.97 }}
          disabled={disabled}
          onClick={() => onChange(value + " ")}
          className="flex-1 h-11 rounded-lg bg-card border border-border text-muted-foreground font-bold text-sm flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none">
          Space
        </motion.button>
        <motion.button type="button" whileTap={disabled ? undefined : { scale: 0.97 }}
          disabled={disabled}
          onClick={onEnter}
          className="flex-[1.8] h-11 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm flex items-center justify-center gap-1.5 shadow-md shadow-primary/25 transition-colors disabled:opacity-40 disabled:pointer-events-none">
          {t("auth.login")} ↵
        </motion.button>
      </div>
    </div>
  );
}

/* ─── Desktop Virtual Keyboard ────────────────────────────── */
function DesktopKeyboard({
  value,
  onChange,
  onEnter,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [shifted, setShifted] = useState(false);

  const rows = [
    ["1","2","3","4","5","6","7","8","9","0","-","="],
    ["q","w","e","r","t","y","u","i","o","p","[","]"],
    ["a","s","d","f","g","h","j","k","l",";","'"],
    ["z","x","c","v","b","n","m",",",".","/"],
  ];

  const press = (k: string) => {
    if (disabled) return;
    const ch = shifted ? k.toUpperCase() : k;
    onChange(value + ch);
    if (shifted) setShifted(false);
  };

  return (
    <div className={`flex flex-col gap-1.5 h-full justify-between ${disabled ? "opacity-55" : ""}`}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1.5 justify-center">
          {ri === 3 && (
            <motion.button whileTap={disabled ? undefined : { scale: 0.93 }} type="button" disabled={disabled} onClick={() => setShifted(s => !s)}
              className={`flex-shrink-0 flex items-center justify-center rounded-xl border-2 text-sm font-bold transition-all disabled:pointer-events-none
                ${shifted ? "bg-primary/30 border-primary text-primary" : "bg-card border-border text-foreground hover:border-primary/40 hover:bg-muted"}
              `} style={{ height: 65, width: 110 }}>
              ⇧
            </motion.button>
          )}
          {row.map(k => (
            <motion.button key={k} whileTap={disabled ? undefined : { scale: 0.9 }} type="button" disabled={disabled} onClick={() => press(k)}
              className="flex items-center justify-center rounded-xl border-2 bg-card border-border text-foreground hover:border-primary/40 hover:bg-muted transition-all text-xl font-bold flex-shrink-0 disabled:pointer-events-none"
              style={{ height: 65, width: 80 }}>
              {shifted ? k.toUpperCase() : k}
            </motion.button>
          ))}
          {ri === 3 && (
            <motion.button whileTap={disabled ? undefined : { scale: 0.93 }} type="button" disabled={disabled} onClick={() => onChange(value.slice(0,-1))}
              className="flex-shrink-0 flex items-center justify-center rounded-xl border-2 border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25 transition-all font-bold disabled:pointer-events-none"
              style={{ height: 65, width: 110 }}>
              <Delete className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      ))}
      <div className="flex gap-1.5">
        <motion.button whileTap={disabled ? undefined : { scale: 0.97 }} type="button" disabled={disabled} onClick={() => onChange(value + " ")}
          className="flex-1 flex items-center justify-center rounded-xl border-2 bg-card border-border text-foreground hover:border-primary/40 hover:bg-muted text-xl font-bold transition-all disabled:pointer-events-none"
          style={{ height: 65 }}>
          Space
        </motion.button>
        <motion.button whileTap={disabled ? undefined : { scale: 0.97 }} type="button" disabled={disabled} onClick={onEnter}
          className="flex-shrink-0 flex items-center justify-center gap-2 rounded-xl border-2 bg-primary border-primary text-primary-foreground hover:bg-primary/90 text-lg font-bold transition-all shadow-lg shadow-primary/25 disabled:pointer-events-none"
          style={{ height: 65, minWidth: 200 }}>
          {t("auth.login")} ↵
        </motion.button>
      </div>
    </div>
  );
}

/* ─── Main Login Page ─────────────────────────────────────── */
export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const employeesQuery = useGetEmployees();
  const tablesQuery = useGetTables();
  const branchesQuery = useGetBranches();
  const allEmployees = Array.isArray(employeesQuery.data) ? employeesQuery.data : [];
  const allTables = Array.isArray(tablesQuery.data) ? tablesQuery.data : [];
  const allBranches = Array.isArray(branchesQuery.data)
    ? branchesQuery.data.filter((b) => b.isActive !== false)
    : [];

  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [selection, setSelection] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<BranchPick | null>(null);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const pinInputDesktopRef = useRef<HTMLInputElement>(null);

  const roleConfig = ROLES.find(r => r.value === selectedRole);
  const isTableRole = selectedRole === "table";

  const selectedEmployee = !isTableRole
    ? allEmployees.find(
        (e) =>
          e.name === selection.trim() &&
          roleConfig &&
          e.role === roleConfig.empRole &&
          e.isActive
      )
    : undefined;

  const employeeCanAllBranches = Boolean(
    selectedEmployee &&
      (selectedEmployee.allBranches ||
        selectedEmployee.role === "admin" ||
        selectedEmployee.role === "manager")
  );

  const branchOptions: { id: BranchPick; label: string }[] = (() => {
    if (isTableRole) {
      return allBranches.map((b) => ({ id: b.id as BranchPick, label: b.name }));
    }
    if (!selectedEmployee) return [];
    if (employeeCanAllBranches) {
      return [
        { id: "all" as const, label: t("auth.allBranchesAggregated") },
        ...allBranches.map((b) => ({ id: b.id as BranchPick, label: b.name })),
      ];
    }
    return (selectedEmployee.branchIds ?? [])
      .map((id) => allBranches.find((b) => b.id === id))
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
      .map((b) => ({ id: b.id as BranchPick, label: b.name }));
  })();

  const branchReady = isTableRole
    ? selectedBranchId !== null && selectedBranchId !== "all"
    : Boolean(selectedEmployee) && selectedBranchId !== null;

  const pinReady = Boolean(
    selectedRole && selection.trim() && branchReady
  );

  const employeeBranchLocked =
    !isTableRole && Boolean(selectedEmployee) && !employeeCanAllBranches;

  useEffect(() => {
    if (isTableRole) {
      if (branchOptions.length === 1) {
        setSelectedBranchId(branchOptions[0].id);
        return;
      }
      if (
        selectedBranchId != null &&
        !branchOptions.some((o) => o.id === selectedBranchId)
      ) {
        setSelectedBranchId(null);
      }
      return;
    }
    if (!selectedEmployee) {
      setSelectedBranchId(null);
      return;
    }
    if (employeeCanAllBranches) {
      if (
        selectedBranchId != null &&
        !branchOptions.some((o) => o.id === selectedBranchId)
      ) {
        setSelectedBranchId(null);
      }
      return;
    }
    if (branchOptions.length > 0) {
      setSelectedBranchId(branchOptions[0].id);
    } else {
      setSelectedBranchId(null);
    }
  }, [
    branchOptions.map((o) => String(o.id)).join("|"),
    selection,
    selectedRole,
    isTableRole,
    employeeCanAllBranches,
    selectedEmployee?.id,
  ]);

  const focusPinInput = () => {
    if (!pinReady) return;
    const el =
      typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
        ? pinInputDesktopRef.current
        : pinInputRef.current;
    el?.focus();
  };

  useEffect(() => {
    if (!pinReady) return undefined;
    const t = window.setTimeout(focusPinInput, 50);
    return () => window.clearTimeout(t);
  }, [pinReady]);

  const updatePin = (v: string) => {
    if (!pinReady) return;
    setPin(v);
    setError("");
  };

  const comboItems: ComboItem[] = isTableRole
    ? allTables
        .filter((tbl) => {
          if (selectedBranchId == null || selectedBranchId === "all") return false;
          return tbl.branchId === selectedBranchId;
        })
        .map((tbl) => ({
          id: tbl.id,
          label: t("auth.tableN", { n: tbl.number }),
          sublabel: t("auth.tableCapacity", {
            location: tbl.location ?? "",
            capacity: tbl.capacity,
          }),
          icon: "🍽️",
        }))
    : allEmployees
        .filter((e) => Boolean(roleConfig && e.role === roleConfig.empRole && e.isActive))
        .map((e) => ({ id: e.id, label: e.name, sublabel: e.phone ?? undefined }));

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setSelection("");
    setSelectedBranchId(null);
    setPin("");
    setError("");
  };

  const handleLogin = async () => {
    if (submitting) return;
    if (!selectedRole)     { setError(t("auth.selectRoleFirst")); return; }
    if (isTableRole && (selectedBranchId == null || selectedBranchId === "all")) {
      setError(t("auth.selectBranchFirst"));
      return;
    }
    if (!selection.trim()) { setError(isTableRole ? t("auth.selectTable") : t("auth.selectEmployee")); return; }
    if (!isTableRole && selectedBranchId == null) { setError(t("auth.selectBranch")); return; }
    if (!pin)              { setError(t("auth.enterPin")); return; }

    const branchName =
      selectedBranchId === "all"
        ? t("auth.allBranches")
        : allBranches.find((b) => b.id === selectedBranchId)?.name;

    const body: Record<string, unknown> = {
      role: selectedRole,
      pin,
    };

    if (isTableRole) {
      const item = comboItems.find((i) => i.label === selection.trim());
      if (!item?.id) {
        setError(t("auth.selectTable"));
        return;
      }
      body.tableId = item.id;
    } else {
      if (!selectedEmployee?.id) {
        setError(t("auth.selectEmployee"));
        return;
      }
      body.employeeId = selectedEmployee.id;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            success?: boolean;
            message?: string;
            token?: string;
            user?: Record<string, unknown>;
          }
        | null;
      if (!res.ok || !data?.token || !data.user) {
        setError(data?.message || t("auth.pinIncorrect"));
        return;
      }

      if (isTableRole) {
        const item = comboItems.find((i) => i.label === selection.trim());
        const table = allTables.find((tbl) => tbl.id === item?.id);
        login(
          {
            name: String(data.user.name ?? selection.trim()),
            role: "table",
            tableId: item?.id ?? (data.user.tableId as number | undefined),
            tableNumber:
              table?.number ??
              (data.user.tableNumber as string | undefined),
            allBranches: false,
            branchIds:
              typeof selectedBranchId === "number" ? [selectedBranchId] : [],
            selectedBranchId: selectedBranchId!,
            branchName,
          },
          data.token
        );
      } else {
        const emp = selectedEmployee;
        const isFullAdmin =
          selectedRole === "admin" ||
          selectedRole === "manager" ||
          emp?.role === "admin" ||
          emp?.role === "manager";
        const listPermissions = isFullAdmin
          ? fullListPermissionsMap()
          : listPermissionsFromEmployee(emp ?? { role: selectedRole });
        login(
          {
            name: String(data.user.name ?? selection.trim()),
            role: selectedRole,
            employeeId: emp?.id,
            allBranches: employeeCanAllBranches,
            branchIds: employeeCanAllBranches ? [] : emp?.branchIds ?? [],
            selectedBranchId: selectedBranchId!,
            branchName,
            listPermissions,
            menuPermissions: toLegacyMenuPermissions(listPermissions),
          },
          data.token
        );
      }
      navigate(roleConfig!.redirect);
    } catch {
      setError(t("auth.pinIncorrect"));
    } finally {
      setSubmitting(false);
    }
  };

  const branchPicker = (() => {
    const showPicker = isTableRole ? Boolean(selectedRole) : Boolean(selectedEmployee);
    const lockedBranchLabel =
      branchOptions.find((o) => o.id === selectedBranchId)?.label ??
      branchOptions[0]?.label ??
      "";

    if (employeeBranchLocked && showPicker && lockedBranchLabel) {
      return (
        <div>
          <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
            {t("common.branch")} <span className="text-destructive">*</span>
          </label>
          <div
            className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-3 pointer-events-none select-none"
            title={t("branch.lockedToUser")}
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-600 text-primary-foreground shadow-md shadow-primary/20">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm sm:text-base font-extrabold text-foreground">
                {lockedBranchLabel}
              </p>
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mt-0.5">
                <Lock className="h-3 w-3" />
                {t("branch.lockedToUser")}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
          {t("common.branch")}{" "}
          {!isTableRole && !selectedEmployee ? "" : <span className="text-destructive">*</span>}
        </label>
        <div
          className={`w-full h-12 sm:h-14 px-3 sm:px-4 rounded-xl border-2 flex items-center gap-2 transition-all
          ${
            !showPicker
              ? "opacity-40 cursor-not-allowed border-border bg-secondary/30"
              : selectedBranchId != null
                ? "border-primary bg-primary/5"
                : "border-border bg-secondary/40"
          }`}
        >
          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <select
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm sm:text-base font-bold text-foreground disabled:cursor-not-allowed"
            disabled={!showPicker}
            value={selectedBranchId == null ? "" : String(selectedBranchId)}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedBranchId(v === "" ? null : v === "all" ? "all" : Number(v));
              if (isTableRole) setSelection("");
              setPin("");
              setError("");
            }}
          >
            <option value="">
              {isTableRole
                ? selectedRole
                  ? t("auth.selectBranchDots")
                  : t("auth.selectRoleFirstDots")
                : selectedEmployee
                  ? t("auth.selectBranchOrAll")
                  : t("auth.selectEmployeeFirst")}
            </option>
            {branchOptions.map((o) => (
              <option key={String(o.id)} value={String(o.id)}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  })();

  return (
    <div className="min-h-app h-app bg-background text-foreground flex flex-col overflow-hidden page-shell">
      {/* Background glows */}
      <div className="fixed top-0 right-0 w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] bg-primary/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[200px] h-[200px] sm:w-[250px] sm:h-[250px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="fixed top-3 left-3 z-50 flex items-center gap-2">
        <LanguageSwitcher compact />
        <button onClick={toggleTheme}
          title={theme === "dark" ? t("theme.light") : t("theme.dark")}
          className="relative flex items-center h-10 sm:h-12 px-1.5 rounded-full bg-secondary border border-border hover:border-primary/40 transition-all duration-300 overflow-hidden"
          style={{ width: "6rem" }}>
          <motion.span layout transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className={`absolute top-1 sm:top-1.5 w-8 h-8 sm:w-9 sm:h-9 rounded-full shadow-md flex items-center justify-center z-10
              ${theme === "dark" ? "bg-gradient-to-br from-slate-700 to-slate-900 right-1" : "bg-gradient-to-br from-amber-300 to-amber-500 left-1"}`}>
            {theme === "dark" ? <Moon className="w-4 h-4 text-blue-300" /> : <Sun className="w-4 h-4 text-white" />}
          </motion.span>
          <Sun className="w-4 h-4 text-amber-400 ms-2 opacity-60" />
          <Moon className="w-4 h-4 text-slate-400 me-2 ms-auto opacity-60" />
        </button>
      </div>

      {/* ══ MOBILE LAYOUT (< lg) — fixed full-screen, no scroll ══ */}
      <div className="flex lg:hidden flex-col h-screen overflow-hidden">

        {/* ── TOP: Logo + Form fields ── */}
        <div className="flex-1 flex flex-col overflow-hidden px-4 pt-12 pb-2 gap-3">

          {/* Logo row */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-11 h-11 bg-gradient-to-br from-primary to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 flex-shrink-0">
              <ChefHat className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">{t("app.name")}</h1>
              <p className="text-primary text-[10px] font-bold tracking-widest">RMS 2026</p>
            </div>
            <AnimatePresence mode="wait">
              {selectedRole && roleConfig && (
                <motion.div key={selectedRole} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className={`mr-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r ${roleConfig.color} text-white text-[11px] font-bold shadow`}>
                  {ROLES.find(r => r.value === selectedRole)?.icon} {t(roleConfig.labelKey)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Title */}
          <div className="flex-shrink-0">
            <h2 className="text-sm font-bold">{t("auth.login")}</h2>
            <p className="text-[11px] text-muted-foreground">{t("auth.loginSubtitle")}</p>
          </div>

          {/* Role buttons — 5 in a row */}
          <div className="grid grid-cols-5 gap-1.5 flex-shrink-0">
            {ROLES.map(role => {
              const isActive = selectedRole === role.value;
              return (
                <motion.button key={role.value} whileTap={{ scale: 0.92 }} onClick={() => handleRoleSelect(role.value)}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-xl border-2 transition-all
                    ${isActive ? `bg-gradient-to-br ${role.color} ${role.ring} ring-2 shadow-lg text-white` : `bg-card/40 ${role.fade} text-foreground`}`}>
                  <span className="text-2xl mb-1">{role.icon}</span>
                  <span className="font-extrabold text-[14px] leading-tight text-center">{t(role.labelKey)}</span>
                  <span className={`text-[11px] font-semibold tracking-wider mt-0.5 ${isActive ? "text-white/70" : "text-muted-foreground"}`}>{role.labelEn}</span>
                </motion.button>
              );
            })}
          </div>

          {isTableRole && <div className="flex-shrink-0">{branchPicker}</div>}

          {/* Name combobox */}
          <div className="flex-shrink-0">
            <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
              {isTableRole ? t("auth.selectTable") : t("auth.employeeName")}
            </label>
            <Combobox
              items={comboItems}
              value={selection}
              onChange={(v) => {
                setSelection(v);
                if (!isTableRole) setSelectedBranchId(null);
                setPin("");
                setError("");
              }}
              disabled={!selectedRole || (isTableRole && (selectedBranchId == null || selectedBranchId === "all"))}
              placeholder={
                isTableRole
                  ? selectedBranchId
                    ? t("auth.selectTableDots")
                    : t("auth.selectBranchFirstDots")
                  : t("auth.selectEmployeeName")
              }
              isTable={isTableRole}
            />
          </div>

          {!isTableRole && <div className="flex-shrink-0">{branchPicker}</div>}

          {/* PIN — locked until employee/table + branch */}
          <div className="flex-shrink-0">
            <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{t("auth.pin")}</label>
            <div className={`w-full h-12 px-3 rounded-xl border-2 flex items-center gap-2 transition-all
              ${!pinReady ? "opacity-50 cursor-not-allowed border-border bg-secondary/30" : pin.length > 0 ? "border-primary bg-primary/5" : "border-border bg-secondary/40"}
              ${pinReady ? "focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10" : ""}`}>
              <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={pinInputRef}
                type={showPin ? "text" : "password"}
                inputMode="text"
                autoComplete="current-password"
                value={pin}
                disabled={!pinReady}
                readOnly={!pinReady}
                onChange={(e) => updatePin(e.target.value)}
                onKeyDown={(e) => {
                  if (!pinReady) {
                    e.preventDefault();
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLogin();
                  }
                }}
                placeholder={
                  !selectedRole
                    ? t("auth.selectRoleFirstDots")
                    : !branchReady
                      ? t("auth.selectBranchFirstDots")
                      : !selection.trim()
                        ? isTableRole
                          ? t("auth.selectTableFirst")
                          : t("auth.selectEmployeeFirst")
                        : t("auth.enterPinPlaceholder")
                }
                dir="ltr"
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm sm:text-base font-bold text-foreground placeholder:text-muted-foreground placeholder:font-normal disabled:cursor-not-allowed"
              />
              <button
                type="button"
                disabled={!pinReady}
                onClick={() => setShowPin((v) => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-40 disabled:pointer-events-none"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex-shrink-0 text-destructive text-xs bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── BOTTOM: PIN Pad — always visible, never hidden ── */}
        <div className="flex-shrink-0 border-t border-border/50 bg-secondary px-4 pt-3 pb-4">
          <MobileKeyboard value={pin} onChange={updatePin} onEnter={handleLogin} disabled={!pinReady || submitting} />
        </div>
      </div>

      {/* ══ DESKTOP LAYOUT (≥ lg) ═════════════════════════════════ */}
      <div className="hidden lg:flex flex-col h-screen">
        {/* Top section */}
        <div className="flex overflow-hidden" style={{ height: "42%" }}>

          {/* Logo column */}
          <div className="w-[22%] flex flex-col items-center justify-center px-4 py-3 border-l border-border/30 flex-shrink-0">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xl shadow-primary/35">
                <ChefHat className="w-9 h-9 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold leading-tight mb-0.5">{t("app.name")}</h1>
              <p className="text-primary font-display tracking-[0.25em] text-xs uppercase mb-2">RMS 2026</p>
              <p className="text-muted-foreground text-xs max-w-[170px] mx-auto leading-relaxed">{t("app.tagline")}</p>
              <AnimatePresence mode="wait">
                {selectedRole && roleConfig && (
                  <motion.div key={selectedRole} initial={{ opacity: 0, y: 6, scale: 0.93 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.93 }}
                    className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${roleConfig.color} text-white text-xs font-bold shadow-lg`}>
                    {ROLES.find(r => r.value === selectedRole)?.icon} {t(roleConfig.labelKey)}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Form column */}
          <div className="flex-1 flex flex-col justify-center px-5 py-2 gap-2.5 overflow-hidden">
            <div>
              <h2 className="text-base font-bold mb-0">{t("auth.login")}</h2>
              <p className="text-[11px] text-muted-foreground">{t("auth.loginSubtitle")}</p>
            </div>

            {/* Role buttons — 5 in a row */}
            <div className="grid grid-cols-5 gap-1.5">
              {ROLES.map(role => {
                const isActive = selectedRole === role.value;
                return (
                  <motion.button key={role.value} whileTap={{ scale: 0.92 }} onClick={() => handleRoleSelect(role.value)}
                    className={`flex flex-col items-center py-2.5 px-1.5 rounded-xl border-2 transition-all
                      ${isActive ? `bg-gradient-to-br ${role.color} ${role.ring} ring-2 shadow-lg text-white` : `bg-card/40 ${role.fade} text-foreground`}`}>
                    <span className="text-3xl mb-1">{role.icon}</span>
                    <span className="font-extrabold text-[15px] leading-tight text-center">{t(role.labelKey)}</span>
                    <span className={`text-[12px] font-semibold tracking-wider mt-0.5 ${isActive ? "text-white/70" : "text-muted-foreground"}`}>{role.labelEn}</span>
                  </motion.button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {isTableRole ? (
                <>
                  <div>{branchPicker}</div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">{t("auth.selectTable")}</label>
                    <Combobox
                      items={comboItems}
                      value={selection}
                      onChange={(v) => {
                        setSelection(v);
                        setPin("");
                        setError("");
                      }}
                      disabled={!selectedRole || selectedBranchId == null || selectedBranchId === "all"}
                      placeholder={selectedBranchId ? t("auth.selectTableDots") : t("auth.selectBranchFirstDots")}
                      isTable
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">{t("auth.employeeName")}</label>
                    <Combobox
                      items={comboItems}
                      value={selection}
                      onChange={(v) => {
                        setSelection(v);
                        setSelectedBranchId(null);
                        setPin("");
                        setError("");
                      }}
                      disabled={!selectedRole}
                      placeholder={t("auth.selectEmployeeName")}
                    />
                  </div>
                  <div>{branchPicker}</div>
                </>
              )}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">{t("auth.pin")}</label>
                <div className={`w-full h-14 px-4 rounded-xl border-2 flex items-center gap-2 transition-all
                  ${!pinReady ? "opacity-50 cursor-not-allowed border-border bg-secondary/30" : pin.length > 0 ? "border-primary bg-primary/5" : "border-border bg-secondary/40"}
                  ${pinReady ? "focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10" : ""}`}>
                  <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <input
                    ref={pinInputDesktopRef}
                    type={showPin ? "text" : "password"}
                    inputMode="text"
                    autoComplete="current-password"
                    value={pin}
                    disabled={!pinReady}
                    readOnly={!pinReady}
                    onChange={(e) => updatePin(e.target.value)}
                    onKeyDown={(e) => {
                      if (!pinReady) {
                        e.preventDefault();
                        return;
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleLogin();
                      }
                    }}
                    placeholder={!pinReady ? t("auth.completeDataFirst") : t("auth.enterPinPlaceholder")}
                    dir="ltr"
                    className="flex-1 min-w-0 bg-transparent border-0 outline-none text-base font-bold text-foreground placeholder:text-muted-foreground placeholder:font-normal disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    disabled={!pinReady}
                    onClick={() => setShowPin((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="text-destructive text-xs bg-destructive/10 px-3 py-1.5 rounded-lg border border-destructive/20">
                  ⚠️ {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Desktop Keyboard */}
        <div className="border-t border-border/50 bg-secondary flex-1 min-h-0 flex flex-col px-4 pt-2 pb-2">
          <DesktopKeyboard value={pin} onChange={updatePin} onEnter={handleLogin} disabled={!pinReady || submitting} />
        </div>
      </div>
    </div>
  );
}
