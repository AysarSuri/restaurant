import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCashMovements,
  useCreateCashMovement,
  useUpdateCashMovement,
  useDeleteCashMovement,
  useGetBranches,
  getListCashMovementsQueryKey,
  type CashMovementRow,
  type CashMovementKind,
} from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Button, Input, Dialog } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { LockedBranchField } from "@/components/locked-branch-field";
import { YmdDateInput } from "@/components/ymd-date-input";
import { useScopedBranch } from "@/hooks/use-scoped-branch";
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
};

const emptyForm = (): FormState => ({
  invoiceNo: "",
  movementDate: todayDate(),
  kind: "withdrawal",
  branchId: "",
  amount: "",
  notes: "",
});

export default function CashMovements() {
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const { locked, forcedBranchId, filterOptions } = useScopedBranch();

  const [filterInvoice, setFilterInvoice] = useState("");
  const [filterFrom, setFilterFrom] = useState(todayDate);
  const [filterTo, setFilterTo] = useState(todayDate);
  const [filterKind, setFilterKind] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");

  const [applied, setApplied] = useState(() => ({
    invoiceNo: "",
    from: todayDate(),
    to: todayDate(),
    kind: "" as CashMovementKind | "",
    filterBranchId: 0,
  }));

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
    }),
    [applied]
  );

  const { data: rows, isLoading } = useListCashMovements(listParams);
  const { data: branches } = useGetBranches();

  const createRow = useCreateCashMovement();
  const updateRow = useUpdateCashMovement();
  const deleteRow = useDeleteCashMovement();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CashMovementRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [formErrorKind, setFormErrorKind] = useState<"branch" | "general" | "">("");
  const [deleteTarget, setDeleteTarget] = useState<CashMovementRow | null>(null);
  const [deleteError, setDeleteError] = useState("");

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
    setEditing(null);
    setForm({
      ...emptyForm(),
      branchId: forcedBranchId != null ? String(forcedBranchId) : "",
    });
    setFormError("");
    setFormErrorKind("");
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

    const body = {
      movementDate: form.movementDate,
      movementTime: editing?.movementTime || nowTime(),
      kind,
      amount,
      notes: form.notes.trim() || undefined,
      branchId,
      invoiceNo: editing ? form.invoiceNo : undefined,
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
    setApplied({
      invoiceNo: filterInvoice.trim(),
      from: filterFrom || todayDate(),
      to: filterTo || todayDate(),
      kind: (filterKind as CashMovementKind | "") || "",
      filterBranchId: Number(filterBranchId) || 0,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
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
                onChange={setFilterBranchId}
                options={filterBranchOptions}
                label={t("common.branch")}
                placeholder={t("expenses.allBranches")}
                icon={Building2}
                searchable
                labelClassName="text-[14px] font-bold text-muted-foreground"
                valueClassName="text-[16px] font-bold"
              />
            )}
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
                    setForm((f) => ({ ...f, branchId }));
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
