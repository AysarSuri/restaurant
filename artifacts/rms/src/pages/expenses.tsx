import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListExpenses,
  useCreateExpenseEntry,
  useUpdateExpenseEntry,
  useDeleteExpenseEntry,
  useGetExpenseTypes,
  useCreateExpenseType,
  useUpdateExpenseType,
  useDeleteExpenseType,
  useGetBranches,
  useGetCards,
  useGetSettings,
  getGetExpenseTypesQueryKey,
  getListExpensesQueryKey,
  getGetSettingsQueryKey,
  type ExpenseRow,
  type ExpenseTypeRow,
  type ExpensePaymentMethod,
} from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Button, Input, Dialog } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { LockedBranchField } from "@/components/locked-branch-field";
import { YmdDateInput } from "@/components/ymd-date-input";
import {
  printExpenseThermal,
  printExpenseReportA4Landscape,
} from "@/lib/print-receipt";
import { useDeviceA4PrinterName } from "@/lib/device-printer-query";
import { useScopedBranch } from "@/hooks/use-scoped-branch";
import { useOpenShiftGate } from "@/hooks/use-open-shift-gate";
import { useI18n } from "@/i18n";
import {
  AlertCircle,
  Building2,
  FileSpreadsheet,
  Hash,
  Layers,
  Pencil,
  Plus,
  StickyNote,
  Tags,
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

type ExpenseFormState = {
  invoiceNo: string;
  expenseDate: string;
  expenseTypeId: string;
  branchId: string;
  amount: number | "";
  notes: string;
  paymentMethod: ExpensePaymentMethod;
  cardId: string;
};

type TypeFormState = { name: string; notes: string };

const emptyExpenseForm = (): ExpenseFormState => ({
  invoiceNo: "",
  expenseDate: todayDate(),
  expenseTypeId: "",
  branchId: "",
  amount: "",
  notes: "",
  paymentMethod: "cash",
  cardId: "",
});

function cardPayFilterToParams(value: string): {
  paymentMethod?: ExpensePaymentMethod;
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

export default function Expenses() {
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const { locked, forcedBranchId, filterOptions } = useScopedBranch();
  const a4PrinterName = useDeviceA4PrinterName(forcedBranchId ?? null);

  const [filterInvoice, setFilterInvoice] = useState("");
  const [filterFrom, setFilterFrom] = useState(todayDate);
  const [filterTo, setFilterTo] = useState(todayDate);
  const [filterTypeId, setFilterTypeId] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");
  const [filterCardPay, setFilterCardPay] = useState("");

  const [applied, setApplied] = useState(() => ({
    invoiceNo: "",
    from: todayDate(),
    to: todayDate(),
    expenseTypeId: 0,
    filterBranchId: 0,
    paymentMethod: undefined as ExpensePaymentMethod | undefined,
    cardId: 0,
  }));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(emptyExpenseForm);
  const [formError, setFormError] = useState("");
  const [formErrorKind, setFormErrorKind] = useState<"branch" | "general" | "">("");

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
      expenseTypeId: applied.expenseTypeId || undefined,
      filterBranchId: applied.filterBranchId || undefined,
      paymentMethod: applied.paymentMethod,
      cardId: applied.cardId > 0 ? applied.cardId : undefined,
    }),
    [applied]
  );

  const { data: expenses, isLoading } = useListExpenses(listParams);
  const { data: expenseTypes } = useGetExpenseTypes();
  const { data: branches } = useGetBranches();
  const { data: cards } = useGetCards();
  const { data: appSettings, refetch: refetchSettings } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });

  const createExpense = useCreateExpenseEntry();
  const updateExpense = useUpdateExpenseEntry();
  const deleteExpense = useDeleteExpenseEntry();
  const createType = useCreateExpenseType();
  const updateType = useUpdateExpenseType();
  const deleteType = useDeleteExpenseType();

  const gateBranchId =
    forcedBranchId ??
    (Number(form.branchId) ||
      Number(filterBranchId) ||
      applied.filterBranchId ||
      null);
  const { shiftClosed, blockReason, blockReasonFor } = useOpenShiftGate(
    gateBranchId && gateBranchId > 0 ? gateBranchId : null
  );

  const [typesOpen, setTypesOpen] = useState(false);
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<ExpenseTypeRow | null>(null);
  const [typeForm, setTypeForm] = useState<TypeFormState>({ name: "", notes: "" });
  const [typeError, setTypeError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const restaurantName = appSettings?.restaurantName?.trim() || "المطعم";
  const restaurantLogoUrl = appSettings?.logoUrl?.trim() || "";
  const restaurantMobile = appSettings?.mobile?.trim() || "";

  const clearFormError = () => {
    if (formError || formErrorKind) {
      setFormError("");
      setFormErrorKind("");
    }
  };

  const typeOptions: ComboboxOption[] = useMemo(
    () =>
      (expenseTypes ?? []).map((x) => ({
        value: String(x.id),
        label: x.name,
      })),
    [expenseTypes]
  );

  const branchOptions: ComboboxOption[] = useMemo(
    () =>
      filterOptions(branches).map((b) => ({
        value: String(b.id),
        label: b.name,
      })),
    [branches, filterOptions]
  );

  const filterTypeOptions: ComboboxOption[] = useMemo(
    () => [{ value: "", label: t("expenses.allTypes") }, ...typeOptions],
    [typeOptions, t]
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
    const rows = expenses ?? [];
    let max = 0;
    for (const row of rows) {
      const match = String(row.invoiceNo ?? "").trim().match(/(\d+)\s*$/);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return String(max + 1);
  }, [expenses]);

  const invalidateExpenses = () =>
    queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey(listParams) });

  const invalidateTypes = () =>
    queryClient.invalidateQueries({ queryKey: getGetExpenseTypesQueryKey() });

  const openAdd = () => {
    const branchForGate =
      forcedBranchId ??
      (Number(filterBranchId) || applied.filterBranchId || null);
    const blocked = branchForGate ? blockReasonFor(branchForGate) : null;
    setEditing(null);
    setForm({
      ...emptyExpenseForm(),
      branchId: forcedBranchId != null ? String(forcedBranchId) : "",
    });
    setFormError(blocked || "");
    setFormErrorKind(blocked ? "general" : "");
    setFormOpen(true);
  };

  const openEdit = (item: ExpenseRow) => {
    setEditing(item);
    setForm({
      invoiceNo: item.invoiceNo || "",
      expenseDate: item.expenseDate || item.date || todayDate(),
      expenseTypeId: item.expenseTypeId ? String(item.expenseTypeId) : "",
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

  const saveExpense = () => {
    const expenseTypeId = Number(form.expenseTypeId);
    const amount = Number(form.amount);
    const branchId =
      locked && forcedBranchId != null
        ? forcedBranchId
        : Number(form.branchId) || null;

    if (!branchId) {
      setFormErrorKind("branch");
      setFormError(t("expenses.branchRequiredHint"));
      return;
    }
    const shiftBlock = blockReasonFor(branchId);
    if (shiftBlock) {
      setFormErrorKind("general");
      setFormError(shiftBlock);
      return;
    }
    if (!Number.isFinite(expenseTypeId) || expenseTypeId <= 0) {
      setFormErrorKind("general");
      setFormError(t("expenses.typeRequired"));
      return;
    }
    if (!(amount > 0)) {
      setFormErrorKind("general");
      setFormError(t("expenses.amountRequired"));
      return;
    }
    if (!form.expenseDate) {
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
      expenseTypeId,
      amount,
      expenseDate: form.expenseDate,
      notes: form.notes.trim() || undefined,
      branchId,
      invoiceNo: editing ? form.invoiceNo : undefined,
      paymentMethod: form.paymentMethod,
      cardId:
        form.paymentMethod === "card" ? Number(form.cardId) || null : null,
    };

    if (editing) {
      updateExpense.mutate(
        { id: editing.id, data: body },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditing(null);
            void invalidateExpenses();
          },
          onError: (e) => {
            setFormErrorKind("general");
            setFormError(apiErrorMessage(e, t("common.saveFailed")));
          },
        }
      );
    } else {
      createExpense.mutate(body, {
        onSuccess: () => {
          setFormOpen(false);
          void invalidateExpenses();
        },
        onError: (e) => {
          setFormErrorKind("general");
          setFormError(apiErrorMessage(e, t("common.saveFailed")));
        },
      });
    }
  };

  const handleDelete = (item: ExpenseRow) => {
    setDeleteError("");
    setDeleteTarget(item);
  };

  const confirmDeleteExpense = () => {
    if (!deleteTarget) return;
    const delBranch = forcedBranchId ?? deleteTarget.branchId ?? null;
    const shiftBlock = blockReasonFor(delBranch);
    if (shiftBlock) {
      setDeleteError(shiftBlock);
      return;
    }
    deleteExpense.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        setDeleteError("");
        void invalidateExpenses();
      },
      onError: (e) => setDeleteError(apiErrorMessage(e, t("common.saveFailed"))),
    });
  };

  const printOne = async (item: ExpenseRow) => {
    const { data: settingsSnap } = await refetchSettings();
    const name = settingsSnap?.restaurantName?.trim() || restaurantName || "المطعم";
    const logo = settingsSnap?.logoUrl?.trim() || restaurantLogoUrl || "";
    const phone = settingsSnap?.mobile?.trim() || restaurantMobile || "";
    printExpenseThermal({
      restaurantName: name,
      logoUrl: logo || null,
      mobile: phone || null,
      invoiceNo: item.invoiceNo || String(item.id),
      expenseDate: item.expenseDate || item.date,
      expenseTypeName: item.expenseTypeName || item.category || "—",
      branchName: item.branchName || "—",
      amount: item.amount,
      notes: item.notes,
      formatMoney: fmtMoney,
    });
  };

  const printReport = async () => {
    const rows = expenses ?? [];
    const { data: settingsSnap } = await refetchSettings();
    const name = settingsSnap?.restaurantName?.trim() || restaurantName || "المطعم";
    const logo = settingsSnap?.logoUrl?.trim() || restaurantLogoUrl || "";
    const phone = settingsSnap?.mobile?.trim() || restaurantMobile || "";

    const typeLabel =
      applied.expenseTypeId > 0
        ? expenseTypes?.find((x) => x.id === applied.expenseTypeId)?.name || ""
        : "";
    const branchLabel =
      applied.filterBranchId > 0
        ? branches?.find((b) => b.id === applied.filterBranchId)?.name || ""
        : "";
    const parts = [
      applied.invoiceNo ? `${t("expenses.invoiceNo")}: ${applied.invoiceNo}` : "",
      typeLabel ? `${t("expenses.type")}: ${typeLabel}` : "",
      branchLabel ? `${t("common.branch")}: ${branchLabel}` : "",
    ].filter(Boolean);

    printExpenseReportA4Landscape({
      restaurantName: name,
      logoUrl: logo || null,
      mobile: phone || null,
      fromLabel: formatDate(applied.from),
      toLabel: formatDate(applied.to),
      filterSummary: parts.join(" · ") || t("expenses.allFilters"),
      totalAmount: rows.reduce((s, r) => s + Number(r.amount || 0), 0),
      count: rows.length,
      lines: rows.map((r) => ({
        invoiceNo: r.invoiceNo || String(r.id),
        dateLabel: formatDate(r.expenseDate || r.date),
        typeName: r.expenseTypeName || r.category || "—",
        branchName: r.branchName || "—",
        amount: r.amount,
        notes: r.notes,
      })),
      formatMoney: fmtMoney,
      a4PrinterName,
    });
  };

  const applyFilters = () => {
    const pay = cardPayFilterToParams(filterCardPay);
    setApplied({
      invoiceNo: filterInvoice.trim(),
      from: filterFrom || todayDate(),
      to: filterTo || todayDate(),
      expenseTypeId: Number(filterTypeId) || 0,
      filterBranchId: Number(filterBranchId) || 0,
      paymentMethod: pay.paymentMethod,
      cardId: pay.cardId ?? 0,
    });
  };

  const openAddType = () => {
    setEditingType(null);
    setTypeForm({ name: "", notes: "" });
    setTypeError("");
    setTypeFormOpen(true);
  };

  const openEditType = (row: ExpenseTypeRow) => {
    setEditingType(row);
    setTypeForm({ name: row.name, notes: row.notes || "" });
    setTypeError("");
    setTypeFormOpen(true);
  };

  const saveType = () => {
    const name = typeForm.name.trim();
    if (!name) {
      setTypeError(t("expenses.typeNameRequired"));
      return;
    }
    const body = { name, notes: typeForm.notes.trim() || undefined };
    if (editingType) {
      updateType.mutate(
        { id: editingType.id, data: body },
        {
          onSuccess: () => {
            setTypeFormOpen(false);
            setEditingType(null);
            void invalidateTypes();
            void invalidateExpenses();
          },
          onError: (e) => setTypeError(apiErrorMessage(e, t("common.saveFailed"))),
        }
      );
    } else {
      createType.mutate(body, {
        onSuccess: () => {
          setTypeFormOpen(false);
          void invalidateTypes();
        },
        onError: (e) => setTypeError(apiErrorMessage(e, t("common.saveFailed"))),
      });
    }
  };

  const handleDeleteType = (row: ExpenseTypeRow) => {
    if (!confirm(t("expenses.deleteTypeAsk"))) return;
    deleteType.mutate(row.id, {
      onSuccess: () => void invalidateTypes(),
      onError: (e) => alert(apiErrorMessage(e, t("common.saveFailed"))),
    });
  };

  const columns = [
    {
      key: "invoiceNo",
      header: t("expenses.invoiceNo"),
      render: (item: ExpenseRow) => (
        <span className="font-display tabular-nums" dir="ltr">
          {item.invoiceNo || item.id}
        </span>
      ),
    },
    {
      key: "expenseDate",
      header: t("common.date"),
      render: (item: ExpenseRow) => (
        <span className="font-display tabular-nums" dir="ltr">
          {formatDate(item.expenseDate || item.date)}
        </span>
      ),
    },
    {
      key: "expenseTypeName",
      header: t("expenses.type"),
      render: (item: ExpenseRow) => (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[13px] font-extrabold">
          <Tags className="w-3.5 h-3.5" />
          {item.expenseTypeName || item.category || "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: t("common.amount"),
      render: (item: ExpenseRow) => (
        <span className="font-display font-extrabold text-destructive tabular-nums" dir="ltr">
          {fmtMoney(item.amount)} {t("common.iqd")}
        </span>
      ),
    },
    {
      key: "branchName",
      header: t("common.branch"),
      render: (item: ExpenseRow) => (
        <span className="font-bold text-foreground/90">{item.branchName || "—"}</span>
      ),
    },
    {
      key: "payment",
      header: "الدفع",
      render: (item: ExpenseRow) =>
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
      render: (item: ExpenseRow) => (
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
        title={t("expenses.log")}
        titleEn={t("expenses.kicker")}
        data={expenses}
        columns={columns}
        isLoading={isLoading}
        hideSearch
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
        onPrint={printOne}
        headerActions={
          <>
            <Button
              type="button"
              variant="outline"
              className="rounded-full min-h-14 h-14 px-5 text-[16px] font-bold gap-2 touch-manipulation"
              onClick={() => setTypesOpen(true)}
            >
              <Layers className="w-6 h-6" />
              {t("expenses.types")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-full min-h-14 h-14 px-5 text-[16px] font-bold gap-2 touch-manipulation"
              onClick={() => void printReport()}
            >
              <FileSpreadsheet className="w-6 h-6" />
              {t("expenses.reportA4")}
            </Button>
          </>
        }
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
              value={filterTypeId}
              onChange={setFilterTypeId}
              options={filterTypeOptions}
              label={t("expenses.type")}
              placeholder={t("expenses.allTypes")}
              icon={Tags}
              searchable
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

      {/* Expense form */}
      <Dialog
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? t("expenses.editTitle") : t("expenses.addTitle")}
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
                value={form.expenseDate}
                onChange={(expenseDate) => {
                  setForm((f) => ({ ...f, expenseDate }));
                  clearFormError();
                }}
              />
            </div>
            <ModernCombobox
              value={form.expenseTypeId}
              onChange={(expenseTypeId) => {
                setForm((f) => ({ ...f, expenseTypeId }));
                clearFormError();
              }}
              options={typeOptions}
              label={`${t("expenses.type")} *`}
              placeholder={t("expenses.pickType")}
              icon={Tags}
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
                    ? t("expenses.branchRequiredTitle")
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
              disabled={createExpense.isPending || updateExpense.isPending}
              isLoading={createExpense.isPending || updateExpense.isPending}
              onClick={saveExpense}
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Expense types manager */}
      <Dialog
        isOpen={typesOpen}
        onClose={() => setTypesOpen(false)}
        title={t("expenses.types")}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 touch-ui">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-muted-foreground leading-relaxed">
              {t("expenses.typesHint")}
            </p>
            <Button
              type="button"
              className="min-h-14 h-14 rounded-full px-6 text-[16px] font-bold gap-2 shrink-0 touch-manipulation w-full sm:w-auto"
              onClick={openAddType}
            >
              <Plus className="w-6 h-6" />
              {t("common.add")}
            </Button>
          </div>

          <div className="rounded-2xl border border-border/60 overflow-hidden">
            {(expenseTypes ?? []).length === 0 ? (
              <div className="py-12 text-center text-[16px] font-bold text-muted-foreground">
                {t("common.noData")}
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {(expenseTypes ?? []).map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-4 hover:bg-secondary/30 touch-manipulation"
                  >
                    <div className="min-w-0">
                      <p className="text-[17px] font-extrabold truncate">{row.name}</p>
                      {row.notes?.trim() ? (
                        <p className="text-[14px] font-semibold text-muted-foreground truncate mt-1">
                          {row.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2.5 shrink-0 w-full sm:w-auto">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 sm:flex-none min-h-14 h-14 px-5 text-[15px] font-bold gap-2 touch-manipulation"
                        onClick={() => openEditType(row)}
                      >
                        <Pencil className="w-5 h-5" />
                        {t("common.edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="flex-1 sm:flex-none min-h-14 h-14 px-5 text-[15px] font-bold gap-2 text-destructive hover:bg-destructive/10 touch-manipulation"
                        onClick={() => handleDeleteType(row)}
                      >
                        <Trash2 className="w-5 h-5" />
                        {t("common.delete")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Dialog>

      {/* Delete expense confirmation */}
      <Dialog
        isOpen={!!deleteTarget}
        onClose={() => {
          if (deleteExpense.isPending) return;
          setDeleteTarget(null);
          setDeleteError("");
        }}
        title={t("expenses.deleteTitle")}
        maxWidth="max-w-md"
      >
        <div className="space-y-5 touch-ui">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
              <Trash2 className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-extrabold text-foreground">
                {t("expenses.deleteConfirm")}
              </p>
              <p className="text-[14px] font-semibold text-muted-foreground leading-relaxed">
                {t("expenses.deleteHint", {
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
                  {t("expenses.type")}
                </span>
                <span className="text-[15px] font-bold truncate max-w-[60%]">
                  {deleteTarget?.expenseTypeName || deleteTarget?.category || "—"}
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
              disabled={deleteExpense.isPending}
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
              disabled={deleteExpense.isPending}
              isLoading={deleteExpense.isPending}
              onClick={confirmDeleteExpense}
            >
              <Trash2 className="h-5 w-5" />
              {t("expenses.deleteConfirmBtn")}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Type form */}
      <Dialog
        isOpen={typeFormOpen}
        onClose={() => {
          setTypeFormOpen(false);
          setEditingType(null);
        }}
        title={editingType ? t("expenses.editType") : t("expenses.addType")}
        maxWidth="max-w-md"
        layer="overlay"
      >
        <div className="space-y-4 touch-ui">
          <div>
            <label className="text-[17px] font-bold text-foreground mb-2 block">
              {t("expenses.typeName")} *
            </label>
            <Input
              className="min-h-14 h-14 text-[17px] font-bold touch-manipulation"
              value={typeForm.name}
              onChange={(e) => {
                setTypeForm((f) => ({ ...f, name: e.target.value }));
                if (typeError) setTypeError("");
              }}
            />
          </div>
          <div>
            <label className="text-[17px] font-bold text-foreground mb-2 block">
              {t("common.notes")}
            </label>
            <Input
              className="min-h-14 h-14 text-[17px] font-bold touch-manipulation"
              value={typeForm.notes}
              onChange={(e) => setTypeForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t("common.optional")}
            />
          </div>
          {typeError ? (
            <p className="text-[15px] font-bold text-destructive">{typeError}</p>
          ) : null}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-h-14 h-14 rounded-full text-[16px] font-bold touch-manipulation"
              onClick={() => {
                setTypeFormOpen(false);
                setEditingType(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              className="flex-1 min-h-14 h-14 rounded-full text-[16px] font-bold touch-manipulation"
              disabled={createType.isPending || updateType.isPending}
              isLoading={createType.isPending || updateType.isPending}
              onClick={saveType}
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
