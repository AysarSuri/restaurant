import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetMenuItems,
  useGetMenuCategories,
  useCreateOrder,
  useGetSettings,
  useGetTables,
  lookupDeliveryPhone,
  upsertDeliveryContact,
} from "@workspace/api-client-react";
import { Button, Card, Input, Badge, Dialog } from "@/components/ui-elements";
import {
  ShoppingCart, Search, Trash2, Plus, Minus, CreditCard,
  Banknote, ChefHat, ArrowLeft, Table2, MapPin, Phone, RefreshCw, X,
  Clock, CheckCircle2, XCircle, Percent,
} from "lucide-react";
import type { MenuItem } from "@workspace/api-client-react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useCurrency } from "@/hooks/use-currency";
import { useBranch } from "@/lib/branch-context";
import { BranchSwitcher } from "@/components/branch-switcher";
import { NumericKeypad } from "@/components/numeric-keypad";

const INVOICE_SEQ_KEY = "rms-invoice-seq";

function readInvoiceSeq(): number {
  try {
    const n = Number(localStorage.getItem(INVOICE_SEQ_KEY) || "1");
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  } catch {
    return 1;
  }
}

function writeInvoiceSeq(n: number) {
  try {
    localStorage.setItem(INVOICE_SEQ_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function formatInvoice(n: number) {
  return `INV-${n}`;
}

/** Current invoice without bumping (first list = INV-1). */
function currentInvoiceNumber() {
  return formatInvoice(readInvoiceSeq());
}

/** Next list after completing an order. */
function nextInvoiceNumber() {
  const next = readInvoiceSeq() + 1;
  writeInvoiceSeq(next);
  return formatInvoice(next);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatClock(date: Date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function formatDateAr(date: Date) {
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

interface CartItem extends MenuItem {
  cartQuantity: number;
  price: number;
}

type OrderType = "dine_in" | "takeaway" | "delivery";

export default function POS() {
  const { data: categories } = useGetMenuCategories();
  const { data: items } = useGetMenuItems({ available: true });
  const { data: tables } = useGetTables();
  const { data: appSettings } = useGetSettings();
  const { mutate: createOrder, isPending: isCreating } = useCreateOrder();
  const posSaveTarget = appSettings?.posSaveTarget === "kitchen" ? "kitchen" : "cashier";

  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  /** null = not checked yet / too short; true = found; false = not found */
  const [phoneKnown, setPhoneKnown] = useState<boolean | null>(null);
  const phoneLookupSeq = useRef(0);
  const [discount, setDiscount] = useState(0);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [isDiscountPadOpen, setIsDiscountPadOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(() => currentInvoiceNumber());
  const [now, setNow] = useState(() => new Date());
  const { isCompactPos, isPortrait, width } = useBreakpoint();
  const { selectedBranchId, branchLabel } = useBranch();
  const {
    format: formatMoneyAmount,
    formatValue,
    symbol: currencySymbol,
    decimalPlaces,
  } = useCurrency();
  const isPortraitPos = !isCompactPos && isPortrait;
  const isWidePos = !isCompactPos && !isPortrait && width >= 1400;
  const needsBranchPick = selectedBranchId === "all";

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const startNewOrderSession = () => {
    setInvoiceNumber(nextInvoiceNumber());
  };

  const formatIQD = (val: number) => formatValue(val);

  const liveClock = formatClock(now);
  const liveDate = formatDateAr(now);

  const filteredItems = items?.filter(
    (item) =>
      (!activeCategory || item.categoryId === activeCategory) &&
      (item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.nameAr.includes(search))
  );

  const availableTables = tables?.filter((t) => t.status === "available");
  const selectedTable = tables?.find((t) => t.id === selectedTableId);

  const addToCart = (item: MenuItem) => {
    if (needsBranchPick) return;
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
    setPhoneKnown(null);
    setDiscount(0);
    setIsCheckoutOpen(false);
    setOrderSuccess(false);
    startNewOrderSession();
  };

  useEffect(() => {
    if (orderType !== "delivery") {
      setPhoneKnown(null);
      return;
    }
    const digits = deliveryPhone.replace(/\D/g, "");
    if (digits.length < 7) {
      setPhoneKnown(null);
      return;
    }
    const seq = ++phoneLookupSeq.current;
    const timer = window.setTimeout(() => {
      lookupDeliveryPhone(deliveryPhone)
        .then((res) => {
          if (seq !== phoneLookupSeq.current) return;
          setPhoneKnown(Boolean(res.found));
          if (res.found && res.contact?.address) {
            setDeliveryAddress(res.contact.address);
          }
        })
        .catch(() => {
          if (seq !== phoneLookupSeq.current) return;
          setPhoneKnown(null);
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [deliveryPhone, orderType]);

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
          if (orderType === "delivery" && deliveryPhone.replace(/\D/g, "").length >= 7) {
            upsertDeliveryContact({
              phone: deliveryPhone,
              address: deliveryAddress.trim(),
            }).catch(() => {
              /* non-blocking */
            });
          }
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

  const cartPanel = (compact: boolean) => (
      <div
        className={`pos-order-pane ${
          compact
            ? "h-full"
            : isPortraitPos
              ? "h-full w-full min-w-0"
              : "h-full w-full min-w-[360px]"
        } bg-card/90 backdrop-blur-xl border-s border-border/60 flex flex-col z-20 shadow-[-12px_0_40px_rgba(0,0,0,0.12)] relative`}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-primary via-amber-400 to-transparent" />
        <div className={`border-b border-border/50 space-y-3 sm:space-y-4 ${isPortraitPos && !compact ? "p-5 xl:p-6" : "p-4 sm:p-5"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-display tracking-[0.2em] uppercase text-primary mb-0.5">
                {isPortraitPos && !compact ? "Order Screen" : "Current Order"}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`font-extrabold flex items-center min-w-0 ${isPortraitPos && !compact ? "text-2xl xl:text-3xl" : "text-lg sm:text-xl"}`}>
                  <ShoppingCart className={`me-2 text-primary flex-shrink-0 ${isPortraitPos && !compact ? "w-6 h-6" : "w-5 h-5"}`} />
                  <span className="truncate">{isPortraitPos && !compact ? "شاشة الطلب" : "الطلب الحالي"}</span>
                </h2>
                <span
                  className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary font-display tabular-nums"
                  dir="ltr"
                  title="رقم القائمة"
                >
                  {invoiceNumber}
                </span>
                {orderType === "dine_in" && (
                  <button
                    type="button"
                    onClick={() => setIsTablePickerOpen(true)}
                    className={`inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-2 text-sm font-extrabold transition-all max-w-[14rem] ${
                      selectedTable
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                    }`}
                    title={selectedTable ? selectedTable.location || undefined : "اختر رقم الطاولة"}
                  >
                    <Table2 className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate">
                      {selectedTable ? `طاولة ${selectedTable.number}` : "اختر رقم الطاولة"}
                    </span>
                  </button>
                )}
              </div>
            </div>
            {compact && (
              <button
                onClick={() => setCartOpen(false)}
                className="touch-target w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

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

          <AnimatePresence>
            {/* Delivery fields */}
            {orderType === "delivery" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="relative">
                  <Phone
                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      phoneKnown === true
                        ? "text-success"
                        : phoneKnown === false
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  />
                  <Input
                    placeholder="رقم الهاتف"
                    value={deliveryPhone}
                    onChange={(e) => setDeliveryPhone(e.target.value)}
                    className={`pr-10 pl-10 text-sm border-2 ${
                      phoneKnown === true
                        ? "border-success/60 focus-visible:border-success"
                        : phoneKnown === false
                          ? "border-destructive/60 focus-visible:border-destructive"
                          : ""
                    }`}
                    dir="ltr"
                  />
                  {phoneKnown === true ? (
                    <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-success" />
                  ) : phoneKnown === false ? (
                    <XCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-destructive" />
                  ) : null}
                </div>
                {phoneKnown === true ? (
                  <p className="text-[11px] text-success font-semibold">رقم محفوظ — تم تعبئة العنوان تلقائياً</p>
                ) : phoneKnown === false ? (
                  <p className="text-[11px] text-destructive font-semibold">رقم جديد — سيُحفظ مع الطلب</p>
                ) : null}
                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="عنوان التوصيل"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="pr-10 text-sm"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Cart Items — single-row professional lines */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          <AnimatePresence>
            {cart.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="group flex items-center gap-2 sm:gap-2.5 rounded-2xl border border-border/50 bg-gradient-to-l from-secondary/70 via-card/80 to-card/90 px-2.5 py-2 shadow-[0_6px_18px_-14px_rgba(0,0,0,0.45)] hover:border-primary/35 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold leading-tight">{item.nameAr}</p>
                </div>

                <div className="flex flex-shrink-0 items-center gap-0.5 rounded-xl border border-border/60 bg-background/70 p-0.5">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, -1)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-secondary transition-colors"
                    aria-label="إنقاص"
                  >
                    <Minus className="w-4.5 h-4.5" />
                  </button>
                  <span className="min-w-[1.85rem] text-center font-display font-extrabold text-base tabular-nums">
                    {item.cartQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-primary hover:bg-primary/15 transition-colors"
                    aria-label="زيادة"
                  >
                    <Plus className="w-4.5 h-4.5" />
                  </button>
                </div>

                <span className="flex-shrink-0 font-display text-xs sm:text-sm font-bold text-primary tabular-nums whitespace-nowrap" dir="ltr">
                  {formatMoneyAmount(item.price * item.cartQuantity)}
                </span>

                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, -item.cartQuantity)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-destructive/25 text-destructive hover:bg-destructive/15 transition-colors"
                  aria-label="حذف"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
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
          {/* Discount — opens numeric keypad */}
          <button
            type="button"
            onClick={() => setIsDiscountPadOpen(true)}
            className="w-full flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/60 hover:border-primary/40 hover:bg-primary/5 px-3 py-2 transition-colors text-start"
          >
            <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
              <Percent className="w-4 h-4" />
            </span>
            <span className="text-sm text-muted-foreground whitespace-nowrap">خصم ({currencySymbol})</span>
            <span
              className="ms-auto font-display text-sm font-extrabold tabular-nums text-foreground"
              dir="ltr"
            >
              {discount > 0 ? formatMoneyAmount(discount) : "0"}
            </span>
          </button>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>المجموع</span>
              <span className="font-display">{formatMoneyAmount(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-500">
                <span>الخصم</span>
                <span className="font-display">- {formatMoneyAmount(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xl text-foreground pt-2 border-t border-border/50">
              <span>الإجمالي</span>
              <span className="text-primary font-display">{formatMoneyAmount(total)}</span>
            </div>
          </div>

          <Button
            className="w-full h-12 sm:h-14 text-base sm:text-lg touch-target"
            disabled={
              cart.length === 0 ||
              (orderType === "dine_in" && !selectedTableId)
            }
            onClick={() => {
              setCartOpen(false);
              setIsCheckoutOpen(true);
            }}
          >
            {orderType === "dine_in" && !selectedTableId
              ? "اختر طاولة أولاً"
              : "دفع وإصدار الفاتورة"}
          </Button>
        </div>
      </div>
  );

  return (
    <div
      className={`h-app w-full bg-background overflow-hidden text-foreground ${
        isCompactPos
          ? "pos-compact"
          : `pos-expansive pos-expansive-xl${isPortraitPos ? " pos-portrait" : ""}`
      }`}
    >
      {/* ── Menu (RIGHT in RTL) ── */}
      <div className="pos-menu-pane min-w-0 min-h-0 flex flex-col h-full overflow-hidden relative">
        {!isPortraitPos && (
          <>
            <div className="absolute inset-0 bg-gradient-to-bl from-primary/8 via-transparent to-amber-500/5 pointer-events-none" />
            <img
              src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-[0.07] pointer-events-none"
            />
          </>
        )}

        <header
          className={`relative z-10 flex flex-col gap-3 border-b border-border/50 bg-card/60 backdrop-blur-xl ${
            isPortraitPos
              ? "p-4 xl:p-5"
              : "p-3 sm:p-4 md:p-5 xl:p-6 sm:flex-row sm:items-center sm:justify-between"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="icon" className="touch-target flex-shrink-0" onClick={() => window.history.back()}>
              <ArrowLeft />
            </Button>
            <div className="min-w-0">
              <h1 className={`font-extrabold truncate ${isPortraitPos ? "text-2xl xl:text-3xl" : "text-lg sm:text-xl md:text-2xl xl:text-3xl"}`}>
                نقطة البيع
              </h1>
              <p className="text-xs sm:text-sm text-primary font-display tracking-widest uppercase truncate">
                {branchLabel} · {isPortraitPos ? "شاشة الأصناف" : "POS"}
              </p>
            </div>
            <BranchSwitcher compact />
            <div className="hidden md:flex flex-col items-end leading-tight ms-1 flex-shrink-0 rounded-xl border border-border/60 bg-secondary/50 px-3 py-1.5">
              <span className="text-[10px] text-muted-foreground">{liveDate}</span>
              <span className="font-display font-extrabold text-sm text-primary tabular-nums" dir="ltr">
                {liveClock}
              </span>
            </div>
          </div>
          <div className={`relative w-full ${isPortraitPos ? "max-w-none" : "sm:w-72 md:w-80 xl:w-96"}`}>
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="ابحث عن صنف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-12 h-11 xl:h-12 bg-background/80 border-border/50"
            />
          </div>
        </header>

        <div className={`py-3 flex gap-2 sm:gap-3 overflow-x-auto relative z-10 scrollbar-hide ${isPortraitPos ? "px-4 xl:px-5" : "px-3 sm:px-5 xl:px-6"}`}>
          <Button
            variant={activeCategory === null ? "default" : "secondary"}
            onClick={() => setActiveCategory(null)}
            className="rounded-full px-4 sm:px-6 flex-shrink-0 touch-target"
          >
            الكل
          </Button>
          {categories?.map((cat) => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? "default" : "secondary"}
              onClick={() => setActiveCategory(cat.id)}
              className="rounded-full px-4 sm:px-6 whitespace-nowrap flex-shrink-0 touch-target"
            >
              {cat.nameAr}
            </Button>
          ))}
        </div>

        <div className={`flex-1 overflow-y-auto relative z-10 ${isCompactPos ? "pb-28 p-3 sm:p-4" : isPortraitPos ? "p-4 xl:p-5" : "p-3 sm:p-4 md:p-5 xl:p-6"}`}>
          {needsBranchPick && (
            <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
              أنت تشاهد «كل الفروع». اختر فرعاً محدداً من الأعلى قبل البيع أو إنشاء طلب.
            </div>
          )}
          <div
            className={`grid gap-3 md:gap-4 ${
              isCompactPos
                ? "grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3"
                : isPortraitPos
                  ? "grid-cols-2 xl:grid-cols-3"
                  : isWidePos
                    ? "grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            }`}
          >
            <AnimatePresence mode="popLayout">
              {filteredItems?.map((item) => {
                const inCart = cart.find((c) => c.id === item.id);
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => addToCart(item)}
                    className={`text-start bg-card/85 backdrop-blur-sm border rounded-2xl p-3 sm:p-4 cursor-pointer flex flex-col justify-between transition-all relative overflow-hidden
                      ${
                        inCart
                          ? "border-primary/70 shadow-lg shadow-primary/15 ring-1 ring-primary/30"
                          : "border-border/50 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10"
                      }`}
                  >
                    {inCart && (
                      <div className="absolute top-2 left-2 min-w-7 h-7 px-1.5 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground z-10 shadow-md">
                        {inCart.cartQuantity}
                      </div>
                    )}
                    <div className="w-full aspect-[4/3] sm:aspect-square rounded-xl bg-gradient-to-br from-secondary to-secondary/40 mb-2 sm:mb-3 flex items-center justify-center overflow-hidden">
                      <ChefHat className="w-10 h-10 sm:w-12 sm:h-12 text-primary/40" />
                    </div>
                    <div className="mt-auto">
                      <h3 className="font-extrabold text-sm sm:text-base leading-tight mb-1 line-clamp-2">{item.nameAr}</h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-display mb-2 hidden sm:block truncate">{item.name}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-primary font-extrabold font-display text-sm sm:text-lg">
                          {formatIQD(Number(item.price))}
                          <span className="text-[10px] ms-1 font-bold opacity-70">{currencySymbol}</span>
                        </div>
                        <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                          <Plus className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Current order (LEFT in RTL) ── */}
      <aside className="pos-order-aside min-h-0 h-full overflow-hidden flex flex-col">
        {cartPanel(false)}
      </aside>

      {/* Compact cart FAB — phones / small tablets only */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="pos-cart-fab fixed bottom-4 left-1/2 -translate-x-1/2 z-30 hidden items-center gap-3 px-5 py-3 rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/30 font-bold safe-pb"
      >
        <ShoppingCart className="w-5 h-5" />
        <span>السلة ({cart.reduce((n, i) => n + i.cartQuantity, 0)})</span>
        <span className="font-display">{formatMoneyAmount(total)}</span>
      </button>

      {/* Compact cart sheet */}
      <AnimatePresence>
        {cartOpen && isCompactPos && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setCartOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-x-0 bottom-0 top-[10%] z-50 overflow-hidden rounded-t-3xl"
            >
              {cartPanel(true)}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Table Picker Dialog ── */}
      <Dialog
        isOpen={isTablePickerOpen}
        onClose={() => setIsTablePickerOpen(false)}
        title="اختر الطاولة"
      >
        <div className="mb-4 text-sm text-muted-foreground">
          الطاولات المتاحة — انقر لاختيار الطاولة
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto">
          {tables?.map((table) => (
            <button
              key={table.id}
              disabled={table.status !== "available"}
              onClick={() => {
                setSelectedTableId(table.id);
                setIsTablePickerOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all font-semibold touch-target
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
              <span className="text-base sm:text-lg">طاولة {table.number}</span>
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
            <p className="text-lg font-bold">
              {posSaveTarget === "kitchen"
                ? "تم إرسال الطلب لشاشة المطبخ!"
                : "تم إرسال الطلب لشاشة الكاشير!"}
            </p>
            <p className="text-sm text-muted-foreground font-display" dir="ltr">
              {invoiceNumber}
            </p>
            {selectedTable && (
              <p className="text-muted-foreground">طاولة رقم {selectedTable.number}</p>
            )}
            <p className="text-2xl font-bold text-primary font-display">
              {formatMoneyAmount(total)}
            </p>
            <Button className="w-full touch-target" onClick={resetOrder}>
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
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
              <Button
                variant="outline"
                className="h-20 sm:h-24 flex flex-col gap-2 touch-target"
                onClick={() => handleCheckout("cash")}
                isLoading={isCreating}
              >
                <Banknote className="w-7 h-7 sm:w-8 sm:h-8 text-green-500" />
                <span>كاش</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 sm:h-24 flex flex-col gap-2 touch-target"
                onClick={() => handleCheckout("card")}
                isLoading={isCreating}
              >
                <CreditCard className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
                <span>بطاقة</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 sm:h-24 flex flex-col gap-2 touch-target"
                onClick={() => handleCheckout("transfer")}
                isLoading={isCreating}
              >
                <Phone className="w-7 h-7 sm:w-8 sm:h-8 text-purple-500" />
                <span>تحويل</span>
              </Button>
            </div>
            <div className="bg-secondary/50 p-4 rounded-xl text-center">
              <p className="text-sm text-muted-foreground mb-1">المبلغ المطلوب</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary font-display">
                {formatMoneyAmount(total)}
              </p>
            </div>
          </>
        )}
      </Dialog>

      <Dialog
        isOpen={isDiscountPadOpen}
        onClose={() => setIsDiscountPadOpen(false)}
        title="خصم الفاتورة"
        maxWidth="max-w-sm"
        layer="overlay"
      >
        <NumericKeypad
          value={discount}
          suffix={currencySymbol}
          allowDecimal={decimalPlaces > 0}
          maxDecimalPlaces={decimalPlaces}
          maxValue={subtotal > 0 ? subtotal : undefined}
          label="أدخل مبلغ الخصم"
          onCancel={() => setIsDiscountPadOpen(false)}
          onConfirm={(v) => {
            setDiscount(Math.max(0, Math.min(v, subtotal || v)));
            setIsDiscountPadOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}
