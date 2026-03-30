import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetMenuItems, useGetMenuCategories,
  useGetTables, useCreateOrder,
} from "@workspace/api-client-react";
import { Button, Input, Dialog } from "@/components/ui-elements";
import {
  ShoppingCart, Search, Plus, Minus, Trash2,
  Table2, CheckCircle2, RefreshCw, ArrowLeft,
} from "lucide-react";
import type { MenuItem } from "@workspace/api-client-react/src/generated/api.schemas";
import { useAuth } from "@/App";
import { useLocation } from "wouter";

interface CartItem extends MenuItem {
  cartQuantity: number;
  price: number;
}

const formatIQD = (v: number) => new Intl.NumberFormat("en-IQ").format(Math.round(v));

const TABLE_STATUS_MAP: Record<string, string> = {
  available: "متاحة",
  occupied: "مشغولة",
  reserved: "محجوزة",
  cleaning: "تنظيف",
};

export default function TableOrder() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  const { data: categories } = useGetMenuCategories();
  const { data: items } = useGetMenuItems({ available: true });
  const { data: tables } = useGetTables();
  const { mutate: createOrder, isPending } = useCreateOrder();

  // Steps: "table" → "menu" → "success"
  const [step, setStep] = useState<"table" | "menu" | "success">("table");
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNum, setOrderNum] = useState("");

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

  const tableInfo = tables?.find((t) => t.id === selectedTable);

  const handleSubmitOrder = () => {
    if (!selectedTable || cart.length === 0) return;
    createOrder(
      {
        data: {
          type: "dine_in",
          tableId: selectedTable,
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
    setSelectedTable(null);
    setSearch("");
    setActiveCategory(null);
    setStep("table");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="p-4 bg-card/80 backdrop-blur-md border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {step === "menu" && (
            <button
              onClick={() => setStep("table")}
              className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold">
              {step === "table" ? "اختيار الطاولة" : step === "menu" ? `طاولة ${tableInfo?.number}` : "تم الطلب!"}
            </h1>
            <p className="text-xs text-primary font-display uppercase tracking-widest">
              {user?.name} — نادل
            </p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate("/login"); }}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 rounded-lg hover:bg-destructive/10"
        >
          خروج
        </button>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── STEP 1: TABLE SELECTION ── */}
        {step === "table" && (
          <div className="flex-1 overflow-y-auto p-6">
            <p className="text-muted-foreground mb-6 text-center">اختر رقم الطاولة للبدء بتسجيل الطلب</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-w-2xl mx-auto">
              {tables?.map((table) => (
                <motion.button
                  key={table.id}
                  whileHover={table.status === "available" ? { scale: 1.05 } : {}}
                  whileTap={table.status === "available" ? { scale: 0.95 } : {}}
                  disabled={table.status !== "available"}
                  onClick={() => {
                    setSelectedTable(table.id);
                    setStep("menu");
                  }}
                  className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all
                    ${table.status === "available"
                      ? "border-green-500/40 bg-green-500/10 hover:bg-green-500/20 hover:border-green-400 cursor-pointer"
                      : "border-border/30 bg-card/30 opacity-40 cursor-not-allowed"
                    }`}
                >
                  <Table2 className={`w-8 h-8 mb-2 ${table.status === "available" ? "text-green-400" : "text-muted-foreground"}`} />
                  <span className="font-bold text-lg">{table.number}</span>
                  <span className="text-xs text-muted-foreground">{table.location}</span>
                  <span className={`text-[10px] mt-1 px-2 py-0.5 rounded-full
                    ${table.status === "available" ? "bg-green-500/20 text-green-400" : "bg-secondary text-muted-foreground"}`}>
                    {TABLE_STATUS_MAP[table.status] ?? table.status}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: MENU + CART ── */}
        {step === "menu" && (
          <div className="flex-1 flex overflow-hidden">
            {/* Menu Side */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search */}
              <div className="p-4 border-b border-border/50 flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث عن صنف..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-border/50">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 transition-all
                    ${activeCategory === null ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >
                  الكل
                </button>
                {categories?.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 transition-all whitespace-nowrap
                      ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    {cat.nameAr}
                  </button>
                ))}
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
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => addToCart(item)}
                          className="bg-card/80 border border-border/50 rounded-2xl p-4 cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all relative"
                        >
                          {inCart && (
                            <div className="absolute top-2 left-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground z-10">
                              {inCart.cartQuantity}
                            </div>
                          )}
                          <div className="aspect-square rounded-xl bg-secondary/50 flex items-center justify-center mb-3 text-3xl">
                            🍽️
                          </div>
                          <h3 className="font-bold text-sm mb-0.5">{item.nameAr}</h3>
                          <p className="text-primary font-bold font-display">{formatIQD(Number(item.price))} د.ع</p>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Cart Side */}
            <div className="w-80 border-r border-border/50 flex flex-col bg-card/30 backdrop-blur-sm">
              <div className="p-4 border-b border-border/50">
                <h2 className="font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  قائمة الطلب
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <AnimatePresence>
                  {cart.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-secondary/50 rounded-xl p-3"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold text-sm flex-1">{item.nameAr}</p>
                        <button onClick={() => updateQty(item.id, -item.cartQuantity)} className="text-destructive/70 hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-primary font-display">
                          {formatIQD(item.price * item.cartQuantity)} د.ع
                        </span>
                        <div className="flex items-center gap-1 bg-background/50 rounded-lg p-0.5">
                          <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-secondary rounded-md">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-bold text-sm">{item.cartQuantity}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 flex items-center justify-center hover:bg-secondary rounded-md text-primary">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {cart.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
                    <ShoppingCart className="w-12 h-12 mb-3" />
                    <p className="text-sm">لم يتم اختيار أصناف بعد</p>
                  </div>
                )}
              </div>

              {/* Summary + Submit */}
              <div className="p-4 border-t border-border/50 space-y-3">
                <div className="space-y-1 text-sm">
                  {cart.map((i) => (
                    <div key={i.id} className="flex justify-between text-muted-foreground text-xs">
                      <span>{i.nameAr} × {i.cartQuantity}</span>
                      <span>{formatIQD(i.price * i.cartQuantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold text-lg border-t border-border/50 pt-2">
                  <span>الإجمالي</span>
                  <span className="text-primary font-display">{formatIQD(subtotal)} د.ع</span>
                </div>
                <Button
                  className="w-full h-12 text-base"
                  disabled={cart.length === 0}
                  isLoading={isPending}
                  onClick={handleSubmitOrder}
                >
                  إرسال الطلب للكاشير
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: SUCCESS ── */}
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
                <p className="text-muted-foreground mt-1">رقم الطلب: <span className="font-display font-bold text-primary">{orderNum}</span></p>
              )}
              <p className="text-muted-foreground mt-2">سيقوم الكاشير بمراجعة الطلب وإرساله للمطبخ</p>
            </motion.div>

            <div className="bg-card/60 rounded-2xl p-5 border border-border/50 w-full max-w-sm text-right space-y-2">
              <p className="text-sm font-bold text-muted-foreground mb-3">تفاصيل الطلب — طاولة {tableInfo?.number}</p>
              {cart.map((i) => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span className="text-primary font-display">{formatIQD(i.price * i.cartQuantity)}</span>
                  <span>{i.nameAr} × {i.cartQuantity}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold pt-2 border-t border-border/50">
                <span className="text-primary font-display text-lg">{formatIQD(subtotal)} د.ع</span>
                <span>الإجمالي</span>
              </div>
            </div>

            <Button onClick={resetOrder} variant="outline" className="gap-2 h-12 px-8">
              <RefreshCw className="w-4 h-4" />
              طلب جديد
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
