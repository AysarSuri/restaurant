import React, { useMemo, useState } from "react";
import {
  useGetSalesBreakdown,
  useGetSalesProfit,
  useGetSalesDiscounts,
  useGetMenuCategories,
  useGetMenuItems,
  getSalesBreakdownQueryKey,
  getSalesProfitQueryKey,
  getSalesDiscountsQueryKey,
  type SalesBreakdownGroupBy,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui-elements";
import { YmdDateInput } from "@/components/ymd-date-input";
import { BranchSwitcher } from "@/components/branch-switcher";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import {
  BadgePercent,
  BarChart3,
  CalendarDays,
  Layers,
  LineChart,
  Loader2,
  Package,
  PiggyBank,
  RefreshCw,
  ShoppingBag,
  Tags,
} from "lucide-react";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IQ", { maximumFractionDigits: 2 }).format(n);

const fmtQty = (n: number) =>
  new Intl.NumberFormat("en-IQ", { maximumFractionDigits: 0 }).format(n);

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ReportPageId = "sales" | "profit" | "discounts" | "expenses" | "inventory";

const PAGES: {
  id: ReportPageId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  ready: boolean;
}[] = [
  {
    id: "sales",
    title: "المبيعات",
    subtitle: "حسب التاريخ · الصنف · الفئة",
    icon: ShoppingBag,
    ready: true,
  },
  {
    id: "profit",
    title: "أرباح من مبيعات",
    subtitle: "أصناف بتكلفة · ربح تفصيلي",
    icon: PiggyBank,
    ready: true,
  },
  {
    id: "discounts",
    title: "خصومات من مبيعات",
    subtitle: "حسب التاريخين · فواتير بخصم",
    icon: BadgePercent,
    ready: true,
  },
  {
    id: "expenses",
    title: "المصاريف",
    subtitle: "قريباً",
    icon: BarChart3,
    ready: false,
  },
  {
    id: "inventory",
    title: "المخزون",
    subtitle: "قريباً",
    icon: Package,
    ready: false,
  },
];

const GROUP_OPTS: {
  id: SalesBreakdownGroupBy;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "date", label: "حسب التاريخ", icon: CalendarDays },
  { id: "item", label: "حسب الصنف", icon: Tags },
  { id: "category", label: "حسب الفئة", icon: Layers },
];

