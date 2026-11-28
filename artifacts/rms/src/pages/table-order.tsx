import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMenuItems,
  useGetMenuCategories,
  useGetTables,
  useGetShifts,
  useCreateOrder,
  useUpdateOrder,
  useGetOrders,
  getGetOrdersQueryKey,
  getGetTablesQueryKey,
  getGetShiftsQueryKey,
  type Order,
  type MenuItem,
} from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Table2,
  ChefHat,
  X,
  DoorOpen,
  UserRound,
  Star,
  Send,
  PencilLine,
  Clock,
  Save,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { bumpOrdersLive } from "@/lib/orders-live";
import { bumpStockLive } from "@/lib/stock-live";
import { Dialog } from "@/components/ui-elements";

interface CartItem extends MenuItem {
  cartQuantity: number;
  price: number;
  isReturn?: boolean;
}

function cartLineKey(item: Pick<CartItem, "id" | "isReturn">) {
  return `${item.id}:${item.isReturn ? "return" : "sale"}`;
}

function cartLineSignedQty(item: Pick<CartItem, "cartQuantity" | "isReturn">) {
  return item.isReturn ? -Math.abs(item.cartQuantity) : item.cartQuantity;
}

function cartLineAmount(item: Pick<CartItem, "price" | "cartQuantity" | "isReturn">) {
  return item.price * cartLineSignedQty(item);
}

type SeatKind = "table" | "room" | "person";

const formatIQD = (v: number) => new Intl.NumberFormat("en-IQ").format(Math.round(v));

