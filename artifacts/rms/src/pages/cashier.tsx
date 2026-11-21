import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  useGetOrders,
  useUpdateOrderStatus,
  useGetSettings,
  type Order,
} from "@workspace/api-client-react";
import { Button, Badge, Dialog } from "@/components/ui-elements";
import {
  Clock,
  CheckCircle2,
  CreditCard,
  Banknote,
  Phone,
  ChefHat,
  RefreshCw,
  ShoppingBag,
  Table2,
  ArrowRight,
  Bell,
  X,
  DoorOpen,
  User,
  Bike,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";

type SeatKind = "table" | "room" | "person" | "takeaway" | "delivery";
type CashierPage = "unpaid" | "paid";

type OrderCardModel = {
  order: Order;
  seatKind: SeatKind;
  seatLabel: string;
  amount: number;
  shortNo: string;
};

const SILENT_REFETCH_MS = 4_000;

const formatIQD = (v: number | string) =>
  new Intl.NumberFormat("en-IQ").format(Math.round(Number(v)));

const elapsed = (
  dateStr: string,
  t: (key: string, params?: Record<string, string | number>) => string
) => {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return t("cashier.justNow");
  if (mins < 60) return t("cashier.minutes", { n: mins });
  return t("cashier.hours", { h: Math.floor(mins / 60), m: mins % 60 });
};

function seatIcon(kind: SeatKind): LucideIcon {
  if (kind === "room") return DoorOpen;
  if (kind === "person") return User;
  if (kind === "delivery") return Bike;
  if (kind === "takeaway") return ShoppingBag;
  return Table2;
}

function seatTone(kind: SeatKind) {
  if (kind === "room")
    return "from-violet-500/20 to-fuchsia-500/10 text-violet-600 dark:text-violet-300 border-violet-500/30";
  if (kind === "person")
    return "from-sky-500/20 to-cyan-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30";
  if (kind === "delivery")
    return "from-amber-500/20 to-orange-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
  if (kind === "takeaway")
    return "from-emerald-500/20 to-teal-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  return "from-primary/20 to-primary/5 text-primary border-primary/30";
}

function resolveSeat(
  order: Order,
  t: (key: string, params?: Record<string, string | number>) => string
): Pick<OrderCardModel, "seatKind" | "seatLabel"> {
  const table = (order as { table?: { number?: string; type?: string; location?: string } })
    .table;
  const tableType = String(table?.type || "").toLowerCase();
  const tableNo = table?.number?.trim();

  if (order.type === "delivery") {
    const phone =
      order.deliveryPhone?.trim() ||
      (order as { customer?: { phone?: string } }).customer?.phone?.trim();
    return {
      seatKind: "delivery",
      seatLabel: phone || t("order.delivery"),
    };
  }

  if (order.type === "takeaway" && !tableNo) {
    const name = (order as { customer?: { name?: string } }).customer?.name?.trim();
    return {
      seatKind: "takeaway",
      seatLabel: name || t("order.takeaway"),
    };
  }

  if (tableType === "room") {
    return {
      seatKind: "room",
      seatLabel: tableNo ? t("cashier.roomN", { n: tableNo }) : t("cashier.room"),
    };
  }
  if (tableType === "person") {
    return {
      seatKind: "person",
      seatLabel: tableNo ? t("cashier.personN", { n: tableNo }) : t("cashier.person"),
    };
  }
  if (tableNo) {
    return {
      seatKind: "table",
      seatLabel: t("tables.tableN", { n: tableNo }),
    };
  }
  if (order.type === "dine_in") {
    return { seatKind: "table", seatLabel: t("order.inside") };
  }
  return { seatKind: "takeaway", seatLabel: t("order.takeaway") };
}

function toCard(
  order: Order,
  t: (key: string, params?: Record<string, string | number>) => string
): OrderCardModel {
  const seat = resolveSeat(order, t);
  return {
    order,
    ...seat,
    amount: Number(order.total) || 0,
    shortNo: String(order.orderNumber || "").slice(-4),
  };
}

function isOrderReceived(order: Order) {
  if (order.paymentMethod) return true;
  return order.status === "paid" || order.status === "served";
}

function urgencyRing(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins > 15) return "ring-2 ring-rose-500/40";
  if (mins > 8) return "ring-2 ring-amber-500/35";
  return "";
}

