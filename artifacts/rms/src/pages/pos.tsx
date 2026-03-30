import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMenuItems, useGetMenuCategories, useCreateOrder, useGetTables } from "@workspace/api-client-react";
import { Button, Card, Input, Badge, Dialog } from "@/components/ui-elements";
import {
  ShoppingCart, Search, Trash2, Plus, Minus, CreditCard,
  Banknote, ChefHat, ArrowLeft, Table2, MapPin, Phone, RefreshCw
} from "lucide-react";
import type { MenuItem } from "@workspace/api-client-react/src/generated/api.schemas";

interface CartItem extends MenuItem {
  cartQuantity: number;
  price: number;
}

type OrderType = "dine_in" | "takeaway" | "delivery";

export default function POS() {
  const { data: categories } = useGetMenuCategories();
  const { data: items } = useGetMenuItems({ available: true });
  const { data: tables } = useGetTables();
  const { mutate: createOrder, isPending: isCreating } = useCreateOrder();

  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const formatIQD = (val: number) =>
    new Intl.NumberFormat("en-IQ").format(Math.round(val));

  const filteredItems = items?.filter(
    (item) =>
      (!activeCategory || item.categoryId === activeCategory) &&
      (item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.nameAr.includes(search))
  );

  const availableTables = tables?.filter((t) => t.status === "available");
  const selectedTable = tables?.find((t) => t.id === selectedTableId);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing)
        return prev.map((i) =>
          i.id === item.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i
        );
      return [...prev, { ...item, price: Number(item.price), cartQuantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const newQ = i.cartQuantity + delta;
            return newQ > 0 ? { ...i, cartQuantity: newQ } : i;
          }
          return i;
        })
        .filter((i) => i.cartQuantity > 0)
    );
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.cartQuantity,
    0
  );
  const total = Math.max(0, subtotal - discount);

  const resetOrder = () => {
    setCart([]);
    setSelectedTableId(null);
    setDeliveryAddress("");
    setDeliveryPhone("");
    setDiscount(0);
    setIsCheckoutOpen(false);
    setOrderSuccess(false);
  };

  const handleCheckout = (paymentMethod: "cash" | "card" | "transfer") => {
    createOrder(
      {
        data: {
          type: orderType,
          tableId: orderType === "dine_in" ? selectedTableId ?? undefined : undefined,
          items: cart.map((i) => ({ menuItemId: i.id, quantity: i.cartQuantity })),
          discount: discount || undefined,
          deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
          deliveryPhone: orderType === "delivery" ? deliveryPhone : undefined,
          paymentMethod,
        } as any,
      },
      {
        onSuccess: () => {
          setOrderSuccess(true);
        },
      }
    );
  };

  const orderTypeLabels: Record<OrderType, string> = {
    dine_in: "طاولة",
    takeaway: "سفري",
    delivery: "توصيل",
  };

  const statusColor = (status: string) => {
    if (status === "available") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (status === "occupied") return "bg-red-500/20 text-red-400 border-red-500/30";
    if (status === "reserved") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const statusLabel = (status: string) => {
    if (status === "available") return "متاحة";
    if (status === "occupied") return "مشغولة";
    if (status === "reserved") return "محجوزة";
    return "تنظيف";
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      {/* ── Menu Side ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
          alt="bg"
          className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
        />

        <header className="p-6 relative z-10 flex justify-between items-center bg-card/50 backdrop-blur-md border-b border-border/50">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">نقطة البيع</h1>
              <p className="text-sm text-primary font-display tracking-widest uppercase">POS System</p>
            </div>
          </div>
          <div className="relative w-72">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="ابحث عن صنف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-12 bg-background/80 border-border/50"
            />
          </div>
        </header>

        {/* Categories */}
        <div className="px-6 py-4 flex gap-3 overflow-x-auto relative z-10 scrollbar-hide">
          <Button
            variant={activeCategory === null ? "default" : "secondary"}
            onClick={() => setActiveCategory(null)}
            className="rounded-full px-6 flex-shrink-0"
          >
            الكل
          </Button>
          {categories?.map((cat) => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? "default" : "secondary"}
              onClick={() => setActiveCategory(cat.id)}
              className="rounded-full px-6 whitespace-nowrap flex-shrink-0"
            >
              {cat.nameAr}
            </Button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => addToCart(item)}
                    className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4 cursor-pointer flex flex-col justify-between hover:border-primary/60 hover:shadow-xl hover:shadow-primary/10 transition-all relative"
                  >
                    {inCart && (
                      <div className="absolute top-2 left-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground z-10">
                        {inCart.cartQuantity}
                      </div>
                    )}
                    <div className="w-full aspect-square rounded-xl bg-secondary/50 mb-4 flex items-center justify-center overflow-hidden">
                      <div className="text-4xl">🍽️</div>
                    </div>
                    <div>
                      <h3 className="font-bold text-base leading-tight mb-1">{item.nameAr}</h3>
                      <p className="text-xs text-muted-foreground font-display mb-3">{item.name}</p>
                      <div className="text-primary font-bold font-display text-lg">
                        {formatIQD(Number(item.price))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Cart Side ── */}
      <div className="w-96 glass-panel border-r border-border/50 flex flex-col z-20 shadow-2xl relative">
        <div className="p-5 border-b border-border/50 space-y-4">
          <h2 className="text-xl font-bold flex items-center">
            <ShoppingCart className="w-5 h-5 me-2 text-primary" />
            الطلب الحالي
          </h2>

          {/* Order Type Switch */}
          <div className="flex bg-secondary p-1 rounded-xl">
            {(["dine_in", "takeaway", "delivery"] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setOrderType(type);
                  setSelectedTableId(null);
                }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  orderType === type
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {orderTypeLabels[type]}
              </button>
            ))}
          </div>

          {/* Table Selector — only when dine_in */}
          <AnimatePresence>
            {orderType === "dine_in" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <button
                  onClick={() => setIsTablePickerOpen(true)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                    selectedTable
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Table2 className="w-5 h-5" />
                    <span className="font-semibold">
                      {selectedTable
                        ? `طاولة رقم ${selectedTable.number}`
                        : "اختر رقم الطاولة"}
                    </span>
                  </div>
                  {selectedTable && (
                    <span className="text-xs text-muted-foreground">
                      {selectedTable.location}
                    </span>
                  )}
                </button>
              </motion.div>
            )}

            {/* Delivery fields */}
            {orderType === "delivery" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="عنوان التوصيل"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="pr-10 text-sm"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="رقم الهاتف"
                    value={deliveryPhone}
                    onChange={(e) => setDeliveryPhone(e.target.value)}
                    className="pr-10 text-sm"
                    dir="ltr"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence>
            {cart.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-secondary/50 border border-border/30 rounded-xl p-3 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm">{item.nameAr}</p>
                    <p className="text-xs text-muted-foreground font-display">
                      {formatIQD(item.price * item.cartQuantity)} د.ع
                    </p>
                  </div>
                  <button
                    onClick={() => updateQuantity(item.id, -item.cartQuantity)}
                    className="text-destructive hover:bg-destructive/20 p-1 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between bg-background/50 rounded-lg p-1">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-secondary rounded-md"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold font-display w-8 text-center">
                    {item.cartQuantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-secondary rounded-md text-primary"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-16">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p>السلة فارغة</p>
            </div>
          )}
        </div>

        {/* Summary & Checkout */}
        <div className="p-5 bg-card border-t border-border/50 space-y-4">
          {/* Discount */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">خصم (د.ع)</span>
            <Input
              type="number"
              min={0}
              value={discount || ""}
              onChange={(e) => setDiscount(Number(e.target.value))}
              placeholder="0"
              className="text-sm h-8"
              dir="ltr"
            />
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>المجموع</span>
              <span className="font-display">{formatIQD(subtotal)} د.ع</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-500">
                <span>الخصم</span>
                <span className="font-display">- {formatIQD(discount)} د.ع</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xl text-foreground pt-2 border-t border-border/50">
              <span>الإجمالي</span>
              <span className="text-primary font-display">{formatIQD(total)} د.ع</span>
            </div>
          </div>

          <Button
            className="w-full h-14 text-lg"
            disabled={
              cart.length === 0 ||
              (orderType === "dine_in" && !selectedTableId)
            }
            onClick={() => setIsCheckoutOpen(true)}
          >
            {orderType === "dine_in" && !selectedTableId
              ? "اختر طاولة أولاً"
              : "دفع وإصدار الفاتورة"}
          </Button>
        </div>
      </div>

      {/* ── Table Picker Dialog ── */}
      <Dialog
        isOpen={isTablePickerOpen}
        onClose={() => setIsTablePickerOpen(false)}
        title="اختر الطاولة"
      >
        <div className="mb-4 text-sm text-muted-foreground">
          الطاولات المتاحة — انقر لاختيار الطاولة
        </div>
        <div className="grid grid-cols-3 gap-3 max-h-80 overflow-y-auto">
          {tables?.map((table) => (
            <button
              key={table.id}
              disabled={table.status !== "available"}
              onClick={() => {
                setSelectedTableId(table.id);
                setIsTablePickerOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all font-semibold
                ${
                  selectedTableId === table.id
                    ? "border-primary bg-primary/10 text-primary"
                    : table.status === "available"
                    ? "border-border hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                    : "border-border/30 opacity-40 cursor-not-allowed"
                }
              `}
            >
              <Table2 className="w-6 h-6 mb-1" />
              <span className="text-lg">طاولة {table.number}</span>
              <span className="text-xs mt-1 text-muted-foreground">{table.location}</span>
              <span className={`text-[10px] mt-1 px-2 py-0.5 rounded-full border ${statusColor(table.status)}`}>
                {statusLabel(table.status)}
              </span>
            </button>
          ))}
        </div>
      </Dialog>

      {/* ── Payment Dialog ── */}
      <Dialog
        isOpen={isCheckoutOpen}
        onClose={() => !orderSuccess && setIsCheckoutOpen(false)}
        title={orderSuccess ? "✅ تم الطلب بنجاح" : "اختر طريقة الدفع"}
      >
        {orderSuccess ? (
          <div className="text-center py-4 space-y-4">
            <div className="text-6xl">🎉</div>
            <p className="text-lg font-bold">تم إرسال الطلب للمطبخ!</p>
            {selectedTable && (
              <p className="text-muted-foreground">طاولة رقم {selectedTable.number}</p>
            )}
            <p className="text-2xl font-bold text-primary font-display">
              {formatIQD(total)} د.ع
            </p>
            <Button className="w-full" onClick={resetOrder}>
              <RefreshCw className="w-4 h-4 me-2" />
              طلب جديد
            </Button>
          </div>
        ) : (
          <>
            {orderType === "dine_in" && selectedTable && (
              <div className="mb-4 px-4 py-2 bg-primary/10 rounded-xl text-primary text-sm font-semibold flex items-center gap-2">
                <Table2 className="w-4 h-4" />
                طاولة رقم {selectedTable.number} — {selectedTable.location}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Button
                variant="outline"
                className="h-24 flex flex-col gap-2"
                onClick={() => handleCheckout("cash")}
                isLoading={isCreating}
              >
                <Banknote className="w-8 h-8 text-green-500" />
                <span>كاش</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex flex-col gap-2"
                onClick={() => handleCheckout("card")}
                isLoading={isCreating}
              >
                <CreditCard className="w-8 h-8 text-blue-500" />
                <span>بطاقة</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex flex-col gap-2"
                onClick={() => handleCheckout("transfer")}
                isLoading={isCreating}
              >
                <Phone className="w-8 h-8 text-purple-500" />
                <span>تحويل</span>
              </Button>
            </div>
            <div className="bg-secondary/50 p-4 rounded-xl text-center">
              <p className="text-sm text-muted-foreground mb-1">المبلغ المطلوب</p>
              <p className="text-3xl font-bold text-primary font-display">
                {formatIQD(total)} د.ع
              </p>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
