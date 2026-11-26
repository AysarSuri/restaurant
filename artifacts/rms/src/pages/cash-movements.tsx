import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCashMovements,
  useCreateCashMovement,
  useUpdateCashMovement,
  useDeleteCashMovement,
  useGetBranches,
  useGetCards,
  getListCashMovementsQueryKey,
  type CashMovementRow,
  type CashMovementKind,
  type CashMovementPaymentMethod,
} from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Button, Input, Dialog } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { LockedBranchField } from "@/components/locked-branch-field";
import { YmdDateInput } from "@/components/ymd-date-input";
import { useScopedBranch } from "@/hooks/use-scoped-branch";
import { useOpenShiftGate } from "@/hooks/use-open-shift-gate";
import { useI18n } from "@/i18n";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Hash,
  StickyNote,
  Trash2,
  Wallet,
  CreditCard,
} from "lucide-react";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IQ", { maximumFractionDigits: 2 }).format(n);

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function apiErrorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object") {
    const anyErr = err as { message?: string; data?: { message?: string } };
    if (anyErr.data?.message) return String(anyErr.data.message);
    if (anyErr.message && !String(anyErr.message).startsWith("Request failed")) {
      return String(anyErr.message);
    }
  }
  return fallback;
}

type FormState = {
  invoiceNo: string;
  movementDate: string;
  kind: CashMovementKind;
  branchId: string;
  amount: number | "";
  notes: string;
  paymentMethod: CashMovementPaymentMethod;
  cardId: string;
};

const emptyForm = (): FormState => ({
  invoiceNo: "",
  movementDate: todayDate(),
  kind: "withdrawal",
  branchId: "",
  amount: "",
  notes: "",
  paymentMethod: "cash",
  cardId: "",
});

function cardPayFilterToParams(value: string): {
  paymentMethod?: CashMovementPaymentMethod;
  cardId?: number;
} {
  const v = value.trim();
  if (!v) return {};
  if (v === "cash") return { paymentMethod: "cash" };
  if (v === "card") return { paymentMethod: "card" };
  const id = Number(v);
  if (Number.isFinite(id) && id > 0) return { cardId: id };
  return {};
}

