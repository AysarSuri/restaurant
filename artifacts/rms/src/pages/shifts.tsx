import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetShifts,
  useCreateShift,
  useCloseShift,
  useDeleteShift,
  useGetBranches,
  getGetShiftsQueryKey,
  getShiftReport,
  type Shift,
  type ShiftKind,
  type ShiftReport,
} from "@workspace/api-client-react";
import { Button, Input, Badge, Dialog, Card } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { LockedBranchField } from "@/components/locked-branch-field";
import { YmdDateInput } from "@/components/ymd-date-input";
import { useScopedBranch } from "@/hooks/use-scoped-branch";
import { useBranch } from "@/lib/branch-context";
import { useCurrency } from "@/hooks/use-currency";
import { useI18n } from "@/i18n";
import { printShiftReportThermal } from "@/lib/print-receipt";
import { getOrCreateDeviceKey } from "@/lib/device-id";
import {
  Plus,
  Trash2,
  Clock3,
  Building2,
  SunMedium,
  MoonStar,
  Lock,
  Unlock,
  AlertTriangle,
  FileText,
  Printer,
  Eye,
} from "lucide-react";

const KIND_META: Record<
  ShiftKind,
  {
    labelKey: string;
    hintKey: string;
    color: string;
    soft: string;
    icon: typeof SunMedium;
  }
