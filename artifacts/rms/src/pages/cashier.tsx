import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  useGetOrders,
  useUpdateOrderStatus,
  useGetSettings,
  useGetBranches,
  useGetDevicePrinters,
  useGetCards,
  type Order,
} from "@workspace/api-client-react";
import { Button, Badge, Dialog } from "@/components/ui-elements";
import {
  Clock,
  CheckCircle2,
  CreditCard,
  Banknote,
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
  Pencil,
  Printer,
  FileText,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { useBranch } from "@/lib/branch-context";
import { BranchSwitcher } from "@/components/branch-switcher";
import { useCurrency } from "@/hooks/use-currency";
import { getOrCreateDeviceKey } from "@/lib/device-id";
import { printKitchenTicketThermal } from "@/lib/print-receipt";
import { NumericKeypad } from "@/components/numeric-keypad";
import { toast } from "@/hooks/use-toast";

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
  // Payment / واصل only — kitchen "served" must NOT mark as received
  if (order.paymentMethod) return true;
  return order.status === "paid";
}

function isPosEdited(order: Order) {
  return Boolean((order as Order & { posEditedAt?: string | null }).posEditedAt);
}

function isRecentlyPosEdited(order: Order) {
  const at = (order as Order & { posEditedAt?: string | null }).posEditedAt;
  if (!at) return false;
  const mins = Math.floor((Date.now() - new Date(at).getTime()) / 60000);
  return mins >= 0 && mins < 20;
}