export default function CashMovements() {
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const { locked, forcedBranchId, filterOptions } = useScopedBranch();

  const [filterInvoice, setFilterInvoice] = useState("");
  const [filterFrom, setFilterFrom] = useState(todayDate);
  const [filterTo, setFilterTo] = useState(todayDate);
  const [filterKind, setFilterKind] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");
  const [filterCardPay, setFilterCardPay] = useState("");

  const [applied, setApplied] = useState(() => ({
    invoiceNo: "",
    from: todayDate(),
    to: todayDate(),
    kind: "" as CashMovementKind | "",
    filterBranchId: 0,
    paymentMethod: undefined as CashMovementPaymentMethod | undefined,
    cardId: 0,
  }));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CashMovementRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [formErrorKind, setFormErrorKind] = useState<"branch" | "general" | "">("");
  const [deleteTarget, setDeleteTarget] = useState<CashMovementRow | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!locked || forcedBranchId == null) return;
    const id = String(forcedBranchId);
    setFilterBranchId(id);
    setApplied((prev) =>
      prev.filterBranchId === forcedBranchId
        ? prev
        : { ...prev, filterBranchId: forcedBranchId }
    );
    setForm((f) => (f.branchId === id ? f : { ...f, branchId: id }));
  }, [locked, forcedBranchId]);

  const listParams = useMemo(
    () => ({
      invoiceNo: applied.invoiceNo || undefined,
      from: applied.from || undefined,
      to: applied.to || undefined,
      kind: applied.kind || undefined,
      filterBranchId: applied.filterBranchId || undefined,
      paymentMethod: applied.paymentMethod,
      cardId: applied.cardId > 0 ? applied.cardId : undefined,
    }),
    [applied]
  );

  const { data: rows, isLoading } = useListCashMovements(listParams);
  const { data: branches } = useGetBranches();
  const { data: cards } = useGetCards();

  const createRow = useCreateCashMovement();
  const updateRow = useUpdateCashMovement();
  const deleteRow = useDeleteCashMovement();

  const gateBranchId =
    forcedBranchId ??
    (Number(form.branchId) ||
      Number(filterBranchId) ||
      applied.filterBranchId ||
      null);
  const { shiftClosed, blockReason, blockReasonFor } = useOpenShiftGate(
    gateBranchId && gateBranchId > 0 ? gateBranchId : null
  );

  const clearFormError = () => {
    if (formError || formErrorKind) {
      setFormError("");
      setFormErrorKind("");
    }
  };

  const kindLabel = (kind: string) =>
    kind === "return" ? t("cash.kindReturn") : t("cash.kindWithdrawal");

  const kindOptions: ComboboxOption[] = useMemo(
    () => [
      { value: "withdrawal", label: t("cash.kindWithdrawal"), icon: ArrowUpRight },
      { value: "return", label: t("cash.kindReturn"), icon: ArrowDownLeft },
    ],
    [t]
  );

  const filterKindOptions: ComboboxOption[] = useMemo(
    () => [{ value: "", label: t("cash.allKinds") }, ...kindOptions],
    [kindOptions, t]
  );

  const branchOptions: ComboboxOption[] = useMemo(
    () =>
      filterOptions(branches).map((b) => ({
        value: String(b.id),
        label: b.name,
      })),
    [branches, filterOptions]
  );

  const filterBranchOptions: ComboboxOption[] = useMemo(
    () =>
      locked
        ? branchOptions
        : [{ value: "", label: t("expenses.allBranches") }, ...branchOptions],
    [branchOptions, locked, t]
  );

  const formBranchCardOptions = useMemo<ComboboxOption[]>(() => {
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

  const filterCardPayOptions = useMemo<ComboboxOption[]>(() => {
    const branchId = Number(filterBranchId) || 0;
    const cardOpts = (cards ?? [])
      .filter((c) => c.isActive !== false)
      .filter((c) => (branchId ? (c.branchIds ?? []).includes(branchId) : true))
      .map((c) => ({
        value: String(c.id),
        label: c.name,
        icon: CreditCard,
      }));
    return [
      { value: "", label: t("expenses.allFilters") },
      { value: "cash", label: "بدون بطاقة", icon: Wallet },
      { value: "card", label: "بطاقة", icon: CreditCard },
      ...cardOpts,
    ];
  }, [cards, filterBranchId, t]);

  const nextInvoicePreview = useMemo(() => {
    const list = rows ?? [];
    let max = 0;
    for (const row of list) {
      const match = String(row.invoiceNo ?? "").trim().match(/(\d+)\s*$/);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return String(max + 1);
  }, [rows]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCashMovementsQueryKey(listParams) });

  const openAdd = () => {
    const branchForGate =
      forcedBranchId ??
      (Number(filterBranchId) || applied.filterBranchId || null);
    const blocked = branchForGate ? blockReasonFor(branchForGate) : null;
    setEditing(null);
    setForm({
      ...emptyForm(),
      branchId: forcedBranchId != null ? String(forcedBranchId) : "",
    });
    setFormError(blocked || "");
    setFormErrorKind(blocked ? "general" : "");
    setFormOpen(true);
  };

  const openEdit = (item: CashMovementRow) => {
    setEditing(item);
    setForm({
      invoiceNo: item.invoiceNo || "",
      movementDate: item.movementDate || todayDate(),
      kind: item.kind === "return" ? "return" : "withdrawal",
      branchId:
        forcedBranchId != null
          ? String(forcedBranchId)
          : item.branchId
            ? String(item.branchId)
            : "",
      amount: item.amount,
      notes: item.notes || "",
      paymentMethod: item.paymentMethod === "card" ? "card" : "cash",
      cardId: item.cardId ? String(item.cardId) : "",
    });
    setFormError("");
    setFormErrorKind("");
    setFormOpen(true);
  };

  const saveRow = () => {
    const amount = Number(form.amount);
    const branchId =
      locked && forcedBranchId != null
        ? forcedBranchId
        : Number(form.branchId) || null;
    const kind: CashMovementKind = form.kind === "return" ? "return" : "withdrawal";

    if (!branchId) {
      setFormErrorKind("branch");
      setFormError(t("cash.branchRequiredHint"));
      return;
    }
    const shiftBlock = blockReasonFor(branchId);
    if (shiftBlock) {
      setFormErrorKind("general");
      setFormError(shiftBlock);
      return;
    }
    if (!(amount > 0)) {
      setFormErrorKind("general");
      setFormError(t("expenses.amountRequired"));
      return;
    }
    if (!form.movementDate) {
      setFormErrorKind("general");
      setFormError(t("expenses.dateRequired"));
      return;
    }
    if (form.paymentMethod === "card" && !form.cardId) {
      setFormErrorKind("general");
      setFormError("اختر البطاقة");
      return;
    }

    const body = {
      movementDate: form.movementDate,
      movementTime: editing?.movementTime || nowTime(),
      kind,
      amount,
      notes: form.notes.trim() || undefined,
      branchId,
      invoiceNo: editing ? form.invoiceNo : undefined,
      paymentMethod: form.paymentMethod,
      cardId:
        form.paymentMethod === "card" ? Number(form.cardId) || null : null,
    };

    if (editing) {
      updateRow.mutate(
        { id: editing.id, data: body },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditing(null);
            void invalidate();
          },
          onError: (e) => {
            setFormErrorKind("general");
            setFormError(apiErrorMessage(e, t("common.saveFailed")));
          },
        }
      );
    } else {
      createRow.mutate(body, {
        onSuccess: () => {
          setFormOpen(false);
          void invalidate();
        },
        onError: (e) => {
          setFormErrorKind("general");
          setFormError(apiErrorMessage(e, t("common.saveFailed")));
        },
      });
    }
  };

  const handleDelete = (item: CashMovementRow) => {
    setDeleteError("");
    setDeleteTarget(item);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const delBranch = forcedBranchId ?? deleteTarget.branchId ?? null;
    const shiftBlock = blockReasonFor(delBranch);
    if (shiftBlock) {
      setDeleteError(shiftBlock);
      return;
    }
    deleteRow.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        setDeleteError("");
        void invalidate();
      },
      onError: (e) => setDeleteError(apiErrorMessage(e, t("common.saveFailed"))),
    });
  };

  const applyFilters = () => {
    const pay = cardPayFilterToParams(filterCardPay);
    setApplied({
      invoiceNo: filterInvoice.trim(),
      from: filterFrom || todayDate(),
      to: filterTo || todayDate(),
      kind: (filterKind as CashMovementKind | "") || "",
      filterBranchId: Number(filterBranchId) || 0,
      paymentMethod: pay.paymentMethod,
      cardId: pay.cardId ?? 0,
    });
  };

  const columns = [
    {
      key: "invoiceNo",
      header: t("expenses.invoiceNo"),
      render: (item: CashMovementRow) => (
        <span className="font-display tabular-nums" dir="ltr">
          {item.invoiceNo || item.id}
        </span>
      ),
    },
    {
      key: "movementDate",
      header: t("common.date"),
      render: (item: CashMovementRow) => (
        <span className="font-display tabular-nums" dir="ltr">
          {formatDate(item.movementDate)}
        </span>
      ),
    },
    {
      key: "kind",
      header: t("cash.amountType"),
      render: (item: CashMovementRow) => {
        const isReturn = item.kind === "return";
        return (
          <span
            className={
              isReturn
                ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-[13px] font-extrabold"
                : "inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 px-2.5 py-1 text-[13px] font-extrabold"
            }
          >
            {isReturn ? (
              <ArrowDownLeft className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5" />
            )}
            {kindLabel(item.kind)}
          </span>
        );
      },
    },
    {
      key: "amount",
      header: t("common.amount"),
      render: (item: CashMovementRow) => (
        <span className="font-display font-extrabold text-destructive tabular-nums" dir="ltr">
          {fmtMoney(item.amount)} {t("common.iqd")}
        </span>
      ),
    },
    {
      key: "branchName",
      header: t("common.branch"),
      render: (item: CashMovementRow) => (
        <span className="font-bold text-foreground/90">{item.branchName || "—"}</span>
      ),
    },
    {
      key: "payment",
      header: "الدفع",
      render: (item: CashMovementRow) =>
        item.paymentMethod === "card" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 text-sky-800 dark:text-sky-200 px-2.5 py-1 text-[13px] font-extrabold">
            <CreditCard className="w-3.5 h-3.5" />
            {item.cardName?.trim() || "بطاقة"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 px-2.5 py-1 text-[13px] font-extrabold">
            <Wallet className="w-3.5 h-3.5" />
            بدون بطاقة
          </span>
        ),
    },
    {
      key: "notes",
      header: t("common.notes"),
      render: (item: CashMovementRow) => (
        <span className="text-muted-foreground font-semibold line-clamp-2">
          {item.notes?.trim() || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 touch-ui">
      {shiftClosed && blockReason ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-extrabold text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <span>{blockReason}</span>
        </div>
      ) : null}
      <CrudTable
        title={t("cash.log")}
        titleEn={t("cash.kicker")}
        data={rows}
        columns={columns}
        isLoading={isLoading}
        hideSearch
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
        toolbar={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 items-end">
            <div>
              <label className="text-[14px] font-bold text-muted-foreground mb-1.5 block">
                {t("expenses.invoiceNo")}
              </label>
              <div className="relative">
                <Hash className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  className="min-h-14 h-14 ps-10 text-[16px] font-bold touch-manipulation"
                  dir="ltr"
                  value={filterInvoice}
                  onChange={(e) => setFilterInvoice(e.target.value)}
                  placeholder="…"
                />
              </div>
            </div>
            <div>
              <label className="text-[14px] font-bold text-muted-foreground mb-1.5 block">
                {t("expenses.fromDate")}
              </label>
              <YmdDateInput
                className="min-h-14 h-14 text-[16px] font-bold tabular-nums"
                value={filterFrom}
                onChange={setFilterFrom}
              />
            </div>
            <div>
              <label className="text-[14px] font-bold text-muted-foreground mb-1.5 block">
                {t("expenses.toDate")}
              </label>
              <YmdDateInput
                className="min-h-14 h-14 text-[16px] font-bold tabular-nums"
                value={filterTo}
                onChange={setFilterTo}
              />
            </div>
            <ModernCombobox
              value={filterKind}
              onChange={setFilterKind}
              options={filterKindOptions}
              label={t("cash.amountType")}
              placeholder={t("cash.allKinds")}
              icon={Wallet}
              searchable={false}
              labelClassName="text-[14px] font-bold text-muted-foreground"
              valueClassName="text-[16px] font-bold"
            />
            {locked ? (
              <LockedBranchField label={t("common.branch")} />
            ) : (
              <ModernCombobox
                value={filterBranchId}
                onChange={(branchId) => {
                  setFilterBranchId(branchId);
                  setFilterCardPay("");
                }}
                options={filterBranchOptions}
                label={t("common.branch")}
                placeholder={t("expenses.allBranches")}
                icon={Building2}
                searchable
                labelClassName="text-[14px] font-bold text-muted-foreground"
                valueClassName="text-[16px] font-bold"
              />
            )}
            <ModernCombobox
              value={filterCardPay}
              onChange={setFilterCardPay}
              options={filterCardPayOptions}
              label="البحث حسب البطاقة"
              placeholder={t("expenses.allFilters")}
              icon={CreditCard}
              searchable
              searchPlaceholder="ابحث عن البطاقة..."
              labelClassName="text-[14px] font-bold text-muted-foreground"
              valueClassName="text-[16px] font-bold"
            />
            <Button
              type="button"
              className="min-h-14 h-14 rounded-2xl text-[16px] font-bold touch-manipulation"
              onClick={applyFilters}
            >
              {t("common.searchAction")}
            </Button>
          </div>
        }
      />

      <Dialog
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? t("cash.editTitle") : t("cash.addTitle")}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 touch-ui">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[17px] font-bold text-foreground mb-2 block">
                {t("expenses.invoiceNo")}
              </label>
              <div className="relative">
                <Hash className="absolute start-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  className="min-h-14 h-14 ps-11 text-[17px] font-bold bg-secondary/50 text-muted-foreground cursor-not-allowed"
                  value={editing ? form.invoiceNo : nextInvoicePreview}
                  readOnly
                  disabled
                  dir="ltr"
                />
              </div>
              <p className="text-[13px] text-muted-foreground mt-1.5 font-semibold">
                {editing ? t("expenses.invoiceLocked") : t("expenses.invoiceAuto")}
              </p>
            </div>
            <div>
              <label className="text-[17px] font-bold text-foreground mb-2 block">
                {t("common.date")} *
              </label>
              <YmdDateInput
                className="min-h-14 h-14 text-[17px] font-bold tabular-nums tracking-wide"
                value={form.movementDate}
                onChange={(movementDate) => {
                  setForm((f) => ({ ...f, movementDate }));
                  clearFormError();
                }}
              />
            </div>
            <ModernCombobox
              value={form.kind}
              onChange={(kind) => {
                setForm((f) => ({
                  ...f,
                  kind: kind === "return" ? "return" : "withdrawal",
                }));
                clearFormError();
              }}
              options={kindOptions}
              label={`${t("cash.amountType")} *`}
              placeholder={t("cash.kindWithdrawal")}
              icon={Wallet}
              searchable={false}
              labelClassName="text-[17px] font-bold text-foreground mb-0.5"
              valueClassName="text-[17px] font-bold"
            />
            <div
              className={
                formErrorKind === "branch"
                  ? "rounded-2xl ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background"
                  : undefined
              }
            >
              {locked ? (
                <LockedBranchField label={`${t("common.branch")} *`} />
              ) : (
                <ModernCombobox
                  value={form.branchId}
                  onChange={(branchId) => {
                    setForm((f) => ({ ...f, branchId, cardId: "" }));
                    clearFormError();
                  }}
                  options={branchOptions}
                  label={`${t("common.branch")} *`}
                  placeholder={t("expenses.pickBranch")}
                  icon={Building2}
                  labelClassName="text-[17px] font-bold text-foreground mb-0.5"
                  valueClassName="text-[17px] font-bold"
                />
              )}
            </div>
            <div className="min-w-0 sm:col-span-2">
              <label className="text-[17px] font-bold text-foreground mb-2 block">
                طريقة الدفع
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1.5 h-14 rounded-2xl border-2 border-border bg-secondary/40">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, paymentMethod: "cash", cardId: "" }))
                  }
                  className={`rounded-xl flex items-center justify-center gap-2 font-extrabold text-[15px] touch-manipulation transition-all ${
                    form.paymentMethod === "cash"
                      ? "bg-gradient-to-l from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                  }`}
                >
                  <Wallet className="w-4 h-4 shrink-0" />
                  بدون بطاقة
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, paymentMethod: "card" }))}
                  className={`rounded-xl flex items-center justify-center gap-2 font-extrabold text-[15px] touch-manipulation transition-all ${
                    form.paymentMethod === "card"
                      ? "bg-gradient-to-l from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0" />
                  بطاقة
                </button>
              </div>
            </div>
            <div className="min-w-0 sm:col-span-2">
              {form.paymentMethod === "card" ? (
                <ModernCombobox
                  value={form.cardId}
                  onChange={(cardId) => {
                    setForm((f) => ({ ...f, cardId }));
                    clearFormError();
                  }}
                  options={formBranchCardOptions}
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
                  labelClassName="text-[17px] font-bold text-foreground mb-0.5"
                  valueClassName="text-[17px] font-bold"
                />
              ) : (
                <>
                  <label className="text-[17px] font-bold text-foreground mb-2 block">
                    البطاقة
                  </label>
                  <div className="min-h-14 h-14 rounded-2xl border-2 border-border/50 bg-secondary/40 px-4 flex items-center text-[16px] font-bold text-muted-foreground">
                    بدون بطاقة
                  </div>
                </>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="text-[17px] font-bold text-foreground mb-2 block">
                {t("common.amount")} *
              </label>
              <div className="relative">
                <Wallet className="absolute start-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  amountPad
                  className="min-h-14 h-14 ps-11 text-[17px] font-bold touch-manipulation"
                  dir="ltr"
                  value={form.amount}
                  placeholder="0"
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      amount: e.target.value === "" ? "" : Number(e.target.value),
                    }));
                    clearFormError();
                  }}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="text-[17px] font-bold text-foreground mb-2 block">
              {t("common.notes")}
            </label>
            <div className="relative">
              <StickyNote className="absolute start-3.5 top-4 w-5 h-5 text-muted-foreground pointer-events-none" />
              <textarea
                className="flex min-h-[8.5rem] w-full rounded-2xl border-2 border-border bg-background/50 ps-11 pe-4 py-3.5 text-[17px] font-bold ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 resize-y touch-manipulation"
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("common.optional")}
              />
            </div>
          </div>
          {formError ? (
            <div
              role="alert"
              className={
                formErrorKind === "branch"
                  ? "flex gap-3 rounded-2xl border border-amber-500/35 bg-gradient-to-l from-amber-500/15 via-amber-500/10 to-card px-4 py-3.5 shadow-sm"
                  : "flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3.5"
              }
            >
              <span
                className={
                  formErrorKind === "branch"
                    ? "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    : "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive"
                }
              >
                {formErrorKind === "branch" ? (
                  <Building2 className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-[15px] font-extrabold text-foreground leading-snug">
                  {formErrorKind === "branch"
                    ? t("cash.branchRequiredTitle")
                    : t("common.saveFailed")}
                </p>
                <p className="text-[14px] font-semibold text-muted-foreground leading-relaxed">
                  {formError}
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-h-14 h-14 rounded-full text-[17px] font-bold touch-manipulation"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              className="flex-1 min-h-14 h-14 rounded-full text-[17px] font-bold touch-manipulation"
              disabled={createRow.isPending || updateRow.isPending}
              isLoading={createRow.isPending || updateRow.isPending}
              onClick={saveRow}
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={!!deleteTarget}
        onClose={() => {
          if (deleteRow.isPending) return;
          setDeleteTarget(null);
          setDeleteError("");
        }}
        title={t("cash.deleteTitle")}
        maxWidth="max-w-md"
      >
        <div className="space-y-5 touch-ui">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
              <Trash2 className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-extrabold text-foreground">
                {t("cash.deleteConfirm")}
              </p>
              <p className="text-[14px] font-semibold text-muted-foreground leading-relaxed">
                {t("cash.deleteHint", {
                  invoiceNo: deleteTarget?.invoiceNo || String(deleteTarget?.id ?? ""),
                })}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-start space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-bold text-muted-foreground">
                  {t("expenses.invoiceNo")}
                </span>
                <span className="text-[16px] font-extrabold tabular-nums" dir="ltr">
                  {deleteTarget?.invoiceNo || deleteTarget?.id}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-bold text-muted-foreground">
                  {t("cash.amountType")}
                </span>
                <span className="text-[15px] font-bold">
                  {kindLabel(deleteTarget?.kind || "withdrawal")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-bold text-muted-foreground">
                  {t("common.amount")}
                </span>
                <span className="text-[15px] font-extrabold text-destructive tabular-nums" dir="ltr">
                  {fmtMoney(Number(deleteTarget?.amount || 0))} {t("common.iqd")}
                </span>
              </div>
            </div>
          </div>
          {deleteError ? (
            <div
              role="alert"
              className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-[14px] font-bold text-destructive">{deleteError}</p>
            </div>
          ) : null}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-h-14 h-14 rounded-full text-[16px] font-bold touch-manipulation"
              disabled={deleteRow.isPending}
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1 min-h-14 h-14 rounded-full text-[16px] font-bold gap-2 touch-manipulation"
              disabled={deleteRow.isPending}
              isLoading={deleteRow.isPending}
              onClick={confirmDelete}
            >
              <Trash2 className="h-5 w-5" />
              {t("expenses.deleteConfirmBtn")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
