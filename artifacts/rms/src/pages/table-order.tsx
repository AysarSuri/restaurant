import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetMenuItems, useGetMenuCategories,
  useGetTables, useCreateOrder,
} from "@workspace/api-client-react";
import {
  ShoppingCart, Search, Plus, Minus, Trash2,
  CheckCircle2, RefreshCw, LogOut, Table2, ChefHat, X,
} from "lucide-react";
import type { MenuItem } from "@workspace/api-client-react";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";

interface CartItem extends MenuItem {
  cartQuantity: number;
  price: number;
}

const formatIQD = (v: number) => new Intl.NumberFormat("en-IQ").format(Math.round(v));

export default function TableOrder() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  const { data: categories } = useGetMenuCategories();
  const { data: items } = useGetMenuItems({ available: true });
  const { data: tables } = useGetTables();
  const { mutate: createOrder, isPending } = useCreateOrder();

  const [step, setStep] = useState<"menu" | "success">("menu");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNum, setOrderNum] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  const tableId = user?.tableId;
  const tableNumber = user?.tableNumber;
  const tableInfo = tables?.find((t) => t.id === tableId);

  const filteredItems = items?.filter(
    (item) =>
      (!activeCategory || item.categoryId === activeCategory) &&
      (item.nameAr.includes(search) || item.name.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === item.id);
      if (ex) return prev.map((i) => i.id === item.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i);
      return [...prev, { ...item, price: Number(item.price), cartQuantity: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev.map((i) => i.id === id ? { ...i, cartQuantity: Math.max(0, i.cartQuantity + delta) } : i)
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
          items: cart.map((i) => ({ menuItemId: i.id, quantity: i.cartQuantity })),
        } as any,
      },
      {
        onSuccess: (order: any) => {
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
    setActiveCategory(null);
    setStep("menu");
  };

  /* ── Cart Panel (shared by desktop sidebar & mobile drawer) ── */
  const CartPanel = () => (
    <div className="flex flex-col h-full">
      {/* Cart Header */}
      <div className="p-4 border-b border-border/50 flex items-center gap-2 flex-shrink-0">
        <ShoppingCart className="w-5 h-5 text-primary" />
        <h2 className="font-bold flex-1">{t("tableOrder.myList")}</h2>
        {cart.length > 0 && (
          <span className="w-6 h-6 bg-primary rounded-full text-xs font-bold text-primary-foreground flex items-center justify-center">
            {totalItems}
          </span>
        )}
        {/* Close — mobile only */}
        <button onClick={() => setCartOpen(false)} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence>
          {cart.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-secondary/50 rounded-xl p-3 border border-border/30"
            >
              <div className="flex justify-between items-start mb-2">
                <button onClick={() => updateQty(item.id, -item.cartQuantity)} className="text-destructive/60 hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <p className="font-semibold text-sm flex-1 text-right">{item.nameAr}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-background/60 rounded-lg p-0.5">
                  <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 flex items-center justify-center hover:bg-primary/20 rounded-md text-primary transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{item.cartQuantity}</span>
                  <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-secondary rounded-md transition-colors">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-primary font-bold font-display text-sm">{formatIQD(item.price * item.cartQuantity)} {t("common.iqd")}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground opacity-40">
            <ShoppingCart className="w-14 h-14 mb-3" />
            <p className="text-sm text-center">{t("tableOrder.tapItem")}</p>
          </div>
        )}
      </div>

      {/* Summary + Submit */}
      <div className="p-4 border-t border-border/50 space-y-3 bg-card/60 flex-shrink-0">
        {cart.length > 0 && (
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {cart.map((i) => (
              <div key={i.id} className="flex justify-between text-xs text-muted-foreground">
                <span className="font-display">{formatIQD(i.price * i.cartQuantity)}</span>
                <span>{i.nameAr} × {i.cartQuantity}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between font-bold text-lg border-t border-border/50 pt-2">
          <span className="text-primary font-display">{formatIQD(subtotal)} {t("common.iqd")}</span>
          <span>{t("common.total")}</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmitOrder}
          disabled={cart.length === 0 || isPending}
          className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
        >
          {isPending ? <RefreshCw className="w-5 h-5 animate-spin" /> : (
            <><ChefHat className="w-5 h-5" /> {t("tableOrder.sendCashier")}</>
          )}
        </motion.button>
        {cart.length > 0 && (
          <button onClick={() => setCart([])} className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1">
            {t("tableOrder.clear")}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-app bg-background text-foreground flex flex-col overflow-hidden page-shell">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-card/90 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Table2 className="w-5 h-5 text-green-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-bold leading-tight truncate">
              {t("tableOrder.tableLine", { n: tableNumber ?? "—" })}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {t("tableOrder.capacityLine", { location: tableInfo?.location ?? "", capacity: tableInfo?.capacity ?? "—" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Total pill — hidden on tiny screens */}
          {subtotal > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
              <span className="text-sm font-bold text-primary font-display">{formatIQD(subtotal)} {t("common.iqd")}</span>
            </div>
          )}
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors px-2 py-2 rounded-xl hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{t("common.exit")}</span>
          </button>
        </div>
      </header>

      {/* ── MENU STEP ── */}
      {step === "menu" && (
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* ── Menu Area (full width on mobile, flex-1 on desktop) ── */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">

            {/* Search + Categories */}
            <div className="flex-shrink-0 border-b border-border/50 p-3 space-y-2.5">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("pos.searchItem")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pr-10 pl-4 h-10 rounded-xl bg-secondary/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`px-3 md:px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 transition-all
                    ${activeCategory === null ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >
                  {t("common.all")}
                </button>
                {categories?.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 md:px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 transition-all whitespace-nowrap
                      ${activeCategory === cat.id ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    {cat.nameAr}
                  </button>
                ))}
              </div>
            </div>

            {/* Items Grid */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-24 lg:pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                <AnimatePresence mode="popLayout">
                  {filteredItems?.map((item) => {
                    const inCart = cart.find((c) => c.id === item.id);
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => addToCart(item)}
                        className={`bg-card/80 border rounded-2xl p-3 md:p-4 cursor-pointer hover:shadow-lg transition-all relative overflow-hidden
                          ${inCart ? "border-primary/60 bg-primary/5 shadow-primary/10 shadow-md" : "border-border/50 hover:border-primary/40"}`}
                      >
                        {inCart && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 left-2 w-6 h-6 md:w-7 md:h-7 bg-primary rounded-full flex items-center justify-center text-xs md:text-sm font-bold text-primary-foreground z-10 shadow-md"
                          >
                            {inCart.cartQuantity}
                          </motion.div>
                        )}
                        <div className="aspect-square rounded-xl bg-secondary/50 flex items-center justify-center mb-2 md:mb-3 text-3xl md:text-4xl">
                          🍽️
                        </div>
                        <h3 className="font-bold text-xs md:text-sm mb-0.5 md:mb-1 leading-tight line-clamp-2">{item.nameAr}</h3>
                        <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5 md:mb-1 hidden sm:block">{item.name}</p>
                        <p className="text-primary font-bold font-display text-xs md:text-sm">{formatIQD(Number(item.price))} {t("common.iqd")}</p>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {filteredItems?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-40">
                  <Search className="w-12 h-12 mb-3" />
                  <p>{t("tableOrder.noMatch")}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── DESKTOP Cart Sidebar (≥ lg) ── */}
          <div className="hidden lg:flex w-80 xl:w-96 flex-shrink-0 border-r border-border/50 flex-col bg-card/40 backdrop-blur-sm">
            <CartPanel />
          </div>
        </div>
      )}

      {/* ── SUCCESS STEP ── */}
      {step === "success" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 text-center space-y-5 overflow-y-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <div className="w-24 h-24 md:w-28 md:h-28 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 text-green-500" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-2xl md:text-3xl font-bold">{t("tableOrder.sent")}</h2>
            {orderNum && (
              <p className="text-muted-foreground mt-1">
                {t("tableOrder.orderNumber", { n: orderNum })}
              </p>
            )}
            <p className="text-muted-foreground mt-2 text-sm md:text-base">{t("tableOrder.cashierWillReview")}</p>
          </motion.div>

          <div className="bg-card/60 rounded-2xl p-4 md:p-5 border border-border/50 w-full max-w-sm text-right space-y-2">
            <p className="text-sm font-bold text-muted-foreground mb-3">{t("tableOrder.details", { n: tableNumber ?? "" })}</p>
            {cart.map((i) => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="text-primary font-display">{formatIQD(i.price * i.cartQuantity)} {t("common.iqd")}</span>
                <span>{i.nameAr} × {i.cartQuantity}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2 border-t border-border/50">
              <span className="text-primary font-display text-lg">{formatIQD(subtotal)} {t("common.iqd")}</span>
              <span>{t("common.total")}</span>
            </div>
          </div>

          <button
            onClick={resetOrder}
            className="flex items-center gap-2 h-12 px-8 rounded-xl bg-secondary hover:bg-secondary/70 border border-border text-foreground font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t("pos.newOrder")}
          </button>
        </div>
      )}

      {/* ── MOBILE: Floating Cart Button (< lg) ── */}
      {step === "menu" && (
        <AnimatePresence>
          {totalItems > 0 && (
            <motion.button
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              onClick={() => setCartOpen(true)}
              className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-primary text-primary-foreground px-6 py-3.5 rounded-2xl shadow-2xl shadow-primary/40 font-bold text-sm"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>{t("tableOrder.view")}</span>
              <span className="bg-primary-foreground/20 text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {totalItems}
              </span>
              <span className="font-display">{formatIQD(subtotal)} {t("common.iqd")}</span>
            </motion.button>
          )}
        </AnimatePresence>
      )}

      {/* ── MOBILE: Cart Bottom Sheet (< lg) ── */}
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
              {/* Pull handle */}
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
