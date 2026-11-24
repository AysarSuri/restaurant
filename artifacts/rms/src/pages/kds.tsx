import React, { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  useGetOrders,
  useUpdateOrderStatus,
  useGetSettings,
  useGetBranches,
  useGetDevicePrinters,
  type Order,
} from "@workspace/api-client-react";
import { Button, Badge } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  ChefHat,
  ArrowLeft,
  Flame,
  ConciergeBell,
  UtensilsCrossed,
  RefreshCw,
  Table2,
  ShoppingBag,
  Bike,
  Printer,
  Pencil,
} from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/i18n";
import { useBranch } from "@/lib/branch-context";
import { BranchSwitcher } from "@/components/branch-switcher";
import { getOrCreateDeviceKey } from "@/lib/device-id";
import { printKitchenTicketThermal } from "@/lib/print-receipt";
import { toast } from "@/hooks/use-toast";

type KitchenColumn = "preparing" | "ready" | "served";

const SILENT_REFETCH_MS = 4_000;

function posEditedAt(order: Order) {
  return (order as Order & { posEditedAt?: string | null }).posEditedAt ?? null;
}

function isPosEdited(order: Order) {
  return Boolean(posEditedAt(order));
}

function isRecentlyPosEdited(order: Order) {
  const at = posEditedAt(order);
  if (!at) return false;
  const mins = Math.floor((Date.now() - new Date(at).getTime()) / 60000);
  return mins >= 0 && mins < 20;
}

