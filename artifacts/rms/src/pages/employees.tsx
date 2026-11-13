import React, { useState } from "react";
import {
  useGetEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
} from "@workspace/api-client-react";
import { Button, Input, Badge, Dialog } from "@/components/ui-elements";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, Card,
} from "@/components/ui-elements";
import {
  Plus, Search, Edit, Trash2, Users,
  Phone, Mail, Briefcase, CalendarDays, BadgeDollarSign,
  ToggleLeft, ToggleRight, AlertTriangle,
} from "lucide-react";
import type { Employee } from "@workspace/api-client-react";

const ROLES: { value: string; label: string; color: string }[] = [
  { value: "admin",   label: "مدير النظام",   color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "manager", label: "مدير",           color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "cashier", label: "كاشير",          color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { value: "waiter",  label: "نادل",           color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "kitchen", label: "مطبخ",           color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "driver",  label: "سائق توصيل",     color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
];

const roleInfo = (value: string) =>
  ROLES.find((r) => r.value === value) ?? { label: value, color: "bg-secondary text-foreground border-border" };

const formatIQD = (val?: number | string | null) =>
  val ? new Intl.NumberFormat("en-IQ").format(Number(val)) + " د.ع" : "—";

const EMPTY_FORM = {
  name: "",
  role: "cashier",
  phone: "",
  email: "",
  salary: "",
  hireDate: new Date().toISOString().slice(0, 10),
  isActive: true,
};

type FormData = typeof EMPTY_FORM;

export default function Employees() {
  const { data: employees, isLoading, refetch } = useGetEmployees();
  const { mutate: createEmployee, isPending: isCreating } = useCreateEmployee();
  const { mutate: updateEmployee, isPending: isUpdating } = useUpdateEmployee();
  const { mutate: deleteEmployee, isPending: isDeleting } = useDeleteEmployee();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const filtered = employees?.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase()) ||
    e.phone?.includes(search)
  ) ?? [];

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    setForm({
      name: emp.name,
      role: emp.role,
      phone: emp.phone ?? "",
      email: emp.email ?? "",
      salary: emp.salary ? String(emp.salary) : "",
      hireDate: emp.hireDate ? String(emp.hireDate).slice(0, 10) : "",
      isActive: emp.isActive ?? true,
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = "الاسم مطلوب";
    if (!form.role) e.role = "المنصب مطلوب";
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const payload = {
      name: form.name.trim(),
      role: form.role as any,
      phone: form.phone || undefined,
      email: form.email || undefined,
      salary: form.salary ? Number(form.salary) : undefined,
      hireDate: form.hireDate || undefined,
      isActive: form.isActive,
    };

    if (editTarget) {
      updateEmployee(
        { id: editTarget.id, data: payload },
        { onSuccess: () => { setFormOpen(false); refetch(); } }
      );
    } else {
      createEmployee(
        { data: payload },
        { onSuccess: () => { setFormOpen(false); refetch(); } }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteEmployee(
      { id: deleteTarget.id },
      { onSuccess: () => { setDeleteTarget(null); refetch(); } }
    );
  };

  const set = (field: keyof FormData, val: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  return (
    <div className="h-full flex flex-col gap-4 md:gap-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الموظفين", value: employees?.length ?? 0, icon: Users, color: "text-primary" },
          { label: "نشطون", value: employees?.filter(e => e.isActive).length ?? 0, icon: ToggleRight, color: "text-green-400" },
          { label: "موقوفون", value: employees?.filter(e => !e.isActive).length ?? 0, icon: ToggleLeft, color: "text-red-400" },
          {
            label: "إجمالي الرواتب",
            value: formatIQD(employees?.reduce((s, e) => s + Number(e.salary ?? 0), 0)),
            icon: BadgeDollarSign,
            color: "text-amber-400",
          },
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
                  <div><span className="text-muted-foreground text-xs">الراتب: </span><span className="text-green-400 font-bold">{formatIQD(emp.salary)}</span></div>
                  <div><span className="text-muted-foreground text-xs">التعيين: </span>{emp.hireDate ? new Date(emp.hireDate).toLocaleDateString("ar-IQ") : "—"}</div>
                  <div className="truncate"><span className="text-muted-foreground text-xs">البريد: </span><span dir="ltr" className="text-xs">{emp.email || "—"}</span></div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={() => openEdit(emp)}>
                    <Edit className="w-3.5 h-3.5" /> تعديل
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(emp)}>
                    <Trash2 className="w-3.5 h-3.5" /> حذف
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
                <TableHead className="text-primary font-bold">الهاتف</TableHead>
                <TableHead className="text-primary font-bold">البريد الإلكتروني</TableHead>
                <TableHead className="text-primary font-bold">الراتب</TableHead>
                <TableHead className="text-primary font-bold">تاريخ التعيين</TableHead>
                <TableHead className="text-primary font-bold">الحالة</TableHead>
                <TableHead className="text-end text-primary font-bold">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
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
                        <span className="font-display text-sm text-muted-foreground" dir="ltr">
                          {emp.phone || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground" dir="ltr">
                          {emp.email || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-display font-semibold text-green-400">
                          {formatIQD(emp.salary)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground font-display">
                          {emp.hireDate ? new Date(emp.hireDate).toLocaleDateString("ar-IQ") : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.isActive ? "success" : "destructive"}>
                          {emp.isActive ? "نشط" : "موقوف"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(emp)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(emp)}
                          >
                            <Trash2 className="w-4 h-4" />
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
        title={editTarget ? `تعديل موظف — ${editTarget.name}` : "إضافة موظف جديد"}
      >
        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              <Users className="w-4 h-4 inline me-1 text-primary" />
              اسم الموظف <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="أدخل اسم الموظف"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              <Briefcase className="w-4 h-4 inline me-1 text-primary" />
              المنصب / الدور <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => set("role", r.value)}
                  className={`py-2 px-3 rounded-xl border text-sm font-semibold transition-all ${
                    form.role === r.value
                      ? `${r.color} border-current`
                      : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                <Phone className="w-4 h-4 inline me-1 text-primary" />
                رقم الهاتف
              </label>
              <Input
                placeholder="07XX-XXX-XXXX"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                <Mail className="w-4 h-4 inline me-1 text-primary" />
                البريد الإلكتروني
              </label>
              <Input
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          {/* Salary + Hire Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                <BadgeDollarSign className="w-4 h-4 inline me-1 text-primary" />
                الراتب (د.ع)
              </label>
              <Input
                type="number"
                placeholder="0"
                value={form.salary}
                onChange={(e) => set("salary", e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                <CalendarDays className="w-4 h-4 inline me-1 text-primary" />
                تاريخ التعيين
              </label>
              <Input
                type="date"
                value={form.hireDate}
                onChange={(e) => set("hireDate", e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl border border-border/50">
            <div>
              <p className="font-semibold text-sm">حالة الموظف</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {form.isActive ? "الموظف نشط ويمكنه تسجيل الدخول" : "الموظف موقوف ولا يستطيع الوصول للنظام"}
              </p>
            </div>
            <button
              onClick={() => set("isActive", !form.isActive)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                form.isActive ? "bg-green-500" : "bg-destructive/60"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  form.isActive ? "translate-x-1" : "translate-x-8"
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setFormOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              className="flex-1"
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
