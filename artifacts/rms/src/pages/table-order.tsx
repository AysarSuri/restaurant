import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMenuItems,
  useGetMenuCategories,
  useGetTables,
  useCreateOrder,
} from "@workspace/api-client-react";
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
} from "lucide-react";
import type { MenuItem } from "@workspace/api-client-react";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { bumpOrdersLive } from "@/lib/orders-live";

interface CartItem extends MenuItem {
  cartQuantity: number;
  price: number;
}

type SeatKind = "table" | "room" | "person";

const formatIQD = (v: number) => new Intl.NumberFormat("en-IQ").format(Math.round(v));

export default function TableOrder() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: categories } = useGetMenuCategories();
  const { data: items } = useGetMenuItems({ available: true });
  const { data: tables } = useGetTables();
  const { mutate: createOrder, isPending } = useCreateOrder();

  const [step, setStep] = useState<"menu" | "success">("menu");
  const [activeCategory, setActiveCategory] = useState<number | "favorites" | null>("favorites");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNum, setOrderNum] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  const tableId = user?.tableId;
  const tableNumber = user?.tableNumber;
  const tableInfo = tables?.find((tbl) => tbl.id === tableId);
  const seatKind: SeatKind = ((tableInfo?.type as SeatKind) || "table") as SeatKind;

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

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === item.id);
      if (ex) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i
        );
      }
      return [...prev, { ...item, price: Number(item.price), cartQuantity: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.id === id ? { ...i, cartQuantity: Math.max(0, i.cartQuantity + delta) } : i
        )
        .filter((i) => i.cartQuantity > 0)
    );
  };

  const totalItems = cart.reduce((s, i) => s + i.cartQuantity, 0);
  const subtotal = cart.reduce((s, i) => s + i.price * i.cartQuantity, 0);

  const handleSubmitOrder = () => {
    if (!tableId || cart.length === 0) return;
    createOrder(
      {
        data: {
          type: "dine_in",
          tableId,
          branchId: tableInfo?.branchId ?? undefined,
          source: "table_order",
          items: cart.map((i) => ({ menuItemId: i.id, quantity: i.cartQuantity })),
        } as any,
      },
      {
        onSuccess: (order: any) => {
          void queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          bumpOrdersLive();
          setOrderNum(order.orderNumber || "");
          setCartOpen(false);
          setStep("success");
        },
      }
    );
  };

  const resetOrder = () => {
    setCart([]);
    setSearch("");
    setActiveCategory("favorites");
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

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence>
          {cart.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="rounded-2xl border border-border/40 bg-background/70 p-3 shadow-sm"
            >
              <div className="flex justify-between items-start gap-2 mb-2.5">
                <button
                  type="button"
                  onClick={() => updateQty(item.id, -item.cartQuantity)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <p className="font-bold text-sm flex-1 text-end leading-snug">{item.nameAr}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-secondary/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, 1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-primary/15 rounded-lg text-primary transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center font-extrabold text-sm tabular-nums">
                    {item.cartQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, -1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-secondary rounded-lg transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-primary font-extrabold font-display text-sm tabular-nums">
                  {formatIQD(item.price * item.cartQuantity)} {t("common.iqd")}
                </span>
              </div>
            </motion.div>
          ))}
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
        <div className="flex justify-between items-end font-bold">
          <span className="text-primary font-display text-xl tabular-nums">
            {formatIQD(subtotal)} {t("common.iqd")}
          </span>
          <span className="text-sm text-muted-foreground">{t("common.total")}</span>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmitOrder}
          disabled={cart.length === 0 || isPending || !tableId}
          className="w-full h-14 rounded-2xl bg-gradient-to-l from-primary via-primary to-amber-500 hover:brightness-105 text-primary-foreground font-extrabold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
        >
          {isPending ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
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
            onClick={() => setCart([])}
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
          {subtotal > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
              <span className="text-sm font-extrabold text-primary font-display tabular-nums">
                {formatIQD(subtotal)} {t("common.iqd")}
              </span>
            </div>
          )}
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
                      className={`px-3.5 py-2 rounded-full text-sm font-bold flex-shrink-0 transition-all whitespace-nowrap border ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                          : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15"
                      }`}
                    >
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
                    const inCart = cart.find((c) => c.id === item.id);
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
                            className="absolute top-2 left-2 min-w-6 h-6 md:min-w-7 md:h-7 px-1 bg-primary rounded-full flex items-center justify-center text-xs md:text-sm font-bold text-primary-foreground z-10 shadow-md tabular-nums"
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
            <h2 className="text-2xl md:text-3xl font-extrabold">{t("tableOrder.sent")}</h2>
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
              <div key={i.id} className="flex justify-between text-sm gap-3">
                <span className="text-primary font-display font-bold tabular-nums">
                  {formatIQD(i.price * i.cartQuantity)} {t("common.iqd")}
                </span>
                <span className="font-medium">
                  {i.nameAr} × {i.cartQuantity}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-extrabold pt-2 border-t border-border/50">
              <span className="text-primary font-display text-lg tabular-nums">
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
    </div>
  );
}
