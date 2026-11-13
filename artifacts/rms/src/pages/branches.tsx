import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBranches,
  useCreateBranch,
  useUpdateBranch,
  useDeleteBranch,
  getGetBranchesQueryKey,
  type Branch,
} from "@workspace/api-client-react";
import { Button, Input, Badge, Dialog, Card } from "@/components/ui-elements";
import {
  Plus,
  Edit,
  Trash2,
  Building2,
  Phone,
  MapPin,
  ImageIcon,
  StickyNote,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Store,
} from "lucide-react";

const MAX_BRANCHES = 3;

const EMPTY_FORM = {
  name: "",
  mobile1: "",
  mobile2: "",
  address: "",
  logoUrl: "",
  isActive: true,
  note: "",
};

type FormData = typeof EMPTY_FORM;

export default function Branches() {
  const queryClient = useQueryClient();
  const { data: branches, isLoading } = useGetBranches({
    query: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnMount: false,
    },
  });
  const { mutate: createBranch, isPending: isCreating } = useCreateBranch();
  const { mutate: updateBranch, isPending: isUpdating } = useUpdateBranch();
  const { mutate: deleteBranch, isPending: isDeleting } = useDeleteBranch();

  const syncBranches = (next: Branch[]) => {
    queryClient.setQueryData<Branch[]>(getGetBranchesQueryKey(), next);
  };

  const showLoader = isLoading && !branches;

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [editTarget, setEditTarget] = useState<Branch | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitError, setSubmitError] = useState("");

  const count = branches?.length ?? 0;
  const canAdd = count < MAX_BRANCHES;
  const activeCount = useMemo(
    () => branches?.filter((b) => b.isActive).length ?? 0,
    [branches]
  );

  const openAdd = () => {
    if (!canAdd) {
      setSubmitError(`الحد الأقصى ${MAX_BRANCHES} فروع فقط`);
      return;
    }
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError("");
    setFormOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditTarget(branch);
    setForm({
      name: branch.name,
      mobile1: branch.mobile1,
      mobile2: branch.mobile2 ?? "",
      address: branch.address ?? "",
      logoUrl: branch.logoUrl ?? "",
      isActive: branch.isActive ?? true,
      note: branch.note ?? "",
    });
    setErrors({});
    setSubmitError("");
    setFormOpen(true);
  };

  const validate = () => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) e.name = "اسم الفرع مطلوب";
    if (!form.mobile1.trim()) e.mobile1 = "موبايل 1 مطلوب";
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSubmitError("");

    const payload = {
      name: form.name.trim(),
      mobile1: form.mobile1.trim(),
      mobile2: form.mobile2.trim() || undefined,
      address: form.address.trim() || undefined,
      logoUrl: form.logoUrl.trim() || undefined,
      isActive: form.isActive,
      note: form.note.trim() || undefined,
    };

    if (editTarget) {
      updateBranch(
        { id: editTarget.id, data: payload },
        {
          onSuccess: (updated) => {
            syncBranches(
              (branches ?? []).map((b) => (b.id === updated.id ? updated : b))
            );
            setFormOpen(false);
          },
          onError: (err: any) => {
            setSubmitError(err?.message || "تعذر حفظ التعديلات");
          },
        }
      );
    } else {
      if (!canAdd) {
        setSubmitError(`لا يمكن إضافة أكثر من ${MAX_BRANCHES} فروع`);
        return;
      }
      createBranch(
        { data: payload },
        {
          onSuccess: (created) => {
            syncBranches([created, ...(branches ?? [])]);
            setFormOpen(false);
          },
          onError: (err: any) => {
            setSubmitError(err?.data?.message || err?.message || "تعذر إضافة الفرع");
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteBranch(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          syncBranches((branches ?? []).filter((b) => b.id !== deleteTarget.id));
          setDeleteTarget(null);
        },
      }
    );
  };

  const set = (field: keyof FormData, val: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  return (
    <div className="h-full flex flex-col gap-5 md:gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {[
          {
            label: "إجمالي الفروع",
            value: `${count} / ${MAX_BRANCHES}`,
            icon: Building2,
            color: "text-primary",
          },
          {
            label: "فروع نشطة",
            value: activeCount,
            icon: ToggleRight,
            color: "text-emerald-500",
          },
          {
            label: "المتبقي للإضافة",
            value: Math.max(0, MAX_BRANCHES - count),
            icon: Store,
            color: "text-amber-500",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-4 flex items-center gap-3 border border-border/50">
            <div
              className={`w-11 h-11 rounded-xl bg-secondary flex items-center justify-center ${color}`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold font-display">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-primary mb-1.5">
            <Building2 className="w-4 h-4" />
            <span className="text-[11px] font-display tracking-[0.2em] uppercase">Branches</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">إدارة الفروع</h2>
          <p className="text-sm text-muted-foreground mt-1">
            يمكنك إضافة حتى {MAX_BRANCHES} فروع فقط مع بيانات الاتصال والشعار
          </p>
        </div>
        <Button
          onClick={openAdd}
          disabled={!canAdd}
          className="rounded-full h-10 gap-1.5 text-sm flex-shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          إضافة فرع
        </Button>
      </div>

      {!canAdd && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          تم الوصول للحد الأقصى ({MAX_BRANCHES} فروع). احذف فرعاً أو عدّل الموجود لإدارة البيانات.
        </div>
      )}

      {/* Cards grid */}
      {showLoader ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : count === 0 ? (
        <Card className="border border-dashed border-border/70 bg-secondary/20 py-16 text-center">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-bold text-foreground">لا توجد فروع بعد</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">أضف أول فرع للبدء</p>
          <Button onClick={openAdd} className="rounded-full">
            <Plus className="w-4 h-4 me-1.5" />
            إضافة فرع
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {branches!.map((branch) => (
            <Card
              key={branch.id}
              className="relative overflow-hidden border border-border/60 h-full flex flex-col"
            >
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/20 via-amber-500/10 to-transparent" />
              <div className="relative p-5 flex flex-col gap-4 flex-1">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-2xl border border-border/60 bg-background/80 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                    {branch.logoUrl ? (
                      <img
                        src={branch.logoUrl}
                        alt={branch.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-lg text-foreground truncate">
                        {branch.name}
                      </h3>
                      <Badge variant={branch.isActive ? "success" : "destructive"}>
                        {branch.isActive ? "نشط" : "موقوف"}
                      </Badge>
                    </div>
                    {branch.address && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary/80" />
                        {branch.address}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2">
                    <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground text-xs">موبايل 1</span>
                    <span className="ms-auto font-display font-semibold" dir="ltr">
                      {branch.mobile1}
                    </span>
                  </div>
                  {branch.mobile2 && (
                    <div className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2">
                      <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground text-xs">موبايل 2</span>
                      <span className="ms-auto font-display font-semibold" dir="ltr">
                        {branch.mobile2}
                      </span>
                    </div>
                  )}
                  {branch.note && (
                    <div className="rounded-xl border border-border/50 bg-background/40 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                        <StickyNote className="w-3.5 h-3.5" /> ملاحظة
                      </p>
                      <p className="text-sm text-foreground/90 line-clamp-3">{branch.note}</p>
                    </div>
                  )}
                </div>

                <div className="mt-auto flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1.5"
                    onClick={() => openEdit(branch)}
                  >
                    <Edit className="w-3.5 h-3.5" /> تعديل
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1.5 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(branch)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> حذف
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? `تعديل فرع — ${editTarget.name}` : "إضافة فرع جديد"}
        maxWidth="max-w-xl"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-amber-500/5 to-transparent p-4 flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-amber-500 text-primary-foreground flex items-center justify-center shadow-md shadow-primary/30 flex-shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="font-bold text-foreground">
                {editTarget ? "تحديث بيانات الفرع" : "فرع جديد"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                الحد الأقصى {MAX_BRANCHES} فروع · المتبقي {Math.max(0, MAX_BRANCHES - count)}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              اسم الفرع <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="مثال: فرع المنصور"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                <Phone className="w-4 h-4 inline me-1 text-primary" />
                موبايل 1 <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="07XX XXX XXXX"
                value={form.mobile1}
                onChange={(e) => set("mobile1", e.target.value)}
                dir="ltr"
                className={errors.mobile1 ? "border-destructive" : ""}
              />
              {errors.mobile1 && (
                <p className="text-xs text-destructive mt-1">{errors.mobile1}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                <Phone className="w-4 h-4 inline me-1 text-primary" />
                موبايل 2
              </label>
              <Input
                placeholder="اختياري"
                value={form.mobile2}
                onChange={(e) => set("mobile2", e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              <MapPin className="w-4 h-4 inline me-1 text-primary" />
              العنوان
            </label>
            <Input
              placeholder="المدينة / الشارع / أقرب نقطة"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              <ImageIcon className="w-4 h-4 inline me-1 text-primary" />
              عنوان اللوجو (رابط الصورة)
            </label>
            <Input
              placeholder="https://..."
              value={form.logoUrl}
              onChange={(e) => set("logoUrl", e.target.value)}
              dir="ltr"
            />
            {form.logoUrl.trim() && (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 p-2">
                <img
                  src={form.logoUrl}
                  alt="معاينة اللوجو"
                  className="w-12 h-12 rounded-lg object-cover bg-background"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "";
                    (e.currentTarget as HTMLImageElement).alt = "رابط غير صالح";
                  }}
                />
                <p className="text-xs text-muted-foreground truncate" dir="ltr">
                  {form.logoUrl}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              <StickyNote className="w-4 h-4 inline me-1 text-primary" />
              ملاحظة
            </label>
            <textarea
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              rows={3}
              placeholder="ملاحظات إدارية عن الفرع..."
              className="flex w-full rounded-xl border-2 border-border bg-background/50 px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all duration-200 resize-none"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl border border-border/50">
            <div>
              <p className="font-semibold text-sm flex items-center gap-1.5">
                {form.isActive ? (
                  <ToggleRight className="w-4 h-4 text-emerald-500" />
                ) : (
                  <ToggleLeft className="w-4 h-4 text-destructive" />
                )}
                تنشيط الفرع
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {form.isActive ? "الفرع نشط ويعمل حالياً" : "الفرع موقوف مؤقتاً"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => set("isActive", !form.isActive)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                form.isActive ? "bg-emerald-500" : "bg-destructive/60"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  form.isActive ? "translate-x-1" : "translate-x-8"
                }`}
              />
            </button>
          </div>

          {submitError && (
            <p className="text-sm font-semibold text-destructive">{submitError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>
              إلغاء
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              isLoading={isCreating || isUpdating}
            >
              {editTarget ? "حفظ التعديلات" : "إضافة الفرع"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete confirm */}
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
            <p className="font-semibold text-lg">حذف هذا الفرع؟</p>
            <p className="text-muted-foreground text-sm mt-1">
              سيتم حذف{" "}
              <span className="text-foreground font-bold">{deleteTarget?.name}</span> نهائياً.
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
              حذف الفرع
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