function isOrderUnpaid(order: Pick<Order, "paymentMethod" | "status">) {
  if (order.paymentMethod) return false;
  return order.status !== "paid" && order.status !== "cancelled";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatListDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function todayDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function TableOrder() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const loginBranchId =
    typeof user?.selectedBranchId === "number" ? user.selectedBranchId : null;

  const { data: categories } = useGetMenuCategories();
  const { data: items } = useGetMenuItems({ available: true });
  const { data: tables } = useGetTables({
    query: {
      queryKey: [...getGetTablesQueryKey(), loginBranchId ?? "table-order"],
      staleTime: 2_000,
    },
  });
  const { mutate: createOrder, isPending: isCreating } = useCreateOrder();
  const { mutate: updateOrder, isPending: isUpdating } = useUpdateOrder();
  const { data: shiftsData, isLoading: shiftsLoading } = useGetShifts({
    query: {
      queryKey: [...getGetShiftsQueryKey(), loginBranchId ?? "table-order"],
      staleTime: 5_000,
    },
  });

  const [step, setStep] = useState<"menu" | "success">("menu");
  const [activeCategory, setActiveCategory] = useState<number | "favorites" | null>("favorites");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNum, setOrderNum] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [editPickerOpen, setEditPickerOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editingOrderNumber, setEditingOrderNumber] = useState<string | null>(null);

  const tableId = user?.tableId;
  const tableNumber = user?.tableNumber;
  const tableInfo = tables?.find(
    (tbl) =>
      tbl.id === tableId &&
      (loginBranchId == null || tbl.branchId === loginBranchId)
  );
  const seatKind: SeatKind = ((tableInfo?.type as SeatKind) || "table") as SeatKind;
  /** Prefer seat branch; fall back to login branch so table orders stay branch-scoped */
  const branchId = tableInfo?.branchId ?? loginBranchId;

  const openShiftForBranch = useMemo(() => {
    if (branchId == null) return null;
    const list = shiftsData ?? [];
    return (
      list.find(
        (s) =>
          s.branchId === branchId &&
          (s.isOpen === true || (s.isActive === true && !s.closedAt)) &&
          !s.closedAt
      ) ?? null
    );
  }, [shiftsData, branchId]);

  const shiftClosed =
    branchId != null &&
    !(shiftsLoading && shiftsData == null) &&
    openShiftForBranch == null;
  const isSaving = isCreating || isUpdating;

  const todayOrdersParams = useMemo(
    () => ({ date: todayDateKey(), limit: 200 }),
    // refresh date key once per mount day is enough; picker refetch on open
    []
  );

  const { data: todayOrders, refetch: refetchTodayOrders, isFetching: isFetchingOrders } =
    useGetOrders(todayOrdersParams, {
      query: {
        queryKey: [...getGetOrdersQueryKey(todayOrdersParams), branchId ?? "table"],
        staleTime: 2_000,
        refetchInterval: editPickerOpen ? 3_000 : false,
      },
    });

  const unpaidSeatOrders = useMemo(() => {
    if (tableId == null || branchId == null) return [];
    const list = todayOrders ?? [];
    return list
      .filter((o) => {
        if (o.type !== "dine_in") return false;
        if (o.tableId !== tableId) return false;
        if (o.branchId !== branchId) return false;
        return isOrderUnpaid(o);
      })
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [todayOrders, tableId, branchId]);

  const seatTitle = useMemo(() => {
    const n = tableNumber ?? tableInfo?.number ?? "—";
    if (seatKind === "room") return t("tableOrder.roomLine", { n });
    if (seatKind === "person") return t("tableOrder.personLine", { n });
    return t("tableOrder.tableLine", { n });
  }, [seatKind, tableNumber, tableInfo?.number, t]);

  const SeatIcon = seatKind === "room" ? DoorOpen : seatKind === "person" ? UserRound : Table2;

  const filteredItems = useMemo(() => {
    const list = items ?? [];
    return list
      .filter((item) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          item.nameAr.includes(search) ||
          item.name.toLowerCase().includes(q);
        if (!matchesSearch) return false;
        if (activeCategory === "favorites") return item.isFavorite === true;
        if (typeof activeCategory === "number") return item.categoryId === activeCategory;
        return true;
      })
      .slice()
      .sort((a, b) => Number(b.isFavorite === true) - Number(a.isFavorite === true));
  }, [items, search, activeCategory]);

  const goBack = () => {
    if (step === "success") {
      setStep("menu");
      setCart([]);
      clearEditing();
      setOrderNum("");
      return;
    }
    if (editingOrderId != null || cart.length > 0) {
      setCart([]);
      clearEditing();
      setCartOpen(false);
      return;
    }
    logout();
    navigate("/login");
  };

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === item.id && !i.isReturn);
      if (ex) {
        return prev.map((i) =>
          i.id === item.id && !i.isReturn
            ? { ...i, cartQuantity: i.cartQuantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          ...item,
          price: Number(item.price),
          cartQuantity: 1,
        },
      ];
    });
  };

  const updateQty = (id: number, delta: number, isReturn = false) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.id === id && Boolean(i.isReturn) === isReturn
            ? { ...i, cartQuantity: Math.max(0, i.cartQuantity + delta) }
            : i
        )
        .filter((i) => i.cartQuantity > 0)
    );
  };

  const totalItems = cart.reduce((s, i) => s + i.cartQuantity, 0);
  const subtotal = cart.reduce((s, i) => s + cartLineAmount(i), 0);

  const loadOrderIntoCart = (order: Order) => {
    const menuById = new Map((items ?? []).map((m) => [m.id, m]));
    const nextCart: CartItem[] = [];
    for (const line of order.items ?? []) {
      const menuItemId = Number(line.menuItemId);
      if (!Number.isFinite(menuItemId)) continue;
      const signedQty = Number(line.quantity) || 0;
      const qty = Math.abs(signedQty);
      if (qty === 0) continue;
      const asReturn = signedQty < 0;
      const unitPrice = Number(line.unitPrice);
      const fromOrder = line.menuItem;
      const fromMenu = menuById.get(menuItemId);
      const base: MenuItem =
        fromOrder ??
        fromMenu ??
        ({
          id: menuItemId,
          categoryId: fromMenu?.categoryId ?? 0,
          name: fromMenu?.name ?? `#${menuItemId}`,
          nameAr: fromMenu?.nameAr ?? `صنف #${menuItemId}`,
          price: Number.isFinite(unitPrice) ? unitPrice : Number(fromMenu?.price) || 0,
          isAvailable: true,
        } as MenuItem);

      const existing = nextCart.find(
        (c) => c.id === menuItemId && Boolean(c.isReturn) === asReturn
      );
      if (existing) {
        existing.cartQuantity += qty;
        continue;
      }
      nextCart.push({
        ...base,
        price: Number.isFinite(unitPrice) ? unitPrice : Number(base.price) || 0,
        cartQuantity: qty,
        isReturn: asReturn || undefined,
      });
    }
    setCart(nextCart);
    setEditingOrderId(order.id);
    setEditingOrderNumber(order.orderNumber || null);
    setOrderNum(order.orderNumber || "");
    setStep("menu");
    setEditPickerOpen(false);
    setCartOpen(true);
  };

  const clearEditing = () => {
    setEditingOrderId(null);
    setEditingOrderNumber(null);
  };

  const openEditPicker = () => {
    setEditPickerOpen(true);
    void refetchTodayOrders();
  };

  const afterSaveSuccess = (order: any) => {
    void queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock"] });
    bumpOrdersLive();
    bumpStockLive();
    setOrderNum(order.orderNumber || editingOrderNumber || "");
    setCartOpen(false);
    setStep("success");
  };

  const handleSubmitOrder = () => {
    if (!tableId || cart.length === 0) return;
    if (branchId == null) return;
    if (editingOrderId == null && shiftClosed) {
      toast({
        title: t("pos.shiftClosedBlock"),
        variant: "destructive",
      });
      return;
    }
    const lineItems = cart.map((i) => ({
      menuItemId: i.id,
      quantity: cartLineSignedQty(i),
    }));

    if (editingOrderId != null) {
      updateOrder(
        {
          id: editingOrderId,
          data: { items: lineItems },
        },
        {
          onSuccess: (order: any) => afterSaveSuccess(order),
        }
      );
      return;
    }

    createOrder(
      {
        data: {
          type: "dine_in",
          tableId,
          branchId,
          source: "table_order",
          items: lineItems,
        } as any,
      },
      {
        onSuccess: (order: any) => afterSaveSuccess(order),
        onError: (err: any) => {
          toast({
            title:
              err?.message ||
              err?.data?.message ||
              t("pos.shiftClosedBlock"),
            variant: "destructive",
          });
        },
      }
    );
  };

  const resetOrder = () => {
    setCart([]);
    setSearch("");
    setActiveCategory("favorites");
    clearEditing();
    setStep("menu");
  };

  const CartPanel = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border/40 flex items-center gap-2.5 flex-shrink-0 bg-gradient-to-l from-primary/10 via-transparent to-transparent">
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold text-sm leading-tight">{t("tableOrder.myList")}</h2>
          <p className="text-[11px] text-muted-foreground truncate">{seatTitle}</p>
        </div>
        {cart.length > 0 && (
          <span className="min-w-7 h-7 px-1.5 bg-primary rounded-full text-xs font-bold text-primary-foreground flex items-center justify-center tabular-nums">
            {totalItems}
          </span>
        )}
        <button
          type="button"
          onClick={() => setCartOpen(false)}
          className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {editingOrderId != null && (
        <div className="mx-3 mt-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold text-amber-900 dark:text-amber-100 truncate">
              {t("tableOrder.editingInvoice")}
            </p>
            <p className="text-xs font-display font-bold tabular-nums text-amber-800 dark:text-amber-200 truncate">
              {editingOrderNumber ?? `#${editingOrderId}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearEditing();
              setCart([]);
            }}
            className="text-[11px] font-bold text-muted-foreground hover:text-destructive shrink-0"
          >
            {t("tableOrder.cancelEdit")}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence>
          {cart.map((item) => {
            const isReturnLine = Boolean(item.isReturn);
            const lineAmount = cartLineAmount(item);
            return (
            <motion.div
              key={cartLineKey(item)}
              layout
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className={`rounded-2xl border p-3 shadow-sm ${
                isReturnLine
                  ? "border-rose-500/40 bg-rose-500/10"
                  : "border-border/40 bg-background/70"
              }`}
            >
              <div className="flex justify-between items-start gap-2 mb-2.5">
                <button
                  type="button"
                  onClick={() => updateQty(item.id, -item.cartQuantity, isReturnLine)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="min-w-0 flex-1 text-end">
                  <p
                    className={`font-bold text-sm leading-snug ${
                      isReturnLine ? "text-rose-700 dark:text-rose-300" : ""
                    }`}
                  >
                    {item.nameAr}
                  </p>
                  {isReturnLine ? (
                    <span className="inline-flex mt-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 dark:text-rose-300">
                      {t("pos.returnLine")}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`flex items-center gap-1 rounded-xl border p-0.5 ${
                    isReturnLine
                      ? "border-rose-500/35 bg-rose-500/10"
                      : "border-border/50 bg-secondary/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, 1, isReturnLine)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                      isReturnLine
                        ? "hover:bg-rose-500/20 text-rose-600 dark:text-rose-300"
                        : "hover:bg-primary/15 text-primary"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span
                    className={`w-8 text-center font-extrabold text-sm tabular-nums ${
                      isReturnLine ? "text-rose-700 dark:text-rose-300" : ""
                    }`}
                  >
                    {isReturnLine ? `-${item.cartQuantity}` : item.cartQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, -1, isReturnLine)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-secondary rounded-lg transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span
                  className={`font-extrabold font-display text-sm tabular-nums ${
                    isReturnLine
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-primary"
                  }`}
                >
                  {formatIQD(lineAmount)} {t("common.iqd")}
                </span>
              </div>
            </motion.div>
            );
          })}
        </AnimatePresence>

        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/70">
            <div className="w-16 h-16 rounded-2xl bg-secondary/60 border border-border/40 flex items-center justify-center mb-3">
              <ShoppingCart className="w-8 h-8 opacity-50" />
            </div>
            <p className="text-sm text-center font-medium">{t("tableOrder.tapItem")}</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border/40 space-y-3 bg-card/80 backdrop-blur-sm flex-shrink-0">
        {shiftClosed && editingOrderId == null ? (
          <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-[12px] font-extrabold text-rose-800 dark:text-rose-200 leading-snug">
            {t("pos.shiftClosedBlock")}
          </div>
        ) : null}
        <button
          type="button"
          onClick={goBack}
          className="group relative w-full h-12 inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-2xl border-2 border-border/70 bg-secondary/40 font-extrabold text-sm text-foreground transition-all active:scale-[0.98] hover:border-primary/40 hover:bg-secondary/70"
          title={t("common.back")}
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground">
            <ArrowRight className="w-4 h-4" strokeWidth={2.35} />
          </span>
          <span>{t("common.back")}</span>
        </button>
        <div className="flex justify-between items-end font-bold">
          <span
            className={`font-display text-xl tabular-nums ${
              subtotal < 0 ? "text-rose-600 dark:text-rose-400" : "text-primary"
            }`}
          >
            {formatIQD(subtotal)} {t("common.iqd")}
          </span>
          <span className="text-sm text-muted-foreground">{t("common.total")}</span>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmitOrder}
          disabled={
            cart.length === 0 ||
            isSaving ||
            !tableId ||
            (shiftClosed && editingOrderId == null)
          }
          className="w-full h-14 rounded-2xl bg-gradient-to-l from-primary via-primary to-amber-500 hover:brightness-105 text-primary-foreground font-extrabold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
        >
          {isSaving ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : editingOrderId != null ? (
            <>
              <Save className="w-5 h-5" />
              {t("tableOrder.saveEdit")}
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              {t("tableOrder.sendCashier")}
            </>
          )}
        </motion.button>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setCart([]);
              clearEditing();
            }}
            className="w-full text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors py-1"
          >
            {t("tableOrder.clear")}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-app bg-background text-foreground flex flex-col overflow-hidden page-shell relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsla(var(--primary),0.12),transparent_45%),radial-gradient(ellipse_at_bottom_left,hsla(38,92%,50%,0.08),transparent_40%)]" />

      <header className="relative flex-shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/40 flex items-center justify-between px-4 py-3.5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 to-amber-500/15 border border-primary/25 flex items-center justify-center flex-shrink-0 shadow-sm">
            <SeatIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-extrabold leading-tight truncate">
              {seatTitle}
            </h1>
            <p className="text-[11px] md:text-xs text-muted-foreground truncate">
              {t("tableOrder.capacityLine", {
                location: tableInfo?.location ?? "—",
                capacity: tableInfo?.capacity ?? "—",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {editingOrderNumber ? (
            <div className="hidden sm:flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/25">
              <span className="text-[11px] font-extrabold text-amber-800 dark:text-amber-200 font-display tabular-nums truncate max-w-[9rem]">
                {editingOrderNumber}
              </span>
            </div>
          ) : subtotal > 0 ? (
            <div className="hidden sm:flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
              <span className="text-sm font-extrabold text-primary font-display tabular-nums">
                {formatIQD(subtotal)} {t("common.iqd")}
              </span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={goBack}
            className="relative inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-border/70 bg-secondary/50 text-foreground text-sm font-extrabold hover:bg-secondary transition-colors"
            title={t("common.back")}
          >
            <ArrowRight className="w-4 h-4" />
            <span className="hidden sm:inline">{t("common.back")}</span>
          </button>

          <button
            type="button"
            onClick={openEditPicker}
            disabled={!tableId}
            className="relative inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 text-sm font-extrabold hover:bg-amber-500/20 transition-colors disabled:opacity-40"
          >
            <PencilLine className="w-4 h-4" />
            <span className="hidden sm:inline">{t("tableOrder.edit")}</span>
            {unpaidSeatOrders.length > 0 ? (
              <span className="min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unpaidSeatOrders.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors px-2.5 py-2 rounded-xl hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{t("common.exit")}</span>
          </button>
        </div>
      </header>

      {step === "menu" && (
        <div className="relative flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex-shrink-0 border-b border-border/40 p-3 space-y-2.5 bg-card/40 backdrop-blur-sm">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("pos.searchItem")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pr-10 pl-4 h-11 rounded-2xl bg-background/80 border border-border/60 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                <button
                  type="button"
                  onClick={() => setActiveCategory("favorites")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-bold flex-shrink-0 transition-all border ${
                    activeCategory === "favorites"
                      ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/15"
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  {t("pos.favorites")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className={`px-3.5 py-2 rounded-full text-sm font-bold flex-shrink-0 transition-all border ${
                    activeCategory === null
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                      : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15"
                  }`}
                >
                  {t("common.all")}
                </button>
                {categories?.map((cat) => {
                  const selected = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-bold flex-shrink-0 transition-all whitespace-nowrap border ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                          : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15"
                      }`}
                    >
                      {cat.imageUrl ? (
                        <img
                          src={cat.imageUrl}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover border border-white/20 flex-shrink-0"
                        />
                      ) : null}
                      {cat.nameAr}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-24 lg:pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-3">
                <AnimatePresence mode="popLayout">
                  {filteredItems.map((item) => {
                    const inCart = cart.find((c) => c.id === item.id && !c.isReturn);
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        layout
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.94 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => addToCart(item)}
                        className={`text-start bg-card/85 border rounded-2xl p-3 md:p-3.5 cursor-pointer hover:shadow-lg transition-all relative overflow-hidden ${
                          inCart
                            ? "border-primary/55 bg-primary/5 shadow-md shadow-primary/10"
                            : "border-border/45 hover:border-primary/35"
                        }`}
                      >
                        {inCart && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 left-2 min-w-6 h-6 md:min-w-7 md:h-7 px-1 rounded-full flex items-center justify-center text-xs md:text-sm font-bold z-10 shadow-md tabular-nums bg-primary text-primary-foreground"
                          >
                            {inCart.cartQuantity}
                          </motion.div>
                        )}
                        <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-secondary/80 to-secondary/40 border border-border/30 flex items-center justify-center mb-2.5 overflow-hidden">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ChefHat className="w-8 h-8 text-muted-foreground/45" />
                          )}
                        </div>
                        <h3 className="font-extrabold text-xs md:text-sm mb-1 leading-tight line-clamp-2">
                          {item.nameAr}
                        </h3>
                        <p className="text-primary font-extrabold font-display text-xs md:text-sm tabular-nums">
                          {formatIQD(Number(item.price))} {t("common.iqd")}
                        </p>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>

              {filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60">
                  <Search className="w-12 h-12 mb-3 opacity-50" />
                  <p className="font-medium">{t("tableOrder.noMatch")}</p>
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:flex w-[22rem] xl:w-[26rem] flex-shrink-0 border-r border-border/40 flex-col bg-card/55 backdrop-blur-md shadow-[-8px_0_28px_rgba(0,0,0,0.06)]">
            <CartPanel />
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="relative flex-1 flex flex-col items-center justify-center p-6 md:p-8 text-center space-y-5 overflow-y-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <div className="w-24 h-24 md:w-28 md:h-28 bg-emerald-500/15 border border-emerald-500/25 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 text-emerald-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h2 className="text-2xl md:text-3xl font-extrabold">
              {editingOrderId != null ? t("tableOrder.updated") : t("tableOrder.sent")}
            </h2>
            {orderNum ? (
              <p className="text-muted-foreground mt-1.5 font-display font-bold tabular-nums">
                {t("tableOrder.orderNumber", { n: orderNum })}
              </p>
            ) : null}
            <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-md mx-auto">
              {t("tableOrder.cashierWillReview")}
            </p>
          </motion.div>

          <div className="bg-card/80 rounded-2xl p-4 md:p-5 border border-border/50 w-full max-w-sm text-end space-y-2 shadow-sm">
            <p className="text-sm font-bold text-muted-foreground mb-3">
              {t("tableOrder.details", { n: tableNumber ?? tableInfo?.number ?? "" })}
            </p>
            {cart.map((i) => (
              <div key={cartLineKey(i)} className="flex justify-between text-sm gap-3">
                <span
                  className={`font-display font-bold tabular-nums ${
                    i.isReturn
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-primary"
                  }`}
                >
                  {formatIQD(cartLineAmount(i))} {t("common.iqd")}
                </span>
                <span className="font-medium">
                  {i.isReturn ? `${t("pos.returnLine")} · ` : ""}
                  {i.nameAr} × {i.isReturn ? `-${i.cartQuantity}` : i.cartQuantity}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-extrabold pt-2 border-t border-border/50">
              <span
                className={`font-display text-lg tabular-nums ${
                  subtotal < 0 ? "text-rose-600 dark:text-rose-400" : "text-primary"
                }`}
              >
                {formatIQD(subtotal)} {t("common.iqd")}
              </span>
              <span>{t("common.total")}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={resetOrder}
            className="inline-flex items-center gap-2 h-12 px-8 rounded-2xl bg-secondary hover:bg-secondary/70 border border-border text-foreground font-bold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t("tableOrder.new")}
          </button>
        </div>
      )}

      {step === "menu" && (
        <AnimatePresence>
          {totalItems > 0 && (
            <motion.button
              type="button"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              onClick={() => setCartOpen(true)}
              className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-gradient-to-l from-primary to-amber-500 text-primary-foreground px-6 py-3.5 rounded-2xl shadow-2xl shadow-primary/35 font-extrabold text-sm"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>{t("tableOrder.view")}</span>
              <span className="bg-primary-foreground/20 text-primary-foreground rounded-full min-w-6 h-6 px-1.5 flex items-center justify-center text-xs font-bold tabular-nums">
                {totalItems}
              </span>
              <span className="font-display tabular-nums">
                {formatIQD(subtotal)} {t("common.iqd")}
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              key="cart-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 z-40"
            />
            <motion.div
              key="cart-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/50 rounded-t-3xl overflow-hidden"
              style={{ maxHeight: "85vh" }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-border rounded-full" />
              </div>
              <div className="h-[80vh]">
                <CartPanel />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Dialog
        isOpen={editPickerOpen}
        onClose={() => setEditPickerOpen(false)}
        title={t("tableOrder.editTitle")}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-l from-amber-500/10 via-primary/5 to-transparent px-4 py-3">
            <p className="text-sm font-bold text-foreground">{seatTitle}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {t("tableOrder.editHint")}
            </p>
          </div>

          {isFetchingOrders && unpaidSeatOrders.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-60" />
              <p className="text-sm font-medium">{t("common.loading")}</p>
            </div>
          ) : unpaidSeatOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/30 py-14 text-center text-muted-foreground">
              <PencilLine className="w-10 h-10 mx-auto mb-3 opacity-45" />
              <p className="font-bold">{t("tableOrder.noUnpaidInvoices")}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 overflow-hidden max-h-[min(55vh,480px)] overflow-y-auto divide-y divide-border/50">
              {unpaidSeatOrders.map((order, idx) => {
                const payable = (() => {
                  const sub = Number(order.subtotal) || 0;
                  const disc = Math.max(0, Number(order.discount) || 0);
                  if (sub > 0 || disc > 0) return Math.max(0, sub - disc);
                  return Math.max(0, Number(order.total) || 0);
                })();
                const selected = editingOrderId === order.id;
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => loadOrderIntoCart(order)}
                    className={`w-full text-start px-4 py-3.5 flex items-center gap-3 transition-colors ${
                      selected ? "bg-amber-500/10" : "hover:bg-amber-500/5"
                    }`}
                  >
                    <span className="text-[11px] font-black tabular-nums text-muted-foreground w-6 shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-extrabold text-sm font-display tabular-nums truncate">
                          {order.orderNumber}
                        </p>
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-200">
                          {t("cashier.colUnpaid")}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-bold tabular-nums" dir="ltr">
                          <Clock className="w-3.5 h-3.5 text-primary/80" />
                          {formatListDateTime(order.createdAt)}
                        </span>
                        <span className="truncate">{seatTitle}</span>
                      </div>
                    </div>
                    <span className="font-display font-extrabold text-sm tabular-nums shrink-0">
                      {formatIQD(payable)} {t("common.iqd")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