function OrderTicket({
  card,
  page,
  onOpen,
  onPrimary,
  primaryLabel,
  t,
}: {
  card: OrderCardModel;
  page: CashierPage;
  onOpen: () => void;
  onPrimary?: () => void;
  primaryLabel?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const Icon = seatIcon(card.seatKind);
  const tone = seatTone(card.seatKind);
  const createdAt = String(card.order.createdAt || "");

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className={`group rounded-[1.35rem] border border-border/55 bg-gradient-to-b from-card via-card to-secondary/25 overflow-hidden shadow-[0_8px_24px_-18px_rgba(0,0,0,0.45)] hover:shadow-[0_14px_28px_-16px_rgba(0,0,0,0.4)] hover:border-border transition-shadow cursor-pointer ${urgencyRing(createdAt)}`}
      onClick={onOpen}
    >
      <div className="p-3.5 flex items-start gap-3">
        <div
          className={`w-12 h-12 rounded-2xl border bg-gradient-to-br flex items-center justify-center shrink-0 ${tone}`}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[15px] font-black truncate leading-tight tracking-tight">
                {card.seatLabel}
              </p>
              <p className="text-[11px] font-bold text-muted-foreground mt-0.5 tabular-nums">
                #{card.shortNo}
              </p>
            </div>
            <div className="text-end shrink-0">
              <p className="text-[16px] font-black text-primary tabular-nums leading-tight">
                {formatIQD(card.amount)}
              </p>
              <p className="text-[10px] font-bold text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {elapsed(createdAt, t)}
              </p>
            </div>
          </div>
          {(card.order.items?.length ?? 0) > 0 ? (
            <p className="text-[11px] text-muted-foreground font-semibold mt-2 truncate">
              {(card.order.items ?? [])
                .slice(0, 2)
                .map((it: any) => it.menuItem?.nameAr || t("common.item"))
                .join(" · ")}
              {(card.order.items?.length ?? 0) > 2
                ? ` · ${t("cashier.moreItems", { n: (card.order.items?.length ?? 0) - 2 })}`
                : ""}
            </p>
          ) : null}
        </div>
      </div>

      {page === "unpaid" && onPrimary ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrimary();
          }}
          className="w-full h-11 bg-gradient-to-l from-amber-500 to-orange-500 text-white font-extrabold text-[13px] flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.99] transition-all"
        >
          <Wallet className="w-4 h-4" />
          {primaryLabel}
        </button>
      ) : null}

      {page === "paid" ? (
        <div className="px-3.5 pb-3.5">
          <div className="h-9 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[12px] font-extrabold flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t("cashier.received")}
          </div>
        </div>
      ) : null}
    </motion.article>
  );
}

function PaidListRow({
  card,
  onOpen,
  t,
}: {
  card: OrderCardModel;
  onOpen: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const Icon = seatIcon(card.seatKind);
  const tone = seatTone(card.seatKind);
  const createdAt = String(card.order.createdAt || "");
  const pay =
    card.order.paymentMethod === "cash"
      ? t("pos.cash")
      : card.order.paymentMethod === "card"
        ? t("common.card")
        : card.order.paymentMethod === "transfer"
          ? t("common.transfer")
          : t("cashier.received");

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onOpen}
      className="w-full text-start rounded-2xl border border-border/50 bg-card/80 hover:bg-card hover:border-emerald-500/35 px-3 sm:px-4 py-3 flex items-center gap-3 transition-colors touch-manipulation"
    >
      <div
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border bg-gradient-to-br flex items-center justify-center shrink-0 ${tone}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[14px] sm:text-[15px] font-black truncate">{card.seatLabel}</p>
          <span className="text-[11px] font-bold text-muted-foreground tabular-nums shrink-0">
            #{card.shortNo}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {elapsed(createdAt, t)}
          </span>
          <span className="text-border">·</span>
          <span>{pay}</span>
        </div>
      </div>
      <div className="shrink-0 text-end flex flex-col items-end gap-1">
        <p className="text-[15px] sm:text-[16px] font-black text-primary tabular-nums leading-none">
          {formatIQD(card.amount)}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3" />
          {t("cashier.received")}
        </span>
      </div>
    </motion.button>
  );
}

