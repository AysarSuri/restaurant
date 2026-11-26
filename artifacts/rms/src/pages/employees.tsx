import React, { useState } from "react";
import {
  useGetEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useGetBranches,
} from "@workspace/api-client-react";
import { Button, Input, Badge, Dialog } from "@/components/ui-elements";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, Card,
} from "@/components/ui-elements";
import {
  Plus, Search, Edit, Trash2, Users,
  Phone, Briefcase,
  ToggleLeft, ToggleRight, AlertTriangle, Building2, Check,
  ShieldCheck, Lock, Eye, EyeOff, KeyRound,
} from "lucide-react";
import type { Employee } from "@workspace/api-client-react";
import {
  AGE_SCOPE_OPTIONS,
  EMPTY_LIST_PERM,
  LIST_CATALOG,
  emptyListPermissionsMap,
  fullListPermissionsMap,
  listPermissionsFromEmployee,
  type AgeScope,
  type ListKey,
  type ListPerm,
  type ListPermissionsMap,
} from "@/lib/list-permissions";
import { cn } from "@/lib/utils";

const ROLES: { value: string; label: string; color: string }[] = [
  { value: "admin",   label: "مدير النظام",   color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "manager", label: "مدير",           color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "cashier", label: "كاشير",          color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { value: "waiter",  label: "نادل",           color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "kitchen", label: "مطبخ",           color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "delivery", label: "سائق توصيل",    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
];

const ALL_BRANCH_ROLES = new Set(["admin", "manager"]);

const roleInfo = (value: string) =>
  ROLES.find((r) => r.value === value) ??
  (value === "driver"
    ? { label: "سائق توصيل", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" }
    : { label: value, color: "bg-secondary text-foreground border-border" });

const EMPTY_FORM = {
  name: "",
  role: "cashier",
  phone: "",
  pin: "",
  isActive: true,
  branchIds: [] as number[],
  listPermissions: emptyListPermissionsMap() as ListPermissionsMap,
};

type FormData = typeof EMPTY_FORM;

function MiniSwitch({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors touch-manipulation",
        disabled && "opacity-40 cursor-not-allowed",
        on ? "bg-emerald-500" : "bg-secondary"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          on ? "start-0.5" : "end-0.5"
        )}
      />
    </button>
  );
}

function AgeScopePicker({
  value,
  disabled,
  onChange,
  label,
}: {
  value: AgeScope;
  disabled?: boolean;
  onChange: (v: AgeScope) => void;
  label: string;
}) {
  return (
    <div className={cn("space-y-1.5", disabled && "opacity-45 pointer-events-none")}>
      <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
      <div className="grid grid-cols-4 gap-1">
        {AGE_SCOPE_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              title={opt.hintAr}
              onClick={() => onChange(opt.value)}
              className={cn(
                "min-h-9 px-1 rounded-xl border text-[10px] sm:text-[11px] font-extrabold transition-all touch-manipulation",
                active
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "border-border/60 bg-secondary/40 text-muted-foreground hover:border-border"
              )}
            >
              {opt.labelAr}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Employees() {
  const { data: employees, isLoading, refetch } = useGetEmployees();
  const { data: branches } = useGetBranches({
    query: { staleTime: 60_000, refetchOnMount: false },
  });
  const { mutate: createEmployee, isPending: isCreating } = useCreateEmployee();
  const { mutate: updateEmployee, isPending: isUpdating } = useUpdateEmployee();
  const { mutate: deleteEmployee, isPending: isDeleting } = useDeleteEmployee();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | "branches", string>>>({});
  const [showPin, setShowPin] = useState(false);

  const isAllBranchesRole = ALL_BRANCH_ROLES.has(form.role);

  const filtered = employees?.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase()) ||
    e.phone?.includes(search)
  ) ?? [];

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowPin(false);
    setFormOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    const role = (emp.role as string) === "driver" ? "delivery" : emp.role;
    setForm({
      name: emp.name,
      role,
      phone: emp.phone ?? "",
      // PIN is never returned by the API — leave blank to keep existing.
      pin: "",
      isActive: emp.isActive ?? true,
      branchIds: emp.branchIds ?? [],
      listPermissions: listPermissionsFromEmployee(emp),
    });
    setErrors({});
    setShowPin(false);
    setFormOpen(true);
  };

  const validate = () => {
    const e: Partial<Record<keyof FormData | "branches", string>> = {};
    if (!form.name.trim()) e.name = "الاسم مطلوب";
    if (!form.role) e.role = "المنصب مطلوب";
    if (!editTarget && !form.pin.trim()) e.pin = "الرقم السري مطلوب";
    else if (form.pin.trim() && form.pin.trim().length < 4) {
      e.pin = "الرقم السري يجب أن يكون 4 أحرف على الأقل";
    }
    if (!ALL_BRANCH_ROLES.has(form.role) && form.branchIds.length === 0) {
      e.branches = "اختر فرعاً واحداً على الأقل";
    }
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const usesAll = ALL_BRANCH_ROLES.has(form.role);
    const listPermissions = usesAll
      ? fullListPermissionsMap()
      : form.listPermissions;
    const menu = listPermissions.menu ?? EMPTY_LIST_PERM;
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      role: form.role as any,
      phone: form.phone || undefined,
      isActive: form.isActive,
      allBranches: usesAll,
      branchIds: usesAll ? [] : form.branchIds,
      listPermissions,
      menuCanAccess: menu.access,
      menuCanCreate: menu.create,
      menuCanEditNew: menu.edit !== "none",
      menuCanEditOld: menu.edit === "all",
      menuCanDeleteNew: menu.delete !== "none",
      menuCanDeleteOld: menu.delete === "all",
    };
    // Omit pin on edit when blank → server keeps the existing PIN.
    if (!editTarget || form.pin.trim()) {
      payload.pin = form.pin.trim();
    }

    if (editTarget) {
      updateEmployee(
        { id: editTarget.id, data: payload as any },
        { onSuccess: () => { setFormOpen(false); refetch(); } }
      );
    } else {
      createEmployee(
        { data: payload as any },
        { onSuccess: () => { setFormOpen(false); refetch(); } }
      );
    }
  };

  const patchListPerm = (key: ListKey, patch: Partial<ListPerm>) => {
    setForm((prev) => {
      const cur = prev.listPermissions[key] ?? { ...EMPTY_LIST_PERM };
      const nextRow: ListPerm = { ...cur, ...patch };
      if (patch.access === false) {
        nextRow.create = false;
        nextRow.edit = "none";
        nextRow.delete = "none";
      }
      if (
        patch.access !== false &&
        (patch.create ||
          (patch.edit && patch.edit !== "none") ||
          (patch.delete && patch.delete !== "none"))
      ) {
        nextRow.access = true;
      }
      return {
        ...prev,
        listPermissions: { ...prev.listPermissions, [key]: nextRow },
      };
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteEmployee(
      { id: deleteTarget.id },
      { onSuccess: () => { setDeleteTarget(null); refetch(); } }
    );
  };

  const set = (field: keyof FormData, val: string | boolean | number[]) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  const setRole = (role: string) => {
    setForm((prev) => ({
      ...prev,
      role,
      branchIds: ALL_BRANCH_ROLES.has(role) ? [] : prev.branchIds,
    }));
    setErrors((prev) => ({ ...prev, role: undefined, branches: undefined }));
  };

  const toggleBranch = (id: number) => {
    setForm((prev) => {
      const exists = prev.branchIds.includes(id);
      return {
        ...prev,
        branchIds: exists
          ? prev.branchIds.filter((b) => b !== id)
          : [...prev.branchIds, id],
      };
    });
    setErrors((prev) => ({ ...prev, branches: undefined }));
  };

  const branchLabel = (emp: Employee) => {
    if (ALL_BRANCH_ROLES.has(emp.role) || emp.allBranches) return "كل الفروع";
    const names = (emp.branchIds ?? [])
      .map((id) => branches?.find((b) => b.id === id)?.name)
      .filter(Boolean);
    return names.length ? names.join(" · ") : "—";
  };

  return (
    <div className="h-full flex flex-col gap-4 md:gap-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "إجمالي الموظفين", value: employees?.length ?? 0, icon: Users, color: "text-primary" },
          { label: "نشطون", value: employees?.filter(e => e.isActive).length ?? 0, icon: ToggleRight, color: "text-green-400" },
          { label: "موقوفون", value: employees?.filter(e => !e.isActive).length ?? 0, icon: ToggleLeft, color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-4 flex items-center gap-4 border border-border/50">
            <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Table Card */}
      <Card className="flex flex-col flex-1 border border-border/50 overflow-hidden">
        <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">إدارة الموظفين</h2>
            <p className="text-xs text-primary font-display tracking-widest uppercase">Employees Management</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو المنصب..."
                className="pr-10 h-9 rounded-full bg-secondary/50 border-transparent text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={openAdd} className="rounded-full h-9 gap-1.5 text-sm flex-shrink-0">
              <Plus className="w-4 h-4" /> إضافة
            </Button>
          </div>
        </div>

        {/* ── MOBILE cards ── */}
        <div className="md:hidden divide-y divide-border/30 overflow-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">لا يوجد موظفون</div>
          ) : filtered.map((emp) => {
            const role = roleInfo(emp.role);
            return (
              <div key={emp.id} className="p-4 flex flex-col gap-2 hover:bg-secondary/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                    {emp.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{emp.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${role.color}`}>{role.label}</span>
                  </div>
                  <Badge variant={emp.isActive ? "success" : "destructive"}>
                    {emp.isActive ? "نشط" : "موقوف"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground text-xs">الهاتف: </span><span dir="ltr">{emp.phone || "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground text-xs">الفرع: </span><span className="font-semibold">{branchLabel(emp)}</span></div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 min-h-[44px] text-sm gap-2 touch-manipulation"
                    onClick={() => openEdit(emp)}
                  >
                    <Edit className="w-4 h-4" /> تعديل
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-11 min-h-[44px] text-sm gap-2 touch-manipulation text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(emp)}
                  >
                    <Trash2 className="w-4 h-4" /> حذف
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── DESKTOP table ── */}
        <div className="hidden md:block overflow-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-primary font-bold">الموظف</TableHead>
                <TableHead className="text-primary font-bold">المنصب</TableHead>
                <TableHead className="text-primary font-bold">الفرع</TableHead>
                <TableHead className="text-primary font-bold">الهاتف</TableHead>
                <TableHead className="text-primary font-bold">الحالة</TableHead>
                <TableHead className="text-end text-primary font-bold">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>لا يوجد موظفون مطابقون للبحث</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((emp) => {
                  const role = roleInfo(emp.role);
                  return (
                    <TableRow key={emp.id} className="border-border/20 group hover:bg-secondary/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                            {emp.name.charAt(0)}
                          </div>
                          <span className="font-semibold">{emp.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full border font-semibold ${role.color}`}>
                          {role.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold text-foreground">
                          {branchLabel(emp)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-display text-sm text-muted-foreground" dir="ltr">
                          {emp.phone || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.isActive ? "success" : "destructive"}>
                          {emp.isActive ? "نشط" : "موقوف"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            className="h-11 min-h-[44px] px-3 text-sm gap-2 touch-manipulation"
                            onClick={() => openEdit(emp)}
                          >
                            <Edit className="w-4 h-4" /> تعديل
                          </Button>
                          <Button
                            variant="outline"
                            className="h-11 min-h-[44px] px-3 text-sm gap-2 touch-manipulation text-destructive border-destructive/40 hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(emp)}
                          >
                            <Trash2 className="w-4 h-4" /> حذف
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ── Add / Edit Dialog ── */}
      <Dialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        hideHeader
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsla(var(--primary),0.18),_transparent_55%)]" />
            <div className="relative flex items-start gap-4">
              <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-amber-600 text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center flex-shrink-0">
                <Users className="w-7 h-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/80">
                  إدارة الموظفين
                </p>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                  {editTarget ? `تعديل — ${editTarget.name}` : "إضافة موظف جديد"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  عيّن البيانات الأساسية وصلاحيات كل القوائم (دخول · إضافة · تعديل/حذف حسب العمر).
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-4 h-4 text-primary" />
              <h3 className="font-extrabold text-sm">البيانات الأساسية</h3>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5">
                اسم الموظف <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="أدخل اسم الموظف"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={cn("min-h-12 h-12 rounded-2xl text-base font-bold", errors.name && "border-destructive")}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5">
                المنصب / الدور <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={cn(
                      "min-h-11 py-2.5 px-3 rounded-2xl border-2 text-sm font-extrabold transition-all touch-manipulation",
                      form.role === r.value
                        ? `${r.color} border-current shadow-sm`
                        : "border-border/70 bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {errors.role && <p className="text-xs text-destructive mt-1">{errors.role}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5">
                <Building2 className="w-4 h-4 inline me-1 text-primary" />
                تابع الفرع {!isAllBranchesRole && <span className="text-destructive">*</span>}
              </label>
              {isAllBranchesRole ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm">تابع لكل الفروع</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      مدير النظام والمدير مرتبطان تلقائياً بجميع الفروع
                    </p>
                  </div>
                </div>
              ) : (branches?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground rounded-2xl border border-dashed border-border px-3 py-3">
                  لا توجد فروع — أضف فرعاً أولاً من صفحة الفروع
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {branches!.map((b) => {
                    const selected = form.branchIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBranch(b.id)}
                        className={cn(
                          "min-h-12 px-3.5 rounded-2xl border-2 text-sm font-bold transition-all flex items-center gap-2.5 text-start touch-manipulation",
                          selected
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border/70 bg-background/50 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0",
                            selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                          )}
                        >
                          {selected && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span className="truncate">{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {errors.branches && (
                <p className="text-xs text-destructive mt-1">{errors.branches}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5">
                <Phone className="w-4 h-4 inline me-1 text-primary" />
                رقم الهاتف
              </label>
              <Input
                placeholder="07XX-XXX-XXXX"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                dir="ltr"
                className="min-h-12 h-12 rounded-2xl text-base font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5">
                الرقم السري لتسجيل الدخول{" "}
                {editTarget ? (
                  <span className="text-muted-foreground font-semibold">(اختياري عند التعديل)</span>
                ) : (
                  <span className="text-destructive">*</span>
                )}
              </label>
              <div
                className={cn(
                  "relative flex items-center gap-3 min-h-14 h-14 rounded-2xl border-2 px-4 transition-all",
                  "bg-gradient-to-l from-primary/5 via-secondary/30 to-secondary/40",
                  errors.pin
                    ? "border-destructive ring-4 ring-destructive/10"
                    : form.pin
                      ? "border-primary/50 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10"
                      : "border-border/70 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10"
                )}
              >
                <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={form.pin}
                  onChange={(e) => set("pin", e.target.value.replace(/\s/g, ""))}
                  placeholder="••••"
                  dir="ltr"
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-lg font-extrabold tracking-[0.35em] text-foreground placeholder:tracking-[0.45em] placeholder:text-muted-foreground/70 placeholder:font-bold"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors touch-manipulation flex-shrink-0"
                  aria-label={showPin ? "إخفاء الرقم السري" : "إظهار الرقم السري"}
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="mt-2 flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                <Lock className="w-3.5 h-3.5 mt-0.5 text-primary/70 flex-shrink-0" />
                <p>
                  يُستخدم عند تسجيل الدخول من شاشة الدخول.
                  {editTarget
                    ? " اتركه فارغاً للإبقاء على الرمز الحالي، أو أدخل رمزاً جديداً."
                    : " اختر رمزاً من 4 أحرف أو أرقام على الأقل."}
                </p>
              </div>
              {errors.pin && <p className="text-xs text-destructive mt-1">{errors.pin}</p>}
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl border border-border/60 bg-secondary/40">
              <div>
                <p className="font-extrabold text-sm">حالة الموظف</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {form.isActive
                    ? "نشط — يمكنه تسجيل الدخول"
                    : "موقوف — لا يستطيع الوصول للنظام"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => set("isActive", !form.isActive)}
                className={cn(
                  "relative inline-flex h-8 w-14 items-center rounded-full transition-colors",
                  form.isActive ? "bg-emerald-500" : "bg-destructive/60"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-6 w-6 rounded-full bg-white shadow transition-transform",
                    form.isActive ? "translate-x-1" : "translate-x-7"
                  )}
                />
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 sm:p-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-base">صلاحيات القوائم</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  لكل قائمة: دخول وإضافة، وتعديل/حذف حسب عمر السجل (خلال يوم · يومين · كل الأيام).
                  {isAllBranchesRole
                    ? " مدير النظام والمدير لديهم صلاحية كاملة تلقائياً."
                    : ""}
                </p>
              </div>
            </div>

            {isAllBranchesRole ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 flex items-center gap-3">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <p className="text-sm font-bold text-foreground">
                  هذا الدور يملك كل صلاحيات القوائم تلقائياً عند الدخول.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[min(52vh,440px)] overflow-y-auto pe-1">
                {LIST_CATALOG.map((item) => {
                  const perm = form.listPermissions[item.key] ?? EMPTY_LIST_PERM;
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        "rounded-2xl border-2 p-3 space-y-2.5 transition-colors",
                        perm.access
                          ? "border-emerald-500/35 bg-emerald-500/5"
                          : "border-border/60 bg-card/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-sm leading-tight">{item.nameAr}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">
                            {item.href}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-bold text-muted-foreground">دخول</span>
                          <MiniSwitch
                            on={perm.access}
                            onClick={() => patchListPerm(item.key, { access: !perm.access })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold text-muted-foreground">إضافة / إنشاء</span>
                        <MiniSwitch
                          on={perm.create}
                          disabled={!perm.access}
                          onClick={() => patchListPerm(item.key, { create: !perm.create })}
                        />
                      </div>

                      {item.dated ? (
                        <>
                          <AgeScopePicker
                            label="تعديل السجلات"
                            value={perm.edit}
                            disabled={!perm.access}
                            onChange={(v) => patchListPerm(item.key, { edit: v })}
                          />
                          <AgeScopePicker
                            label="حذف السجلات"
                            value={perm.delete}
                            disabled={!perm.access}
                            onChange={(v) => patchListPerm(item.key, { delete: v })}
                          />
                        </>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2">
                            <span className="text-[11px] font-bold text-muted-foreground">تعديل</span>
                            <MiniSwitch
                              on={perm.edit !== "none"}
                              disabled={!perm.access}
                              onClick={() =>
                                patchListPerm(item.key, {
                                  edit: perm.edit === "none" ? "all" : "none",
                                })
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2">
                            <span className="text-[11px] font-bold text-muted-foreground">حذف</span>
                            <MiniSwitch
                              on={perm.delete !== "none"}
                              disabled={!perm.access}
                              onClick={() =>
                                patchListPerm(item.key, {
                                  delete: perm.delete === "none" ? "all" : "none",
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 min-h-12 h-12 rounded-2xl font-extrabold"
              onClick={() => setFormOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              className="flex-1 min-h-12 h-12 rounded-2xl font-extrabold"
              onClick={handleSubmit}
              isLoading={isCreating || isUpdating}
            >
              {editTarget ? "حفظ التعديلات" : "إضافة الموظف"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="تأكيد الحذف"
      >
        <div className="text-center py-2 space-y-4">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-lg">هل أنت متأكد من حذف هذا الموظف؟</p>
            <p className="text-muted-foreground text-sm mt-1">
              سيتم حذف <span className="text-foreground font-bold">{deleteTarget?.name}</span> نهائياً ولا يمكن التراجع.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              حذف الموظف
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
