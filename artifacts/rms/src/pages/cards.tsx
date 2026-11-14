import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  useGetCards,
  useCreateCard,
  useUpdateCard,
  useDeleteCard,
  useGetBranches,
  getGetCardsQueryKey,
  type Card,
} from "@workspace/api-client-react";
import { Button, Input, Badge, Dialog, Card as UiCard } from "@/components/ui-elements";
import { useBranch } from "@/lib/branch-context";
import {
  Plus,
  Edit,
  Trash2,
  CreditCard,
  Building2,
  StickyNote,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Check,
  QrCode,
  Wallet,
  Search,
  X,
} from "lucide-react";

const EMPTY_FORM = {
  name: "",
  openingBalance: "",
  note: "",
  isActive: true,
  branchIds: [] as number[],
};

type FormData = typeof EMPTY_FORM;

function formatMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat("en-IQ").format(Number.isFinite(n) ? n : 0)} د.ع`;
}

export default function CardsPage() {
  const queryClient = useQueryClient();
  const { selectedBranchId, canViewAllBranches } = useBranch();
  const { data: cards, isLoading } = useGetCards();
  const { data: branches } = useGetBranches();
  const { mutate: createCard, isPending: isCreating } = useCreateCard();
  const { mutate: updateCard, isPending: isUpdating } = useUpdateCard();
  const { mutate: deleteCard, isPending: isDeleting } = useDeleteCard();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [qrTarget, setQrTarget] = useState<Card | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);
  const [editTarget, setEditTarget] = useState<Card | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<"name" | "openingBalance" | "branches", string>>>({});
  const [submitError, setSubmitError] = useState("");

  const syncCards = (next: Card[]) => {
    queryClient.setQueryData<Card[]>(getGetCardsQueryKey(), next);
  };

  const activeBranches = useMemo(
    () => (branches ?? []).filter((b) => b.isActive !== false),
    [branches]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards ?? [];
    return (cards ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.branchNames ?? []).some((n) => n.toLowerCase().includes(q)) ||
        c.qrToken.toLowerCase().includes(q)
    );
  }, [cards, search]);

  const stats = useMemo(() => {
    const list = cards ?? [];
    return {
      total: list.length,
      active: list.filter((c) => c.isActive).length,
      balance: list.reduce((sum, c) => sum + Number(c.balance ?? 0), 0),
    };
  }, [cards]);

  const openAdd = () => {
    const defaultBranches =
      selectedBranchId !== "all"
        ? [selectedBranchId]
        : activeBranches.length === 1
          ? [activeBranches[0].id]
          : [];
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, branchIds: defaultBranches });
    setErrors({});
    setSubmitError("");
    setFormOpen(true);
  };

  const openEdit = (card: Card) => {
    setEditTarget(card);
    setForm({
      name: card.name,
      openingBalance: String(card.openingBalance ?? 0),
      note: card.note ?? "",
      isActive: card.isActive ?? true,
      branchIds: card.branchIds ?? [],
    });
    setErrors({});
    setSubmitError("");
    setFormOpen(true);
  };

  const toggleBranch = (id: number) => {
    setForm((prev) => {
      const exists = prev.branchIds.includes(id);
      return {
        ...prev,
        branchIds: exists ? prev.branchIds.filter((b) => b !== id) : [...prev.branchIds, id],
      };
    });
  };

  const validate = () => {
    const e: Partial<Record<"name" | "openingBalance" | "branches", string>> = {};
    const name = form.name.trim();
    if (!name) e.name = "اسم البطاقة مطلوب";
    else {
      const duplicate = (cards ?? []).some(
        (c) => c.name.trim().toLowerCase() === name.toLowerCase() && c.id !== editTarget?.id
      );
      if (duplicate) e.name = "اسم البطاقة مستخدم مسبقاً";
    }
    const opening = Number(form.openingBalance);
    if (form.openingBalance.trim() === "" || !Number.isFinite(opening) || opening < 0) {
      e.openingBalance = "أدخل رصيداً افتتاحياً صالحاً";
    }
    if (form.branchIds.length === 0) e.branches = "اختر فرعاً واحداً على الأقل";
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
      openingBalance: Number(form.openingBalance),
      note: form.note.trim() || undefined,
      isActive: form.isActive,
      branchIds: form.branchIds,
    };

    if (editTarget) {
      updateCard(
        { id: editTarget.id, data: payload },
        {
          onSuccess: (updated) => {
            syncCards((cards ?? []).map((c) => (c.id === updated.id ? updated : c)));
            setFormOpen(false);
          },
          onError: (err: any) => {
            setSubmitError(err?.data?.message || err?.message || "تعذر تحديث البطاقة");
          },
        }
      );
    } else {
      createCard(
        { data: payload },
        {
          onSuccess: (created) => {
            syncCards([created, ...(cards ?? [])]);
            setFormOpen(false);
            setQrTarget(created);
          },
          onError: (err: any) => {
            setSubmitError(err?.data?.message || err?.message || "تعذر إضافة البطاقة");
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteCard(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          syncCards((cards ?? []).filter((c) => c.id !== deleteTarget.id));
          setDeleteTarget(null);
        },
      }
    );
  };

  const showLoader = isLoading && !cards;

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 xl:p-8 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-2">
            <CreditCard className="w-3.5 h-3.5" />
            Cards Ledger
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">بطاقات الرصيد</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            أنشئ بطاقة برصيد افتتاحي ورمز QR، واربطها بفرع واحد أو عدة فروع دون تكرار الأسماء.
          </p>
        </div>
        <Button className="gap-2 self-start lg:self-auto" onClick={openAdd}>
          <Plus className="w-4 h-4" /> إضافة بطاقة
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "إجمالي البطاقات", value: stats.total, icon: CreditCard, tone: "text-primary" },
          { label: "النشطة", value: stats.active, icon: ToggleRight, tone: "text-success" },
          { label: "إجمالي الأرصدة", value: formatMoney(stats.balance), icon: Wallet, tone: "text-amber-500" },
        ].map((s) => (
          <UiCard key={s.label} className="p-4 border border-border/60 bg-card/70">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center ${s.tone}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-extrabold font-display">{s.value}</p>
              </div>
            </div>
          </UiCard>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو الفرع أو رمز QR..."
          className="pr-10"
        />
      </div>

      {showLoader ? (
        <div className="py-20 text-center text-muted-foreground">جاري تحميل البطاقات...</div>
      ) : filtered.length === 0 ? (
        <UiCard className="p-10 text-center border border-dashed border-border/70">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <CreditCard className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-lg">لا توجد بطاقات بعد</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-5">أضف أول بطاقة مع رصيد افتتاحي وQR.</p>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" /> إضافة بطاقة
          </Button>
        </UiCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((card) => (
            <UiCard
              key={card.id}
              className="group relative overflow-hidden border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04] p-0"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-primary via-amber-500 to-transparent opacity-80" />
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-lg truncate">{card.name}</h3>
                      <Badge variant={card.isActive ? "success" : "secondary"}>
                        {card.isActive ? "نشطة" : "موقوفة"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="truncate">
                        {(card.branchNames && card.branchNames.length > 0
                          ? card.branchNames.join(" · ")
                          : "بدون فروع") || "بدون فروع"}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQrTarget(card)}
                    className="w-11 h-11 rounded-xl border border-primary/25 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center flex-shrink-0"
                    title="عرض QR"
                  >
                    <QrCode className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground">رصيد افتتاحي</p>
                    <p className="font-display font-bold text-sm mt-0.5">{formatMoney(card.openingBalance)}</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5">
                    <p className="text-[11px] text-primary/80">الرصيد الحالي</p>
                    <p className="font-display font-extrabold text-sm text-primary mt-0.5">
                      {formatMoney(card.balance)}
                    </p>
                  </div>
                </div>

                {card.note ? (
                  <p className="text-xs text-muted-foreground line-clamp-2 flex gap-1.5">
                    <StickyNote className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary/70" />
                    <span>{card.note}</span>
                  </p>
                ) : null}

                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEdit(card)}>
                    <Edit className="w-3.5 h-3.5" /> تعديل
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setDeleteTarget(card)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </UiCard>
          ))}
        </div>
      )}

      <Dialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? "تعديل البطاقة" : "إضافة بطاقة جديدة"}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-transparent to-transparent p-3.5">
            <p className="text-sm font-bold">بطاقة رصيد متعددة الفروع</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              يمكن ربط البطاقة بفرع واحد أو أكثر. الاسم يجب أن يكون فريداً.
              {canViewAllBranches && selectedBranchId === "all"
                ? " أنت حالياً في وضع كل الفروع."
                : ""}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">اسم البطاقة *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="مثال: بطاقة الضيافة"
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">الرصيد الافتتاحي *</label>
            <Input
              type="number"
              min={0}
              step="1000"
              dir="ltr"
              value={form.openingBalance}
              onChange={(e) => setForm((p) => ({ ...p, openingBalance: e.target.value }))}
              placeholder="0"
            />
            {errors.openingBalance && (
              <p className="text-xs text-destructive mt-1">{errors.openingBalance}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              <Building2 className="w-4 h-4 inline me-1 text-primary" />
              الفروع المرتبطة *
            </label>
            {activeBranches.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-xl border border-dashed border-border px-3 py-3">
                لا توجد فروع — أضف فرعاً أولاً من صفحة الفروع
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeBranches.map((b) => {
                  const selected = form.branchIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBranch(b.id)}
                      className={`h-11 px-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center gap-2 text-start ${
                        selected
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background/50 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}
                      >
                        {selected && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="truncate">{b.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {errors.branches && <p className="text-xs text-destructive mt-1">{errors.branches}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">ملاحظة</label>
            <Input
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="اختياري"
            />
          </div>

          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
            className={`w-full h-12 rounded-xl border-2 px-4 flex items-center justify-between transition-colors ${
              form.isActive
                ? "border-success/40 bg-success/10 text-success"
                : "border-border bg-secondary/40 text-muted-foreground"
            }`}
          >
            <span className="font-bold text-sm">{form.isActive ? "البطاقة نشطة" : "البطاقة موقوفة"}</span>
            {form.isActive ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
          </button>

          {submitError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>
              إلغاء
            </Button>
            <Button
              className="flex-1 gap-2"
              isLoading={isCreating || isUpdating}
              onClick={handleSubmit}
            >
              {editTarget ? "حفظ التعديل" : "إنشاء البطاقة"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={Boolean(qrTarget)}
        onClose={() => setQrTarget(null)}
        title="رمز QR للبطاقة"
        maxWidth="max-w-md"
      >
        {qrTarget ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto w-fit rounded-3xl border border-border/70 bg-white p-4 shadow-xl shadow-black/10">
              <QRCodeSVG
                value={qrTarget.qrToken}
                size={220}
                level="M"
                includeMargin
                bgColor="#ffffff"
                fgColor="#111827"
              />
            </div>
            <div>
              <p className="font-extrabold text-lg">{qrTarget.name}</p>
              <p className="text-sm text-primary font-display mt-1">{formatMoney(qrTarget.balance)}</p>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => setQrTarget(null)}>
              <X className="w-4 h-4" /> إغلاق
            </Button>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="حذف البطاقة"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <p className="font-bold text-lg">حذف «{deleteTarget?.name}»؟</p>
            <p className="text-sm text-muted-foreground mt-1">لا يمكن التراجع عن هذا الإجراء.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" className="flex-1" isLoading={isDeleting} onClick={handleDelete}>
              حذف
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