export default function Cashier() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todayParams = useMemo(() => ({ date: today, limit: 200 }), [today]);
  const openParams = useMemo(
    () => ({ status: "pending,confirmed,preparing,ready", limit: 200 }),
    []
  );

  const silentQueryOpts = {
    refetchInterval: SILENT_REFETCH_MS,
    staleTime: 2_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  } as const;

  const {
    data: todayOrders,
    refetch: refetchToday,
    isFetching: fetchingToday,
  } = useGetOrders(todayParams, {
    query: {
      queryKey: ["/api/orders", todayParams],
      ...silentQueryOpts,
    },
  });

  const {
    data: openOrders,
    refetch: refetchOpen,
    isFetching: fetchingOpen,
  } = useGetOrders(openParams, {
    query: {
      queryKey: ["/api/orders", openParams],
      ...silentQueryOpts,
    },
  });

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateOrderStatus();
  const { data: appSettings } = useGetSettings();
  const cashierSendToKitchen = appSettings?.cashierSendToKitchen !== false;

  const [page, setPage] = useState<CashierPage>("unpaid");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<Order | null>(null);
  const [dismissedTableNotifs, setDismissedTableNotifs] = useState<Set<number>>(
    () => new Set()
  );
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const manualTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (manualTimer.current != null) window.clearTimeout(manualTimer.current);
    };
  }, []);

  useEffect(() => {
    const bump = () => {
      void refetchToday();
      void refetchOpen();
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
  }, [refetchToday, refetchOpen]);

  const allOrders = useMemo(() => {
    const map = new Map<number, Order>();
    for (const o of todayOrders ?? []) map.set(o.id, o);
    for (const o of openOrders ?? []) {
      if (!map.has(o.id)) map.set(o.id, o);
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [todayOrders, openOrders]);

  const unpaid = useMemo(
    () =>
      allOrders
        .filter((o) => !isOrderReceived(o) && o.status !== "cancelled")
        .map((o) => toCard(o, t)),
    [allOrders, t]
  );

  const paid = useMemo(
    () =>
      allOrders
        .filter((o) => {
          if (!isOrderReceived(o)) return false;
          const day = String(o.createdAt || "").slice(0, 10);
          return day === today || o.status === "preparing" || o.status === "ready";
        })
        .map((o) => toCard(o, t)),
    [allOrders, t, today]
  );

  const visible = page === "unpaid" ? unpaid : paid;

  const tableAlerts = useMemo(
    () =>
      unpaid.filter(
        (c) =>
          c.order.type === "dine_in" &&
          !dismissedTableNotifs.has(c.order.id) &&
          (c.seatKind === "table" || c.seatKind === "room" || c.seatKind === "person")
      ),
    [unpaid, dismissedTableNotifs]
  );

  const refreshAll = async (manual = false) => {
    if (manual) {
      setManualRefreshing(true);
      if (manualTimer.current != null) window.clearTimeout(manualTimer.current);
    }
    await Promise.all([refetchToday(), refetchOpen()]);
    if (manual) {
      manualTimer.current = window.setTimeout(() => {
        setManualRefreshing(false);
        manualTimer.current = null;
      }, 350);
    }
  };

  const confirmCashierSave = (
    order: Order,
    paymentMethod: "cash" | "card" | "transfer"
  ) => {
    updateStatus(
      {
        id: order.id,
        data: {
          status: cashierSendToKitchen ? "preparing" : "paid",
          paymentMethod,
        } as any,
      },
      {
        onSuccess: () => {
          setPaymentDialog(null);
          setSelectedOrder(null);
          void queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          void refreshAll(false);
          setPage("paid");
        },
      }
    );
  };

  const primaryPayLabel = cashierSendToKitchen
    ? t("cashier.collectSendKitchen")
    : t("cashier.collectPaid");

  const showSpin = manualRefreshing;

  return (
    <div className="h-app min-h-app bg-background text-foreground flex flex-col overflow-hidden page-shell relative">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-28 -start-12 h-72 w-72 rounded-full bg-amber-500/12 blur-3xl" />
        <div className="absolute top-36 -end-20 h-80 w-80 rounded-full bg-emerald-500/12 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04),transparent_55%)]" />
      </div>

      <header className="p-3 sm:p-4 bg-card/75 backdrop-blur-xl border-b border-border/50 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-11 h-11 bg-gradient-to-br from-amber-500/30 to-orange-500/15 border border-amber-500/35 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Wallet className="w-5 h-5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black truncate tracking-tight">
              {t("cashier.title")}
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-bold truncate">
              {user?.name} · {t("cashier.boardHint")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => void refreshAll(true)}
            className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center hover:bg-secondary transition-colors touch-manipulation relative"
            title={t("common.update")}
          >
            <RefreshCw className={`w-4 h-4 ${showSpin ? "animate-spin" : ""}`} />
            {(fetchingToday || fetchingOpen) && !showSpin ? (
              <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-secondary transition-colors touch-manipulation"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="hidden sm:inline">{t("common.back")}</span>
          </button>
        </div>
      </header>

      {tableAlerts.length > 0 ? (
        <div className="flex-shrink-0 border-b border-amber-500/30 bg-amber-500/10">
          <div className="px-3 sm:px-4 py-2 flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-7 h-7 bg-amber-500/30 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <Bell className="w-4 h-4 text-amber-500" />
            </motion.div>
            <span className="text-amber-700 dark:text-amber-300 text-sm font-extrabold flex-shrink-0">
              {tableAlerts.length > 1
                ? t("cashier.newTableOrders", { n: tableAlerts.length })
                : t("cashier.newTableOrder")}
            </span>
            <div className="flex-1 flex gap-2 overflow-x-auto pb-0.5 pt-1">
              <AnimatePresence>
                {tableAlerts.map((card) => {
                  const Icon = seatIcon(card.seatKind);
                  return (
                    <motion.button
                      key={card.order.id}
                      type="button"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      onClick={() => setPaymentDialog(card.order)}
                      className="flex-shrink-0 flex items-center gap-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-xl px-3 py-1.5 transition-all"
                    >
                      <Icon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                      <span className="text-sm font-bold">{card.seatLabel}</span>
                      <span className="text-xs text-amber-700 dark:text-amber-300 font-display font-bold tabular-nums">
                        {formatIQD(card.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDismissedTableNotifs(
                            (prev) => new Set([...prev, card.order.id])
                          );
                        }}
                        className="w-5 h-5 flex items-center justify-center hover:bg-amber-500/30 rounded transition-colors"
                      >
                        <X className="w-3 h-3 text-amber-600" />
                      </button>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-[1.35rem] border border-border/50 bg-secondary/35 backdrop-blur-md shadow-inner">
          {(
            [
              {
                id: "unpaid" as const,
                label: t("cashier.colUnpaid"),
                count: unpaid.length,
                icon: Wallet,
                activeClass: "from-amber-500 to-orange-500",
              },
              {
                id: "paid" as const,
                label: t("cashier.colPaid"),
                count: paid.length,
                icon: CheckCircle2,
                activeClass: "from-emerald-500 to-teal-500",
              },
            ] as const
          ).map((tab) => {
            const active = page === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPage(tab.id)}
                className={`relative h-12 sm:h-14 rounded-[1.1rem] flex items-center justify-center gap-2 font-extrabold text-sm sm:text-base transition-colors ${
                  active ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="cashier-page-pill"
                    className={`absolute inset-0 rounded-[1.1rem] bg-gradient-to-l shadow-md ${tab.activeClass}`}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                ) : null}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{tab.label}</span>
                  <span
                    className={`min-w-6 h-6 px-1.5 rounded-full text-[11px] font-black tabular-nums flex items-center justify-center ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-background/70 text-foreground border border-border/50"
                    }`}
                  >
                    {tab.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 safe-pb">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="h-full"
          >
            {visible.length === 0 ? (
              <div className="h-full min-h-[16rem] flex flex-col items-center justify-center text-center px-6 rounded-[1.75rem] border border-dashed border-border/60 bg-card/30">
                {page === "unpaid" ? (
                  <Wallet className="w-12 h-12 mb-3 text-amber-500/70" />
                ) : (
                  <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-500/70" />
                )}
                <p className="text-base font-black">
                  {page === "unpaid"
                    ? t("cashier.emptyUnpaid")
                    : t("cashier.emptyPaid")}
                </p>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
                  {page === "unpaid"
                    ? t("cashier.emptyUnpaidHint")
                    : t("cashier.emptyPaidHint")}
                </p>
              </div>
            ) : page === "paid" ? (
              <div className="max-w-4xl mx-auto rounded-[1.5rem] border border-border/50 bg-card/40 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-border/40 bg-emerald-500/8 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
                    <p className="text-sm font-extrabold truncate">{t("cashier.colPaid")}</p>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                    {t("cashier.ordersCount", { n: paid.length })}
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 space-y-1.5">
                  <AnimatePresence initial={false}>
                    {visible.map((card) => (
                      <PaidListRow
                        key={card.order.id}
                        card={card}
                        t={t}
                        onOpen={() => setSelectedOrder(card.order)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                <AnimatePresence initial={false}>
                  {visible.map((card) => (
                    <OrderTicket
                      key={card.order.id}
                      card={card}
                      page="unpaid"
                      t={t}
                      onOpen={() => setSelectedOrder(card.order)}
                      onPrimary={() => setPaymentDialog(card.order)}
                      primaryLabel={primaryPayLabel}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Dialog
        isOpen={!!selectedOrder && !paymentDialog}
        onClose={() => setSelectedOrder(null)}
        title={t("cashier.orderN", {
          n: String(selectedOrder?.orderNumber || "").slice(-4),
        })}
      >
        {selectedOrder ? (
          <div className="space-y-4">
            {(() => {
              const card = toCard(selectedOrder, t);
              const Icon = seatIcon(card.seatKind);
              return (
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl border bg-gradient-to-br flex items-center justify-center ${seatTone(card.seatKind)}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-[16px]">{card.seatLabel}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline">{card.order.status}</Badge>
                      <Badge variant="warning">
                        <Clock className="w-3 h-3 me-1" />
                        {elapsed(String(card.order.createdAt), t)}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2 bg-secondary/30 rounded-xl p-4">
              {(selectedOrder.items ?? []).map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm border-b border-border/30 pb-2 last:border-0 last:pb-0 gap-3"
                >
                  <span className="font-semibold">
                    {item.menuItem?.nameAr || t("common.item")}
                  </span>
                  <div className="flex gap-4 shrink-0">
                    <span className="text-muted-foreground">×{item.quantity}</span>
                    <span className="font-display font-bold text-primary tabular-nums">
                      {formatIQD(
                        (item.price ?? item.unitPrice ?? item.menuItem?.price ?? 0) *
                          item.quantity
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-black text-xl border-t border-border/50 pt-3">
              <span>{t("common.total")}</span>
              <span className="text-primary font-display tabular-nums">
                {formatIQD(selectedOrder.total ?? 0)}
              </span>
            </div>

            {!isOrderReceived(selectedOrder) ? (
              <Button
                className="w-full h-12 gap-2 font-extrabold"
                onClick={() => setPaymentDialog(selectedOrder)}
              >
                {cashierSendToKitchen ? (
                  <ChefHat className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                {primaryPayLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        isOpen={!!paymentDialog}
        onClose={() => setPaymentDialog(null)}
        title={t("pos.choosePayment")}
      >
        {paymentDialog ? (
          <div className="space-y-4">
            {(() => {
              const card = toCard(paymentDialog, t);
              const Icon = seatIcon(card.seatKind);
              return (
                <div className="bg-secondary/50 rounded-2xl p-4 text-center space-y-2">
                  <div
                    className={`mx-auto w-12 h-12 rounded-2xl border bg-gradient-to-br flex items-center justify-center ${seatTone(card.seatKind)}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-muted-foreground">
                    {card.seatLabel} · #{card.shortNo}
                  </p>
                  <p className="text-3xl font-black text-primary font-display tabular-nums">
                    {formatIQD(card.amount)}
                  </p>
                </div>
              );
            })()}

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  method: "cash" as const,
                  label: t("pos.cash"),
                  icon: Banknote,
                  color: "text-green-500",
                },
                {
                  method: "card" as const,
                  label: t("common.card"),
                  icon: CreditCard,
                  color: "text-blue-500",
                },
                {
                  method: "transfer" as const,
                  label: t("common.transfer"),
                  icon: Phone,
                  color: "text-purple-500",
                },
              ].map(({ method, label, icon: PayIcon, color }) => (
                <Button
                  key={method}
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  isLoading={isUpdating}
                  onClick={() => confirmCashierSave(paymentDialog, method)}
                >
                  <PayIcon className={`w-8 h-8 ${color}`} />
                  <span className="font-bold">{label}</span>
                </Button>
              ))}
            </div>

            <p className="text-xs text-center text-muted-foreground font-semibold">
              {cashierSendToKitchen
                ? t("cashier.payWillKitchen")
                : t("cashier.payWillSave")}
            </p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
