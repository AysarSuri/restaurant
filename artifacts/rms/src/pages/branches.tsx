import React, { useMemo, useRef, useState } from "react";
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
import { useBranch } from "@/lib/branch-context";
import { writeHomeBrandCache } from "@/lib/branding-cache";
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
  Upload,
  X,
  Ban,
} from "lucide-react";

const MAX_BRANCHES = 3;
const MAX_LOGO_BYTES = 2.5 * 1024 * 1024; // 2.5MB before compress

/** Compress / resize logo and return a data URL for storage */
function fileToStoredLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("الملف يجب أن يكون صورة"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      reject(new Error("حجم الصورة كبير جداً (الحد 2.5 ميجا)"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("صورة غير صالحة"));
      img.onload = () => {
        const maxSide = 512;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("تعذر معالجة الصورة"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

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
  const { selectedBranchId } = useBranch();
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
    queryClient.setQueryData<Branch[]>(["branches", "scoped"], next);
  };

  const showLoader = isLoading && !branches;

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [editTarget, setEditTarget] = useState<Branch | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoDeleteOpen, setLogoDeleteOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoPick = async (file?: File | null) => {
    if (!file) return;
    setLogoBusy(true);
    setSubmitError("");
    try {
      const dataUrl = await fileToStoredLogo(file);
      setForm((prev) => ({ ...prev, logoUrl: dataUrl }));
    } catch (err: any) {
      setSubmitError(err?.message || "تعذر رفع الصورة");
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const count = branches?.length ?? 0;
  const canAdd = count < MAX_BRANCHES;
  const activeCount = useMemo(
    () => branches?.filter((b) => b.isActive).length ?? 0,
    [branches]
  );

  const openAdd = () => {
    if (!canAdd) {
      setLimitOpen(true);
      return;
    }
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError("");
    setLogoDeleteOpen(false);
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
    setLogoDeleteOpen(false);
    setFormOpen(true);
  };

  const validate = () => {
    const e: Partial<Record<keyof FormData, string>> = {};
    const name = form.name.trim();
    if (!name) e.name = "اسم الفرع مطلوب";
    else {
      const duplicate = (branches ?? []).some(
        (b) =>
          b.name.trim().toLowerCase() === name.toLowerCase() &&
          b.id !== editTarget?.id
      );
      if (duplicate) e.name = "اسم الفرع مستخدم مسبقاً";
    }
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
            if (selectedBranchId === updated.id) {
              writeHomeBrandCache({
                branchId: updated.id,
                name: updated.name,
                logoUrl: updated.logoUrl,
              });
            }
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
          className="rounded-full h-10 gap-1.5 text-sm flex-shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          إضافة فرع
        </Button>
      </div>

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

      {/* Add / Edit dialog — wider + compact vertically */}
      <Dialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? `تعديل فرع — ${editTarget.name}` : "إضافة فرع جديد"}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-amber-500/5 px-3 py-2 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-amber-500 text-primary-foreground flex items-center justify-center shadow-sm shadow-primary/25 flex-shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">
                {editTarget ? "تحديث بيانات الفرع" : "فرع جديد"}
              </span>
              {" · "}الحد {MAX_BRANCHES} · المتبقي {Math.max(0, MAX_BRANCHES - count)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">
                اسم الفرع <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="مثال: فرع المنصور"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={`h-10 ${errors.name ? "border-destructive" : ""}`}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                <MapPin className="w-3.5 h-3.5 inline me-1 text-primary" />
                العنوان
              </label>
              <Input
                placeholder="المدينة / الشارع / أقرب نقطة"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                className="h-10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                <Phone className="w-3.5 h-3.5 inline me-1 text-primary" />
                موبايل 1 <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="07XX XXX XXXX"
                value={form.mobile1}
                onChange={(e) => set("mobile1", e.target.value)}
                dir="ltr"
                className={`h-10 ${errors.mobile1 ? "border-destructive" : ""}`}
              />
              {errors.mobile1 && (
                <p className="text-xs text-destructive mt-1">{errors.mobile1}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                <Phone className="w-3.5 h-3.5 inline me-1 text-primary" />
                موبايل 2
              </label>
              <Input
                placeholder="اختياري"
                value={form.mobile2}
                onChange={(e) => set("mobile2", e.target.value)}
                dir="ltr"
                className="h-10"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">
                <ImageIcon className="w-3.5 h-3.5 inline me-1 text-primary" />
                رسم / لوجو الفرع
              </label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleLogoPick(e.target.files?.[0])}
              />
              <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-border/70 bg-secondary/30 p-2.5">
                <div className="w-14 h-14 rounded-xl border border-border/50 bg-background overflow-hidden flex items-center justify-center flex-shrink-0">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="معاينة اللوجو"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground/60" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {form.logoUrl ? "تم اختيار الصورة" : "اختر صورة من الجهاز"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    PNG أو JPG · تُخزَّن مع الفرع تلقائياً
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {form.logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      onClick={() => setLogoDeleteOpen(true)}
                      aria-label="حذف الصورة"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    isLoading={logoBusy}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {form.logoUrl ? "تغيير" : "رفع"}
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                <StickyNote className="w-3.5 h-3.5 inline me-1 text-primary" />
                ملاحظة
              </label>
              <textarea
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                rows={2}
                placeholder="ملاحظات إدارية..."
                className="flex w-full min-h-[2.5rem] rounded-xl border-2 border-border bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all duration-200 resize-none"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/40 px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-semibold text-sm flex items-center gap-1.5">
                {form.isActive ? (
                  <ToggleRight className="w-4 h-4 text-emerald-500" />
                ) : (
                  <ToggleLeft className="w-4 h-4 text-destructive" />
                )}
                تنشيط الفرع
              </p>
              <p className="text-[11px] text-muted-foreground">
                {form.isActive ? "الفرع نشط ويعمل حالياً" : "الفرع موقوف مؤقتاً"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
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
              <Button variant="outline" size="sm" className="h-9" onClick={() => setFormOpen(false)}>
                إلغاء
              </Button>
              <Button
                size="sm"
                className="h-9"
                onClick={handleSubmit}
                isLoading={isCreating || isUpdating}
              >
                {editTarget ? "حفظ" : "إضافة الفرع"}
              </Button>
            </div>
          </div>

          {submitError && (
            <p className="text-sm font-semibold text-destructive">{submitError}</p>
          )}
        </div>
      </Dialog>

      {/* Max branches limit message */}
      <Dialog
        isOpen={limitOpen}
        onClose={() => setLimitOpen(false)}
        title="حد الفروع"
        maxWidth="max-w-md"
      >
        <div className="text-center space-y-5 py-1">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-amber-500/25 blur-xl" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Ban className="w-9 h-9" />
            </div>
          </div>
          <div>
            <p className="font-extrabold text-xl text-foreground">لا يمكن إضافة فرع جديد</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              تم الوصول للحد الأقصى{" "}
              <span className="font-bold text-foreground">{MAX_BRANCHES} فروع</span>.
              <br />
              لا يُقبل تخزين أكثر من ذلك. احذف فرعاً موجوداً إن أردت إضافة فرع جديد.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 flex items-center justify-center gap-3">
            <Store className="w-5 h-5 text-amber-600 dark:text-amber-300" />
            <span className="text-sm font-bold text-amber-800 dark:text-amber-200 font-display">
              {count} / {MAX_BRANCHES} فروع مسجّلة
            </span>
          </div>
          <Button
            className="w-full h-11 rounded-xl font-bold"
            onClick={() => setLimitOpen(false)}
          >
            حسناً
          </Button>
        </div>
      </Dialog>

      {/* Confirm remove logo */}
      <Dialog
        isOpen={logoDeleteOpen}
        onClose={() => setLogoDeleteOpen(false)}
        title="حذف الرسم"
        maxWidth="max-w-sm"
        layer="overlay"
      >
        <div className="text-center space-y-5 py-1">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-3xl bg-destructive/15 blur-xl" />
            <div className="relative w-24 h-24 rounded-3xl border border-border/60 bg-secondary/40 overflow-hidden shadow-lg">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="اللوجو" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-destructive text-white flex items-center justify-center shadow-md">
                <Trash2 className="w-4 h-4" />
              </div>
            </div>
          </div>
          <div>
            <p className="font-extrabold text-lg text-foreground">هل تريد حذف الرسم؟</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              سيتم إزالة لوجو الفرع من النموذج. يمكنك رفع صورة جديدة لاحقاً.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="outline"
              className="h-11 rounded-xl font-bold"
              onClick={() => setLogoDeleteOpen(false)}
            >
              لا
            </Button>
            <Button
              variant="destructive"
              className="h-11 rounded-xl font-bold gap-1.5"
              onClick={() => {
                set("logoUrl", "");
                setLogoDeleteOpen(false);
              }}
            >
              <Trash2 className="w-4 h-4" />
              نعم
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
