import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetVaultStatement,
  useSetVaultCashOpening,
  useGetSettings,
  getVaultStatementQueryKey,
  getGetSettingsQueryKey,
  type VaultAccountStatement,
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
  Banknote,
  CreditCard,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Vault as VaultIcon,
} from "lucide-react";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IQ", { maximumFractionDigits: 2 }).format(n);

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
        <div className="absolute -top-24 -start-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-32 -end-16 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto space-y-5 pb-10">
        <header className="rounded-[1.6rem] border border-border/50 bg-gradient-to-l from-emerald-500/10 via-background to-sky-500/5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                <VaultIcon className="w-3.5 h-3.5" />
                قاصة المطعم
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">القاصة</h1>
              <p className="text-sm font-semibold text-muted-foreground max-w-2xl">
                كشف سريع حسب التاريخ — بدون بطاقة ولكل بطاقة كشف مستقل، مع رصيد ما قبل تاريخ البداية.
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
                A4 · 13
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

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-4 space-y-3">
            <div className="rounded-3xl border border-border/60 bg-background/80 p-4 space-y-3">
              <p className="text-[12px] font-extrabold text-muted-foreground">الفترة</p>
              <div className="grid grid-cols-2 gap-2">
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
              {data ? (
                <p className="text-[12px] font-bold text-muted-foreground">
                  رصيد ما قبل {formatDate(data.openingAsOf)} يُحسب تلقائياً من حقل «من تاريخ».
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-3">
              <p className="text-[12px] font-extrabold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                رصيد افتتاحي للقاصة (بدون بطاقة)
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  amountPad
                  dir="ltr"
                  className="h-11 rounded-xl font-extrabold"
                  value={openingDraft}
                  onChange={(e) =>
                    setOpeningDraft(e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0))
                  }
                />
                <Button
                  type="button"
                  className="h-11 rounded-xl px-4 font-extrabold gap-1.5 shrink-0"
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
                يُستخدم كرصيد بداية البرنامج ليطابق كشف بدون بطاقة.
              </p>
            </div>

            <div className="rounded-3xl border border-border/60 bg-background/80 p-2 space-y-1 max-h-[28rem] overflow-auto">
              {isLoading ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                accounts.map((acc) => {
                  const on = acc.key === active?.key;
                  return (
                    <button
                      key={acc.key}
                      type="button"
                      onClick={() => setActiveKey(acc.key)}
                      className={`w-full text-start rounded-2xl px-3.5 py-3 transition-all touch-manipulation ${
                        on
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "hover:bg-secondary/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 font-extrabold text-[14px]">
                          {acc.kind === "cash" ? (
                            <Banknote className="w-4 h-4" />
                          ) : (
                            <CreditCard className="w-4 h-4" />
                          )}
                          {acc.titleAr}
                        </span>
                        <span className="font-display text-[13px] font-extrabold tabular-nums" dir="ltr">
                          {fmtMoney(acc.closingBalance)}
                        </span>
                      </div>
                      <div className={`mt-1 text-[11px] font-bold ${on ? "opacity-90" : "text-muted-foreground"}`}>
                        قبل الفترة: {fmtMoney(acc.openingBeforeFrom)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="xl:col-span-8 rounded-3xl border border-border/60 bg-background/85 overflow-hidden flex flex-col min-h-[32rem]">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground font-bold">
                لا توجد بيانات
              </div>
            ) : (
              <>
                <div className="px-4 sm:px-5 py-4 border-b border-border/50 bg-gradient-to-l from-secondary/40 to-transparent">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black">{active.titleAr}</h2>
                      <p className="text-[12px] font-bold text-muted-foreground mt-1">
                        من {formatDate(applied.from)} إلى {formatDate(applied.to)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px] font-extrabold">
                      <div className="rounded-xl border border-border/50 px-3 py-2">
                        <p className="text-muted-foreground text-[10px]">قبل الفترة</p>
                        <p className="tabular-nums" dir="ltr">{fmtMoney(active.openingBeforeFrom)}</p>
                      </div>
                      <div className="rounded-xl border border-border/50 px-3 py-2">
                        <p className="text-muted-foreground text-[10px]">مدين</p>
                        <p className="tabular-nums text-rose-600" dir="ltr">{fmtMoney(active.periodDebit)}</p>
                      </div>
                      <div className="rounded-xl border border-border/50 px-3 py-2">
                        <p className="text-muted-foreground text-[10px]">دائن</p>
                        <p className="tabular-nums text-emerald-600" dir="ltr">{fmtMoney(active.periodCredit)}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                        <p className="text-muted-foreground text-[10px]">ختامي</p>
                        <p className="tabular-nums" dir="ltr">{fmtMoney(active.closingBalance)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-auto flex-1">
                  <table className="w-full text-[13px]">
                    <thead className="sticky top-0 bg-background/95 backdrop-blur border-b border-border/60 z-10">
                      <tr className="text-[11px] font-extrabold text-muted-foreground">
                        <th className="px-3 py-3 text-start">#</th>
                        <th className="px-3 py-3 text-start">التاريخ</th>
                        <th className="px-3 py-3 text-start">النوع</th>
                        <th className="px-3 py-3 text-start">البيان</th>
                        <th className="px-3 py-3 text-start">رقم</th>
                        <th className="px-3 py-3 text-start">مدين</th>
                        <th className="px-3 py-3 text-start">دائن</th>
                        <th className="px-3 py-3 text-start">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.lines.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-16 text-center text-muted-foreground font-bold">
                            لا حركات في هذه الفترة
                          </td>
                        </tr>
                      ) : (
                        active.lines.map((line, idx) => (
                          <tr
                            key={line.id}
                            className="border-b border-border/30 hover:bg-secondary/30 transition-colors"
                          >
                            <td className="px-3 py-2.5 font-bold text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-display tabular-nums font-bold" dir="ltr">
                              {formatDate(line.date)}
                            </td>
                            <td className="px-3 py-2.5 font-extrabold">{line.sourceAr}</td>
                            <td className="px-3 py-2.5 font-semibold">{line.label}</td>
                            <td className="px-3 py-2.5 font-display tabular-nums" dir="ltr">
                              {line.invoiceNo || "—"}
                            </td>
                            <td className="px-3 py-2.5 font-display tabular-nums font-extrabold text-rose-600" dir="ltr">
                              {line.debit ? fmtMoney(line.debit) : "—"}
                            </td>
                            <td className="px-3 py-2.5 font-display tabular-nums font-extrabold text-emerald-600" dir="ltr">
                              {line.credit ? fmtMoney(line.credit) : "—"}
                            </td>
                            <td className="px-3 py-2.5 font-display tabular-nums font-black" dir="ltr">
                              {fmtMoney(line.balanceAfter ?? 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
