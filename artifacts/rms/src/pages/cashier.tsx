import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetOrders,
  useUpdateOrderStatus,
  useGetSettings,
} from "@workspace/api-client-react";
import { Button, Badge, Dialog } from "@/components/ui-elements";
import {
  Clock, CheckCircle2, CreditCard, Banknote,
  Phone, ChefHat, RefreshCw, ShoppingBag, Table2, LogOut, Bell, X,
} from "lucide-react";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";

const formatIQD = (v: number | string) =>
  new Intl.NumberFormat("en-IQ").format(Math.round(Number(v)));

const elapsed = (
  dateStr: string,
  t: (key: string, params?: Record<string, string | number>) => string
) => {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return t("cashier.minutes", { n: mins });
  return t("cashier.hours", { h: Math.floor(mins / 60), m: mins % 60 });
};

export default function Cashier() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  const { data: pendingOrders, refetch: refetchPending } = useGetOrders({ status: "pending" } as any);
  const { data: todayPaidOrders, refetch: refetchPaid } = useGetOrders({
    status: "paid",
    date: new Date().toISOString().slice(0, 10),
  } as any);

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateOrderStatus();
  const { data: appSettings } = useGetSettings();
  const cashierSendToKitchen = appSettings?.cashierSendToKitchen !== false;

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<any | null>(null);
  const [dismissedTableNotifs, setDismissedTableNotifs] = useState<Set<number>>(new Set());
  const prevTableOrderCount = useRef(0);

  useEffect(() => {
    const t = setInterval(() => { refetchPending(); refetchPaid(); }, 15000);
    return () => clearInterval(t);
  }, []);

  const confirmCashierSave = (order: any, paymentMethod: "cash" | "card" | "transfer") => {
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
          refetchPending();
          refetchPaid();
        },
      }
    );
  };

  const orderTypeLabel = (type: string, tableId?: number | null) => {
    if (type === "dine_in") return tableId ? t("tables.tableN", { n: tableId }) : t("order.inside");
    if (type === "takeaway") return t("order.takeaway");
    return t("order.delivery");
  };

  const urgencyColor = (createdAt: string) => {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (mins > 15) return "border-red-500/60 bg-red-500/5";
    if (mins > 8) return "border-amber-500/60 bg-amber-500/5";
    return "border-border/50 bg-card/50";
  };

  return (
    <div className="h-app min-h-app bg-background text-foreground flex flex-col overflow-hidden page-shell">
      {/* Header */}
      <header className="p-3 sm:p-4 bg-card/80 backdrop-blur-md border-b border-border/50 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">{t("cashier.title")}</h1>
            <p className="text-[10px] sm:text-xs text-primary font-display uppercase tracking-widest truncate">
              {user?.name} — Cashier
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { refetchPending(); refetchPaid(); }}
            className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
            title={t("common.update")}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive px-3 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t("common.exit")}
          </button>
        </div>
      </header>

      {/* ── Table Order Notifications ── */}
      {(() => {
        const tableOrders = (pendingOrders ?? []).filter(
          (o: any) => o.type === "dine_in" && !dismissedTableNotifs.has(o.id)
        );
        if (tableOrders.length === 0) return null;
        return (
          <div className="flex-shrink-0 border-b border-amber-500/40 bg-amber-500/10">
            <div className="px-4 py-2 flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                className="w-7 h-7 bg-amber-500/30 rounded-full flex items-center justify-center flex-shrink-0"
              >
                <Bell className="w-4 h-4 text-amber-400" />
              </motion.div>
              <span className="text-amber-300 text-sm font-bold flex-shrink-0">
                {tableOrders.length > 1 ? t("cashier.newTableOrders", { n: tableOrders.length }) : t("cashier.newTableOrder")}
              </span>
              <div className="flex-1 flex gap-2 overflow-x-auto pb-0.5 pt-1">
                <AnimatePresence>
                  {tableOrders.map((order: any) => (
                    <motion.button
                      key={order.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={() => setPaymentDialog(order)}
                      className="flex-shrink-0 flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 hover:border-amber-400 rounded-xl px-3 py-1.5 transition-all group"
                    >
                      <Table2 className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-sm font-bold text-amber-200">
                        {t("tables.tableN", { n: (order as any).table?.number ?? order.tableId })}
                      </span>
                      <span className="text-xs text-amber-400 font-display">
                        {formatIQD(order.total ?? 0)} {t("common.iqd")}
                      </span>
                      <ChefHat className="w-3.5 h-3.5 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDismissedTableNotifs(prev => new Set([...prev, order.id]));
                        }}
                        className="w-4 h-4 flex items-center justify-center hover:bg-amber-500/30 rounded transition-colors"
                      >
                        <X className="w-3 h-3 text-amber-500" />
                      </button>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex-1 flex overflow-hidden min-h-0 rms-stack-portrait">
        {/* ── Pending Orders (main) ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
          <div className="p-3 sm:p-4 border-b border-border/50 flex items-center justify-between">
            <h2 className="font-bold text-base sm:text-lg flex items-center gap-2 flex-wrap">
              <Clock className="w-5 h-5 text-amber-400" />
              {t("cashier.awaiting")}
              {pendingOrders && pendingOrders.length > 0 && (
                <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingOrders.length}
                </span>
              )}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 safe-pb">
            {!pendingOrders || pendingOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 py-16">
                <CheckCircle2 className="w-16 h-16 mb-4 text-green-500/50" />
                <p className="text-lg font-semibold">{t("cashier.noNew")}</p>
                <p className="text-sm">{t("cashier.allProcessed")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                <AnimatePresence>
                  {pendingOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`rounded-2xl border-2 overflow-hidden transition-all cursor-pointer hover:shadow-xl hover:shadow-primary/10 ${urgencyColor(order.createdAt)}`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      {/* Card Header */}
                      <div className="p-4 bg-black/20 flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-xl font-display">#{order.orderNumber?.slice(-4)}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            {order.type === "dine_in" ? (
                              <Table2 className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                            )}
                            <span className="text-sm text-primary font-semibold">
                              {orderTypeLabel(order.type, order.tableId)}
                            </span>
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-1 text-sm font-display text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            {elapsed(order.createdAt, t)}
                          </div>
                          <div className="text-lg font-bold text-primary font-display mt-1">
                            {formatIQD(order.total ?? 0)} {t("common.iqd")}
                          </div>
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="p-4 space-y-1.5">
                        {(order.items ?? []).slice(0, 3).map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.menuItem?.nameAr || t("common.item")}</span>
                            <span className="font-bold">×{item.quantity}</span>
                          </div>
                        ))}
                        {(order.items ?? []).length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            {t("cashier.moreItems", { n: (order.items ?? []).length - 3 })}
                          </p>
                        )}
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setPaymentDialog(order); }}
                        className="w-full p-3 bg-primary/90 hover:bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <ChefHat className="w-4 h-4" />
                        {t("cashier.sendKitchen")}
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* ── Today's Paid Orders (sidebar) ── */}
        <div className="w-full lg:w-72 xl:w-80 border-t lg:border-t-0 border-r border-border/50 flex flex-col bg-card/20 rms-hide-on-compact max-h-48 lg:max-h-none">
          <div className="p-3 sm:p-4 border-b border-border/50">
            <h3 className="font-bold flex items-center gap-2 text-sm sm:text-base">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              {t("cashier.paidToday")}
              {todayPaidOrders && (
                <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">
                  {todayPaidOrders.length}
                </span>
              )}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {todayPaidOrders?.map((order) => (
              <div key={order.id} className="bg-card/50 rounded-xl p-3 border border-border/30">
                <div className="flex justify-between items-center">
                  <span className="font-display font-bold text-sm">#{order.orderNumber?.slice(-4)}</span>
                  <span className="text-xs text-green-400 font-semibold">{t("cashier.paid")}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-muted-foreground">{orderTypeLabel(order.type, order.tableId)}</span>
                  <span className="text-primary font-display text-sm font-bold">
                    {formatIQD(order.total ?? 0)}
                  </span>
                </div>
              </div>
            ))}
            {(!todayPaidOrders || todayPaidOrders.length === 0) && (
              <p className="text-center text-xs text-muted-foreground py-8 opacity-50">{t("cashier.noPayments")}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Order Detail Dialog ── */}
      <Dialog
        isOpen={!!selectedOrder && !paymentDialog}
        onClose={() => setSelectedOrder(null)}
        title={t("cashier.orderN", { n: selectedOrder?.orderNumber?.slice(-4) ?? "" })}
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Badge variant="outline">
                {orderTypeLabel(selectedOrder.type, selectedOrder.tableId)}
              </Badge>
              <Badge variant="warning">
                <Clock className="w-3 h-3 me-1" />
                {elapsed(selectedOrder.createdAt, t)}
              </Badge>
            </div>

            <div className="space-y-2 bg-secondary/30 rounded-xl p-4">
              {(selectedOrder.items ?? []).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm border-b border-border/30 pb-2 last:border-0 last:pb-0">
                  <span>{item.menuItem?.nameAr}</span>
                  <div className="flex gap-4">
                    <span className="text-muted-foreground">×{item.quantity}</span>
                    <span className="font-display font-bold text-primary">
                      {formatIQD((item.price ?? item.menuItem?.price ?? 0) * item.quantity)} {t("common.iqd")}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-bold text-xl border-t border-border/50 pt-3">
              <span>{t("common.total")}</span>
              <span className="text-primary font-display">{formatIQD(selectedOrder.total ?? 0)} {t("common.iqd")}</span>
            </div>

            <Button className="w-full h-12 gap-2" onClick={() => setPaymentDialog(selectedOrder)}>
              {cashierSendToKitchen ? (
                <ChefHat className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {cashierSendToKitchen ? t("pos.confirmPayKitchen") : t("pos.confirmPaySave")}
            </Button>
          </div>
        )}
      </Dialog>

      {/* ── Payment Method Dialog ── */}
      <Dialog
        isOpen={!!paymentDialog}
        onClose={() => setPaymentDialog(null)}
        title={t("pos.choosePayment")}
      >
        {paymentDialog && (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                {t("cashier.orderN", { n: paymentDialog.orderNumber?.slice(-4) ?? "" })} — {orderTypeLabel(paymentDialog.type, paymentDialog.tableId)}
              </p>
              <p className="text-3xl font-bold text-primary font-display">
                {formatIQD(paymentDialog.total ?? 0)} {t("common.iqd")}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { method: "cash" as const, label: t("pos.cash"), icon: Banknote, color: "text-green-500" },
                { method: "card" as const, label: t("common.card"), icon: CreditCard, color: "text-blue-500" },
                { method: "transfer" as const, label: t("common.transfer"), icon: Phone, color: "text-purple-500" },
              ].map(({ method, label, icon: Icon, color }) => (
                <Button
                  key={method}
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  isLoading={isUpdating}
                  onClick={() => confirmCashierSave(paymentDialog, method)}
                >
                  <Icon className={`w-8 h-8 ${color}`} />
                  <span>{label}</span>
                </Button>
              ))}
            </div>

            <p className="text-xs text-center text-muted-foreground">
              {cashierSendToKitchen
                ? t("cashier.payWillKitchen")
                : t("cashier.payWillSave")}
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
