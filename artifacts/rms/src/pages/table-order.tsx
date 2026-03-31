import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetMenuItems, useGetMenuCategories,
  useGetTables, useCreateOrder,
} from "@workspace/api-client-react";
import { Button, Input } from "@/components/ui-elements";
import {
  ShoppingCart, Search, Plus, Minus, Trash2,
  CheckCircle2, RefreshCw, LogOut, Table2, ChefHat, Utensils,
} from "lucide-react";
import type { MenuItem } from "@workspace/api-client-react/src/generated/api.schemas";
import { useAuth } from "@/App";
import { useLocation } from "wouter";

interface CartItem extends MenuItem {
  cartQuantity: number;
  price: number;
}

const formatIQD = (v: number) => new Intl.NumberFormat("en-IQ").format(Math.round(v));

export default function TableOrder() {
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

  // Get table info from auth session
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

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-card/90 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center">
            <Table2 className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">
              طاولة {tableNumber ?? "—"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {tableInfo?.location ?? ""} — سعة {tableInfo?.capacity ?? "—"} أشخاص
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-xl border border-primary/20">
            <Utensils className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary font-display">
              {formatIQD(subtotal)} د.ع
            </span>
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors px-3 py-2 rounded-xl hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            خروج
          </button>
        </div>
      </header>

      {/* ── MENU STEP ── */}
      {step === "menu" && (
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left: Menu ── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Search + Categories */}
            <div className="flex-shrink-0 border-b border-border/50 p-3 space-y-2.5">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="ابحث عن صنف..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pr-10 pl-4 h-10 rounded-xl bg-secondary/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 transition-all
                    ${activeCategory === null ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >
                  الكل
                </button>
                {categories?.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 transition-all whitespace-nowrap
                      ${activeCategory === cat.id ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    {cat.nameAr}
                  </button>
                ))}
              </div>
            </div>

            {/* Items Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
                        whileTap={{ scale: 0.96 }}
                        onClick={() => addToCart(item)}
                        className={`bg-card/80 border rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all relative overflow-hidden
                          ${inCart ? "border-primary/60 bg-primary/5 shadow-primary/10 shadow-md" : "border-border/50 hover:border-primary/40"}`}
                      >
                        {inCart && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 left-2 w-7 h-7 bg-primary rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground z-10 shadow-md"
                          >
                            {inCart.cartQuantity}
                          </motion.div>
                        )}
                        <div className="aspect-square rounded-xl bg-secondary/50 flex items-center justify-center mb-3 text-4xl">
                          🍽️
                        </div>
                        <h3 className="font-bold text-sm mb-1 leading-tight">{item.nameAr}</h3>
                        <p className="text-xs text-muted-foreground mb-1">{item.name}</p>
                        <p className="text-primary font-bold font-display text-sm">{formatIQD(Number(item.price))} د.ع</p>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {filteredItems?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-40">
                  <Search className="w-12 h-12 mb-3" />
                  <p>لا توجد أصناف مطابقة</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Cart ── */}
          <div className="w-80 flex-shrink-0 border-r border-border/50 flex flex-col bg-card/40 backdrop-blur-sm">
            {/* Cart Header */}
            <div className="p-4 border-b border-border/50 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <h2 className="font-bold flex-1">قائمة طلبي</h2>
              {cart.length > 0 && (
                <span className="w-6 h-6 bg-primary rounded-full text-xs font-bold text-primary-foreground flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.cartQuantity, 0)}
                </span>
              )}
            </div>

            {/* Cart Items */}
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
                      <button
                        onClick={() => updateQty(item.id, -item.cartQuantity)}
                        className="text-destructive/60 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <p className="font-semibold text-sm flex-1 text-right">{item.nameAr}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 bg-background/60 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-primary/20 rounded-md text-primary transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-sm">{item.cartQuantity}</span>
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-secondary rounded-md transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-primary font-bold font-display text-sm">
                        {formatIQD(item.price * item.cartQuantity)} د.ع
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground opacity-40">
                  <ShoppingCart className="w-14 h-14 mb-3" />
                  <p className="text-sm text-center">اضغط على أي صنف لإضافته</p>
                </div>
              )}
            </div>

            {/* Summary + Submit */}
            <div className="p-4 border-t border-border/50 space-y-3 bg-card/60">
              {cart.length > 0 && (
                <div className="space-y-1">
                  {cart.map((i) => (
                    <div key={i.id} className="flex justify-between text-xs text-muted-foreground">
                      <span className="font-display">{formatIQD(i.price * i.cartQuantity)}</span>
                      <span>{i.nameAr} × {i.cartQuantity}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between font-bold text-lg border-t border-border/50 pt-2">
                <span className="text-primary font-display">{formatIQD(subtotal)} د.ع</span>
                <span>الإجمالي</span>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmitOrder}
                disabled={cart.length === 0 || isPending}
                className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
              >
                {isPending ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ChefHat className="w-5 h-5" />
                    إرسال الطلب للكاشير
                  </>
                )}
              </motion.button>

              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
                >
                  مسح الطلب
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS STEP ── */}
      {step === "success" && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <div className="w-28 h-28 bg-green-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-3xl font-bold">تم إرسال الطلب!</h2>
            {orderNum && (
              <p className="text-muted-foreground mt-1">
                رقم الطلب: <span className="font-display font-bold text-primary">{orderNum}</span>
              </p>
            )}
            <p className="text-muted-foreground mt-2">سيقوم الكاشير بمراجعة طلبك وإرساله للمطبخ</p>
          </motion.div>

          <div className="bg-card/60 rounded-2xl p-5 border border-border/50 w-full max-w-sm text-right space-y-2">
            <p className="text-sm font-bold text-muted-foreground mb-3">تفاصيل الطلب — طاولة {tableNumber}</p>
            {cart.map((i) => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="text-primary font-display">{formatIQD(i.price * i.cartQuantity)} د.ع</span>
                <span>{i.nameAr} × {i.cartQuantity}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2 border-t border-border/50">
              <span className="text-primary font-display text-lg">{formatIQD(subtotal)} د.ع</span>
              <span>الإجمالي</span>
            </div>
          </div>

          <button
            onClick={resetOrder}
            className="flex items-center gap-2 h-12 px-8 rounded-xl bg-secondary hover:bg-secondary/70 border border-border text-foreground font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            طلب جديد
          </button>
        </div>
      )}
    </div>
  );
}