function sortKitchenOrders(orders: Order[]) {
  return [...orders].sort((a, b) => {
    const aEdit = posEditedAt(a) ? new Date(posEditedAt(a)!).getTime() : 0;
    const bEdit = posEditedAt(b) ? new Date(posEditedAt(b)!).getTime() : 0;
    if (aEdit !== bEdit) return bEdit - aEdit;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function seatLabel(
  order: Order,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  const table = (order as Order & { table?: { number?: string } }).table;
  const tableNo = table?.number?.trim();
  if (order.type === "delivery") {
    return order.deliveryPhone?.trim() || t("order.delivery");
  }
  if (order.type === "takeaway") {
    return t("order.takeaway");
  }
  if (tableNo) return t("tables.tableN", { n: tableNo });
  return t("order.dineIn");
}

function SeatIcon({ order }: { order: Order }) {
  if (order.type === "delivery") return <Bike className="w-4 h-4" />;
  if (order.type === "takeaway") return <ShoppingBag className="w-4 h-4" />;
  return <Table2 className="w-4 h-4" />;
}

function elapsedMins(createdAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
}

/** Kitchen flow only — never tied to payment / واصل */
function isKitchenServedToday(order: Order, todayYmd: string) {
  if (order.status !== "served") return false;
  const day = String(order.updatedAt || order.createdAt || "").slice(0, 10);
  return day === todayYmd;
}

function columnOf(order: Order): KitchenColumn | null {
  if (order.status === "ready") return "ready";
  if (order.status === "preparing") return "preparing";
  if (order.status === "served") return "served";
  return null;
}

function KitchenTicket({
  order,
  column,
  busy,
  onAction,
  onPrint,
  t,
}: {
  order: Order;
  column: KitchenColumn;
  busy: boolean;
  onAction: () => void;
  onPrint: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const mins = elapsedMins(String(order.createdAt || ""));
  const urgent = column !== "served" && mins >= 12;
  const warn = column !== "served" && mins >= 7 && !urgent;
  const edited = isPosEdited(order);
  const recentlyEdited = isRecentlyPosEdited(order);

  const shell = edited
    ? "border-indigo-500/65 bg-gradient-to-b from-indigo-500/20 via-violet-500/10 to-fuchsia-500/8"
    : column === "preparing"
      ? "border-amber-500/55 bg-gradient-to-b from-amber-500/15 via-card to-orange-500/8"
      : column === "ready"
        ? "border-emerald-500/55 bg-gradient-to-b from-emerald-500/15 via-card to-teal-500/8"
        : "border-slate-400/40 bg-gradient-to-b from-slate-500/10 via-card to-card";

  const actionClass =
    column === "preparing"
      ? "bg-gradient-to-l from-emerald-500 to-teal-600 text-white"
      : column === "ready"
        ? "bg-gradient-to-l from-sky-500 to-blue-600 text-white"
        : "bg-secondary text-muted-foreground cursor-default";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.16 }}
      className={`rounded-[1.35rem] border-2 overflow-hidden shadow-[0_10px_28px_-20px_rgba(0,0,0,0.45)] ${shell} ${
        edited
          ? recentlyEdited
            ? "ring-2 ring-indigo-500/60"
            : "ring-2 ring-indigo-500/40"
          : urgent
            ? "ring-2 ring-rose-500/45"
            : warn
              ? "ring-2 ring-amber-500/35"
              : ""
      }`}
    >
      {edited ? (
        <div
          className={`px-3 pt-3 ${
            recentlyEdited ? "animate-pulse" : ""
          }`}
        >
          <div className="flex items-center gap-2 rounded-xl border border-indigo-500/45 bg-gradient-to-l from-indigo-500/25 via-violet-500/15 to-fuchsia-500/10 px-3 py-2 text-[11px] sm:text-xs font-extrabold text-indigo-900 dark:text-indigo-100 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]">
            <span className="w-7 h-7 rounded-lg bg-indigo-500 text-white flex items-center justify-center shrink-0">
              <Pencil className="w-3.5 h-3.5" />
            </span>
            <span className="leading-tight min-w-0">
              <span className="block">{t("kds.editedFromPos")}</span>
              <span className="block text-[10px] font-bold opacity-80 mt-0.5">
                {t("kds.editedFromPosHint")}
              </span>
            </span>
          </div>
        </div>
      ) : null}

      <div className="p-3.5 border-b border-border/40 bg-black/10 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xl font-black tabular-nums leading-none">
            #{String(order.orderNumber || "").slice(-4)}
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-[11px] font-extrabold">
            <SeatIcon order={order} />
            <span className="truncate max-w-[9rem]">{seatLabel(order, t)}</span>
          </div>
        </div>
        <div className="text-end shrink-0">
          <p className="text-sm font-black tabular-nums flex items-center justify-end gap-1 opacity-90">
            <Clock className="w-3.5 h-3.5" />
            {mins}m
          </p>
          <Badge
            variant="outline"
            className={`mt-1.5 text-[10px] font-extrabold ${
              edited
                ? "border-indigo-500/45 text-indigo-700 dark:text-indigo-300"
                : column === "preparing"
                  ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                  : column === "ready"
                    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                    : "border-slate-400/40 text-muted-foreground"
            }`}
          >
            {column === "preparing"
              ? t("kds.colPreparing")
              : column === "ready"
                ? t("kds.colReady")
                : t("kds.colServed")}
          </Badge>
        </div>
      </div>

      <div className="p-3.5 space-y-2.5 max-h-56 overflow-y-auto">
        {(order.items ?? []).map((item: any, idx: number) => (
          <div
            key={item.id ?? idx}
            className="flex items-start gap-2.5 border-b border-border/40 pb-2 last:border-0 last:pb-0"
          >
            <span className="min-w-8 h-8 rounded-xl bg-secondary/80 flex items-center justify-center text-sm font-black tabular-nums">
              {item.quantity}×
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-[15px] leading-snug">
                {item.menuItem?.nameAr || t("kds.item")}
              </p>
              {item.notes ? (
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-1 bg-amber-500/10 rounded-lg px-2 py-1">
                  {t("common.note", { text: item.notes })}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3.5 pb-3.5 space-y-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrint();
          }}
          className="w-full h-11 rounded-xl border-2 border-border/60 bg-background/70 hover:bg-background font-extrabold text-[13px] flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99] transition-all"
        >
          <Printer className="w-4 h-4" />
          {t("kds.printTicket")}
        </button>
        {column === "served" ? (
          <div className="h-11 rounded-xl border border-slate-400/30 bg-secondary/50 text-[13px] font-extrabold flex items-center justify-center gap-2 text-muted-foreground">
            <UtensilsCrossed className="w-4 h-4" />
            {t("kds.served")}
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onAction}
            className={`w-full h-12 sm:h-14 font-black text-[14px] sm:text-[15px] flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99] transition-all disabled:opacity-60 ${actionClass}`}
          >
            {column === "preparing" ? (
              <>
                <ConciergeBell className="w-5 h-5" />
                {t("kds.ready")}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                {t("kds.served")}
              </>
            )}
          </button>
        )}
      </div>
    </motion.article>
  );
}

export default function KDS() {
  const { t } = useI18n();
  const { selectedBranchId, branchLabel } = useBranch();
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const openParams = useMemo(
    () => ({ status: "preparing,ready", limit: 200 }),
    []
  );
  const todayParams = useMemo(() => ({ date: today, limit: 200 }), [today]);

  const silentQueryOpts = {
    refetchInterval: SILENT_REFETCH_MS,
    staleTime: 2_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  } as const;

  const {
    data: openOrders,
    refetch: refetchOpen,
    isFetching: fetchingOpen,
  } = useGetOrders(openParams, {
    query: {
      queryKey: ["/api/orders", "kds-open", openParams, selectedBranchId],
      ...silentQueryOpts,
    },
  });

  const {
    data: todayOrders,
    refetch: refetchToday,
    isFetching: fetchingToday,
  } = useGetOrders(todayParams, {
    query: {
      queryKey: ["/api/orders", "kds-today", todayParams, selectedBranchId],
      ...silentQueryOpts,
    },
  });

  const { mutate: updateStatus } = useUpdateOrderStatus();
  const { data: appSettings } = useGetSettings();
  const { data: branches } = useGetBranches();
  const deviceKey = useMemo(() => getOrCreateDeviceKey(), []);
  const { data: devicePrinters } = useGetDevicePrinters();
  const devicePrinter = useMemo(() => {
    const list = devicePrinters ?? [];
    return (
      list.find((p) => p.deviceKey === deviceKey && p.isActive !== false) ??
      list.find((p) => p.deviceKey === deviceKey) ??
      null
    );
  }, [devicePrinters, deviceKey]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const bump = () => {
      void refetchOpen();
      void refetchToday();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "rms-orders-bump") bump();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetchOpen, refetchToday]);

  const allOrders = useMemo(() => {
    void nowTick;
    const map = new Map<number, Order>();
    for (const o of todayOrders ?? []) map.set(o.id, o);
    for (const o of openOrders ?? []) map.set(o.id, o);
    let list = [...map.values()];
    if (selectedBranchId !== "all") {
      list = list.filter((o) => o.branchId == null || o.branchId === selectedBranchId);
    }
    return list.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [todayOrders, openOrders, selectedBranchId, nowTick]);

  const preparing = useMemo(
    () => sortKitchenOrders(allOrders.filter((o) => o.status === "preparing")),
    [allOrders]
  );
  const ready = useMemo(
    () => sortKitchenOrders(allOrders.filter((o) => o.status === "ready")),
    [allOrders]
  );
  const served = useMemo(
    () =>
      sortKitchenOrders(allOrders.filter((o) => isKitchenServedToday(o, today))),
    [allOrders, today]
  );

  const bumpOrders = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    try {
      localStorage.setItem("rms-orders-bump", String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const printKitchenOrder = (order: Order) => {
    const branch =
      (order.branchId != null
        ? (branches ?? []).find((b) => b.id === order.branchId)
        : null) ??
      (selectedBranchId !== "all"
        ? (branches ?? []).find((b) => b.id === selectedBranchId)
        : null);
    const created = new Date(order.createdAt);
    const statusLabel =
      order.status === "ready"
        ? t("kds.colReady")
        : order.status === "served"
          ? t("kds.colServed")
          : t("kds.colPreparing");
    const typeLabel =
      order.type === "delivery"
        ? t("order.delivery")
        : order.type === "takeaway"
          ? t("order.takeaway")
          : t("order.dineIn");

    try {
      printKitchenTicketThermal({
        restaurantName:
          appSettings?.restaurantName?.trim() || t("pos.fallbackRestaurant"),
        branchName: branch?.name?.trim() || branchLabel,
        logoUrl: branch?.logoUrl?.trim() || appSettings?.logoUrl?.trim() || null,
        invoiceNumber: order.orderNumber,
        dateLabel: created.toLocaleDateString("en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          numberingSystem: "latn",
        }),
        timeLabel: created.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          numberingSystem: "latn",
        }),
        orderTypeLabel: typeLabel,
        seatLabel: seatLabel(order, t),
        kitchenStatusLabel: statusLabel,
        items: (order.items ?? []).map((item: any) => ({
          name: item.menuItem?.nameAr || t("kds.item"),
          quantity: item.quantity,
          notes: item.notes,
        })),
        orderNotes: order.notes,
        printerName: devicePrinter?.printerName?.trim() || null,
      });
      toast({
        title: t("kds.printOk"),
        description: devicePrinter?.printerName?.trim()
          ? t("pos.printNamed", { name: devicePrinter.printerName.trim() })
          : t("kds.printTicketHint"),
      });
    } catch {
      toast({
        variant: "destructive",
        title: t("kds.printFailed"),
        description: t("pos.printPopupBlocked"),
      });
    }
  };

  const advance = (order: Order) => {
    const col = columnOf(order);
    // Kitchen statuses only — never touch payment / واصل
    const next: "ready" | "served" | null =
      col === "preparing" ? "ready" : col === "ready" ? "served" : null;
    if (!next) return;
    setBusyId(order.id);
    updateStatus(
      { id: order.id, data: { status: next } },
      {
        onSuccess: () => {
          bumpOrders();
          void refetchOpen();
          void refetchToday();
          setBusyId(null);
        },
        onError: () => setBusyId(null),
      }
    );
  };

  const columns: {
    id: KitchenColumn;
    title: string;
    hint: string;
    icon: typeof Flame;
    orders: Order[];
    accent: string;
  }[] = [
    {
      id: "preparing",
      title: t("kds.colPreparing"),
      hint: t("kds.colPreparingHint"),
      icon: Flame,
      orders: preparing,
      accent: "from-amber-500/20 to-orange-500/5 border-amber-500/35",
    },
    {
      id: "ready",
      title: t("kds.colReady"),
      hint: t("kds.colReadyHint"),
      icon: ConciergeBell,
      orders: ready,
      accent: "from-emerald-500/20 to-teal-500/5 border-emerald-500/35",
    },
    {
      id: "served",
      title: t("kds.colServed"),
      hint: t("kds.colServedHint"),
      icon: UtensilsCrossed,
      orders: served,
      accent: "from-slate-500/15 to-transparent border-border/50",
    },
  ];

  const fetching = fetchingOpen || fetchingToday;

  return (
    <div className="min-h-app h-app bg-background flex flex-col text-foreground overflow-hidden page-shell">
      <header className="flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="glass-panel p-3 sm:p-4 rounded-[1.5rem] border border-border/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/">
              <Button variant="outline" size="icon" className="rounded-full touch-target shrink-0">
                <ArrowLeft />
              </Button>
            </Link>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-orange-500/15 text-orange-600 dark:text-orange-300 flex items-center justify-center shrink-0 border border-orange-500/25">
              <ChefHat className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-black truncate">{t("kds.heading")}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-bold truncate">
                {branchLabel} · {t("kds.paymentIndependent")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <BranchSwitcher />
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl touch-target"
              disabled={fetching}
              onClick={() => {
                void refetchOpen();
                void refetchToday();
              }}
            >
              <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
            </Button>
            <div className="text-sm sm:text-base font-display font-bold px-3 sm:px-4 py-2 rounded-xl border border-border/50 bg-secondary/50 tabular-nums">
              {new Date().toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
                numberingSystem: "latn",
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-3 sm:p-4 safe-pb">
        <div className="h-full min-w-[64rem] grid grid-cols-3 gap-3 sm:gap-4">
          {columns.map((col) => {
            const Icon = col.icon;
            return (
              <section
                key={col.id}
                className={`h-full min-h-0 flex flex-col rounded-[1.5rem] border bg-gradient-to-b ${col.accent}`}
              >
                <div className="flex-shrink-0 px-3.5 py-3 border-b border-border/40 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 shrink-0" />
                      <h2 className="font-black text-base sm:text-lg truncate">{col.title}</h2>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                      {col.hint}
                    </p>
                  </div>
                  <span className="min-w-7 h-7 px-1.5 rounded-full bg-background/70 border border-border/50 text-xs font-black tabular-nums flex items-center justify-center">
                    {col.orders.length}
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3 space-y-3">
                  <AnimatePresence initial={false}>
                    {col.orders.map((order) => (
                      <KitchenTicket
                        key={order.id}
                        order={order}
                        column={col.id}
                        busy={busyId === order.id}
                        onAction={() => advance(order)}
                        onPrint={() => printKitchenOrder(order)}
                        t={t}
                      />
                    ))}
                  </AnimatePresence>
                  {col.orders.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground px-4">
                      <ChefHat className="w-10 h-10 mb-2 opacity-40" />
                      <p className="text-sm font-bold">{t("kds.columnEmpty")}</p>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
