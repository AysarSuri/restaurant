import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetVaultStatement,
  useSetVaultCashOpening,
  useGetSettings,
  getVaultStatementQueryKey,
  getGetSettingsQueryKey,
  type VaultAccountStatement,
  type VaultLedgerLine,
} from "@workspace/api-client-react";
import { Button, Input } from "@/components/ui-elements";
import { YmdDateInput } from "@/components/ymd-date-input";
import { BranchSwitcher } from "@/components/branch-switcher";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import {
  printVaultReportA4,
  printVaultReportThermal,
} from "@/lib/print-receipt";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  ShoppingBag,
  Undo2,
  Vault as VaultIcon,
  Wallet,
} from "lucide-react";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IQ", { maximumFractionDigits: 2 }).format(n);

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type FlowBucket = {
  key: string;
  label: string;
  tone: "in" | "out" | "neutral";
  amount: number;
};

function buildFlowBuckets(lines: VaultLedgerLine[]): FlowBucket[] {
  let salesIn = 0;
  let salesOut = 0;
  let supplierReturnIn = 0;
  let cashReturnIn = 0;
  let withdrawalOut = 0;
  let purchaseOut = 0;
  let expenseOut = 0;
  let supplierPaidOut = 0;
  let supplierReceivedIn = 0;
  let otherIn = 0;
  let otherOut = 0;

  for (const line of lines) {
    const abs = Math.abs(line.signed);
    if (line.source === "order") {
      if (line.signed >= 0) salesIn += abs;
      else salesOut += abs;
      continue;
    }
    if (line.source === "supplier_return") {
      supplierReturnIn += abs;
      continue;
    }
    if (line.source === "cash_movement") {
      if (line.signed >= 0) cashReturnIn += abs;
      else withdrawalOut += abs;
      continue;
    }
    if (line.source === "supplier_purchase") {
      purchaseOut += abs;
      continue;
    }
    if (line.source === "expense") {
      expenseOut += abs;
      continue;
    }
    if (line.source === "supplier_movement") {
      if (line.signed >= 0) supplierReceivedIn += abs;
      else supplierPaidOut += abs;
      continue;
    }
    if (line.signed >= 0) otherIn += abs;
    else otherOut += abs;
  }

  const buckets: FlowBucket[] = [
    { key: "salesIn", label: "مبيعات واصل (+)", tone: "in", amount: salesIn },
    { key: "salesOut", label: "مرجع مبيعات (−)", tone: "out", amount: salesOut },
    { key: "supplierReturn", label: "واصل مرجوعات", tone: "in", amount: supplierReturnIn },
    { key: "cashReturn", label: "مرجوع صندوق", tone: "in", amount: cashReturnIn },
    { key: "withdrawal", label: "سحوبات", tone: "out", amount: withdrawalOut },
    { key: "purchase", label: "دفع مشتريات", tone: "out", amount: purchaseOut },
    { key: "expense", label: "مصاريف", tone: "out", amount: expenseOut },
    { key: "supReceived", label: "واصل مورد", tone: "in", amount: supplierReceivedIn },
    { key: "supPaid", label: "مدفوع مورد", tone: "out", amount: supplierPaidOut },
  ];
  if (otherIn > 0.005) {
    buckets.push({ key: "otherIn", label: "داخل أخرى", tone: "in", amount: otherIn });
  }
  if (otherOut > 0.005) {
    buckets.push({ key: "otherOut", label: "خارج أخرى", tone: "out", amount: otherOut });
  }
  return buckets;
}

function MetricPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "in" | "out" | "neutral" | "accent";
}) {
  const toneCls =
    tone === "in"
      ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-800 dark:text-emerald-200"
      : tone === "out"
        ? "border-rose-500/25 bg-rose-500/8 text-rose-800 dark:text-rose-200"
        : tone === "accent"
          ? "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100"
          : "border-border/60 bg-background/70 text-foreground";
  return (
    <div className={`rounded-2xl border px-3.5 py-3 min-w-[7.5rem] ${toneCls}`}>
      <p className="text-[10px] font-extrabold opacity-70 mb-1">{label}</p>
      <p className="font-display text-[15px] font-black tabular-nums tracking-tight" dir="ltr">
        {fmtMoney(value)}
      </p>
    </div>
  );
}

export default function VaultPage() {
  const { formatDate } = useI18n();
  const { selectedBranchId } = useBranch();
  const queryClient = useQueryClient();

  const [from, setFrom] = useState(todayDate);
  const [to, setTo] = useState(todayDate);
  const [applied, setApplied] = useState(() => ({
    from: todayDate(),
    to: todayDate(),
  }));
  const [openingDraft, setOpeningDraft] = useState<number | "">("");
  const [activeKey, setActiveKey] = useState<string>("cash");

  const params = useMemo(
    () => ({
      from: applied.from,
      to: applied.to,
      filterBranchId:
        typeof selectedBranchId === "number" ? selectedBranchId : undefined,
    }),
    [applied, selectedBranchId]
  );

  const { data, isLoading, isFetching, refetch } = useGetVaultStatement(params, {
    query: {
      queryKey: getVaultStatementQueryKey(params),
      staleTime: 1_000,
    },
  });
  const { data: settings } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });
  const saveOpening = useSetVaultCashOpening();

  const accounts = data?.accounts ?? [];
  const active =
    accounts.find((a) => a.key === activeKey) ??
    accounts.find((a) => a.kind === "cash") ??
    accounts[0] ??
    null;

  const flowBuckets = useMemo(
    () => buildFlowBuckets(active?.lines ?? []),
    [active?.lines]
  );
  const visibleFlows = flowBuckets.filter((b) => b.amount > 0.005);

  React.useEffect(() => {
    if (data && typeof data.cashOpeningBalance === "number") {
      setOpeningDraft(data.cashOpeningBalance);
    }
  }, [data?.cashOpeningBalance]);

  React.useEffect(() => {
    if (!accounts.length) return;
    if (!accounts.some((a) => a.key === activeKey)) {
      setActiveKey(accounts[0].key);
    }
  }, [accounts, activeKey]);

  const apply = () => {
    setApplied({
      from: from || todayDate(),
      to: to || todayDate(),
    });
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getVaultStatementQueryKey(params) });
    void queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
  };

  const saveCashOpening = () => {
    const n = Number(openingDraft);
    if (!Number.isFinite(n) || n < 0) return;
    saveOpening.mutate(
      { cashOpeningBalance: n },
      { onSuccess: () => invalidate() }
    );
  };

  const toReportAccounts = (list: VaultAccountStatement[]) =>
    list.map((acc) => ({
      titleAr: acc.titleAr,
      openingBeforeFrom: acc.openingBeforeFrom,
      periodDebit: acc.periodDebit,
      periodCredit: acc.periodCredit,
      closingBalance: acc.closingBalance,
      lines: acc.lines.map((l) => ({
        dateLabel: formatDate(l.date),
        sourceAr: l.sourceAr,
        label: l.label,
        invoiceNo: l.invoiceNo,
        debit: l.debit,
        credit: l.credit,
        balanceAfter: l.balanceAfter ?? 0,
      })),
    }));

  const printA4 = () => {
    if (!data) return;
    printVaultReportA4({
      restaurantName: settings?.restaurantName?.trim() || "المطعم",
      logoUrl: settings?.logoUrl,
      mobile: settings?.mobile,
      fromLabel: formatDate(data.from),
      toLabel: formatDate(data.to),
      openingAsOfLabel: formatDate(data.openingAsOf),
      accounts: toReportAccounts(data.accounts),
      formatMoney: fmtMoney,
    });
  };

  const printThermal = () => {
    if (!data) return;
    printVaultReportThermal({
      restaurantName: settings?.restaurantName?.trim() || "المطعم",
      logoUrl: settings?.logoUrl,
      mobile: settings?.mobile,
      fromLabel: formatDate(data.from),
      toLabel: formatDate(data.to),
      openingAsOfLabel: formatDate(data.openingAsOf),
      accounts: toReportAccounts(
        active ? [active] : data.accounts.filter((a) => a.kind === "cash").slice(0, 1)
      ),
      formatMoney: fmtMoney,
    });
  };

  return (
    <div className="relative min-h-[calc(100vh-5rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-28 -start-12 h-80 w-80 rounded-full bg-emerald-500/12 blur-3xl" />
        <div className="absolute top-40 -end-20 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-10 start-1/3 h-64 w-64 rounded-full bg-amber-400/8 blur-3xl" />
      </div>

      <div className="max-w-[90rem] mx-auto space-y-5 pb-12">
        {/* ── Header ─────────────────────────────────────── */}
        <header className="rounded-[1.75rem] border border-border/50 bg-gradient-to-l from-emerald-500/[0.12] via-background/90 to-sky-500/[0.08] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_50px_-34px_rgba(16,185,129,0.45)]">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                <VaultIcon className="w-3.5 h-3.5" />
                قاصة المطعم
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">القاصة</h1>
              <p className="text-sm font-semibold text-muted-foreground max-w-2xl">
                ملخص الأرصدة والحركات في الأعلى — تفاصيل الكشف كاملة في الأسفل.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BranchSwitcher />
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full px-4 font-bold gap-2"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                تحديث
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full px-4 font-bold gap-2"
                onClick={printA4}
                disabled={!data}
              >
                <FileText className="w-4 h-4" />
                A4
              </Button>
              <Button
                type="button"
                className="h-11 rounded-full px-4 font-extrabold gap-2 bg-emerald-600 hover:bg-emerald-500"
                onClick={printThermal}
                disabled={!data}
              >
                <Printer className="w-4 h-4" />
                حراري 80×80
              </Button>
            </div>
          </div>
        </header>

        {/* ── TOP: controls + summary ────────────────────── */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-5 rounded-[1.5rem] border border-border/55 bg-background/85 backdrop-blur-sm p-4 sm:p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-black text-muted-foreground tracking-wide">الفترة</p>
                {data ? (
                  <span className="text-[11px] font-bold text-muted-foreground">
                    قبل {formatDate(data.openingAsOf)} يُحسب تلقائياً
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground mb-1 block">من تاريخ</label>
                  <YmdDateInput value={from} onChange={setFrom} className="h-11 rounded-xl" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground mb-1 block">إلى تاريخ</label>
                  <YmdDateInput value={to} onChange={setTo} className="h-11 rounded-xl" />
                </div>
              </div>
              <Button
                type="button"
                className="w-full h-11 rounded-full font-extrabold"
                onClick={apply}
              >
                عرض الكشف
              </Button>
            </div>

            <div className="lg:col-span-7 rounded-[1.5rem] border border-emerald-500/25 bg-gradient-to-l from-emerald-500/[0.08] via-background/90 to-background/90 p-4 sm:p-5 space-y-3 shadow-sm">
              <p className="text-[12px] font-black text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                رصيد افتتاحي للقاصة (بدون بطاقة)
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  amountPad
                  dir="ltr"
                  className="h-12 rounded-xl font-extrabold text-[16px] flex-1"
                  value={openingDraft}
                  onChange={(e) =>
                    setOpeningDraft(
                      e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0)
                    )
                  }
                />
                <Button
                  type="button"
                  className="h-12 rounded-xl px-5 font-extrabold gap-1.5 shrink-0"
                  disabled={saveOpening.isPending}
                  onClick={saveCashOpening}
                >
                  {saveOpening.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  حفظ
                </Button>
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground leading-relaxed">
                رصيد بداية البرنامج لكشف بدون بطاقة. رصيد كل بطاقة يُضبط من شاشة البطاقات.
              </p>
            </div>
          </div>

          {/* Account selector strip */}
          <div className="rounded-[1.5rem] border border-border/55 bg-background/85 p-2.5 sm:p-3 shadow-sm">
            {isLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : accounts.length === 0 ? (
              <p className="py-6 text-center text-sm font-bold text-muted-foreground">لا حسابات</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
                {accounts.map((acc) => {
                  const on = acc.key === active?.key;
                  return (
                    <button
                      key={acc.key}
                      type="button"
                      onClick={() => setActiveKey(acc.key)}
                      className={`snap-start shrink-0 min-w-[11.5rem] sm:min-w-[13rem] text-start rounded-2xl px-4 py-3.5 transition-all touch-manipulation border ${
                        on
                          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                          : "bg-secondary/35 border-border/40 hover:bg-secondary/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 font-extrabold text-[13px]">
                          {acc.kind === "cash" ? (
                            <Banknote className="w-4 h-4 opacity-90" />
                          ) : (
                            <CreditCard className="w-4 h-4 opacity-90" />
                          )}
                          {acc.titleAr}
                        </span>
                      </div>
                      <p
                        className={`mt-2 font-display text-[18px] font-black tabular-nums tracking-tight ${
                          on ? "text-primary-foreground" : ""
                        }`}
                        dir="ltr"
                      >
                        {fmtMoney(acc.closingBalance)}
                      </p>
                      <p
                        className={`mt-0.5 text-[11px] font-bold ${
                          on ? "opacity-90" : "text-muted-foreground"
                        }`}
                      >
                        قبل الفترة:{" "}
                        <span className="tabular-nums" dir="ltr">
                          {fmtMoney(acc.openingBeforeFrom)}
                        </span>
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active account KPIs + flow breakdown */}
          {active ? (
            <div className="rounded-[1.6rem] border border-border/55 bg-gradient-to-br from-background via-background to-secondary/20 p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-[11px] font-extrabold text-muted-foreground mb-1">
                    <Wallet className="w-3.5 h-3.5" />
                    ملخص الحساب النشط
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">{active.titleAr}</h2>
                  <p className="text-[12px] font-bold text-muted-foreground mt-1">
                    من {formatDate(applied.from)} إلى {formatDate(applied.to)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <MetricPill label="قبل الفترة" value={active.openingBeforeFrom} tone="neutral" />
                  <MetricPill label="داخل الفترة" value={active.periodCredit} tone="in" />
                  <MetricPill label="خارج الفترة" value={active.periodDebit} tone="out" />
                  <MetricPill label="الرصيد الختامي" value={active.closingBalance} tone="accent" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                {(visibleFlows.length ? visibleFlows : flowBuckets.slice(0, 4)).map((b) => (
                  <div
                    key={b.key}
                    className={`rounded-2xl border px-3.5 py-3.5 ${
                      b.tone === "in"
                        ? "border-emerald-500/20 bg-emerald-500/[0.06]"
                        : "border-rose-500/20 bg-rose-500/[0.06]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[12px] font-extrabold text-foreground/90">{b.label}</span>
                      {b.tone === "in" ? (
                        <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-rose-600" />
                      )}
                    </div>
                    <p
                      className={`font-display text-[17px] font-black tabular-nums ${
                        b.tone === "in" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                      }`}
                      dir="ltr"
                    >
                      {fmtMoney(b.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* ── BOTTOM: professional statement ─────────────── */}
        <section className="rounded-[1.7rem] border border-border/55 bg-background/90 overflow-hidden shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
          <div className="px-4 sm:px-6 py-4 border-b border-border/50 bg-gradient-to-l from-slate-500/[0.06] via-transparent to-emerald-500/[0.05]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {active?.kind === "card" ? (
                    <CreditCard className="w-5 h-5" />
                  ) : (
                    <ShoppingBag className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black tracking-tight truncate">
                    تفاصيل الكشف · {active?.titleAr ?? "—"}
                  </h3>
                  <p className="text-[12px] font-bold text-muted-foreground">
                    {active
                      ? `${active.lines.length} حركة · صافي الفترة ${fmtMoney(active.periodNet)}`
                      : "اختر حساباً لعرض التفاصيل"}
                  </p>
                </div>
              </div>
              {active ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3 py-1.5 text-[11px] font-extrabold text-muted-foreground">
                  <Undo2 className="w-3.5 h-3.5" />
                  مدين / دائن / رصيد جاري
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-auto max-h-[min(62vh,44rem)]">
            {!active ? (
              <div className="py-20 text-center text-muted-foreground font-bold">لا توجد بيانات</div>
            ) : (
              <table className="w-full text-[13px] min-w-[720px]">
                <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/60">
                  <tr className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-3.5 text-start w-12">#</th>
                    <th className="px-3 py-3.5 text-start">التاريخ</th>
                    <th className="px-3 py-3.5 text-start">النوع</th>
                    <th className="px-3 py-3.5 text-start">البيان</th>
                    <th className="px-3 py-3.5 text-start">الرقم</th>
                    <th className="px-3 py-3.5 text-start">مدين</th>
                    <th className="px-3 py-3.5 text-start">دائن</th>
                    <th className="px-4 py-3.5 text-start">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {active.lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-20 text-center text-muted-foreground font-bold"
                      >
                        لا حركات في هذه الفترة — غيّر التاريخ أو أضف حركات مرتبطة بالقاصة
                      </td>
                    </tr>
                  ) : (
                    active.lines.map((line, idx) => (
                      <tr
                        key={line.id}
                        className="border-b border-border/25 hover:bg-emerald-500/[0.04] transition-colors"
                      >
                        <td className="px-4 py-3 font-bold text-muted-foreground tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-3 font-display tabular-nums font-bold" dir="ltr">
                          {formatDate(line.date)}
                          {line.time ? (
                            <span className="block text-[10px] font-semibold text-muted-foreground mt-0.5">
                              {line.time}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold border ${
                              line.signed >= 0
                                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                : "border-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-200"
                            }`}
                          >
                            {line.sourceAr}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-semibold text-foreground/90 max-w-[18rem]">
                          {line.label}
                        </td>
                        <td className="px-3 py-3 font-display tabular-nums text-muted-foreground" dir="ltr">
                          {line.invoiceNo || "—"}
                        </td>
                        <td
                          className="px-3 py-3 font-display tabular-nums font-extrabold text-rose-600"
                          dir="ltr"
                        >
                          {line.debit ? fmtMoney(line.debit) : "—"}
                        </td>
                        <td
                          className="px-3 py-3 font-display tabular-nums font-extrabold text-emerald-600"
                          dir="ltr"
                        >
                          {line.credit ? fmtMoney(line.credit) : "—"}
                        </td>
                        <td
                          className="px-4 py-3 font-display tabular-nums font-black text-[13.5px]"
                          dir="ltr"
                        >
                          {fmtMoney(line.balanceAfter ?? 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {active && active.lines.length > 0 ? (
            <div className="px-4 sm:px-6 py-3.5 border-t border-border/50 bg-secondary/20 flex flex-wrap items-center justify-between gap-2 text-[12px] font-extrabold">
              <span className="text-muted-foreground">إجمالي الفترة</span>
              <div className="flex flex-wrap gap-4 tabular-nums" dir="ltr">
                <span className="text-rose-600">مدين {fmtMoney(active.periodDebit)}</span>
                <span className="text-emerald-600">دائن {fmtMoney(active.periodCredit)}</span>
                <span>ختامي {fmtMoney(active.closingBalance)}</span>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