function PosEditedBanner({
  order,
  t,
  compact = false,
}: {
  order: Order;
  t: (key: string, params?: Record<string, string | number>) => string;
  compact?: boolean;
}) {
  if (!isPosEdited(order)) return null;
  const recent = isRecentlyPosEdited(order);
  return (
    <div
      className={`flex items-center gap-1.5 font-extrabold text-indigo-800 dark:text-indigo-200 border border-indigo-500/40 bg-gradient-to-l from-indigo-500/20 via-violet-500/15 to-fuchsia-500/10 ${
        compact
          ? "rounded-lg px-2 py-1 text-[10px]"
          : "rounded-xl px-3 py-2 text-[11px] sm:text-xs"
      } ${recent ? "animate-pulse shadow-[0_0_0_1px_rgba(99,102,241,0.35)]" : ""}`}
    >
      <Pencil className={compact ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"} />
      <span className="leading-tight">{t("cashier.editedFromPos")}</span>
    </div>
  );
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
  onPrint,
  primaryLabel,
  t,
}: {
  card: OrderCardModel;
  page: CashierPage;
  onOpen: () => void;
  onPrimary?: () => void;
  onPrint?: () => void;
  primaryLabel?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const Icon = seatIcon(card.seatKind);
  const tone = seatTone(card.seatKind);
  const createdAt = String(card.order.createdAt || "");
  const edited = isPosEdited(card.order);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className={`group rounded-[1.35rem] overflow-hidden shadow-[0_8px_24px_-18px_rgba(0,0,0,0.45)] hover:shadow-[0_14px_28px_-16px_rgba(0,0,0,0.4)] transition-shadow ${urgencyRing(createdAt)} ${
        page === "unpaid"
          ? "border-2 border-amber-500/60 bg-gradient-to-b from-amber-500/18 via-card to-orange-500/8 hover:border-amber-500/80"
          : "border-2 border-emerald-500/55 bg-gradient-to-b from-emerald-500/15 via-card to-teal-500/8 hover:border-emerald-500/75"
      } ${edited ? "ring-2 ring-indigo-500/35" : ""}`}
    >
      {edited ? (
        <div className="px-3 pt-3">
          <PosEditedBanner order={card.order} t={t} />
        </div>
      ) : null}

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
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${
                page === "unpaid"
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200"
                  : "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
              }`}
            >
              {page === "unpaid" ? (
                <>
                  <Wallet className="w-3 h-3" />
                  {t("cashier.colUnpaid")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  {t("cashier.colPaid")}
                </>
              )}
            </span>
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

      <div className="px-3.5 pb-3.5">
        {page === "unpaid" ? (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrint?.();
              }}
              disabled={!onPrint}
              className="h-12 min-h-12 rounded-xl border-2 border-border/70 bg-background/80 hover:bg-background font-extrabold text-[11px] sm:text-xs flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 touch-manipulation active:scale-[0.98] transition-all px-1.5 disabled:opacity-50"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span className="truncate leading-tight">{t("common.print")}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="h-12 min-h-12 rounded-xl border-2 border-sky-500/45 bg-sky-500/10 hover:bg-sky-500/15 text-sky-800 dark:text-sky-200 font-extrabold text-[11px] sm:text-xs flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 touch-manipulation active:scale-[0.98] transition-all px-1.5"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate leading-tight">{t("cashier.details")}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrimary?.();
              }}
              disabled={!onPrimary}
              className="h-12 min-h-12 rounded-xl text-white font-extrabold text-[11px] sm:text-xs flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 hover:brightness-105 active:scale-[0.98] transition-all touch-manipulation bg-gradient-to-l from-amber-500 to-orange-500 px-1.5 disabled:opacity-50"
            >
              <Wallet className="w-4 h-4 shrink-0" />
              <span className="truncate leading-tight">{t("cashier.collectShort")}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrint?.();
              }}
              disabled={!onPrint}
              className="h-12 min-h-12 rounded-xl border-2 border-border/70 bg-background/80 hover:bg-background font-extrabold text-[11px] sm:text-xs flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 touch-manipulation active:scale-[0.98] transition-all px-1.5 disabled:opacity-50"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span className="truncate leading-tight">{t("common.print")}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="h-12 min-h-12 rounded-xl border-2 border-sky-500/45 bg-sky-500/10 hover:bg-sky-500/15 text-sky-800 dark:text-sky-200 font-extrabold text-[11px] sm:text-xs flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 touch-manipulation active:scale-[0.98] transition-all px-1.5"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate leading-tight">{t("cashier.details")}</span>
            </button>
            <div className="h-12 min-h-12 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] sm:text-xs font-extrabold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="truncate leading-tight">{t("cashier.colPaid")}</span>
            </div>
          </div>
        )}
      </div>
    </motion.article>
  );
}

function PaidListRow({
  card,
  onOpen,
  onPrint,
  t,
}: {
  card: OrderCardModel;
  onOpen: () => void;
  onPrint?: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const Icon = seatIcon(card.seatKind);
  const tone = seatTone(card.seatKind);
  const createdAt = String(card.order.createdAt || "");
  const edited = isPosEdited(card.order);
  const pay =
    card.order.paymentMethod === "cash"
      ? t("pos.cash")
      : card.order.paymentMethod === "card"
        ? t("common.card")
        : card.order.paymentMethod === "transfer"
          ? t("common.transfer")
          : t("cashier.received");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={`w-full border-b border-border/40 last:border-b-0 ${
        edited ? "bg-indigo-500/[0.06]" : "bg-transparent hover:bg-emerald-500/[0.04]"
      }`}
    >
      {edited ? (
        <div className="px-3 sm:px-4 pt-2.5">
          <PosEditedBanner order={card.order} t={t} compact />
        </div>
      ) : null}
      <div className="px-3 sm:px-4 py-3 flex items-center gap-2.5 sm:gap-3 w-full min-h-[4.25rem]">
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border bg-gradient-to-br flex items-center justify-center shrink-0 ${tone}`}
        >
          <Icon className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <p className="text-[14px] sm:text-[15px] font-black truncate leading-tight">
              {card.seatLabel}
            </p>
            <span className="text-[11px] font-bold text-muted-foreground tabular-nums shrink-0">
              #{card.shortNo}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 shrink-0">
              <CheckCircle2 className="w-3 h-3" />
              {t("cashier.colPaid")}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] font-semibold text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {elapsed(createdAt, t)}
            </span>
            <span className="text-border">·</span>
            <span>{pay}</span>
            <span className="text-border">·</span>
            <span className="font-display font-black text-primary tabular-nums text-[13px]">
              {formatIQD(card.amount)}
            </span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={onPrint}
            disabled={!onPrint}
            className="h-11 min-h-11 min-w-[4.75rem] sm:min-w-[5.5rem] px-2.5 sm:px-3 rounded-xl border-2 border-border/70 bg-background/90 hover:bg-background font-extrabold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span className="truncate">{t("common.print")}</span>
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="h-11 min-h-11 min-w-[4.75rem] sm:min-w-[5.5rem] px-2.5 sm:px-3 rounded-xl border-2 border-sky-500/45 bg-sky-500/10 hover:bg-sky-500/15 text-sky-800 dark:text-sky-200 font-extrabold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98] transition-all"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">{t("cashier.details")}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Cashier() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { selectedBranchId, branchLabel } = useBranch();
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
      queryKey: ["/api/orders", todayParams, selectedBranchId],
      ...silentQueryOpts,
    },
  });

  const {
    data: openOrders,
    refetch: refetchOpen,
    isFetching: fetchingOpen,
  } = useGetOrders(openParams, {
    query: {
      queryKey: ["/api/orders", openParams, selectedBranchId],
      ...silentQueryOpts,
    },
  });

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateOrderStatus();
  const { data: appSettings } = useGetSettings();
  const { data: branches } = useGetBranches();
  const { data: paymentCards } = useGetCards();
  const {
    format: formatMoneyAmount,
    symbol: currencySymbol,
    decimalPlaces,
  } = useCurrency();
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

  const branchPaymentCards = useMemo(() => {
    const list = (paymentCards ?? []).filter((c) => c.isActive !== false);
    if (selectedBranchId === "all") return list;
    return list.filter((c) => (c.branchIds ?? []).includes(selectedBranchId));
  }, [paymentCards, selectedBranchId]);

  const [page, setPage] = useState<CashierPage>("unpaid");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<Order | null>(null);
  const [checkoutPayMethod, setCheckoutPayMethod] = useState<"cash" | "card">("cash");
  const [checkoutReceived, setCheckoutReceived] = useState(0);
  const [checkoutCardId, setCheckoutCardId] = useState<number | null>(null);
  const [isReceivedPadOpen, setIsReceivedPadOpen] = useState(false);
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
    setSelectedOrder(null);
    setPaymentDialog(null);
    setIsReceivedPadOpen(false);
    setDismissedTableNotifs(new Set());
  }, [selectedBranchId]);

  const openPaymentDialog = (order: Order) => {
    const total = Number(order.total) || 0;
    setCheckoutPayMethod("cash");
    setCheckoutReceived(total);
    setCheckoutCardId(null);
    setIsReceivedPadOpen(false);
    setPaymentDialog(order);
  };

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
    const merged = [...map.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (selectedBranchId === "all") return merged;
    return merged.filter(
      (o) => o.branchId == null || o.branchId === selectedBranchId
    );
  }, [todayOrders, openOrders, selectedBranchId]);

  const sortCashierCards = (cards: OrderCardModel[]) =>
    [...cards].sort((a, b) => {
      const aEdit = (a.order as Order & { posEditedAt?: string | null }).posEditedAt;
      const bEdit = (b.order as Order & { posEditedAt?: string | null }).posEditedAt;
      const aEditMs = aEdit ? new Date(aEdit).getTime() : 0;
      const bEditMs = bEdit ? new Date(bEdit).getTime() : 0;
      if (aEditMs !== bEditMs) return bEditMs - aEditMs;
      return (
        new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime()
      );
    });

  // Show all POS order invoices on cashier — including kitchen-bound (preparing/ready)
  // when «إلى شاشة المطبخ» is enabled in sales settings.
  const unpaid = useMemo(
    () =>
      sortCashierCards(
        allOrders
          .filter(
            (o) =>
              !isOrderReceived(o) &&
              o.status !== "cancelled" &&
              (o.status === "pending" ||
                o.status === "confirmed" ||
                o.status === "preparing" ||
                o.status === "ready" ||
                o.status === "served")
          )
          .map((o) => toCard(o, t))
      ),
    [allOrders, t]
  );

  const paid = useMemo(
    () =>
      sortCashierCards(
        allOrders
          .filter((o) => {
            if (!isOrderReceived(o) || o.status === "cancelled") return false;
            const day = String(o.createdAt || "").slice(0, 10);
            return (
              day === today ||
              o.status === "preparing" ||
              o.status === "ready" ||
              o.status === "served"
            );
          })
          .map((o) => toCard(o, t))
      ),
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

  const confirmCashierCollect = () => {
    if (!paymentDialog) return;
    const total = Number(paymentDialog.total) || 0;
    if (checkoutPayMethod === "cash" && checkoutReceived < total) return;
    if (checkoutPayMethod === "card" && !checkoutCardId) return;

    const paymentMethod = checkoutPayMethod === "card" ? "card" : "cash";
    // Cashier collect = واصل only — never send to kitchen from this screen
    const keepKitchen =
      paymentDialog.status === "preparing" || paymentDialog.status === "ready"
        ? paymentDialog.status
        : "paid";

    updateStatus(
      {
        id: paymentDialog.id,
        data: {
          status: keepKitchen,
          paymentMethod,
        } as any,
      },
      {
        onSuccess: () => {
          setPaymentDialog(null);
          setSelectedOrder(null);
          setIsReceivedPadOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          try {
            localStorage.setItem("rms-orders-bump", String(Date.now()));
          } catch {
            /* ignore */
          }
          void refreshAll(false);
          setPage("paid");
        },
      }
    );
  };

  const primaryPayLabel = t("cashier.collectPaid");

  const printCashierReceipt = (order: Order) => {
    const card = toCard(order, t);
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
          : order.status === "preparing"
            ? t("kds.colPreparing")
            : t("cashier.colUnpaid");
    const typeLabel =
      order.type === "delivery"
        ? t("order.delivery")
        : order.type === "takeaway"
          ? t("order.takeaway")
          : t("order.dineIn");

    try {
      // Same kitchen thermal ticket as KDS (no prices)
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
        seatLabel: card.seatLabel,
        kitchenStatusLabel: statusLabel,
        items: (order.items ?? []).map((item: any) => ({
          name: item.menuItem?.nameAr || t("common.item"),
          quantity: item.quantity,
          notes: item.notes,
        })),
        orderNotes: order.notes,
        printerName: devicePrinter?.printerName?.trim() || null,
      });
      toast({
        title: t("cashier.printOk"),
        description: devicePrinter?.printerName?.trim()
          ? t("pos.printNamed", { name: devicePrinter.printerName.trim() })
          : t("kds.printTicketHint"),
      });
    } catch {
      toast({
        variant: "destructive",
        title: t("cashier.printFailed"),
        description: t("pos.printPopupBlocked"),
      });
    }
  };

  const paymentTotal = Number(paymentDialog?.total) || 0;
  const checkoutChange = Math.max(0, checkoutReceived - paymentTotal);
  const canConfirmCollect =
    Boolean(paymentDialog) &&
    !isUpdating &&
    ((checkoutPayMethod === "cash" && checkoutReceived >= paymentTotal) ||
      (checkoutPayMethod === "card" && checkoutCardId != null));

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
              {user?.name} · {branchLabel} · {t("cashier.boardHint")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <BranchSwitcher compact />
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
                      onClick={() => openPaymentDialog(card.order)}
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
              <div className="max-w-5xl mx-auto rounded-[1.5rem] border-2 border-emerald-500/30 bg-card/60 overflow-hidden shadow-sm">
                <div className="px-4 py-3.5 border-b border-emerald-500/20 bg-gradient-to-l from-emerald-500/12 via-emerald-500/6 to-transparent flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold truncate">{t("cashier.colPaid")}</p>
                      <p className="text-[10px] font-bold text-muted-foreground truncate">
                        {t("cashier.paidListHint")}
                      </p>
                    </div>
                  </div>
                  <span className="min-w-8 h-8 px-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[12px] font-black tabular-nums flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                    {paid.length}
                  </span>
                </div>
                <div className="divide-y divide-border/30">
                  <AnimatePresence initial={false}>
                    {visible.map((card) => (
                      <PaidListRow
                        key={card.order.id}
                        card={card}
                        t={t}
                        onOpen={() => setSelectedOrder(card.order)}
                        onPrint={() => printCashierReceipt(card.order)}
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
                      onPrimary={() => openPaymentDialog(card.order)}
                      onPrint={() => printCashierReceipt(card.order)}
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
            {isPosEdited(selectedOrder) ? (
              <PosEditedBanner order={selectedOrder} t={t} />
            ) : null}
            {(() => {
              const card = toCard(selectedOrder, t);
              const Icon = seatIcon(card.seatKind);
              const received = isOrderReceived(selectedOrder);
              const typeLabel =
                selectedOrder.type === "delivery"
                  ? t("order.delivery")
                  : selectedOrder.type === "takeaway"
                    ? t("order.takeaway")
                    : t("order.dineIn");
              return (
                <div className="rounded-2xl border border-border/50 bg-gradient-to-l from-secondary/40 via-card to-card p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl border bg-gradient-to-br flex items-center justify-center ${seatTone(card.seatKind)}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-[16px] truncate">{card.seatLabel}</p>
                      <p className="text-xs font-bold text-muted-foreground mt-0.5 tabular-nums">
                        #{selectedOrder.orderNumber} · {typeLabel}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge
                          variant="outline"
                          className={
                            received
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                          }
                        >
                          {received ? t("cashier.colPaid") : t("cashier.colUnpaid")}
                        </Badge>
                        <Badge variant="warning">
                          <Clock className="w-3 h-3 me-1" />
                          {elapsed(String(card.order.createdAt), t)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="rounded-2xl border border-border/50 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-border/40 bg-secondary/35 flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold tracking-wide uppercase text-muted-foreground">
                  {t("cashier.invoiceLines")}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground">
                  {t("cashier.linesCount", { n: selectedOrder.items?.length ?? 0 })}
                </p>
              </div>
              <div className="divide-y divide-border/40">
                {(selectedOrder.items ?? []).map((item: any, idx: number) => {
                  const unit =
                    Number(item.unitPrice ?? item.price ?? item.menuItem?.price ?? 0) || 0;
                  const qty = Number(item.quantity) || 0;
                  const line = Number(item.totalPrice) || unit * qty;
                  return (
                    <div key={item.id ?? idx} className="px-3.5 py-3 flex items-start gap-3">
                      <span className="min-w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black tabular-nums shrink-0">
                        {qty}×
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-sm leading-snug">
                          {item.menuItem?.nameAr || t("common.item")}
                        </p>
                        <p className="text-[11px] font-semibold text-muted-foreground mt-0.5 tabular-nums">
                          {t("cashier.unitPrice")}: {formatMoneyAmount(unit)}
                        </p>
                        {item.notes ? (
                          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-1">
                            {t("common.note", { text: item.notes })}
                          </p>
                        ) : null}
                      </div>
                      <p className="font-display font-black text-primary tabular-nums text-sm shrink-0">
                        {formatMoneyAmount(line)}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="px-3.5 py-3 bg-secondary/25 space-y-1.5 border-t border-border/40">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-muted-foreground">{t("cashier.subtotal")}</span>
                  <span className="tabular-nums font-display">
                    {formatMoneyAmount(Number(selectedOrder.subtotal) || 0)}
                  </span>
                </div>
                {Number(selectedOrder.discount) > 0 ? (
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-muted-foreground">{t("pos.discountShort")}</span>
                    <span className="tabular-nums font-display text-rose-600">
                      − {formatMoneyAmount(Number(selectedOrder.discount) || 0)}
                    </span>
                  </div>
                ) : null}
                {Number(selectedOrder.deliveryFee) > 0 ? (
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-muted-foreground">{t("pos.deliveryFee")}</span>
                    <span className="tabular-nums font-display">
                      {formatMoneyAmount(Number(selectedOrder.deliveryFee) || 0)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                  <span className="font-black text-base">{t("common.total")}</span>
                  <span className="text-primary font-display font-black text-xl tabular-nums">
                    {formatMoneyAmount(Number(selectedOrder.total) || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div
              className={`grid gap-2.5 ${
                !isOrderReceived(selectedOrder) ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              <Button
                variant="outline"
                className="h-14 min-h-14 gap-2 font-extrabold rounded-2xl text-sm touch-manipulation"
                onClick={() => printCashierReceipt(selectedOrder)}
              >
                <Printer className="w-5 h-5 shrink-0" />
                <span className="truncate">{t("cashier.printReceipt")}</span>
              </Button>
              {!isOrderReceived(selectedOrder) ? (
                <Button
                  className="h-14 min-h-14 gap-2 font-extrabold rounded-2xl text-sm touch-manipulation"
                  onClick={() => openPaymentDialog(selectedOrder)}
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="truncate">{primaryPayLabel}</span>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        isOpen={!!paymentDialog && !isReceivedPadOpen}
        onClose={() => {
          if (isUpdating) return;
          setPaymentDialog(null);
        }}
        title={t("pos.choosePayment")}
        maxWidth="max-w-lg"
      >
        {paymentDialog ? (
          <div className="space-y-4">
            {(() => {
              const card = toCard(paymentDialog, t);
              const Icon = seatIcon(card.seatKind);
              return (
                <div className="px-4 py-2.5 bg-primary/10 rounded-xl text-primary text-sm font-semibold flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {card.seatLabel} · #{card.shortNo}
                  </span>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-2.5 p-1.5 rounded-2xl border border-border/60 bg-secondary/40">
              <button
                type="button"
                onClick={() => {
                  setCheckoutPayMethod("cash");
                  setCheckoutReceived(paymentTotal);
                  setCheckoutCardId(null);
                }}
                className={`h-14 sm:h-16 rounded-xl flex items-center justify-center gap-2.5 font-extrabold text-sm sm:text-base transition-all touch-manipulation ${
                  checkoutPayMethod === "cash"
                    ? "bg-gradient-to-l from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                }`}
              >
                <Banknote className="w-5 h-5 sm:w-6 sm:h-6" />
                {t("pos.cash")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckoutPayMethod("card");
                  setCheckoutReceived(paymentTotal);
                }}
                className={`h-14 sm:h-16 rounded-xl flex items-center justify-center gap-2.5 font-extrabold text-sm sm:text-base transition-all touch-manipulation ${
                  checkoutPayMethod === "card"
                    ? "bg-gradient-to-l from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                }`}
              >
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
                {t("pos.cardShort")}
              </button>
            </div>

            <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card to-secondary/30 overflow-hidden shadow-sm">
              <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm font-bold">{t("pos.invoiceTotal")}</span>
                </div>
                <span
                  className="font-display text-xl sm:text-2xl font-extrabold text-primary tabular-nums"
                  dir="ltr"
                >
                  {formatMoneyAmount(paymentTotal)}
                </span>
              </div>

              <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-foreground">
                    {t("pos.receivedTotal")}
                  </span>
                </div>
                {checkoutPayMethod === "cash" ? (
                  <button
                    type="button"
                    onClick={() => setIsReceivedPadOpen(true)}
                    className="min-w-[7.5rem] rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-display text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums hover:border-emerald-500 transition-colors touch-manipulation"
                    dir="ltr"
                  >
                    {formatMoneyAmount(checkoutReceived)}
                  </button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/50 px-3 py-2 font-display text-lg sm:text-xl font-extrabold tabular-nums text-foreground"
                    dir="ltr"
                  >
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    {formatMoneyAmount(paymentTotal)}
                  </span>
                )}
              </div>

              {checkoutPayMethod === "cash" ? (
                <div className="px-4 py-3 flex items-center justify-between gap-3 bg-secondary/25">
                  <span className="text-sm font-bold text-muted-foreground">
                    {t("pos.change")}
                  </span>
                  <span
                    className={`font-display text-lg font-extrabold tabular-nums ${
                      checkoutReceived >= paymentTotal
                        ? "text-amber-500"
                        : "text-rose-500"
                    }`}
                    dir="ltr"
                  >
                    {checkoutReceived >= paymentTotal
                      ? formatMoneyAmount(checkoutChange)
                      : t("pos.shortage", {
                          amount: formatMoneyAmount(paymentTotal - checkoutReceived),
                        })}
                  </span>
                </div>
              ) : null}
            </div>

            {checkoutPayMethod === "card" ? (
              <div className="space-y-2.5">
                <p className="text-sm font-extrabold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-sky-500" />
                  {t("pos.chooseCard")}
                </p>
                {branchPaymentCards.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/30 py-8 text-center text-muted-foreground">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-45" />
                    <p className="text-sm font-bold">{t("pos.noActiveCards")}</p>
                    <p className="text-xs mt-1 opacity-80">{t("pos.addCardFirst")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[min(36vh,280px)] overflow-y-auto overscroll-contain pe-0.5">
                    {branchPaymentCards.map((card) => {
                      const active = checkoutCardId === card.id;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => setCheckoutCardId(card.id)}
                          className={`text-start rounded-2xl border-2 px-3.5 py-3 transition-all touch-manipulation ${
                            active
                              ? "border-sky-500 bg-sky-500/10 shadow-md shadow-sky-500/15"
                              : "border-border/60 bg-card/70 hover:border-sky-500/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                active
                                  ? "bg-sky-500 text-white"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              <CreditCard className="w-4 h-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-extrabold text-sm truncate">{card.name}</p>
                              <p
                                className="text-[10px] text-muted-foreground font-display tabular-nums mt-0.5"
                                dir="ltr"
                              >
                                {formatMoneyAmount(Number(card.balance ?? 0))}
                              </p>
                            </div>
                            {active ? (
                              <CheckCircle2 className="w-5 h-5 text-sky-500 flex-shrink-0" />
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <Button
              className="w-full h-14 text-sm sm:text-base touch-manipulation gap-2 font-extrabold rounded-2xl"
              isLoading={isUpdating}
              disabled={!canConfirmCollect}
              onClick={confirmCashierCollect}
            >
              <CheckCircle2 className="w-5 h-5" />
              {t("cashier.collectPaid")}
            </Button>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        isOpen={isReceivedPadOpen}
        onClose={() => setIsReceivedPadOpen(false)}
        title={t("pos.receivedTotal")}
        maxWidth="max-w-sm"
        layer="overlay"
      >
        <NumericKeypad
          value={checkoutReceived}
          suffix={currencySymbol}
          allowDecimal={decimalPlaces > 0}
          maxDecimalPlaces={decimalPlaces}
          label={t("pos.enterReceived")}
          onCancel={() => setIsReceivedPadOpen(false)}
          onConfirm={(v) => {
            setCheckoutReceived(Math.max(0, v));
            setIsReceivedPadOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}
