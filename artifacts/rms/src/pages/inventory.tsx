import React, { useEffect, useMemo, useState } from "react";
import {
  useGetWarehouseStock,
  useGetWarehouseItemDetail,
  useGetSettings,
  getGetWarehouseStockQueryKey,
  type WarehouseStockRow,
  type WarehouseMovementLine,
} from "@workspace/api-client-react";
import { Button, Card, Dialog } from "@/components/ui-elements";
import { ModernCombobox } from "@/components/modern-combobox";
import { YmdDateInput } from "@/components/ymd-date-input";
import { BranchSwitcher } from "@/components/branch-switcher";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import { printWarehouseStockReportA4 } from "@/lib/print-receipt";
import { subscribeStockLive } from "@/lib/stock-live";
import { subscribeOrdersLive } from "@/lib/orders-live";
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  Package,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Undo2,
  Wallet,
} from "lucide-react";

type Page = "hub" | "remaining" | "detail";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IQ", { maximumFractionDigits: 2 }).format(n);

const fmtQty = (n: number) =>
  new Intl.NumberFormat("en-IQ", { maximumFractionDigits: 3 }).format(n);

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthStartDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function MovementTable({
  title,
  icon: Icon,
  accent,
  lines,
  empty,
}: {
  title: string;
  icon: typeof ShoppingCart;
  accent: string;
  lines: WarehouseMovementLine[];
  empty: string;
}) {
  const totalMinor = lines.reduce((s, l) => s + l.qtyMinor, 0);
  const totalAmount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  return (
    <Card className={`overflow-hidden border ${accent}`}>
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3 bg-gradient-to-l from-transparent via-background/40 to-background/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-background/80 border border-border/50 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm truncate">{title}</h3>
            <p className="text-[11px] text-muted-foreground font-semibold">
              {lines.length} · {fmtQty(totalMinor)} · {fmtMoney(totalAmount)}
            </p>
          </div>
        </div>
      </div>
      {lines.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground font-semibold">{empty}</div>
      ) : (
        <div className="overflow-x-auto max-h-[min(42vh,420px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="p-2.5 text-start font-bold">#</th>
                <th className="p-2.5 text-start font-bold">التاريخ</th>
                <th className="p-2.5 text-start font-bold">الرقم</th>
                <th className="p-2.5 text-start font-bold">الكمية</th>
                <th className="p-2.5 text-start font-bold">بالصغرى</th>
                <th className="p-2.5 text-start font-bold">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={l.id} className="border-t border-border/30 hover:bg-secondary/30">
                  <td className="p-2.5 font-bold tabular-nums text-muted-foreground">{idx + 1}</td>
                  <td className="p-2.5 font-bold tabular-nums" dir="ltr">
                    {l.date}
                    {l.time ? (
                      <span className="block text-[11px] text-muted-foreground font-semibold">
                        {l.time}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2.5 font-extrabold font-display tabular-nums" dir="ltr">
                    {l.docNo}
                  </td>
                  <td className="p-2.5 font-bold">
                    {fmtQty(l.qty)} {l.unitLabel}
                  </td>
                  <td className="p-2.5 font-extrabold tabular-nums">{fmtQty(l.qtyMinor)}</td>
                  <td className="p-2.5 font-extrabold font-display tabular-nums" dir="ltr">
                    {fmtMoney(Number(l.amount) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function Inventory() {
  const { t, formatDateTime } = useI18n();
  const { branchLabel, selectedBranchId } = useBranch();
  const [page, setPage] = useState<Page>("hub");
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [fromDate, setFromDate] = useState(monthStartDate);
  const [toDate, setToDate] = useState(todayDate);
  const [reportOpen, setReportOpen] = useState(false);

  const { data: stock, isLoading, refetch, isFetching } = useGetWarehouseStock({
    query: {
      queryKey: [...getGetWarehouseStockQueryKey(), selectedBranchId],
      staleTime: 400,
      refetchInterval: 1_500,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    },
  });

  const menuItemId = selectedItemId ? Number(selectedItemId) : null;
  const detailParams = useMemo(
    () => ({ from: fromDate || undefined, to: toDate || undefined }),
    [fromDate, toDate]
  );
  const {
    data: detail,
    isLoading: detailLoading,
    refetch: refetchDetail,
    isFetching: detailFetching,
  } = useGetWarehouseItemDetail(menuItemId, detailParams, {
    query: {
      enabled: page === "detail" && menuItemId != null && menuItemId > 0,
      staleTime: 400,
      refetchInterval: page === "detail" ? 1_500 : false,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    },
  });

  const { data: appSettings } = useGetSettings({
    query: { staleTime: 60_000 },
  });

  /** Live: POS / purchases / returns → refresh both pages ASAP */
  useEffect(() => {
    const refresh = () => {
      void refetch();
      if (page === "detail" && menuItemId != null && menuItemId > 0) {
        void refetchDetail();
      }
    };
    const unsubStock = subscribeStockLive(refresh);
    const unsubOrders = subscribeOrdersLive(refresh);
    return () => {
      unsubStock();
      unsubOrders();
    };
  }, [refetch, refetchDetail, page, menuItemId]);

  useEffect(() => {
    if (!selectedItemId) return;
    const stillCosted = (stock ?? []).some(
      (r) => String(r.menuItemId) === selectedItemId && Number(r.costPerMinor) > 0
    );
    if (!stillCosted) setSelectedItemId("");
  }, [stock, selectedItemId]);

  const filtered = useMemo(() => {
    /** Only costed items («تكلفة») — never «بدون تكلفة» */
    const list = (stock ?? []).filter((r) => Number(r.costPerMinor) > 0);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.nameAr.includes(search) ||
        r.name.toLowerCase().includes(q) ||
        r.categoryNameAr.includes(search) ||
        r.categoryName.toLowerCase().includes(q)
    );
  }, [stock, search]);

  const totals = useMemo(() => {
    const list = filtered;
    return {
      count: list.length,
      remainingMinor: list.reduce((s, r) => s + r.remainingMinor, 0),
      totalCost: list.reduce((s, r) => s + r.totalCost, 0),
    };
  }, [filtered]);

  const itemOptions = useMemo(
    () =>
      filtered.map((r) => ({
        value: String(r.menuItemId),
        label: `${r.code} — ${r.nameAr}`,
        subtitle: r.remainingLabel,
      })),
    [filtered]
  );

  const printReport = () => {
    const lines = filtered.map((r) => ({
      code: r.code,
      nameAr: r.nameAr,
      categoryNameAr: r.categoryNameAr,
      remainingLabel: r.remainingLabel,
      costPerMinor: r.costPerMinor,
      totalCost: r.totalCost,
    }));
    printWarehouseStockReportA4({
      restaurantName: appSettings?.restaurantName?.trim() || t("app.name"),
      branchName: branchLabel,
      logoUrl: appSettings?.logoUrl,
      mobile: appSettings?.mobile,
      printedAtLabel: formatDateTime(new Date()),
      formatMoney: fmtMoney,
      lines,
      totalCostSum: lines.reduce((s, l) => s + l.totalCost, 0),
    });
    setReportOpen(false);
  };

  const toneRemaining = (r: WarehouseStockRow) => {
    if (r.remainingMinor < 0) return "text-rose-600 dark:text-rose-300";
    if (r.remainingMinor === 0) return "text-muted-foreground";
    return "text-emerald-700 dark:text-emerald-300";
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary/80">
            {t("inventory.kicker")}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {t("inventory.title")}
          </h1>
          <p className="text-sm text-muted-foreground font-semibold mt-1 max-w-2xl">
            {t("inventory.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BranchSwitcher />
          {page !== "hub" ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full px-4 font-bold gap-2"
              onClick={() => setPage("hub")}
            >
              <ArrowLeft className="w-4 h-4" />
              {t("common.back")}
            </Button>
          ) : null}
        </div>
      </div>

      {page === "hub" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setPage("remaining")}
            className="group flex flex-col items-center text-center rounded-3xl border-2 border-border/70 bg-card/90 min-h-[10rem] p-6 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg active:scale-[0.98] transition-all"
          >
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25 mb-4 group-hover:scale-105 transition-transform">
              <Boxes className="w-7 h-7" strokeWidth={2.25} />
            </span>
            <h2 className="text-[15px] font-extrabold">{t("inventory.pageRemaining")}</h2>
            <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed font-semibold">
              {t("inventory.pageRemainingHint")}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setPage("detail")}
            className="group flex flex-col items-center text-center rounded-3xl border-2 border-border/70 bg-card/90 min-h-[10rem] p-6 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:shadow-lg active:scale-[0.98] transition-all"
          >
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/25 mb-4 group-hover:scale-105 transition-transform">
              <ClipboardList className="w-7 h-7" strokeWidth={2.25} />
            </span>
            <h2 className="text-[15px] font-extrabold">{t("inventory.pageDetail")}</h2>
            <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed font-semibold">
              {t("inventory.pageDetailHint")}
            </p>
          </button>
        </div>
      ) : null}

      {page === "remaining" ? (
        <div className="space-y-4">
          <Card className="p-4 sm:p-5 border border-border/50 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">{t("inventory.pageRemaining")}</h2>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                  {t("inventory.remainingFormula")}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full px-4 font-bold gap-2"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
                  {t("common.refresh")}
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-full px-5 font-extrabold gap-2 shadow-md shadow-primary/20"
                  onClick={() => setReportOpen(true)}
                  disabled={!filtered.length}
                >
                  <Printer className="w-4 h-4" />
                  {t("inventory.printReport")}
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("inventory.searchItems")}
                className="w-full h-11 rounded-2xl border border-border/60 bg-background/80 pr-10 pl-4 text-sm font-semibold focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border/50 bg-secondary/30 px-4 py-3">
                <p className="text-[11px] font-bold text-muted-foreground">{t("inventory.itemsCount")}</p>
                <p className="text-xl font-extrabold tabular-nums mt-0.5">{totals.count}</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-secondary/30 px-4 py-3">
                <p className="text-[11px] font-bold text-muted-foreground">{t("inventory.remainingMinorSum")}</p>
                <p className="text-xl font-extrabold tabular-nums mt-0.5">{fmtQty(totals.remainingMinor)}</p>
              </div>
              <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 col-span-2 sm:col-span-1">
                <p className="text-[11px] font-bold text-primary/80">{t("inventory.stockValue")}</p>
                <p className="text-xl font-extrabold font-display tabular-nums mt-0.5 text-primary">
                  {fmtMoney(totals.totalCost)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden border border-border/50">
            {isLoading ? (
              <div className="py-16 text-center text-muted-foreground font-semibold">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-60" />
                {t("common.loading")}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-bold">{t("inventory.emptyStock")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-center">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/40 text-muted-foreground">
                      <th className="p-3 text-center font-extrabold">#</th>
                      <th className="p-3 text-center font-extrabold">{t("inventory.itemCode")}</th>
                      <th className="p-3 text-center font-extrabold">{t("inventory.itemName")}</th>
                      <th className="p-3 text-center font-extrabold">{t("menu.category")}</th>
                      <th className="p-3 text-center font-extrabold">{t("inventory.remainingQty")}</th>
                      <th className="p-3 text-center font-extrabold">{t("inventory.costMinor")}</th>
                      <th className="p-3 text-center font-extrabold">{t("common.total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, idx) => (
                      <tr
                        key={r.menuItemId}
                        className="border-t border-border/30 hover:bg-primary/5 transition-colors"
                      >
                        <td className="p-3 text-center font-bold tabular-nums text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="p-3 text-center font-extrabold font-display tabular-nums" dir="ltr">
                          {r.code}
                        </td>
                        <td className="p-3 text-center font-extrabold">{r.nameAr}</td>
                        <td className="p-3 text-center font-semibold text-muted-foreground">
                          {r.categoryNameAr || "—"}
                        </td>
                        <td className={`p-3 text-center font-extrabold ${toneRemaining(r)}`}>
                          {r.remainingLabel}
                        </td>
                        <td className="p-3 text-center font-extrabold font-display tabular-nums" dir="ltr">
                          {fmtMoney(r.costPerMinor)}
                        </td>
                        <td className="p-3 text-center font-extrabold font-display tabular-nums text-primary" dir="ltr">
                          {fmtMoney(r.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {page === "detail" ? (
        <div className="space-y-4">
          <Card className="p-4 sm:p-5 border border-border/50 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold">{t("inventory.pageDetail")}</h2>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                {t("inventory.pageDetailHint")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="text-[13px] font-bold mb-1.5 block">
                  {t("inventory.chooseItem")}
                </label>
                <ModernCombobox
                  value={selectedItemId}
                  onChange={setSelectedItemId}
                  options={itemOptions}
                  placeholder={t("inventory.chooseItem")}
                  searchPlaceholder={t("inventory.searchItems")}
                />
              </div>
              <div>
                <label className="text-[13px] font-bold mb-1.5 block">{t("inventory.fromDate")}</label>
                <YmdDateInput value={fromDate} onChange={setFromDate} className="h-11" />
              </div>
              <div>
                <label className="text-[13px] font-bold mb-1.5 block">{t("inventory.toDate")}</label>
                <YmdDateInput value={toDate} onChange={setToDate} className="h-11" />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full px-4 font-bold gap-2"
                onClick={() => void refetchDetail()}
                disabled={!menuItemId || detailFetching}
              >
                <RefreshCw className={`w-4 h-4 ${detailFetching ? "animate-spin" : ""}`} />
                {t("common.refresh")}
              </Button>
            </div>
          </Card>

          {!menuItemId ? (
            <Card className="py-16 text-center border border-dashed border-border/70">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-muted-foreground">{t("inventory.pickItemFirst")}</p>
            </Card>
          ) : detailLoading ? (
            <Card className="py-16 text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-60" />
              <p className="font-semibold text-muted-foreground">{t("common.loading")}</p>
            </Card>
          ) : detail ? (
            <>
              <Card className="p-4 sm:p-5 border border-cyan-500/25 bg-gradient-to-l from-cyan-500/10 via-card to-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 tabular-nums" dir="ltr">
                      {detail.item.code}
                    </p>
                    <h3 className="text-xl font-extrabold mt-0.5">{detail.item.nameAr}</h3>
                    <p className="text-sm text-muted-foreground font-semibold mt-1">
                      {detail.item.categoryNameAr || "—"}
                      {detail.item.majorUnit
                        ? ` · ${detail.item.subunitQty} ${detail.item.minorUnit} / ${detail.item.majorUnit}`
                        : ` · ${detail.item.minorUnit}`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 text-end">
                    <p className="text-[11px] font-bold text-muted-foreground">
                      {t("inventory.remainingQty")}
                    </p>
                    <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {detail.totals.remainingLabel}
                    </p>
                    <p className="text-xs font-bold text-primary mt-1 tabular-nums" dir="ltr">
                      {fmtMoney(detail.item.totalCost)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-emerald-800/80 dark:text-emerald-200/80">
                      {t("inventory.purchases")}
                    </p>
                    <p className="font-extrabold tabular-nums mt-0.5">
                      {fmtQty(detail.totals.purchasedMinor)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-amber-800/80 dark:text-amber-200/80">
                      {t("inventory.returns")}
                    </p>
                    <p className="font-extrabold tabular-nums mt-0.5">
                      {fmtQty(detail.totals.returnedMinor)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-rose-800/80 dark:text-rose-200/80">
                      {t("inventory.sales")}
                    </p>
                    <p className="font-extrabold tabular-nums mt-0.5">
                      {fmtQty(detail.totals.soldMinor)}
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <MovementTable
                  title={t("inventory.purchasesByDate")}
                  icon={ShoppingCart}
                  accent="border-emerald-500/30"
                  lines={detail.purchases}
                  empty={t("inventory.noPurchases")}
                />
                <MovementTable
                  title={t("inventory.returnsByDate")}
                  icon={Undo2}
                  accent="border-amber-500/30"
                  lines={detail.returns}
                  empty={t("inventory.noReturns")}
                />
                <MovementTable
                  title={t("inventory.salesByDate")}
                  icon={Wallet}
                  accent="border-rose-500/30"
                  lines={detail.sales}
                  empty={t("inventory.noSales")}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <Dialog
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        title={t("inventory.printReport")}
      >
        <div className="space-y-4 text-center py-1">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Printer className="w-7 h-7 text-primary" />
          </div>
          <p className="text-[15px] font-bold leading-relaxed">
            {t("inventory.printReportAsk", { n: filtered.length })}
          </p>
          <p className="text-xs text-muted-foreground font-semibold">
            {t("inventory.printReportHint")}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-full font-bold"
              onClick={() => setReportOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              className="flex-1 h-12 rounded-full font-extrabold gap-2"
              onClick={printReport}
            >
              <Printer className="w-4 h-4" />
              {t("inventory.printNow")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
