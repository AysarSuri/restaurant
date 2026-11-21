import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  LogOut,
  Bell,
  X,
  DoorOpen,
  User,
  Bike,
  Wallet,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";

type SeatKind = "table" | "room" | "person" | "takeaway" | "delivery";

type OrderCardModel = {
  order: Order;
  seatKind: SeatKind;
  seatLabel: string;
  amount: number;
  shortNo: string;
};

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

function urgencyRing(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins > 15) return "ring-2 ring-rose-500/50";
  if (mins > 8) return "ring-2 ring-amber-500/40";
  return "";
}

function BoardColumn({
  title,
  count,
  icon: Icon,
  tone,
  emptyTitle,
  emptyHint,
  countLabel,
  children,
}: {
  title: string;
  count: number;
  icon: LucideIcon;
  tone: "amber" | "orange" | "emerald";
  emptyTitle: string;
  emptyHint: string;
  countLabel: string;
  children: React.ReactNode;
}) {
  const toneMap = {
    amber: {
      head: "from-amber-500/15 via-card to-card border-amber-500/25",
      icon: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
      badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    },
    orange: {
      head: "from-orange-500/15 via-card to-card border-orange-500/25",
      icon: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
      badge: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
    },
    emerald: {
      head: "from-emerald-500/15 via-card to-card border-emerald-500/25",
      icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
      badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    },
  }[tone];

  return (
    <section className="min-w-0 min-h-0 flex flex-col rounded-[1.5rem] border border-border/50 bg-card/40 overflow-hidden shadow-sm">
      <div
        className={`px-3.5 py-3 border-b bg-gradient-to-l ${toneMap.head} flex items-center justify-between gap-2`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneMap.icon}`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] sm:text-base font-black truncate">{title}</h2>
            <p className="text-[11px] font-semibold text-muted-foreground">
              {countLabel}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-extrabold tabular-nums ${toneMap.badge}`}
        >
          {count}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5 safe-pb">
        {count === 0 ? (
          <div className="h-full min-h-[10rem] flex flex-col items-center justify-center text-center px-4 opacity-60">
            <Icon className="w-10 h-10 mb-2 text-muted-foreground" />
            <p className="text-sm font-bold">{emptyTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">{emptyHint}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function OrderTicket({
  card,
  column,
  onOpen,
  onPrimary,
  primaryLabel,
  t,
}: {
  card: OrderCardModel;
  column: "unpaid" | "kitchen" | "paid";
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`rounded-2xl border border-border/60 bg-gradient-to-b from-card to-secondary/20 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer ${urgencyRing(createdAt)}`}
      onClick={onOpen}
    >
      <div className="p-3 flex items-start gap-3">
        <div
          className={`w-12 h-12 rounded-2xl border bg-gradient-to-br flex items-center justify-center shrink-0 ${tone}`}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[15px] font-black truncate leading-tight">{card.seatLabel}</p>
              <p className="text-[11px] font-bold text-muted-foreground mt-0.5 tabular-nums">
                #{card.shortNo}
              </p>
            </div>
            <div className="text-end shrink-0">
              <p className="text-[15px] font-black text-primary tabular-nums leading-tight">
                {formatIQD(card.amount)}
              </p>
              <p className="text-[10px] font-bold text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {elapsed(createdAt, t)}
              </p>
            </div>
          </div>
          {(card.order.items?.length ?? 0) > 0 ? (
            <p className="text-[11px] text-muted-foreground font-semibold mt-1.5 truncate">
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

      {column === "unpaid" && onPrimary ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrimary();
          }}
          className="w-full h-11 bg-gradient-to-l from-amber-500 to-orange-500 text-white font-extrabold text-[13px] flex items-center justify-center gap-2 hover:brightness-105 transition-all"
        >
          <Wallet className="w-4 h-4" />
          {primaryLabel}
        </button>
      ) : null}

      {column === "kitchen" ? (
        <div className="px-3 pb-3 space-y-1.5">
          <div className="h-9 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300 text-[12px] font-extrabold flex items-center justify-center gap-1.5">
            <Flame className="w-3.5 h-3.5" />
            {card.order.status === "ready"
              ? t("cashier.statusReady")
              : card.order.status === "served"
                ? t("cashier.statusServed")
                : t("cashier.statusKitchen")}
          </div>
          {card.order.paymentMethod ? (
            <div className="h-8 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t("cashier.received")}
            </div>
          ) : null}
        </div>
      ) : null}

      {column === "paid" ? (
        <div className="px-3 pb-3">
          <div className="h-9 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[12px] font-extrabold flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t("cashier.received")}
          </div>
        </div>
      ) : null}
    </motion.article>
  );
}

