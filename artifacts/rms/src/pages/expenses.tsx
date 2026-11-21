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
  useGetSettings,
  getGetExpenseTypesQueryKey,
  getGetSettingsQueryKey,
  type ExpenseRow,
  type ExpenseTypeRow,
} from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Button, Input, Dialog } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { YmdDateInput } from "@/components/ymd-date-input";
import {
  printExpenseThermal,
  printExpenseReportA4Landscape,
} from "@/lib/print-receipt";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import {
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
};

type TypeFormState = { name: string; notes: string };

const emptyExpenseForm = (): ExpenseFormState => ({
  invoiceNo: "",
  expenseDate: todayDate(),
  expenseTypeId: "",
  branchId: "",
  amount: "",
  notes: "",
});

export default function Expenses() {
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();

  const [filterInvoice, setFilterInvoice] = useState("");
  const [filterFrom, setFilterFrom] = useState(todayDate);
  const [filterTo, setFilterTo] = useState(todayDate);
  const [filterTypeId, setFilterTypeId] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");

  const [applied, setApplied] = useState(() => ({
    invoiceNo: "",
    from: todayDate(),
    to: todayDate(),
    expenseTypeId: 0,
    filterBranchId: 0,
  }));

  const listParams = useMemo(
    () => ({
      invoiceNo: applied.invoiceNo || undefined,
      from: applied.from || undefined,
      to: applied.to || undefined,
      expenseTypeId: applied.expenseTypeId || undefined,
      filterBranchId: applied.filterBranchId || undefined,
    }),
    [applied]
  );

  const { data: expenses, isLoading } = useListExpenses(listParams);
  const { data: expenseTypes } = useGetExpenseTypes();
  const { data: branches } = useGetBranches();
  const { data: appSettings, refetch: refetchSettings } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });

  const createExpense = useCreateExpenseEntry();
  const updateExpense = useUpdateExpenseEntry();
  const deleteExpense = useDeleteExpenseEntry();
  const createType = useCreateExpenseType();
  const updateType = useUpdateExpenseType();
  const deleteType = useDeleteExpenseType();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(emptyExpenseForm);
  const [formError, setFormError] = useState("");

  const [typesOpen, setTypesOpen] = useState(false);
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<ExpenseTypeRow | null>(null);
  const [typeForm, setTypeForm] = useState<TypeFormState>({ name: "", notes: "" });
  const [typeError, setTypeError] = useState("");

  const restaurantName = appSettings?.restaurantName?.trim() || "المطعم";
  const restaurantLogoUrl = appSettings?.logoUrl?.trim() || "";
  const restaurantMobile = appSettings?.mobile?.trim() || "";

  const defaultBranchId = useMemo(() => {
    if (typeof selectedBranchId === "number" && selectedBranchId > 0) {
      return String(selectedBranchId);
    }
    const first = branches?.[0]?.id;
    return first ? String(first) : "";
  }, [selectedBranchId, branches]);

  useEffect(() => {
    if (!formOpen || editing) return;
    if (!form.branchId && defaultBranchId) {
      setForm((f) => ({ ...f, branchId: defaultBranchId }));
    }
  }, [formOpen, editing, defaultBranchId, form.branchId]);

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
      (branches ?? []).map((b) => ({
        value: String(b.id),
        label: b.name,
      })),
    [branches]
  );

  const filterTypeOptions: ComboboxOption[] = useMemo(
    () => [{ value: "", label: t("expenses.allTypes") }, ...typeOptions],
    [typeOptions, t]
  );

  const filterBranchOptions: ComboboxOption[] = useMemo(
    () => [{ value: "", label: t("expenses.allBranches") }, ...branchOptions],
    [branchOptions, t]
  );

  const invalidateExpenses = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });

  const invalidateTypes = () =>
    queryClient.invalidateQueries({ queryKey: getGetExpenseTypesQueryKey() });

  const openAdd = () => {
    setEditing(null);
    setForm({
      ...emptyExpenseForm(),
      branchId: defaultBranchId,
    });
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (item: ExpenseRow) => {
    setEditing(item);
    setForm({
      invoiceNo: item.invoiceNo || "",
      expenseDate: item.expenseDate || item.date || todayDate(),
      expenseTypeId: item.expenseTypeId ? String(item.expenseTypeId) : "",
      branchId: item.branchId ? String(item.branchId) : defaultBranchId,
      amount: item.amount,
      notes: item.notes || "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const saveExpense = () => {
    const expenseTypeId = Number(form.expenseTypeId);
    const amount = Number(form.amount);
    const branchId = Number(form.branchId) || null;

    if (!Number.isFinite(expenseTypeId) || expenseTypeId <= 0) {
      setFormError(t("expenses.typeRequired"));
      return;
    }
    if (!(amount > 0)) {
      setFormError(t("expenses.amountRequired"));
      return;
    }
    if (!form.expenseDate) {
      setFormError(t("expenses.dateRequired"));
      return;
    }
    if (!branchId) {
      setFormError(t("expenses.branchRequired"));
      return;
    }

    const body = {
      expenseTypeId,
      amount,
      expenseDate: form.expenseDate,
      notes: form.notes.trim() || undefined,
      branchId,
      invoiceNo: editing ? form.invoiceNo : undefined,
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
          onError: (e) => setFormError(apiErrorMessage(e, t("common.saveFailed"))),
        }
      );
    } else {
      createExpense.mutate(body, {
        onSuccess: () => {
          setFormOpen(false);
          void invalidateExpenses();
        },
        onError: (e) => setFormError(apiErrorMessage(e, t("common.saveFailed"))),
      });
    }
  };

  const handleDelete = (item: ExpenseRow) => {
    if (!confirm(t("expenses.deleteAsk"))) return;
    deleteExpense.mutate(item.id, {
      onSuccess: () => void invalidateExpenses(),
      onError: (e) => alert(apiErrorMessage(e, t("common.saveFailed"))),
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
    });
  };

  const applyFilters = () => {
    setApplied({
      invoiceNo: filterInvoice.trim(),
      from: filterFrom || todayDate(),
      to: filterTo || todayDate(),
      expenseTypeId: Number(filterTypeId) || 0,
      filterBranchId: Number(filterBranchId) || 0,
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
              className="rounded-full h-12 px-4 text-[15px] font-bold gap-2 touch-manipulation"
              onClick={() => setTypesOpen(true)}
            >
              <Layers className="w-5 h-5" />
              {t("expenses.types")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-full h-12 px-4 text-[15px] font-bold gap-2 touch-manipulation"
              onClick={() => void printReport()}
            >
              <FileSpreadsheet className="w-5 h-5" />
              {t("expenses.reportA4")}
            </Button>
          </>
        }
        toolbar={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end">
            <div>
              <label className="text-[13px] font-bold text-muted-foreground mb-1 block">
                {t("expenses.invoiceNo")}
              </label>
              <div className="relative">
                <Hash className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="h-11 ps-9 text-[15px] font-bold"
                  dir="ltr"
                  value={filterInvoice}
                  onChange={(e) => setFilterInvoice(e.target.value)}
                  placeholder="…"
                />
              </div>
            </div>
            <div>
              <label className="text-[13px] font-bold text-muted-foreground mb-1 block">
                {t("expenses.fromDate")}
              </label>
              <YmdDateInput
                className="h-11 text-[15px] font-bold tabular-nums"
                value={filterFrom}
                onChange={setFilterFrom}
              />
            </div>
            <div>
              <label className="text-[13px] font-bold text-muted-foreground mb-1 block">
                {t("expenses.toDate")}
              </label>
              <YmdDateInput
                className="h-11 text-[15px] font-bold tabular-nums"
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
              size="sm"
              labelClassName="text-[13px] font-bold text-muted-foreground"
              valueClassName="text-[15px] font-bold"
            />
            <ModernCombobox
              value={filterBranchId}
              onChange={setFilterBranchId}
              options={filterBranchOptions}
              label={t("common.branch")}
              placeholder={t("expenses.allBranches")}
              icon={Building2}
              searchable
              size="sm"
              labelClassName="text-[13px] font-bold text-muted-foreground"
              valueClassName="text-[15px] font-bold"
            />
            <Button
              type="button"
              className="h-11 rounded-xl text-[15px] font-bold touch-manipulation"
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
        <div className="space-y-3.5 touch-ui">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[16px] font-bold text-foreground mb-1.5 block">
                {t("expenses.invoiceNo")}
              </label>
              <div className="relative">
                <Hash className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="h-12 ps-9 text-[16px] font-bold bg-secondary/50 text-muted-foreground cursor-not-allowed"
                  value={editing ? form.invoiceNo : t("expenses.invoiceAutoShort")}
                  readOnly
                  disabled
                  dir="ltr"
                />
              </div>
              <p className="text-[12px] text-muted-foreground mt-1 font-semibold">
                {editing ? t("expenses.invoiceLocked") : t("expenses.invoiceAuto")}
              </p>
            </div>
            <div>
              <label className="text-[16px] font-bold text-foreground mb-1.5 block">
                {t("common.date")} *
              </label>
              <YmdDateInput
                className="h-12 text-[16px] font-bold tabular-nums tracking-wide"
                value={form.expenseDate}
                onChange={(expenseDate) => {
                  setForm((f) => ({ ...f, expenseDate }));
                  if (formError) setFormError("");
                }}
              />
            </div>
            <ModernCombobox
              value={form.expenseTypeId}
              onChange={(expenseTypeId) => {
                setForm((f) => ({ ...f, expenseTypeId }));
                if (formError) setFormError("");
              }}
              options={typeOptions}
              label={`${t("expenses.type")} *`}
              placeholder={t("expenses.pickType")}
              icon={Tags}
              labelClassName="text-[16px] font-bold text-foreground"
              valueClassName="text-[16px] font-bold"
            />
            <ModernCombobox
              value={form.branchId}
              onChange={(branchId) => {
                setForm((f) => ({ ...f, branchId }));
                if (formError) setFormError("");
              }}
              options={branchOptions}
              label={`${t("common.branch")} *`}
              placeholder={t("expenses.pickBranch")}
              icon={Building2}
              labelClassName="text-[16px] font-bold text-foreground"
              valueClassName="text-[16px] font-bold"
            />
            <div>
              <label className="text-[16px] font-bold text-foreground mb-1.5 block">
                {t("common.amount")} *
              </label>
              <div className="relative">
                <Wallet className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-12 ps-9 text-[16px] font-bold"
                  dir="ltr"
                  value={form.amount}
                  placeholder="0"
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      amount: e.target.value === "" ? "" : Number(e.target.value),
                    }));
                    if (formError) setFormError("");
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-[16px] font-bold text-foreground mb-1.5 block">
                {t("common.notes")}
              </label>
              <div className="relative">
                <StickyNote className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="h-12 ps-9 text-[16px] font-bold"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t("common.optional")}
                />
              </div>
            </div>
          </div>
          {formError ? (
            <p className="text-[15px] font-bold text-destructive">{formError}</p>
          ) : null}
          <div className="flex gap-2.5 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-full text-[16px] font-bold"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              className="flex-1 h-12 rounded-full text-[16px] font-bold"
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] font-semibold text-muted-foreground">
              {t("expenses.typesHint")}
            </p>
            <Button
              type="button"
              className="h-11 rounded-full px-4 text-[15px] font-bold gap-2 shrink-0"
              onClick={openAddType}
            >
              <Plus className="w-4 h-4" />
              {t("common.add")}
            </Button>
          </div>

          <div className="rounded-2xl border border-border/60 overflow-hidden">
            {(expenseTypes ?? []).length === 0 ? (
              <div className="py-10 text-center text-[15px] font-bold text-muted-foreground">
                {t("common.noData")}
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {(expenseTypes ?? []).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-secondary/30"
                  >
                    <div className="min-w-0">
                      <p className="text-[16px] font-extrabold truncate">{row.name}</p>
                      {row.notes?.trim() ? (
                        <p className="text-[13px] font-semibold text-muted-foreground truncate mt-0.5">
                          {row.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11"
                        onClick={() => openEditType(row)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteType(row)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-[15px] font-bold text-foreground mb-1.5 block">
              {t("expenses.typeName")} *
            </label>
            <Input
              className="h-12 text-[16px] font-bold"
              value={typeForm.name}
              onChange={(e) => {
                setTypeForm((f) => ({ ...f, name: e.target.value }));
                if (typeError) setTypeError("");
              }}
            />
          </div>
          <div>
            <label className="text-[15px] font-bold text-foreground mb-1.5 block">
              {t("common.notes")}
            </label>
            <Input
              className="h-12 text-[16px] font-bold"
              value={typeForm.notes}
              onChange={(e) => setTypeForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t("common.optional")}
            />
          </div>
          {typeError ? (
            <p className="text-[15px] font-bold text-destructive">{typeError}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-full text-[15px] font-bold"
              onClick={() => {
                setTypeFormOpen(false);
                setEditingType(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              className="flex-1 h-12 rounded-full text-[15px] font-bold"
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
