import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSupplierReturns,
  useCreateSupplierReturn,
  useUpdateSupplierReturn,
  useDeleteSupplierReturn,
  useGetBranches,
  useGetCards,
  getGetSupplierReturnsQueryKey,
  type SupplierReturn,
  type SupplierUnitKind,
  type SupplierPaymentMethod,
  type MenuItem,
  type Supplier,
} from "@workspace/api-client-react";
import { Button, Input, Card } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { YmdDateInput } from "@/components/ymd-date-input";
import { printSupplierPurchaseThermal } from "@/lib/print-receipt";
import { useI18n } from "@/i18n";
import {
  Building2,
  CreditCard,
  Hash,
  Package,
  Pencil,
  Plus,
  Printer,
  Scale,
  StickyNote,
  Trash2,
  Truck,
  Undo2,
  Wallet,
  X,
} from "lucide-react";

type Props = {
  suppliers: Supplier[] | undefined;
  menuItems: MenuItem[] | undefined;
  restaurantName: string;
  restaurantLogoUrl: string;
  restaurantMobile: string;
  onInvalidate: () => void;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IQ", { maximumFractionDigits: 2 }).format(n);

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function nowTime(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

type ReturnLine = {
  key: string;
  menuItemId: string;
  qty: number | "";
  unitKind: SupplierUnitKind;
  price: number | "";
};

const EMPTY_LINE = (): ReturnLine => ({
  key: crypto.randomUUID(),
  menuItemId: "",
  qty: "",
  unitKind: "major",
  price: "",
});

function nextInvoiceNo(list: SupplierReturn[] | undefined): string {
  let max = 0;
  for (const p of list ?? []) {
    const match = String(p.invoiceNo ?? "").trim().match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

function apiErrorMessage(error: unknown, fallback: string) {
  const e = error as { data?: { message?: string }; message?: string } | null;
  const fromData = e?.data?.message?.trim();
  if (fromData) return fromData;
  const raw = e?.message?.trim() || "";
  const stripped = raw.replace(/^HTTP\s+\d+\s+[^:]*:\s*/i, "").trim();
  return stripped || fallback;
}

export function SupplierReturnsPanel({
  suppliers,
  menuItems,
  restaurantName,
  restaurantLogoUrl,
  restaurantMobile,
  onInvalidate,
}: Props) {
  const { formatDate } = useI18n();
  const queryClient = useQueryClient();
  const { data: returns, isLoading: loadingReturns } = useGetSupplierReturns();
  const { data: branches } = useGetBranches();
  const { data: cards } = useGetCards();
  const { mutate: createReturn, isPending: creatingReturn } = useCreateSupplierReturn();
  const { mutate: updateReturn, isPending: updatingReturn } = useUpdateSupplierReturn();
  const { mutate: deleteReturn } = useDeleteSupplierReturn();

  const [form, setForm] = useState({
    invoiceNo: "",
    invoiceDate: todayDate(),
    invoiceTime: nowTime(),
    supplierId: "",
    notes: "",
    paidAmount: 0,
    discountAmount: 0,
    branchId: "",
    paymentMethod: "cash" as SupplierPaymentMethod,
    cardId: "",
  });
  const [lines, setLines] = useState<ReturnLine[]>([EMPTY_LINE()]);
  const [formError, setFormError] = useState("");
  const [editingReturnId, setEditingReturnId] = useState<number | null>(null);
  const [listSupplierId, setListSupplierId] = useState("");
  const [listFromDate, setListFromDate] = useState(todayDate);
  const [listToDate, setListToDate] = useState(todayDate);
  const [listInvoiceNo, setListInvoiceNo] = useState("");

  useEffect(() => {
    if (editingReturnId != null) return;
    setForm((f) => ({
      ...f,
      invoiceNo: nextInvoiceNo(returns),
    }));
  }, [returns, editingReturnId]);

  useEffect(() => {
    if (editingReturnId != null) return;
    const tick = () => {
      const clock = nowTime();
      setForm((f) => (f.invoiceTime === clock ? f : { ...f, invoiceTime: clock }));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [editingReturnId]);

  const supplierOptions = useMemo<ComboboxOption[]>(
    () =>
      (suppliers ?? []).map((s) => ({
        value: String(s.id),
        label: s.name,
        subtitle: `كود ${s.code}`,
        icon: Truck,
      })),
    [suppliers]
  );

  const branchOptions = useMemo<ComboboxOption[]>(
    () =>
      (branches ?? []).map((b) => ({
        value: String(b.id),
        label: b.name,
        icon: Building2,
      })),
    [branches]
  );

  const branchCardOptions = useMemo<ComboboxOption[]>(() => {
    const branchId = Number(form.branchId) || 0;
    return (cards ?? [])
      .filter((c) => c.isActive !== false)
      .filter((c) => (branchId ? (c.branchIds ?? []).includes(branchId) : false))
      .map((c) => ({
        value: String(c.id),
        label: c.name,
        subtitle: fmtMoney(Number(c.balance) || 0),
        icon: CreditCard,
      }));
  }, [cards, form.branchId]);

  const supplierNameSearchOptions = useMemo<ComboboxOption[]>(
    () => [
      {
        value: "",
        label: "كل الموردين",
        subtitle: "عرض بدون فلتر",
        icon: Truck,
      },
      ...supplierOptions,
    ],
    [supplierOptions]
  );

  const filteredReturns = useMemo(() => {
    const list = returns ?? [];
    const invoiceQ = listInvoiceNo.trim().toLowerCase();
    const from = listFromDate.trim();
    const to = listToDate.trim();
    return list.filter((p) => {
      if (listSupplierId && String(p.supplierId) !== listSupplierId) return false;
      if (invoiceQ && !String(p.invoiceNo ?? "").toLowerCase().includes(invoiceQ)) return false;
      const d = String(p.invoiceDate ?? "");
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [returns, listSupplierId, listFromDate, listToDate, listInvoiceNo]);

  const menuOptions = useMemo<ComboboxOption[]>(
    () =>
      (menuItems ?? [])
        .filter((m) => m.cost != null && m.cost !== "" && Number(m.cost) > 0)
        .map((m) => ({
          value: String(m.id),
          label: m.nameAr,
          subtitle: m.name,
          icon: Package,
        })),
    [menuItems]
  );

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    for (const line of lines) {
      const qty = Number(line.qty) || 0;
      const price = Number(line.price) || 0;
      totalQty += qty;
      totalAmount += qty * price;
    }
    const discountAmount = Math.max(0, Number(form.discountAmount) || 0);
    const paidAmount = Math.max(0, Number(form.paidAmount) || 0);
    const remainingAmount = Math.max(
      0,
      Number((totalAmount - discountAmount - paidAmount).toFixed(2))
    );
    return { totalQty, totalAmount, discountAmount, paidAmount, remainingAmount };
  }, [lines, form.discountAmount, form.paidAmount]);

  const findMenu = (id: string): MenuItem | undefined =>
    (menuItems ?? []).find((m) => String(m.id) === id);

  const unitOptionsFor = (menuItemId: string): ComboboxOption[] => {
    const item = findMenu(menuItemId);
    const minor = item?.minorUnit?.trim() || "عدد";
    const major = item?.majorUnit?.trim();
    const opts: ComboboxOption[] = [
      { value: "minor", label: minor, subtitle: "الوحدة الصغرى", icon: Scale },
    ];
    if (major) {
      opts.unshift({
        value: "major",
        label: major,
        subtitle: item?.subunitQty ? `${item.subunitQty} × ${minor}` : "الوحدة الكبرى",
        icon: Scale,
      });
    }
    return opts;
  };

  const invalidateReturns = () => {
    void queryClient.invalidateQueries({ queryKey: getGetSupplierReturnsQueryKey() });
    onInvalidate();
  };

  const resetForm = () => {
    setEditingReturnId(null);
    setFormError("");
    setLines([EMPTY_LINE()]);
    setForm({
      invoiceNo: nextInvoiceNo(returns),
      invoiceDate: todayDate(),
      invoiceTime: nowTime(),
      supplierId: "",
      notes: "",
      paidAmount: 0,
      discountAmount: 0,
      branchId: "",
      paymentMethod: "cash",
      cardId: "",
    });
  };

  const openEditReturn = (p: SupplierReturn) => {
    setEditingReturnId(p.id);
    setFormError("");
    setForm({
      invoiceNo: p.invoiceNo,
      invoiceDate: p.invoiceDate,
      invoiceTime: p.invoiceTime || nowTime(),
      supplierId: String(p.supplierId),
      notes: p.notes || "",
      paidAmount: Number(p.paidAmount) || 0,
      discountAmount: Number(p.discountAmount) || 0,
      branchId: p.branchId ? String(p.branchId) : "",
      paymentMethod: p.paymentMethod === "card" ? "card" : "cash",
      cardId: p.cardId ? String(p.cardId) : "",
    });
    setLines(
      p.items.length > 0
        ? p.items.map((it) => ({
            key: crypto.randomUUID(),
            menuItemId: String(it.menuItemId),
            qty: Number(it.qty) || "",
            unitKind: (it.unitKind as SupplierUnitKind) || "major",
            price: Number(it.price) || "",
          }))
        : [EMPTY_LINE()]
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveReturn = () => {
    if (!form.supplierId) return setFormError("اختر المورد");
    if (!form.branchId) return setFormError("اختر الفرع");
    if (form.paymentMethod === "card" && !form.cardId) {
      return setFormError("اختر البطاقة");
    }
    const invoiceNo =
      editingReturnId != null ? form.invoiceNo : nextInvoiceNo(returns);
    const items = lines
      .filter((l) => l.menuItemId)
      .map((l) => ({
        menuItemId: Number(l.menuItemId),
        qty: Number(l.qty) || 0,
        unitKind: l.unitKind,
        price: Number(l.price) || 0,
      }));
    if (items.length === 0) return setFormError("أضف صنفاً واحداً على الأقل");
    if (items.some((i) => !(i.qty > 0))) return setFormError("تحقق من الكميات");
    setFormError("");
    if (totals.discountAmount + totals.paidAmount > totals.totalAmount + 0.001) {
      return setFormError("مجموع الواصل والخصم لا يمكن أن يتجاوز مجموع الفاتورة");
    }
    const body = {
      invoiceNo,
      invoiceDate: form.invoiceDate,
      invoiceTime: form.invoiceTime,
      supplierId: Number(form.supplierId),
      notes: form.notes.trim(),
      paidAmount: totals.paidAmount,
      discountAmount: totals.discountAmount,
      branchId: Number(form.branchId) || null,
      paymentMethod: form.paymentMethod,
      cardId: form.paymentMethod === "card" ? Number(form.cardId) || null : null,
      items,
    };
    if (editingReturnId != null) {
      updateReturn(
        { id: editingReturnId, data: body },
        {
          onSuccess: () => {
            resetForm();
            invalidateReturns();
          },
          onError: (e) => setFormError(apiErrorMessage(e, "تعذر تعديل فاتورة المرجوع")),
        }
      );
      return;
    }
    createReturn(body, {
      onSuccess: () => {
        resetForm();
        invalidateReturns();
      },
      onError: (e) => setFormError(apiErrorMessage(e, "تعذر حفظ فاتورة المرجوع")),
    });
  };

  const printReturnReport = (p: SupplierReturn) => {
    const supplier = (suppliers ?? []).find((s) => s.id === p.supplierId);
    const currentBalance = Number(supplier?.balance) || 0;
    const remaining = Number(p.remainingAmount) || 0;
    const oldBalance = Number((currentBalance + remaining).toFixed(2));
    const newBalance = currentBalance;
    printSupplierPurchaseThermal({
      docTitle: "فاتورة مرجوع إلى المورد",
      paidLabel: "مبلغ واصل",
      restaurantName: restaurantName || "المطعم",
      logoUrl: restaurantLogoUrl || null,
      mobile: restaurantMobile || null,
      invoiceNo: p.invoiceNo,
      invoiceDate: p.invoiceDate,
      invoiceTime: p.invoiceTime,
      supplierName: p.supplierName || supplier?.name || "—",
      notes: p.notes,
      items: (p.items ?? []).map((it) => ({
        name: it.itemNameAr || it.itemName || `صنف #${it.menuItemId}`,
        qty: Number(it.qty) || 0,
        unitLabel: it.unitLabel || "",
        price: Number(it.price) || 0,
        amount: Number(it.amount) || 0,
      })),
      totalQty: Number(p.totalQty) || 0,
      totalAmount: Number(p.totalAmount) || 0,
      paidAmount: Number(p.paidAmount) || 0,
      discountAmount: Number(p.discountAmount) || 0,
      remainingAmount: remaining,
      oldBalance,
      newBalance,
      formatMoney: fmtMoney,
    });
  };

  return (
    <div className="space-y-3">
      <Card className="px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-destructive/35 bg-gradient-to-l from-destructive/10 via-card to-card space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base sm:text-lg font-extrabold leading-none flex items-center gap-2 text-destructive">
            <Undo2 className="w-5 h-5 text-destructive shrink-0" aria-hidden />
            {editingReturnId != null ? "تعديل فاتورة مرجوع" : "مرجوع إلى المورد"}
          </h2>
          {editingReturnId != null ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full h-10 px-3 text-[14px] font-bold touch-manipulation border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={resetForm}
            >
              <X className="w-4 h-4 me-1" /> إلغاء التعديل
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.65fr)_minmax(0,0.7fr)] gap-x-2 gap-y-1 items-end">
          <div className="col-span-2 lg:col-span-1 min-w-0">
            <ModernCombobox
              value={form.supplierId}
              onChange={(v) => setForm((f) => ({ ...f, supplierId: v }))}
              options={supplierOptions}
              label="المورد *"
              placeholder="اختر المورد"
              icon={Truck}
              searchable
              searchPlaceholder="ابحث باسم أو كود المورد..."
              emptyText="لا يوجد مورد مطابق"
              size="sm"
              labelClassName="text-[14px] font-bold text-foreground !mb-0"
              valueClassName="text-[14px] font-bold"
              className="[&>div:first-child]:mb-0.5"
            />
          </div>
          <div className="min-w-0">
            <ModernCombobox
              value={form.branchId}
              onChange={(branchId) =>
                setForm((f) => ({
                  ...f,
                  branchId,
                  cardId: "",
                }))
              }
              options={branchOptions}
              label="الفرع *"
              placeholder="اختر الفرع"
              icon={Building2}
              searchable
              searchPlaceholder="ابحث عن الفرع..."
              emptyText="لا يوجد فرع"
              size="sm"
              labelClassName="text-[14px] font-bold text-foreground !mb-0"
              valueClassName="text-[14px] font-bold"
              className="[&>div:first-child]:mb-0.5"
            />
          </div>
          <div className="min-w-0">
            <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
              التاريخ *
            </label>
            <YmdDateInput
              className="h-10 text-[14px] font-bold"
              value={form.invoiceDate}
              onChange={(invoiceDate) => setForm((f) => ({ ...f, invoiceDate }))}
            />
          </div>
          <div className="min-w-0">
            <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
              الساعة
            </label>
            <Input
              className="h-10 text-[14px] font-bold bg-secondary/50 text-muted-foreground cursor-not-allowed font-mono tracking-wide"
              dir="ltr"
              value={form.invoiceTime}
              readOnly
              disabled
            />
          </div>
          <div className="min-w-0 col-span-2 lg:col-span-1">
            <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
              رقم الفاتورة
            </label>
            <div className="relative">
              <Hash className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="h-10 ps-8 text-[14px] font-bold bg-secondary/50 text-muted-foreground cursor-not-allowed"
                value={form.invoiceNo || nextInvoiceNo(returns)}
                readOnly
                disabled
                dir="ltr"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
            ملاحظة
          </label>
          <div className="relative">
            <StickyNote className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="h-10 ps-8 text-[14px] font-bold"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="اختياري"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-destructive/30 bg-gradient-to-l from-destructive/10 via-transparent to-rose-500/5 px-2.5 py-2 sm:px-3 sm:py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold text-destructive">أصناف المرجوع</h3>
            <Button
              type="button"
              variant="outline"
              className="rounded-full h-11 px-4 text-[15px] font-bold touch-manipulation border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setLines((rows) => [...rows, EMPTY_LINE()])}
            >
              <Plus className="w-4 h-4 me-1" /> سطر صنف
            </Button>
          </div>

          <div className="rounded-xl border border-border/50 bg-background/90 overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,1.7fr)_minmax(4.75rem,0.7fr)_minmax(0,1fr)_minmax(4.75rem,0.7fr)_minmax(4.75rem,0.7fr)_2.75rem] gap-1.5 px-2.5 pt-1.5 pb-1 text-[13px] xl:text-[14px] font-bold text-muted-foreground">
              <div>الصنف *</div>
              <div>كمية *</div>
              <div>الوحدة *</div>
              <div>سعر *</div>
              <div>مبلغ</div>
              <div />
            </div>

            <div className="divide-y divide-border/25">
              {lines.map((line, idx) => {
                const amount = (Number(line.qty) || 0) * (Number(line.price) || 0);
                return (
                  <div
                    key={line.key}
                    className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-[minmax(0,1.7fr)_minmax(4.75rem,0.7fr)_minmax(0,1fr)_minmax(4.75rem,0.7fr)_minmax(4.75rem,0.7fr)_2.75rem] gap-1.5 px-2.5 py-1.5 items-end"
                  >
                    <div className="col-span-2 sm:col-span-4 md:col-span-1 min-w-0 order-1">
                      <span className="md:hidden text-[13px] font-bold mb-0.5 block text-muted-foreground">
                        الصنف *
                      </span>
                      <ModernCombobox
                        value={line.menuItemId}
                        onChange={(v) => {
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx
                                ? {
                                    ...r,
                                    menuItemId: v,
                                    unitKind: findMenu(v)?.majorUnit?.trim() ? "major" : "minor",
                                  }
                                : r
                            )
                          );
                          if (!v) return;
                          const qtyId = `return-qty-${line.key}`;
                          window.setTimeout(() => {
                            const qtyEl = document.getElementById(qtyId) as HTMLInputElement | null;
                            if (!qtyEl) return;
                            qtyEl.focus();
                            try {
                              qtyEl.select();
                            } catch {
                              /* ignore */
                            }
                          }, 0);
                        }}
                        options={menuOptions}
                        placeholder="اختر الصنف"
                        emptyText="لا توجد أصناف من نوع تكلفة"
                        icon={Package}
                        valueClassName="text-[15px] font-bold"
                      />
                    </div>

                    <div className="min-w-0 order-2">
                      <span className="md:hidden text-[13px] font-bold mb-0.5 block text-muted-foreground">
                        كمية *
                      </span>
                      <Input
                        id={`return-qty-${line.key}`}
                        type="number"
                        min={0}
                        step="0.001"
                        className="h-12 w-full text-[15px] font-bold"
                        dir="ltr"
                        value={line.qty}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx
                                ? {
                                    ...r,
                                    qty: e.target.value === "" ? "" : Number(e.target.value),
                                  }
                                : r
                            )
                          )
                        }
                      />
                    </div>

                    <div className="min-w-0 order-3">
                      <span className="md:hidden text-[13px] font-bold mb-0.5 block text-muted-foreground">
                        الوحدة *
                      </span>
                      <ModernCombobox
                        value={line.unitKind}
                        onChange={(v) =>
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx
                                ? { ...r, unitKind: (v as SupplierUnitKind) || "major" }
                                : r
                            )
                          )
                        }
                        options={unitOptionsFor(line.menuItemId)}
                        placeholder="وحدة"
                        icon={Scale}
                        searchable={false}
                        valueClassName="text-[15px] font-bold"
                        className="w-full min-w-0"
                      />
                    </div>

                    <div className="min-w-0 order-4">
                      <span className="md:hidden text-[13px] font-bold mb-0.5 block text-muted-foreground">
                        سعر *
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="h-12 w-full text-[15px] font-bold"
                        dir="ltr"
                        value={line.price}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx
                                ? {
                                    ...r,
                                    price:
                                      e.target.value === "" ? "" : Number(e.target.value),
                                  }
                                : r
                            )
                          )
                        }
                      />
                    </div>

                    <div className="min-w-0 order-5">
                      <span className="md:hidden text-[13px] font-bold mb-0.5 block text-muted-foreground">
                        مبلغ
                      </span>
                      <div
                        className="h-12 w-full rounded-xl border border-border/60 bg-secondary/40 px-2 flex items-center text-[15px] font-bold"
                        dir="ltr"
                      >
                        {fmtMoney(amount)}
                      </div>
                    </div>

                    <div className="flex items-center justify-end order-6 col-span-2 sm:col-span-1 md:col-span-1 md:justify-center self-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-destructive touch-manipulation"
                        disabled={lines.length <= 1}
                        onClick={() => setLines((rows) => rows.filter((_, i) => i !== idx))}
                        aria-label="حذف السطر"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border/40 pt-2 space-y-2">
            <div className="grid grid-cols-2 gap-1.5 text-[14px] sm:text-[15px] font-bold">
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 flex items-center justify-between gap-2">
                <span className="text-muted-foreground">مجموع كمية</span>
                <span className="text-destructive" dir="ltr">
                  {fmtMoney(totals.totalQty)}
                </span>
              </div>
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 flex items-center justify-between gap-2">
                <span className="text-muted-foreground">مجموع المبلغ</span>
                <span className="text-destructive" dir="ltr">
                  {fmtMoney(totals.totalAmount)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[15px] font-bold text-foreground mb-1 block">
                  مبلغ واصل
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-12 text-[15px] font-bold"
                  dir="ltr"
                  value={form.paidAmount}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      paidAmount: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-[15px] font-bold text-foreground mb-1 block">خصم</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-12 text-[15px] font-bold"
                  dir="ltr"
                  value={form.discountAmount}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discountAmount: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-[15px] font-bold text-foreground mb-1 block">
                  باقي قائمة
                </label>
                <div
                  className="h-12 rounded-xl border border-destructive/40 bg-destructive/10 px-3 flex items-center text-[15px] font-bold text-destructive"
                  dir="ltr"
                >
                  {fmtMoney(totals.remainingAmount)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl border border-border/60 bg-secondary/40">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, paymentMethod: "cash", cardId: "" }))
                  }
                  className={`h-12 rounded-xl flex items-center justify-center gap-2 font-extrabold text-[14px] touch-manipulation transition-all ${
                    form.paymentMethod === "cash"
                      ? "bg-gradient-to-l from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  بدون بطاقة
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, paymentMethod: "card" }))}
                  className={`h-12 rounded-xl flex items-center justify-center gap-2 font-extrabold text-[14px] touch-manipulation transition-all ${
                    form.paymentMethod === "card"
                      ? "bg-gradient-to-l from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  بطاقة
                </button>
              </div>
              {form.paymentMethod === "card" ? (
                <ModernCombobox
                  value={form.cardId}
                  onChange={(cardId) => setForm((f) => ({ ...f, cardId }))}
                  options={branchCardOptions}
                  label="البطاقة *"
                  placeholder={
                    form.branchId ? "اختر البطاقة حسب الفرع" : "اختر الفرع أولاً"
                  }
                  icon={CreditCard}
                  searchable
                  searchPlaceholder="ابحث عن البطاقة..."
                  emptyText={
                    form.branchId
                      ? "لا توجد بطاقة لهذا الفرع"
                      : "اختر الفرع أولاً لعرض البطاقات"
                  }
                  size="sm"
                  labelClassName="text-[14px] font-bold text-foreground !mb-0"
                  valueClassName="text-[14px] font-bold"
                  className="[&>div:first-child]:mb-0.5"
                />
              ) : null}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-0.5">
              {formError ? (
                <p className="text-[14px] font-bold text-destructive sm:me-auto">{formError}</p>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                className="rounded-full h-12 px-6 text-[15px] font-bold w-full sm:w-auto touch-manipulation"
                disabled={creatingReturn || updatingReturn}
                onClick={saveReturn}
              >
                {editingReturnId != null ? "حفظ التعديلات" : "حفظ فاتورة المرجوع"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="px-3 py-2.5 sm:px-4 sm:py-3 border-2 border-destructive/30 bg-gradient-to-l from-destructive/5 via-card to-card space-y-2 overflow-hidden">
        <h3 className="text-[15px] font-extrabold text-destructive">فواتير المرجوع</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <div className="min-w-0">
            <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
              من تاريخ
            </label>
            <YmdDateInput
              className="h-11 text-[14px] font-bold"
              value={listFromDate}
              onChange={setListFromDate}
            />
          </div>
          <div className="min-w-0">
            <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
              إلى تاريخ
            </label>
            <YmdDateInput
              className="h-11 text-[14px] font-bold"
              value={listToDate}
              onChange={setListToDate}
            />
          </div>
          <div className="min-w-0">
            <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
              رقم الفاتورة
            </label>
            <div className="relative">
              <Hash className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="h-11 ps-8 text-[14px] font-bold"
                dir="ltr"
                value={listInvoiceNo}
                onChange={(e) => setListInvoiceNo(e.target.value)}
                placeholder="بحث برقم الفاتورة"
              />
            </div>
          </div>
          <div className="min-w-0 col-span-2 lg:col-span-1">
            <ModernCombobox
              value={listSupplierId}
              onChange={setListSupplierId}
              options={supplierNameSearchOptions}
              label="المورد"
              placeholder="كل الموردين"
              icon={Truck}
              searchable
              size="sm"
              searchPlaceholder="ابحث عن مورد..."
              emptyText="لا يوجد مورد مطابق"
              labelClassName="text-[14px] font-bold text-foreground"
              valueClassName="text-[14px] font-bold"
              className="[&>div:first-child]:mb-0.5"
            />
          </div>
        </div>
        {loadingReturns ? (
          <div className="py-6 flex justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (returns ?? []).length === 0 ? (
          <p className="text-[14px] font-bold text-muted-foreground text-center py-5">
            لا توجد فواتير بعد
          </p>
        ) : filteredReturns.length === 0 ? (
          <p className="text-[14px] font-bold text-muted-foreground text-center py-5">
            لا توجد فواتير مطابقة للبحث
          </p>
        ) : (
          <>
            <div className="hidden md:block overflow-auto rounded-xl border border-border/40">
              <table className="w-full text-[14px] xl:text-[15px]">
                <thead className="bg-destructive/10 text-destructive">
                  <tr>
                    <th className="text-center p-2.5 font-bold">رقم الفاتورة</th>
                    <th className="text-center p-2.5 font-bold">التاريخ</th>
                    <th className="text-center p-2.5 font-bold">اسم المورد</th>
                    <th className="text-center p-2.5 font-bold">مجموع مبلغ</th>
                    <th className="text-center p-2.5 font-bold">مبلغ واصل</th>
                    <th className="text-center p-2.5 font-bold">خصم</th>
                    <th className="text-center p-2.5 font-bold">باقي قائمة</th>
                    <th className="text-center p-2.5 font-bold">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-t border-destructive/15 ${
                        editingReturnId === p.id ? "bg-destructive/10" : ""
                      }`}
                    >
                      <td className="p-2.5 text-center font-mono font-bold">{p.invoiceNo}</td>
                      <td className="p-2.5 text-center font-bold tabular-nums" dir="ltr">
                        {formatDate(p.invoiceDate)}
                      </td>
                      <td className="p-2.5 text-center font-bold">{p.supplierName || "—"}</td>
                      <td className="p-2.5 text-center font-bold" dir="ltr">
                        {fmtMoney(p.totalAmount)}
                      </td>
                      <td className="p-2.5 text-center font-bold" dir="ltr">
                        {fmtMoney(p.paidAmount || 0)}
                      </td>
                      <td className="p-2.5 text-center font-bold" dir="ltr">
                        {fmtMoney(p.discountAmount || 0)}
                      </td>
                      <td className="p-2.5 text-center font-bold text-destructive" dir="ltr">
                        {fmtMoney(p.remainingAmount ?? 0)}
                      </td>
                      <td className="p-2.5">
                        <div className="flex justify-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-muted-foreground hover:text-destructive touch-manipulation"
                            title="تعديل"
                            onClick={() => openEditReturn(p)}
                          >
                            <Pencil className="w-5 h-5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-muted-foreground hover:text-destructive touch-manipulation"
                            title="تقرير حراري"
                            onClick={() => printReturnReport(p)}
                          >
                            <Printer className="w-5 h-5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-destructive touch-manipulation"
                            title="حذف"
                            onClick={() => {
                              if (!confirm("حذف فاتورة المرجوع؟")) return;
                              if (editingReturnId === p.id) resetForm();
                              deleteReturn({ id: p.id }, { onSuccess: invalidateReturns });
                            }}
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-2">
              {filteredReturns.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-xl border border-border/40 px-2.5 py-2 space-y-2 ${
                    editingReturnId === p.id ? "border-destructive/45 bg-destructive/10" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-extrabold">
                        #{p.invoiceNo} — {p.supplierName || "—"}
                      </p>
                      <p className="text-[13px] font-bold text-muted-foreground tabular-nums" dir="ltr">
                        {formatDate(p.invoiceDate)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[13px] font-bold">
                    <div className="rounded-lg bg-secondary/40 px-2 py-1.5 flex justify-between gap-1">
                      <span className="text-muted-foreground">مجموع</span>
                      <span dir="ltr">{fmtMoney(p.totalAmount)}</span>
                    </div>
                    <div className="rounded-lg bg-secondary/40 px-2 py-1.5 flex justify-between gap-1">
                      <span className="text-muted-foreground">واصل</span>
                      <span dir="ltr">{fmtMoney(p.paidAmount || 0)}</span>
                    </div>
                    <div className="rounded-lg bg-secondary/40 px-2 py-1.5 flex justify-between gap-1">
                      <span className="text-muted-foreground">خصم</span>
                      <span dir="ltr">{fmtMoney(p.discountAmount || 0)}</span>
                    </div>
                    <div className="rounded-lg bg-destructive/10 px-2 py-1.5 flex justify-between gap-1 text-destructive">
                      <span>باقي</span>
                      <span dir="ltr">{fmtMoney(p.remainingAmount ?? 0)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-11 text-[14px] font-bold gap-1.5 touch-manipulation"
                      onClick={() => openEditReturn(p)}
                    >
                      <Pencil className="w-4 h-4" /> تعديل
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-11 text-[14px] font-bold gap-1.5 touch-manipulation"
                      onClick={() => printReturnReport(p)}
                    >
                      <Printer className="w-4 h-4" /> تقرير
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-destructive touch-manipulation"
                      onClick={() => {
                        if (!confirm("حذف فاتورة المرجوع؟")) return;
                        if (editingReturnId === p.id) resetForm();
                        deleteReturn({ id: p.id }, { onSuccess: invalidateReturns });
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default SupplierReturnsPanel;