export default function Cashier() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const {
    data: openOrders,
    refetch: refetchOpen,
    isFetching: fetchingOpen,
  } = useGetOrders({
    status: "pending,confirmed,preparing,ready",
    limit: 120,
  });
  const {
    data: paidOrders,
    refetch: refetchPaid,
    isFetching: fetchingPaid,
  } = useGetOrders({
    status: "paid,served",
    date: today,
    limit: 120,
  });

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateOrderStatus();
  const { data: appSettings } = useGetSettings();
  const cashierSendToKitchen = appSettings?.cashierSendToKitchen !== false;

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<Order | null>(null);
  const [dismissedTableNotifs, setDismissedTableNotifs] = useState<Set<number>>(
    () => new Set()
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      void refetchOpen();
      void refetchPaid();
    }, 12000);
    return () => window.clearInterval(id);
  }, [refetchOpen, refetchPaid]);

  const unpaid = useMemo(
    () =>
      (openOrders ?? [])
        .filter(
          (o) =>
            (o.status === "pending" || o.status === "confirmed") &&
            !o.paymentMethod
        )
        .map((o) => toCard(o, t)),
    [openOrders, t]
  );

  const kitchen = useMemo(
    () =>
      (openOrders ?? [])
        .filter(
          (o) =>
            o.status === "preparing" ||
            o.status === "ready" ||
            o.status === "served"
        )
        .map((o) => toCard(o, t)),
    [openOrders, t]
  );

  const paid = useMemo(
    () => (paidOrders ?? []).map((o) => toCard(o, t)),
    [paidOrders, t]
  );

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

  const refreshAll = () => {
    void refetchOpen();
    void refetchPaid();
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
          refreshAll();
        },
      }
    );
  };

  const primaryPayLabel = cashierSendToKitchen
    ? t("cashier.collectSendKitchen")
    : t("cashier.collectPaid");

  return (
    <div className="h-app min-h-app bg-background text-foreground flex flex-col overflow-hidden page-shell">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-24 -start-10 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute top-40 -end-16 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <header className="p-3 sm:p-4 bg-card/80 backdrop-blur-md border-b border-border/50 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-11 h-11 bg-gradient-to-br from-amber-500/25 to-orange-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black truncate">{t("cashier.title")}</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-bold truncate">
              {user?.name} · {t("cashier.boardHint")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={refreshAll}
            className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors touch-manipulation"
            title={t("common.update")}
          >
            <RefreshCw
              className={`w-4 h-4 ${fetchingOpen || fetchingPaid ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive px-3 py-2 rounded-xl hover:bg-destructive/10 transition-colors touch-manipulation"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{t("common.exit")}</span>
          </button>
        </div>
      </header>

      {tableAlerts.length > 0 ? (
        <div className="flex-shrink-0 border-b border-amber-500/35 bg-amber-500/10">
          <div className="px-3 sm:px-4 py-2 flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
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
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
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

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 p-3 sm:p-4 overflow-y-auto lg:overflow-hidden">
        <BoardColumn
          title={t("cashier.colUnpaid")}
          count={unpaid.length}
          countLabel={t("cashier.ordersCount", { n: unpaid.length })}
          icon={Wallet}
          tone="amber"
          emptyTitle={t("cashier.emptyUnpaid")}
          emptyHint={t("cashier.emptyUnpaidHint")}
        >
          <AnimatePresence initial={false}>
            {unpaid.map((card) => (
              <OrderTicket
                key={card.order.id}
                card={card}
                column="unpaid"
                t={t}
                onOpen={() => setSelectedOrder(card.order)}
                onPrimary={() => setPaymentDialog(card.order)}
                primaryLabel={primaryPayLabel}
              />
            ))}
          </AnimatePresence>
        </BoardColumn>

        <BoardColumn
          title={t("cashier.colKitchen")}
          count={kitchen.length}
          countLabel={t("cashier.ordersCount", { n: kitchen.length })}
          icon={ChefHat}
          tone="orange"
          emptyTitle={t("cashier.emptyKitchen")}
          emptyHint={t("cashier.emptyKitchenHint")}
        >
          <AnimatePresence initial={false}>
            {kitchen.map((card) => (
              <OrderTicket
                key={card.order.id}
                card={card}
                column="kitchen"
                t={t}
                onOpen={() => setSelectedOrder(card.order)}
              />
            ))}
          </AnimatePresence>
        </BoardColumn>

        <BoardColumn
          title={t("cashier.colPaid")}
          count={paid.length}
          countLabel={t("cashier.ordersCount", { n: paid.length })}
          icon={CheckCircle2}
          tone="emerald"
          emptyTitle={t("cashier.emptyPaid")}
          emptyHint={t("cashier.emptyPaidHint")}
        >
          <AnimatePresence initial={false}>
            {paid.map((card) => (
              <OrderTicket
                key={card.order.id}
                card={card}
                column="paid"
                t={t}
                onOpen={() => setSelectedOrder(card.order)}
              />
            ))}
          </AnimatePresence>
        </BoardColumn>
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

            {(selectedOrder.status === "pending" ||
              selectedOrder.status === "confirmed") && (
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
            )}
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