> = {
  morning: {
    labelKey: "shifts.kindMorning",
    hintKey: "shifts.kindMorningHint",
    color: "#0ea5e9",
    soft: "from-sky-400/25 via-sky-500/10 to-amber-300/15",
    icon: SunMedium,
  },
  evening: {
    labelKey: "shifts.kindEvening",
    hintKey: "shifts.kindEveningHint",
    color: "#64748b",
    soft: "from-slate-500/30 via-slate-600/15 to-indigo-500/10",
    icon: MoonStar,
  },
};

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function moneyRow(label: string, value: string, emphasize = false) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-1.5 ${
        emphasize ? "border-t border-border/60 pt-2 mt-1" : ""
      }`}
    >
      <span className={`text-sm ${emphasize ? "font-extrabold" : "font-bold text-muted-foreground"}`}>
        {label}
      </span>
      <span
        className={`tabular-nums text-sm font-extrabold ${emphasize ? "text-base" : ""}`}
        dir="ltr"
      >
        {value}
      </span>
    </div>
  );
}

export default function ShiftsPage() {
  const { t } = useI18n();
  const { format: fmtMoney } = useCurrency();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const {
    locked,
    forcedBranchId,
    filterOptions,
    resolveWriteBranchId,
    canPickBranch,
    canViewAllBranches,
  } = useScopedBranch();
  /**
   * Managers load ALL branch shifts (x-branch-id: all) so open/close rules
   * are per-branch across devices — not tied to the device's selected branch.
   * Locked users only see their assigned branch.
   */
  const shiftsScopeKey =
    canViewAllBranches || !locked
      ? "all"
      : forcedBranchId != null
        ? String(forcedBranchId)
        : "all";
  const { data: shifts, isLoading, refetch: refetchShifts } = useGetShifts({
    query: {
      queryKey: [...getGetShiftsQueryKey(), "form", shiftsScopeKey],
      staleTime: 1_500,
      refetchInterval: 4_000,
      refetchOnWindowFocus: true,
    },
    request:
      shiftsScopeKey === "all"
        ? { headers: { "x-branch-id": "all" } }
        : { headers: { "x-branch-id": shiftsScopeKey } },
  });
  const { data: branches } = useGetBranches();
  const { mutate: createShift, isPending: isCreating } = useCreateShift();
  const { mutate: closeShift, isPending: isClosing } = useCloseShift();
  const { mutate: deleteShift, isPending: isDeleting } = useDeleteShift();

  const [filterFrom, setFilterFrom] = useState(todayYmd);
  const [filterTo, setFilterTo] = useState(todayYmd);
  const [filterKind, setFilterKind] = useState<ShiftKind | "all">("all");
  const [filterBranchId, setFilterBranchId] = useState(() =>
    selectedBranchId !== "all" ? String(selectedBranchId) : ""
  );
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [closeTarget, setCloseTarget] = useState<Shift | null>(null);
  const [detailShift, setDetailShift] = useState<Shift | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [kind, setKind] = useState<ShiftKind | "">("morning");
  const [branchId, setBranchId] = useState<number | "">("");
  const [openDate, setOpenDate] = useState(todayYmd);
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState("");

  const activeBranches = useMemo(
    () => filterOptions((branches ?? []).filter((b) => b.isActive !== false)),
    [branches, filterOptions]
  );

  useEffect(() => {
    if (!locked || forcedBranchId == null) return;
    setBranchId(forcedBranchId);
    setFilterBranchId(String(forcedBranchId));
  }, [locked, forcedBranchId]);

  useEffect(() => {
    if (locked) return;
    if (selectedBranchId === "all") {
      setFilterBranchId("");
      return;
    }
    setFilterBranchId(String(selectedBranchId));
  }, [locked, selectedBranchId]);

  const branchOptions = useMemo<ComboboxOption[]>(
    () =>
      activeBranches.map((b) => ({
        value: String(b.id),
        label: b.name,
        icon: Building2,
      })),
    [activeBranches]
  );

  const filterBranchOptions = useMemo<ComboboxOption[]>(
    () =>
      locked
        ? branchOptions
        : [{ value: "", label: t("expenses.allBranches"), icon: Building2 }, ...branchOptions],
    [branchOptions, locked, t]
  );

  const shiftsQueryKey = [...getGetShiftsQueryKey(), "form", shiftsScopeKey] as const;

  const syncShifts = (next: Shift[]) => {
    queryClient.setQueryData<Shift[]>(shiftsQueryKey, next);
    queryClient.setQueryData<Shift[]>(getGetShiftsQueryKey(), next);
    void queryClient.invalidateQueries({ queryKey: getGetShiftsQueryKey() });
  };

  const filtered = useMemo(() => {
    const list = shifts ?? [];
    const branchFilter =
      locked && forcedBranchId != null
        ? forcedBranchId
        : Number(filterBranchId) || 0;
    const scoped = branchFilter
      ? list.filter((s) => s.branchId === branchFilter)
      : list;

    const from = filterFrom || todayYmd();
    const to = filterTo || todayYmd();
    // Always show currently-open shifts so they can be closed (even outside date filter)
    const byDate = scoped.filter((s) => {
      if (s.isOpen === true && (s.closedAt == null || s.closedAt === "")) return true;
      const od = s.openDate || "";
      return od >= from && od <= to;
    });

    return filterKind === "all"
      ? byDate
      : byDate.filter((s) => s.kind === filterKind);
  }, [
    shifts,
    locked,
    forcedBranchId,
    filterBranchId,
    filterFrom,
    filterTo,
    filterKind,
  ]);

  const stats = useMemo(() => {
    const list = filtered;
    return {
      total: list.length,
      open: list.filter((s) => s.isOpen).length,
      morning: list.filter((s) => s.kind === "morning").length,
      evening: list.filter((s) => s.kind === "evening").length,
    };
  }, [filtered]);

  const openAdd = () => {
    const defaultBranch =
      forcedBranchId ??
      (selectedBranchId !== "all"
        ? selectedBranchId
        : activeBranches.length === 1
          ? activeBranches[0].id
          : "");
    setKind("morning");
    setBranchId(locked && forcedBranchId != null ? forcedBranchId : defaultBranch);
    setOpenDate(todayYmd());
    setNotes("");
    setSubmitError("");
    setFormOpen(true);
    void refetchShifts();
  };

  /** True open shift only: server sets isOpen when closedAt is null. */
  const findOpenForBranch = (bid: number) =>
    (shifts ?? []).find(
      (s) =>
        s.branchId === bid &&
        s.isOpen === true &&
        (s.closedAt == null || s.closedAt === "")
    ) ?? null;

  /** Open shift for the selected form branch only (shared DB — all devices). */
  const openShiftForBranch = useMemo(() => {
    if (branchId === "" || !Number(branchId)) return null;
    return findOpenForBranch(Number(branchId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- findOpenForBranch uses shifts
  }, [shifts, branchId]);

  const handleOpenShift = () => {
    setSubmitError("");
    if (!kind) {
      setSubmitError(t("shifts.errKind"));
      return;
    }
    const writeBranchId = resolveWriteBranchId(branchId);
    if (!writeBranchId || !Number.isFinite(writeBranchId)) {
      setSubmitError(t("shifts.errBranch"));
      return;
    }
    if (!openDate) {
      setSubmitError(t("shifts.errOpenDate"));
      return;
    }
    const stillOpen = findOpenForBranch(writeBranchId);
    if (stillOpen) {
      setSubmitError(
        t("shifts.errBranchAlreadyOpen", {
          name: t(KIND_META[stillOpen.kind].labelKey),
        })
      );
      void refetchShifts();
      return;
    }
    createShift(
      {
        data: {
          kind,
          branchId: writeBranchId,
          openedAt: openDate,
          notes: notes.trim() || null,
          deviceKey: getOrCreateDeviceKey(),
        },
      },
      {
        onSuccess: (created) => {
          syncShifts([created, ...(shifts ?? []).filter((s) => s.id !== created.id)]);
          void refetchShifts();
          setFormOpen(false);
        },
        onError: (err: any) => {
          const msg =
            err?.data?.message ||
            err?.data?.error ||
            err?.message ||
            t("shifts.saveFailed");
          setSubmitError(String(msg));
          void refetchShifts();
        },
      }
    );
  };

  const confirmClose = () => {
    if (!closeTarget) return;
    closeShift(
      { id: closeTarget.id },
      {
        onSuccess: (updated) => {
          syncShifts((shifts ?? []).map((s) => (s.id === updated.id ? updated : s)));
          void refetchShifts();
          setCloseTarget(null);
        },
        onError: () => {
          void refetchShifts();
        },
      }
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteShift(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          syncShifts((shifts ?? []).filter((s) => s.id !== deleteTarget.id));
          setDeleteTarget(null);
        },
      }
    );
  };

  const toPrintPayload = (data: ShiftReport) => ({
    restaurantName: data.restaurantName,
    logoUrl: data.logoUrl,
    mobile: data.mobile,
    branchName: data.branchName,
    branchAddress: data.branchAddress,
    shiftKindLabel: t(KIND_META[data.shift.kind].labelKey),
    openedAtLabel: formatDateTime(data.openedAt),
    closedAtLabel: data.closedAt ? formatDateTime(data.closedAt) : "—",
    sales: {
      byCategory: data.sales.byCategory.map((c) => ({
        name: c.name,
        amount: c.amount,
      })),
      total: data.sales.total,
      discountTotal: data.sales.discountTotal,
      receivedTotal: data.sales.receivedTotal,
      unpaidTotal: data.sales.unpaidTotal ?? 0,
      unpaidCount: data.sales.unpaidCount ?? 0,
    },
    expenses: {
      total: data.expenses.total,
      items: data.expenses.items.map((e) => ({
        label: e.label || "مصروف",
        amount: e.amount ?? 0,
        invoiceNo: e.invoiceNo,
      })),
    },
    cashMovements: {
      show: data.cashMovements.show,
      withdrawalsTotal: data.cashMovements.withdrawalsTotal,
      returnsTotal: data.cashMovements.returnsTotal,
      withdrawals: data.cashMovements.withdrawals.map((w) => ({
        invoiceNo: w.invoiceNo,
        amount: w.amount ?? 0,
        notes: w.notes,
      })),
      returns: data.cashMovements.returns.map((w) => ({
        invoiceNo: w.invoiceNo,
        amount: w.amount ?? 0,
        notes: w.notes,
      })),
    },
    suppliers: {
      show: data.suppliers.show,
      purchasesTotal: data.suppliers.purchasesTotal,
      returnsTotal: data.suppliers.returnsTotal,
      paidTotal: data.suppliers.paidTotal,
      receivedTotal: data.suppliers.receivedTotal,
      discountTotal: data.suppliers.discountTotal,
      purchases: data.suppliers.purchases.map((p) => ({
        invoiceNo: p.invoiceNo,
        totalAmount: p.totalAmount ?? 0,
      })),
      returns: data.suppliers.returns.map((p) => ({
        invoiceNo: p.invoiceNo,
        totalAmount: p.totalAmount ?? 0,
      })),
    },
    formatMoney: fmtMoney,
  });

  const loadReport = async (shift: Shift) => {
    setReportLoading(true);
    setReportError("");
    try {
      const data = await getShiftReport(shift.id);
      setReport(data);
      return data;
    } catch (err: any) {
      setReportError(err?.data?.message || err?.message || t("shifts.reportFailed"));
      setReport(null);
      return null;
    } finally {
      setReportLoading(false);
    }
  };

  const openDetails = async (shift: Shift) => {
    setDetailShift(shift);
    setReport(null);
    await loadReport(shift);
  };

  const printReport = async (shift: Shift) => {
    setPrintingId(shift.id);
    try {
      const data =
        detailShift?.id === shift.id && report ? report : await getShiftReport(shift.id);
      if (!data) return;
      printShiftReportThermal(toPrintPayload(data));
    } catch (err: any) {
      setReportError(err?.data?.message || err?.message || t("shifts.reportFailed"));
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-l from-sky-500/15 via-card to-card p-5 sm:p-7">
        <div className="absolute -top-16 -start-10 h-44 w-44 rounded-full bg-sky-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -end-8 h-48 w-48 rounded-full bg-slate-400/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-display tracking-[0.22em] uppercase text-sky-600 dark:text-sky-300 mb-2">
              {t("shifts.eyebrow")}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/25">
                <Clock3 className="w-5 h-5" />
              </span>
              {t("shifts.title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
              {t("shifts.subtitleSimple")}
            </p>
          </div>
          <Button className="h-12 px-5 gap-2 shadow-lg shadow-sky-500/20" onClick={openAdd}>
            <Plus className="w-5 h-5" />
            {t("shifts.openShift")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: t("shifts.statTotal"), value: stats.total, icon: Clock3, tone: "text-sky-600" },
          { label: t("shifts.statOpen"), value: stats.open, icon: Unlock, tone: "text-emerald-600" },
          { label: t("shifts.kindMorning"), value: stats.morning, icon: SunMedium, tone: "text-sky-500" },
          { label: t("shifts.kindEvening"), value: stats.evening, icon: MoonStar, tone: "text-slate-500" },
        ].map((card) => (
          <Card
            key={card.label}
            className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3.5 flex items-center gap-3"
          >
            <span
              className={`h-10 w-10 rounded-xl bg-secondary/80 flex items-center justify-center ${card.tone}`}
            >
              <card.icon className="w-5 h-5" />
            </span>
            <div>
              <p className="text-[11px] text-muted-foreground font-bold">{card.label}</p>
              <p className="text-xl font-display font-extrabold tabular-nums">{card.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/80 p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground mb-1.5">
              {t("expenses.fromDate")}
            </p>
            <YmdDateInput
              value={filterFrom}
              onChange={setFilterFrom}
              className="h-11 rounded-xl"
            />
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-foreground mb-1.5">
              {t("expenses.toDate")}
            </p>
            <YmdDateInput
              value={filterTo}
              onChange={setFilterTo}
              className="h-11 rounded-xl"
            />
          </div>
          <div>
            {!canPickBranch || locked ? (
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
                size="sm"
                labelClassName="text-[11px] font-bold text-muted-foreground"
                valueClassName="text-sm font-extrabold"
              />
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-foreground mb-1.5">
              {t("shifts.filterKind")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "all" as const, label: t("common.all") },
                  { id: "morning" as const, label: t("shifts.kindMorning") },
                  { id: "evening" as const, label: t("shifts.kindEvening") },
                ] as const
              ).map((opt) => {
                const selected = filterKind === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilterKind(opt.id)}
                    className={`h-11 rounded-xl border-2 text-sm font-extrabold touch-manipulation transition-all ${
                      selected
                        ? "border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300"
                        : "border-border/60 bg-secondary/40 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <p className="text-[11px] font-semibold text-muted-foreground">
          {t("shifts.filterByOpenDateHint")}
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-dashed border-border/70 py-20 text-center text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-secondary/20 py-16 text-center">
          <Clock3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-bold">{t("shifts.empty")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("shifts.emptyHintSimple")}</p>
          <Button className="mt-5 gap-2" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            {t("shifts.openShift")}
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card/90 overflow-hidden shadow-[0_18px_40px_-28px_rgba(0,0,0,0.35)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[13px] border-collapse">
              <thead>
                <tr className="bg-secondary/55 border-b border-border/60">
                  <th className="px-3 py-3.5 text-start font-extrabold whitespace-nowrap">
                    {t("shifts.kind")}
                  </th>
                  <th className="px-3 py-3.5 text-start font-extrabold whitespace-nowrap">
                    {t("common.branch")}
                  </th>
                  <th className="px-3 py-3.5 text-start font-extrabold whitespace-nowrap">
                    {t("shifts.status")}
                  </th>
                  <th className="px-3 py-3.5 text-start font-extrabold whitespace-nowrap">
                    {t("shifts.openedAt")}
                  </th>
                  <th className="px-3 py-3.5 text-start font-extrabold whitespace-nowrap">
                    {t("shifts.closedAt")}
                  </th>
                  <th className="px-3 py-3.5 text-start font-extrabold whitespace-nowrap min-w-[22rem]">
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((shift, idx) => {
                  const meta = KIND_META[shift.kind] ?? KIND_META.morning;
                  const Icon = meta.icon;
                  const color = shift.color || meta.color;
                  return (
                    <tr
                      key={shift.id}
                      className={`border-b border-border/40 last:border-b-0 hover:bg-sky-500/[0.06] transition-colors ${
                        idx % 2 === 1 ? "bg-secondary/20" : "bg-transparent"
                      }`}
                    >
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 border"
                            style={{
                              backgroundColor: `${color}22`,
                              color,
                              borderColor: `${color}55`,
                            }}
                          >
                            <Icon className="w-5 h-5" />
                          </span>
                          <span className="font-extrabold text-[15px] whitespace-nowrap">
                            {t(meta.labelKey)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className="inline-flex items-center gap-1.5 font-bold text-sm whitespace-nowrap">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {shift.branchName || t("branch.noneSpecified")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <Badge
                          className={
                            shift.isOpen
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30"
                          }
                        >
                          {shift.isOpen ? t("shifts.statusOpen") : t("shifts.statusClosed")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span
                          className="font-display font-extrabold tabular-nums text-sm whitespace-nowrap"
                          dir="ltr"
                        >
                          {formatDateTime(shift.openedAt)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span
                          className="font-display font-extrabold tabular-nums text-sm whitespace-nowrap"
                          dir="ltr"
                        >
                          {shift.closedAt
                            ? formatDateTime(shift.closedAt)
                            : t("shifts.stillOpen")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex items-center gap-2 flex-nowrap">
                          {!shift.isOpen ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void openDetails(shift)}
                                className="h-12 min-w-[6.75rem] px-3 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 flex items-center justify-center gap-1.5 text-sm font-extrabold touch-manipulation active:scale-[0.98]"
                              >
                                <Eye className="w-4 h-4" />
                                {t("shifts.showDetails")}
                              </button>
                              <button
                                type="button"
                                disabled={printingId === shift.id}
                                onClick={() => void printReport(shift)}
                                className="h-12 min-w-[6.75rem] px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 flex items-center justify-center gap-1.5 text-sm font-extrabold touch-manipulation active:scale-[0.98] disabled:opacity-60"
                              >
                                <Printer className="w-4 h-4" />
                                {t("shifts.printReport")}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCloseTarget(shift)}
                              className="h-12 min-w-[6.75rem] px-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 flex items-center justify-center gap-1.5 text-sm font-extrabold touch-manipulation active:scale-[0.98]"
                            >
                              <Lock className="w-4 h-4" />
                              {t("shifts.close")}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(shift)}
                            className="h-12 min-w-[5.5rem] px-3 rounded-xl border border-rose-500/35 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 flex items-center justify-center gap-1.5 text-sm font-extrabold touch-manipulation active:scale-[0.98]"
                            aria-label={t("common.delete")}
                          >
                            <Trash2 className="w-4 h-4" />
                            {t("common.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={t("shifts.openShift")}
        maxWidth="max-w-xl"
      >
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">{t("shifts.openHint")}</p>
          {submitError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive font-bold flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          ) : null}

          <div>
            <p className="text-sm font-extrabold mb-2.5">{t("shifts.kind")}</p>
            <div className="grid grid-cols-2 gap-3">
              {(["morning", "evening"] as const).map((k) => {
                const meta = KIND_META[k];
                const Icon = meta.icon;
                const selected = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`relative min-h-[7.5rem] touch-manipulation overflow-hidden rounded-[1.35rem] border-2 p-4 text-start transition-all active:scale-[0.98] ${
                      selected
                        ? "shadow-lg"
                        : "border-border/60 bg-card/70 hover:border-border"
                    }`}
                    style={
                      selected
                        ? {
                            borderColor: meta.color,
                            boxShadow: `0 14px 32px -18px ${meta.color}`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${meta.soft} pointer-events-none ${
                        selected ? "opacity-100" : "opacity-50"
                      }`}
                    />
                    <div className="relative flex h-full flex-col justify-between gap-3">
                      <span
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border"
                        style={{
                          backgroundColor: `${meta.color}22`,
                          borderColor: `${meta.color}55`,
                          color: meta.color,
                        }}
                      >
                        <Icon className="w-6 h-6" />
                      </span>
                      <div>
                        <p className="text-lg font-black leading-none">{t(meta.labelKey)}</p>
                        <p className="mt-1.5 text-xs font-bold text-muted-foreground">
                          {t(meta.hintKey)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex h-2.5 w-2.5 rounded-full ${
                          selected ? "opacity-100" : "opacity-40"
                        }`}
                        style={{ backgroundColor: meta.color }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            {!canPickBranch || locked ? (
              <LockedBranchField label={t("common.branch")} />
            ) : (
              <>
                <p className="text-sm font-extrabold mb-2.5">{t("common.branch")}</p>
                {activeBranches.length > 0 && activeBranches.length <= 6 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeBranches.map((b) => {
                      const selected = branchId === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBranchId(b.id)}
                          className={`min-h-14 touch-manipulation rounded-2xl border-2 px-4 py-3 text-start transition-all active:scale-[0.98] ${
                            selected
                              ? "border-primary bg-primary/10 shadow-md shadow-primary/15"
                              : "border-border/60 bg-card/70 hover:border-primary/35"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                selected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              <Building2 className="w-5 h-5" />
                            </span>
                            <span className="font-extrabold text-sm sm:text-base truncate">
                              {b.name}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <ModernCombobox
                    icon={Building2}
                    value={branchId === "" ? "" : String(branchId)}
                    onChange={(v) => setBranchId(v ? Number(v) : "")}
                    options={branchOptions}
                    placeholder={t("shifts.chooseBranch")}
                    searchPlaceholder={t("branch.search")}
                  />
                )}
              </>
            )}
            {openShiftForBranch ? (
              <div className="mt-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-3 text-sm font-bold text-amber-800 dark:text-amber-200">
                {t("shifts.errBranchAlreadyOpen", {
                  name: t(KIND_META[openShiftForBranch.kind].labelKey),
                })}
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-extrabold mb-2.5">
              {t("shifts.openDate")}
            </label>
            <div className="rounded-2xl border border-border/60 bg-secondary/30 p-2">
              <YmdDateInput value={openDate} onChange={setOpenDate} />
            </div>
            <p className="text-xs text-muted-foreground mt-2 font-semibold">
              {t("shifts.openDateHint")}
            </p>
          </div>

          <div>
            <label className="block text-sm font-extrabold mb-2.5">{t("common.notes")}</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("shifts.notesOptional")}
              className="h-14 rounded-2xl text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button
              variant="outline"
              className="h-14 rounded-2xl text-base font-extrabold touch-manipulation"
              onClick={() => setFormOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              isLoading={isCreating}
              disabled={Boolean(openShiftForBranch)}
              onClick={handleOpenShift}
              className="h-14 rounded-2xl text-base font-extrabold gap-2 touch-manipulation shadow-lg shadow-primary/20"
            >
              <Unlock className="w-5 h-5" />
              {t("shifts.openShift")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={Boolean(closeTarget)}
        onClose={() => setCloseTarget(null)}
        title={t("shifts.closeTitle")}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("shifts.closeAsk", {
              name: closeTarget ? t(KIND_META[closeTarget.kind].labelKey) : "",
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-14 rounded-2xl text-base font-extrabold touch-manipulation"
              onClick={() => setCloseTarget(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              isLoading={isClosing}
              onClick={confirmClose}
              className="h-14 rounded-2xl text-base font-extrabold gap-2 touch-manipulation"
            >
              <Lock className="w-5 h-5" />
              {t("shifts.close")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("shifts.deleteTitle")}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("shifts.deleteAskSimple", {
              name: deleteTarget ? t(KIND_META[deleteTarget.kind].labelKey) : "",
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-14 rounded-2xl text-base font-extrabold touch-manipulation"
              onClick={() => setDeleteTarget(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              isLoading={isDeleting}
              onClick={confirmDelete}
              className="h-14 rounded-2xl text-base font-extrabold touch-manipulation"
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={Boolean(detailShift)}
        onClose={() => {
          setDetailShift(null);
          setReport(null);
          setReportError("");
        }}
        title={t("shifts.reportTitle")}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pe-1">
          {reportLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("common.loading")}
            </p>
          ) : reportError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive font-bold">
              {reportError}
            </div>
          ) : report ? (
            <>
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-secondary/50 to-card p-4">
                <div className="flex items-start gap-3">
                  {report.logoUrl ? (
                    <img
                      src={report.logoUrl}
                      alt=""
                      className="h-14 w-14 rounded-xl object-contain border border-border/50 bg-white"
                    />
                  ) : (
                    <span className="h-14 w-14 rounded-xl bg-sky-500/15 text-sky-600 flex items-center justify-center border border-sky-500/25">
                      <FileText className="w-6 h-6" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold leading-tight">
                      {report.restaurantName}
                    </p>
                    <p className="text-sm font-bold text-muted-foreground mt-0.5">
                      {report.branchName}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground mt-1">
                      {t(KIND_META[report.shift.kind].labelKey)} ·{" "}
                      <span dir="ltr">{formatDateTime(report.openedAt)}</span>
                      {" → "}
                      <span dir="ltr">
                        {report.closedAt ? formatDateTime(report.closedAt) : "—"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <section className="rounded-2xl border border-border/60 p-4">
                <h3 className="text-sm font-extrabold mb-2 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  {t("shifts.salesByCategory")}
                </h3>
                {report.sales.byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("shifts.noSales")}</p>
                ) : (
                  <div className="space-y-1">
                    {report.sales.byCategory.map((c) => (
                      <div key={c.categoryId} className="flex justify-between gap-3 text-sm">
                        <span className="font-bold">{c.name}</span>
                        <span className="font-extrabold tabular-nums" dir="ltr">
                          {fmtMoney(c.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 rounded-xl bg-secondary/50 px-3 py-2">
                  {moneyRow(t("shifts.salesTotal"), fmtMoney(report.sales.total))}
                  {moneyRow(
                    t("shifts.salesDiscounts"),
                    fmtMoney(report.sales.discountTotal)
                  )}
                  {moneyRow(
                    t("shifts.salesReceived"),
                    fmtMoney(report.sales.receivedTotal),
                    true
                  )}
                  {(report.sales.unpaidCount ?? 0) > 0 ||
                  Math.abs(report.sales.unpaidTotal ?? 0) > 0.009 ? (
                    <>
                      {moneyRow(
                        t("shifts.salesUnpaid"),
                        fmtMoney(report.sales.unpaidTotal ?? 0)
                      )}
                      <div className="flex justify-between gap-3 text-xs text-muted-foreground mt-1">
                        <span>{t("shifts.salesUnpaidCount")}</span>
                        <span className="tabular-nums" dir="ltr">
                          {report.sales.unpaidCount ?? 0}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>

              <section className="rounded-2xl border border-border/60 p-4">
                <h3 className="text-sm font-extrabold mb-2">{t("shifts.expensesSection")}</h3>
                {moneyRow(t("shifts.expensesTotal"), fmtMoney(report.expenses.total), true)}
                {report.expenses.items.length > 0 ? (
                  <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
                    {report.expenses.items.map((e) => (
                      <div key={e.id} className="flex justify-between gap-3 text-sm">
                        <span className="font-bold text-muted-foreground">
                          {e.label}
                          {e.invoiceNo ? ` · #${e.invoiceNo}` : ""}
                        </span>
                        <span className="font-extrabold tabular-nums" dir="ltr">
                          {fmtMoney(e.amount ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              {report.cashMovements.show ? (
                <section className="rounded-2xl border border-border/60 p-4">
                  <h3 className="text-sm font-extrabold mb-2">
                    {t("shifts.cashMovementsSection")}
                  </h3>
                  {moneyRow(
                    t("shifts.withdrawalsTotal"),
                    fmtMoney(report.cashMovements.withdrawalsTotal)
                  )}
                  {moneyRow(
                    t("shifts.cashReturnsTotal"),
                    fmtMoney(report.cashMovements.returnsTotal)
                  )}
                  {report.cashMovements.withdrawals.length > 0 ? (
                    <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                      <p className="text-xs font-extrabold text-muted-foreground mb-1">
                        {t("shifts.withdrawalsDetails")}
                      </p>
                      {report.cashMovements.withdrawals.map((w) => (
                        <div key={w.id} className="flex justify-between gap-3 text-sm">
                          <span className="font-bold">
                            {w.invoiceNo ? `#${w.invoiceNo}` : t("shifts.withdrawal")}
                          </span>
                          <span className="font-extrabold tabular-nums" dir="ltr">
                            {fmtMoney(w.amount ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {report.cashMovements.returns.length > 0 ? (
                    <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                      <p className="text-xs font-extrabold text-muted-foreground mb-1">
                        {t("shifts.cashReturnsDetails")}
                      </p>
                      {report.cashMovements.returns.map((w) => (
                        <div key={w.id} className="flex justify-between gap-3 text-sm">
                          <span className="font-bold">
                            {w.invoiceNo ? `#${w.invoiceNo}` : t("shifts.cashReturn")}
                          </span>
                          <span className="font-extrabold tabular-nums" dir="ltr">
                            {fmtMoney(w.amount ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {report.suppliers.show ? (
                <section className="rounded-2xl border border-border/60 p-4">
                  <h3 className="text-sm font-extrabold mb-2">
                    {t("shifts.suppliersSection")}
                  </h3>
                  {moneyRow(
                    t("shifts.purchasesTotal"),
                    fmtMoney(report.suppliers.purchasesTotal)
                  )}
                  {moneyRow(
                    t("shifts.supplierReturnsTotal"),
                    fmtMoney(report.suppliers.returnsTotal)
                  )}
                  {moneyRow(t("shifts.supplierPaid"), fmtMoney(report.suppliers.paidTotal))}
                  {moneyRow(
                    t("shifts.supplierReceived"),
                    fmtMoney(report.suppliers.receivedTotal)
                  )}
                  {moneyRow(
                    t("shifts.supplierDiscounts"),
                    fmtMoney(report.suppliers.discountTotal),
                    true
                  )}
                  {report.suppliers.purchases.length > 0 ? (
                    <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                      <p className="text-xs font-extrabold text-muted-foreground mb-1">
                        {t("shifts.purchasesDetails")}
                      </p>
                      {report.suppliers.purchases.map((p) => (
                        <div key={p.id} className="flex justify-between gap-3 text-sm">
                          <span className="font-bold">
                            {p.invoiceNo ? `#${p.invoiceNo}` : t("shifts.purchase")}
                          </span>
                          <span className="font-extrabold tabular-nums" dir="ltr">
                            {fmtMoney(p.totalAmount ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {report.suppliers.returns.length > 0 ? (
                    <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                      <p className="text-xs font-extrabold text-muted-foreground mb-1">
                        {t("shifts.supplierReturnsDetails")}
                      </p>
                      {report.suppliers.returns.map((p) => (
                        <div key={p.id} className="flex justify-between gap-3 text-sm">
                          <span className="font-bold">
                            {p.invoiceNo ? `#${p.invoiceNo}` : t("shifts.supplierReturn")}
                          </span>
                          <span className="font-extrabold tabular-nums" dir="ltr">
                            {fmtMoney(p.totalAmount ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <Button
                className="w-full h-12 rounded-2xl gap-2 font-extrabold"
                isLoading={printingId === detailShift?.id}
                onClick={() => detailShift && void printReport(detailShift)}
              >
                <Printer className="w-4 h-4" />
                {t("shifts.printReport")}
              </Button>
            </>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