function SalesReportPage() {
  const { formatDate } = useI18n();
  const { selectedBranchId, branchLabel } = useBranch();

  const [from, setFrom] = useState(todayDate);
  const [to, setTo] = useState(todayDate);
  const [groupBy, setGroupBy] = useState<SalesBreakdownGroupBy>("date");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [applied, setApplied] = useState(() => ({
    from: todayDate(),
    to: todayDate(),
    groupBy: "date" as SalesBreakdownGroupBy,
    categoryId: undefined as number | undefined,
  }));

  const { data: categories } = useGetMenuCategories({
    query: { staleTime: 60_000 },
  });

  const params = useMemo(
    () => ({
      from: applied.from,
      to: applied.to,
      groupBy: applied.groupBy,
      filterBranchId:
        typeof selectedBranchId === "number" ? selectedBranchId : undefined,
      categoryId: applied.categoryId,
    }),
    [applied, selectedBranchId]
  );

  const { data, isLoading, isFetching, refetch, isError, error } =
    useGetSalesBreakdown(params, {
      query: {
        queryKey: getSalesBreakdownQueryKey(params),
        staleTime: 2_000,
      },
    });

  const apply = () => {
    setApplied({
      from: from || todayDate(),
      to: to || todayDate(),
      groupBy,
      categoryId:
        typeof categoryId === "number" && categoryId > 0 ? categoryId : undefined,
    });
  };

  const rows = data?.rows ?? [];
  const summary = data?.summary;
  const dimLabel =
    applied.groupBy === "date"
      ? "التاريخ"
      : applied.groupBy === "item"
        ? "الصنف"
        : "الفئة";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-8 rounded-[1.5rem] border border-border/55 bg-background/90 p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-black text-muted-foreground tracking-wide">
              فلاتر تقرير المبيعات
            </p>
            <span className="text-[11px] font-bold text-muted-foreground">
              الفرع: {branchLabel || "كل الفروع"}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                من تاريخ
              </label>
              <YmdDateInput value={from} onChange={setFrom} className="h-11 rounded-xl" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                إلى تاريخ
              </label>
              <YmdDateInput value={to} onChange={setTo} className="h-11 rounded-xl" />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                تصفية فئة (اختياري)
              </label>
              <select
                className="w-full h-11 rounded-xl border border-border/60 bg-background px-3 text-[13px] font-extrabold outline-none focus:ring-2 focus:ring-primary/30"
                value={categoryId === "" ? "" : String(categoryId)}
                onChange={(e) =>
                  setCategoryId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">كل الفئات</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr || c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {GROUP_OPTS.map((opt) => {
              const Icon = opt.icon;
              const on = groupBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setGroupBy(opt.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 h-10 text-[13px] font-extrabold border transition-all touch-manipulation ${
                    on
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                      : "bg-secondary/40 border-border/50 hover:bg-secondary/70"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-11 rounded-full px-6 font-extrabold"
              onClick={apply}
            >
              عرض التقرير
            </Button>
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
          </div>
        </div>

        <div className="xl:col-span-4 grid grid-cols-2 xl:grid-cols-1 gap-2.5">
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3.5">
            <p className="text-[12px] font-black text-emerald-800 dark:text-emerald-200 mb-1">
              إجمالي المبيعات
            </p>
            <p className="font-display text-[22px] font-black tabular-nums" dir="ltr">
              {fmtMoney(summary?.totalAmount ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.07] px-4 py-3.5">
            <p className="text-[12px] font-black text-sky-800 dark:text-sky-200 mb-1">
              عدد الفواتير
            </p>
            <p className="font-display text-[22px] font-black tabular-nums" dir="ltr">
              {fmtQty(summary?.orderCount ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3.5">
            <p className="text-[12px] font-black text-amber-900 dark:text-amber-200 mb-1">
              الكمية
            </p>
            <p className="font-display text-[22px] font-black tabular-nums" dir="ltr">
              {fmtQty(summary?.totalQty ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-border/55 bg-background/90 px-4 py-3.5">
            <p className="text-[12px] font-black text-muted-foreground mb-1">الصفوف</p>
            <p className="font-display text-[22px] font-black tabular-nums" dir="ltr">
              {fmtQty(summary?.rowCount ?? 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-border/55 bg-background/90 overflow-hidden shadow-sm">
        <div className="px-4 sm:px-5 py-4 border-b border-border/50 bg-gradient-to-l from-secondary/35 to-transparent flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-black">
              {GROUP_OPTS.find((g) => g.id === applied.groupBy)?.label ?? "المبيعات"}
            </h3>
            <p className="text-[12px] font-bold text-muted-foreground mt-0.5">
              من {formatDate(applied.from)} إلى {formatDate(applied.to)}
              {applied.categoryId
                ? ` · فئة محددة`
                : ""}
            </p>
          </div>
        </div>

        <div className="overflow-auto max-h-[min(58vh,40rem)]">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-rose-600 font-bold">
              تعذر تحميل التقرير
              <div className="text-[12px] mt-1 opacity-80">
                {(error as Error)?.message || ""}
              </div>
            </div>
          ) : (
            <table className="w-full text-[13px] min-w-[640px]">
              <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/60">
                <tr className="text-[11px] font-extrabold text-muted-foreground">
                  <th className="px-4 py-3.5 text-center w-12">#</th>
                  <th className="px-3 py-3.5 text-center">{dimLabel}</th>
                  <th className="px-3 py-3.5 text-center">الكمية</th>
                  <th className="px-3 py-3.5 text-center">المبلغ</th>
                  <th className="px-3 py-3.5 text-center">فواتير</th>
                  <th className="px-3 py-3.5 text-center">أسطر</th>
                  <th className="px-4 py-3.5 text-center">نسبة المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-20 text-center text-muted-foreground font-bold"
                    >
                      لا مبيعات في هذه الفترة حسب الفلاتر المحددة
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const share =
                      summary && summary.totalAmount
                        ? (row.amount / summary.totalAmount) * 100
                        : 0;
                    return (
                      <tr
                        key={row.key}
                        className="border-b border-border/25 hover:bg-primary/[0.03] transition-colors"
                      >
                        <td className="px-4 py-3 text-center font-bold text-muted-foreground tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-3 text-center font-extrabold">
                          {applied.groupBy === "date"
                            ? formatDate(row.key)
                            : row.labelAr || row.label}
                        </td>
                        <td
                          className="px-3 py-3 text-center font-display tabular-nums font-extrabold"
                          dir="ltr"
                        >
                          {fmtQty(row.qty)}
                        </td>
                        <td
                          className="px-3 py-3 text-center font-display tabular-nums font-black text-emerald-700 dark:text-emerald-300"
                          dir="ltr"
                        >
                          {fmtMoney(row.amount)}
                        </td>
                        <td
                          className="px-3 py-3 text-center font-display tabular-nums font-bold"
                          dir="ltr"
                        >
                          {fmtQty(row.orderCount)}
                        </td>
                        <td
                          className="px-3 py-3 text-center font-display tabular-nums font-bold text-muted-foreground"
                          dir="ltr"
                        >
                          {fmtQty(row.lineCount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="mx-auto max-w-[8rem]">
                            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary/80"
                                style={{
                                  width: `${Math.max(0, Math.min(100, share))}%`,
                                }}
                              />
                            </div>
                            <p
                              className="mt-1 text-[11px] font-extrabold tabular-nums text-muted-foreground"
                              dir="ltr"
                            >
                              {share.toFixed(1)}%
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {summary && rows.length > 0 ? (
          <div className="px-4 sm:px-5 py-3.5 border-t border-border/50 bg-secondary/20 flex flex-wrap items-center justify-between gap-2 text-[12px] font-extrabold">
            <span className="text-muted-foreground">إجمالي التقرير</span>
            <div className="flex flex-wrap gap-4 tabular-nums" dir="ltr">
              <span>كمية {fmtQty(summary.totalQty)}</span>
              <span className="text-emerald-700 dark:text-emerald-300">
                مبلغ {fmtMoney(summary.totalAmount)}
              </span>
              <span>فواتير {fmtQty(summary.orderCount)}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SalesProfitPage() {
  const { formatDate } = useI18n();
  const { selectedBranchId, branchLabel } = useBranch();

  const [from, setFrom] = useState(todayDate);
  const [to, setTo] = useState(todayDate);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [menuItemId, setMenuItemId] = useState<number | "">("");
  const [applied, setApplied] = useState(() => ({
    from: todayDate(),
    to: todayDate(),
    categoryId: undefined as number | undefined,
    menuItemId: undefined as number | undefined,
  }));

  const { data: categories } = useGetMenuCategories({
    query: { staleTime: 60_000 },
  });
  const { data: menuItems } = useGetMenuItems({
    query: { staleTime: 60_000 },
  });

  const costItems = useMemo(() => {
    const list = menuItems ?? [];
    return list.filter((item) => {
      const c = Number(item.cost);
      return item.cost != null && Number.isFinite(c) && c > 0;
    });
  }, [menuItems]);

  const filteredCostItems = useMemo(() => {
    if (typeof categoryId !== "number") return costItems;
    return costItems.filter((i) => i.categoryId === categoryId);
  }, [costItems, categoryId]);

  const params = useMemo(
    () => ({
      from: applied.from,
      to: applied.to,
      filterBranchId:
        typeof selectedBranchId === "number" ? selectedBranchId : undefined,
      categoryId: applied.categoryId,
      menuItemId: applied.menuItemId,
    }),
    [applied, selectedBranchId]
  );

  const { data, isLoading, isFetching, refetch, isError, error } =
    useGetSalesProfit(params, {
      query: {
        queryKey: getSalesProfitQueryKey(params),
        staleTime: 2_000,
      },
    });

  const apply = () => {
    setApplied({
      from: from || todayDate(),
      to: to || todayDate(),
      categoryId:
        typeof categoryId === "number" && categoryId > 0 ? categoryId : undefined,
      menuItemId:
        typeof menuItemId === "number" && menuItemId > 0 ? menuItemId : undefined,
    });
  };

  const rows = data?.rows ?? [];
  const summary = data?.summary;
  const marginPct =
    summary && summary.totalSale
      ? (summary.totalProfit / summary.totalSale) * 100
      : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-8 rounded-[1.5rem] border border-border/55 bg-background/90 p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[12px] font-black text-muted-foreground tracking-wide">
                فلاتر أرباح المبيعات
              </p>
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                فقط الأصناف بنوع تكلفة (ليس بدون تكلفة)
              </p>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">
              الفرع: {branchLabel || "كل الفروع"}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                من تاريخ
              </label>
              <YmdDateInput value={from} onChange={setFrom} className="h-11 rounded-xl" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                إلى تاريخ
              </label>
              <YmdDateInput value={to} onChange={setTo} className="h-11 rounded-xl" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                الفئة
              </label>
              <select
                className="w-full h-11 rounded-xl border border-border/60 bg-background px-3 text-[13px] font-extrabold outline-none focus:ring-2 focus:ring-primary/30"
                value={categoryId === "" ? "" : String(categoryId)}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : "";
                  setCategoryId(v);
                  setMenuItemId("");
                }}
              >
                <option value="">كل الفئات</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr || c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                الصنف (بتكلفة)
              </label>
              <select
                className="w-full h-11 rounded-xl border border-border/60 bg-background px-3 text-[13px] font-extrabold outline-none focus:ring-2 focus:ring-primary/30"
                value={menuItemId === "" ? "" : String(menuItemId)}
                onChange={(e) =>
                  setMenuItemId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">كل الأصناف بتكلفة</option>
                {filteredCostItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nameAr || item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-11 rounded-full px-6 font-extrabold"
              onClick={apply}
            >
              عرض الأرباح
            </Button>
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
          </div>
        </div>

        <div className="xl:col-span-4 grid grid-cols-2 xl:grid-cols-1 gap-2.5">
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3.5">
            <p className="text-[12px] font-black text-emerald-800 dark:text-emerald-200 mb-1">
              إجمالي الربح
            </p>
            <p
              className={`font-display text-[22px] font-black tabular-nums ${
                (summary?.totalProfit ?? 0) >= 0
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-rose-600"
              }`}
              dir="ltr"
            >
              {fmtMoney(summary?.totalProfit ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.07] px-4 py-3.5">
            <p className="text-[12px] font-black text-sky-800 dark:text-sky-200 mb-1">
              إجمالي البيع
            </p>
            <p className="font-display text-[20px] font-black tabular-nums" dir="ltr">
              {fmtMoney(summary?.totalSale ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3.5">
            <p className="text-[12px] font-black text-amber-900 dark:text-amber-200 mb-1">
              إجمالي التكلفة
            </p>
            <p className="font-display text-[20px] font-black tabular-nums" dir="ltr">
              {fmtMoney(summary?.totalCost ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-border/55 bg-background/90 px-4 py-3.5">
            <p className="text-[12px] font-black text-muted-foreground mb-1">هامش الربح</p>
            <p className="font-display text-[20px] font-black tabular-nums" dir="ltr">
              {marginPct.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-border/55 bg-background/90 overflow-hidden shadow-sm">
        <div className="px-4 sm:px-5 py-4 border-b border-border/50 bg-gradient-to-l from-emerald-500/[0.06] to-transparent flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-black">تفاصيل البيع والربح</h3>
            <p className="text-[12px] font-bold text-muted-foreground mt-0.5">
              من {formatDate(applied.from)} إلى {formatDate(applied.to)} ·{" "}
              {fmtQty(summary?.lineCount ?? 0)} سطر · {fmtQty(summary?.orderCount ?? 0)} فاتورة
            </p>
          </div>
        </div>

        <div className="overflow-auto max-h-[min(58vh,42rem)]">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-rose-600 font-bold">
              تعذر تحميل تقرير الأرباح
              <div className="text-[12px] mt-1 opacity-80">
                {(error as Error)?.message || ""}
              </div>
            </div>
          ) : (
            <table className="w-full text-[13px] min-w-[980px]">
              <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/60">
                <tr className="text-[11px] font-extrabold text-muted-foreground">
                  <th className="px-3 py-3.5 text-center w-12">#</th>
                  <th className="px-3 py-3.5 text-center">رقم الفاتورة</th>
                  <th className="px-3 py-3.5 text-center">التاريخ</th>
                  <th className="px-3 py-3.5 text-center">الساعة</th>
                  <th className="px-3 py-3.5 text-center">اسم الصنف</th>
                  <th className="px-3 py-3.5 text-center">الفئة</th>
                  <th className="px-3 py-3.5 text-center">الكمية</th>
                  <th className="px-3 py-3.5 text-center">السعر</th>
                  <th className="px-3 py-3.5 text-center">سعر التكلفة</th>
                  <th className="px-3 py-3.5 text-center">البيع</th>
                  <th className="px-3 py-3.5 text-center">التكلفة</th>
                  <th className="px-3 py-3.5 text-center">الربح</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-4 py-20 text-center text-muted-foreground font-bold"
                    >
                      لا مبيعات لأصناف بتكلفة في هذه الفترة / الفلاتر
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/25 hover:bg-emerald-500/[0.04] transition-colors"
                    >
                      <td className="px-3 py-2.5 text-center font-bold text-muted-foreground tabular-nums">
                        {idx + 1}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-display tabular-nums font-extrabold"
                        dir="ltr"
                      >
                        {row.invoiceNo}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-display tabular-nums font-bold"
                        dir="ltr"
                      >
                        {formatDate(row.date)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-display tabular-nums font-bold text-muted-foreground"
                        dir="ltr"
                      >
                        {row.time}
                      </td>
                      <td className="px-3 py-2.5 text-center font-extrabold">
                        {row.itemNameAr || row.itemName}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-muted-foreground">
                        {row.categoryNameAr || row.categoryName}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-display tabular-nums font-extrabold"
                        dir="ltr"
                      >
                        {fmtQty(row.qty)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-display tabular-nums font-bold"
                        dir="ltr"
                      >
                        {fmtMoney(row.unitPrice)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-display tabular-nums font-bold text-amber-700 dark:text-amber-300"
                        dir="ltr"
                      >
                        {fmtMoney(row.costPrice)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-display tabular-nums font-extrabold text-sky-700 dark:text-sky-300"
                        dir="ltr"
                      >
                        {fmtMoney(row.lineSale)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-display tabular-nums font-bold"
                        dir="ltr"
                      >
                        {fmtMoney(row.lineCost)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-center font-display tabular-nums font-black ${
                          row.profit >= 0
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-rose-600"
                        }`}
                        dir="ltr"
                      >
                        {fmtMoney(row.profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {summary && rows.length > 0 ? (
          <div className="px-4 sm:px-5 py-3.5 border-t border-border/50 bg-secondary/20 flex flex-wrap items-center justify-between gap-2 text-[12px] font-extrabold">
            <span className="text-muted-foreground">إجمالي الأرباح</span>
            <div className="flex flex-wrap gap-4 tabular-nums" dir="ltr">
              <span>بيع {fmtMoney(summary.totalSale)}</span>
              <span>تكلفة {fmtMoney(summary.totalCost)}</span>
              <span
                className={
                  summary.totalProfit >= 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-rose-600"
                }
              >
                ربح {fmtMoney(summary.totalProfit)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SalesDiscountsPage() {
  const { formatDate } = useI18n();
  const { selectedBranchId, branchLabel } = useBranch();

  const [from, setFrom] = useState(todayDate);
  const [to, setTo] = useState(todayDate);
  const [applied, setApplied] = useState(() => ({
    from: todayDate(),
    to: todayDate(),
  }));

  const params = useMemo(
    () => ({
      from: applied.from,
      to: applied.to,
      filterBranchId:
        typeof selectedBranchId === "number" ? selectedBranchId : undefined,
    }),
    [applied, selectedBranchId]
  );

  const { data, isLoading, isFetching, refetch, isError, error } =
    useGetSalesDiscounts(params, {
      query: {
        queryKey: getSalesDiscountsQueryKey(params),
        staleTime: 2_000,
      },
    });

  const apply = () => {
    setApplied({
      from: from || todayDate(),
      to: to || todayDate(),
    });
  };

  const rows = data?.rows ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-8 rounded-[1.5rem] border border-border/55 bg-background/90 p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[12px] font-black text-muted-foreground tracking-wide">
                فلاتر خصومات المبيعات
              </p>
              <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                فواتير واصل التي تحتوي خصماً فقط
              </p>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">
              الفرع: {branchLabel || "كل الفروع"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 max-w-xl">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                من تاريخ
              </label>
              <YmdDateInput value={from} onChange={setFrom} className="h-11 rounded-xl" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                إلى تاريخ
              </label>
              <YmdDateInput value={to} onChange={setTo} className="h-11 rounded-xl" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-11 rounded-full px-6 font-extrabold"
              onClick={apply}
            >
              عرض الكشف
            </Button>
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
          </div>
        </div>

        <div className="xl:col-span-4 grid grid-cols-2 xl:grid-cols-1 gap-2.5">
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.08] px-4 py-3.5">
            <p className="text-[12px] font-black text-rose-800 dark:text-rose-200 mb-1">
              إجمالي الخصومات
            </p>
            <p className="font-display text-[22px] font-black tabular-nums text-rose-700 dark:text-rose-300" dir="ltr">
              {fmtMoney(summary?.totalDiscount ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.07] px-4 py-3.5">
            <p className="text-[12px] font-black text-sky-800 dark:text-sky-200 mb-1">
              عدد الفواتير
            </p>
            <p className="font-display text-[22px] font-black tabular-nums" dir="ltr">
              {fmtQty(summary?.invoiceCount ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-border/55 bg-background/90 px-4 py-3.5 xl:col-span-1 col-span-2">
            <p className="text-[12px] font-black text-muted-foreground mb-1">
              صافي هذه الفواتير
            </p>
            <p className="font-display text-[20px] font-black tabular-nums" dir="ltr">
              {fmtMoney(summary?.totalSales ?? 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-border/55 bg-background/90 overflow-hidden shadow-sm">
        <div className="px-4 sm:px-5 py-4 border-b border-border/50 bg-gradient-to-l from-rose-500/[0.06] to-transparent">
          <h3 className="text-lg font-black">كشف الخصومات</h3>
          <p className="text-[12px] font-bold text-muted-foreground mt-0.5">
            من {formatDate(applied.from)} إلى {formatDate(applied.to)}
          </p>
        </div>

        <div className="overflow-auto max-h-[min(58vh,42rem)]">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-rose-600 font-bold">
              تعذر تحميل كشف الخصومات
              <div className="text-[12px] mt-1 opacity-80">
                {(error as Error)?.message || ""}
              </div>
            </div>
          ) : (
            <table className="w-full text-[13px] min-w-[640px]">
              <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/60">
                <tr className="text-[11px] font-extrabold text-muted-foreground">
                  <th className="px-4 py-3.5 text-center w-12">#</th>
                  <th className="px-3 py-3.5 text-center">رقم الفاتورة</th>
                  <th className="px-3 py-3.5 text-center">التاريخ</th>
                  <th className="px-3 py-3.5 text-center">الساعة</th>
                  <th className="px-4 py-3.5 text-center">الخصم</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-20 text-center text-muted-foreground font-bold"
                    >
                      لا فواتير بخصم في هذه الفترة
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/25 hover:bg-rose-500/[0.04] transition-colors"
                    >
                      <td className="px-4 py-3 text-center font-bold text-muted-foreground tabular-nums">
                        {idx + 1}
                      </td>
                      <td
                        className="px-3 py-3 text-center font-display tabular-nums font-extrabold"
                        dir="ltr"
                      >
                        {row.invoiceNo}
                      </td>
                      <td
                        className="px-3 py-3 text-center font-display tabular-nums font-bold"
                        dir="ltr"
                      >
                        {formatDate(row.date)}
                      </td>
                      <td
                        className="px-3 py-3 text-center font-display tabular-nums font-bold text-muted-foreground"
                        dir="ltr"
                      >
                        {row.time}
                      </td>
                      <td
                        className="px-4 py-3 text-center font-display tabular-nums font-black text-rose-700 dark:text-rose-300 text-[15px]"
                        dir="ltr"
                      >
                        {fmtMoney(row.discount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {summary && rows.length > 0 ? (
          <div className="px-4 sm:px-5 py-3.5 border-t border-border/50 bg-secondary/20 flex flex-wrap items-center justify-between gap-2 text-[12px] font-extrabold">
            <span className="text-muted-foreground">إجمالي الكشف</span>
            <div className="flex flex-wrap gap-4 tabular-nums" dir="ltr">
              <span>فواتير {fmtQty(summary.invoiceCount)}</span>
              <span className="text-rose-700 dark:text-rose-300">
                خصم {fmtMoney(summary.totalDiscount)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="rounded-[1.6rem] border border-dashed border-border/70 bg-background/70 px-6 py-20 text-center">
      <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center">
        <LineChart className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-black mb-2">{title}</h3>
      <p className="text-sm font-semibold text-muted-foreground max-w-md mx-auto">
        هذه الصفحة جاهزة للإضافة لاحقاً ضمن فورم التقارير.
      </p>
    </div>
  );
}

export default function Reports() {
  const { t } = useI18n();
  const [page, setPage] = useState<ReportPageId>("sales");

  return (
    <div className="relative min-h-[calc(100vh-5rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-24 -start-10 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute top-40 -end-16 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="max-w-[90rem] mx-auto space-y-5 pb-12">
        <header className="rounded-[1.75rem] border border-border/50 bg-gradient-to-l from-sky-500/[0.10] via-background/90 to-emerald-500/[0.08] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-extrabold text-sky-800 dark:text-sky-200">
                <LineChart className="w-3.5 h-3.5" />
                {t("reports.kicker")}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {t("reports.title")}
              </h1>
              <p className="text-sm font-semibold text-muted-foreground max-w-2xl">
                صفحات تقارير منظمة — ابدأ بتقرير المبيعات حسب التاريخين والصنف والفئة.
              </p>
            </div>
            <BranchSwitcher />
          </div>
        </header>

        <nav className="rounded-[1.4rem] border border-border/55 bg-background/85 p-2 flex gap-2 overflow-x-auto shadow-sm">
          {PAGES.map((p) => {
            const Icon = p.icon;
            const on = page === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPage(p.id)}
                className={`shrink-0 min-w-[10.5rem] text-start rounded-2xl px-4 py-3 transition-all touch-manipulation border ${
                  on
                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                    : "bg-secondary/30 border-transparent hover:bg-secondary/55"
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-[13px]">
                  <Icon className="w-4 h-4" />
                  {p.title}
                  {!p.ready ? (
                    <span
                      className={`ms-auto text-[10px] font-black rounded-full px-2 py-0.5 ${
                        on
                          ? "bg-primary-foreground/15"
                          : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                      }`}
                    >
                      قريباً
                    </span>
                  ) : null}
                </div>
                <p className={`mt-1 text-[11px] font-bold ${on ? "opacity-90" : "text-muted-foreground"}`}>
                  {p.subtitle}
                </p>
              </button>
            );
          })}
        </nav>

        {page === "sales" ? (
          <SalesReportPage />
        ) : page === "profit" ? (
          <SalesProfitPage />
        ) : page === "discounts" ? (
          <SalesDiscountsPage />
        ) : (
          <ComingSoonPage
            title={PAGES.find((p) => p.id === page)?.title || "تقرير"}
          />
        )}
      </div>
    </div>
  );
}
