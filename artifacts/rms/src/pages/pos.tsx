import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetMenuItems,
  useGetMenuCategories,
  useCreateOrder,
  useGetSettings,
  useGetTables,
  useUpdateTable,
  useGetCards,
  useGetBranches,
  useGetDevicePrinters,
  getGetTablesQueryKey,
  lookupDeliveryPhone,
  upsertDeliveryContact,
  type RestaurantTable,
} from "@workspace/api-client-react";
import { Button, Card, Badge, Dialog } from "@/components/ui-elements";
import {
  ShoppingCart, Search, Trash2, Plus, Minus, CreditCard,
  Banknote, ChefHat, ArrowLeft, Table2, MapPin, Phone, RefreshCw, X,
  Clock, CheckCircle2, XCircle, Percent, Users, Armchair, Star,
  DoorOpen, UserRound, Lock, Wallet, Printer,
} from "lucide-react";
import type { MenuItem } from "@workspace/api-client-react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useCurrency } from "@/hooks/use-currency";
import { useBranch } from "@/lib/branch-context";
import { BranchSwitcher } from "@/components/branch-switcher";
import { NumericKeypad } from "@/components/numeric-keypad";
import { MultilingualKeyboard } from "@/components/multilingual-keyboard";
import { DiningTableIcon } from "@/components/dining-table-icon";
import { RoomIcon } from "@/components/room-icon";
import { TABLE_STATUS_META } from "@/lib/table-status";
import { getOrCreateDeviceKey } from "@/lib/device-id";
import { printThermalReceipt } from "@/lib/print-receipt";
import { toast } from "@/hooks/use-toast";

type SeatEntityType = "table" | "room" | "person";

const SEAT_TABS: {
  key: SeatEntityType;
  label: string;
  labelPlural: string;
  icon: typeof Armchair;
}[] = [
  { key: "table", label: "طاولات", labelPlural: "طاولات", icon: Armchair },
  { key: "room", label: "غرفات", labelPlural: "غرف", icon: DoorOpen },
  { key: "person", label: "أشخاص", labelPlural: "أشخاص", icon: UserRound },
];

const PERSON_STATUS_META = {
  available: {
    label: "موجود",
    chip: "bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/40",
    card: "bg-emerald-500/10",
    ring: "ring-emerald-500/70 border-emerald-500",
    glow: "from-emerald-500/45 via-emerald-400/15 to-transparent",
  },
  occupied: {
    label: "مو موجود",
    chip: "bg-slate-500 text-white border-slate-600 shadow-sm shadow-slate-500/40",
    card: "bg-slate-500/10",
    ring: "ring-slate-500/70 border-slate-500",
    glow: "from-slate-500/45 via-slate-400/15 to-transparent",
  },
} as const;

const personPresence = (status: string): "available" | "occupied" =>
  status === "available" ? "available" : "occupied";

const personInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
};

function seatLabel(seat: { type?: string | null; number: string | number } | undefined | null) {
  if (!seat) return "اختر رقم الطاولة";
  const type = (seat.type ?? "table") as SeatEntityType;
  if (type === "person") return String(seat.number);
  if (type === "room") return `غرفة ${seat.number}`;
  return `طاولة ${seat.number}`;
}

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
  const { selectedBranchId, branchLabel } = useBranch();
  const { data: categories } = useGetMenuCategories();
  const { data: items } = useGetMenuItems({ available: true });
  const { data: tables, refetch: refetchTables } = useGetTables({
    query: {
      queryKey: [...getGetTablesQueryKey(), selectedBranchId],
    },
  });
  const { data: appSettings } = useGetSettings();
  const { data: paymentCards } = useGetCards();
  const { data: branches } = useGetBranches();
  const { data: devicePrinters } = useGetDevicePrinters();
  const { mutate: createOrder, isPending: isCreating } = useCreateOrder();
  const { mutate: updateTable, isPending: isUpdatingPerson } = useUpdateTable();
  const posSaveTarget =
    appSettings?.posSaveTarget === "kitchen" || appSettings?.posSaveTarget === "none"
      ? appSettings.posSaveTarget
      : "cashier";
  const isDirectSave = posSaveTarget === "none";
  const deviceKey = useMemo(() => getOrCreateDeviceKey(), []);

  const currentBranch = useMemo(() => {
    if (selectedBranchId === "all") return null;
    return (branches ?? []).find((b) => b.id === selectedBranchId) ?? null;
  }, [branches, selectedBranchId]);

  const devicePrinter = useMemo(() => {
    const list = devicePrinters ?? [];
    return (
      list.find((p) => p.deviceKey === deviceKey && p.isActive !== false) ??
      list.find((p) => p.deviceKey === deviceKey) ??
      null
    );
  }, [devicePrinters, deviceKey]);

  const branchTables = useMemo(() => {
    const list = tables ?? [];
    if (selectedBranchId === "all") return [];
    return list.filter(
      (t) => t.branchId == null || t.branchId === selectedBranchId
    );
  }, [tables, selectedBranchId]);

  /** null = all, "favorites" = favorites only, number = category id */
  const [activeCategory, setActiveCategory] = useState<number | "favorites" | null>("favorites");
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
  const [checkoutPayMethod, setCheckoutPayMethod] = useState<"cash" | "card">("cash");
  const [checkoutReceived, setCheckoutReceived] = useState(0);
  const [checkoutCardId, setCheckoutCardId] = useState<number | null>(null);
  const [isReceivedPadOpen, setIsReceivedPadOpen] = useState(false);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [pickerEntityType, setPickerEntityType] = useState<SeatEntityType>("table");
  const [personSearch, setPersonSearch] = useState("");
  const [isPersonSearchPadOpen, setIsPersonSearchPadOpen] = useState(false);
  const [isDiscountPadOpen, setIsDiscountPadOpen] = useState(false);
  const [isPhonePadOpen, setIsPhonePadOpen] = useState(false);
  const [isAddressPadOpen, setIsAddressPadOpen] = useState(false);
  const [isSearchPadOpen, setIsSearchPadOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(() => currentInvoiceNumber());
  const [now, setNow] = useState(() => new Date());

  const seatTypeCounts = useMemo(() => {
    const base = { table: 0, room: 0, person: 0 };
    for (const t of branchTables) {
      const key = (t.type ?? "table") as SeatEntityType;
      if (key in base) base[key] += 1;
    }
    return base;
  }, [branchTables]);

  const pickerSeats = useMemo(() => {
    let list = branchTables.filter(
      (t) => (t.type ?? "table") === pickerEntityType
    );
    if (pickerEntityType === "person") {
      const q = personSearch.trim().toLowerCase();
      if (q) {
        list = list.filter((t) => {
          const name = String(t.number).toLowerCase();
          const loc = (t.location ?? "").toLowerCase();
          return name.includes(q) || loc.includes(q);
        });
      }
      return [...list].sort((a, b) =>
        String(a.number).localeCompare(String(b.number), "ar", { sensitivity: "base" })
      );
    }
    return list;
  }, [branchTables, pickerEntityType, personSearch]);

  const { isCompactPos, isPortrait, width } = useBreakpoint();
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

  const filteredItems = items
    ?.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.nameAr.includes(search);
      if (!matchesSearch) return false;
      if (activeCategory === "favorites") return item.isFavorite === true;
      if (typeof activeCategory === "number") return item.categoryId === activeCategory;
      return true;
    })
    .slice()
    .sort((a, b) => Number(b.isFavorite === true) - Number(a.isFavorite === true));

  const selectedTable = branchTables.find((t) => t.id === selectedTableId);

  useEffect(() => {
    if (selectedTableId != null && !branchTables.some((t) => t.id === selectedTableId)) {
      setSelectedTableId(null);
    }
  }, [branchTables, selectedTableId]);

  const finishPersonSelection = (personId: number) => {
    setSelectedTableId(personId);
    setPersonSearch("");
    setIsPersonSearchPadOpen(false);
    setIsTablePickerOpen(false);
  };

  /** Any person can be picked; مو موجود → موجود automatically */
  const selectPerson = (person: RestaurantTable) => {
    if (isUpdatingPerson) return;
    const markPresent = () => {
      if (personPresence(person.status) === "available") {
        finishPersonSelection(person.id);
        return;
      }
      updateTable(
        { id: person.id, data: { status: "available" } },
        {
          onSuccess: () => {
            void refetchTables();
            finishPersonSelection(person.id);
          },
          onError: () => {
            finishPersonSelection(person.id);
          },
        }
      );
    };
    markPresent();
  };

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
        .map((i) =>
          i.id === id ? { ...i, cartQuantity: i.cartQuantity + delta } : i
        )
        .filter((i) => i.cartQuantity > 0)
    );
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.cartQuantity,
    0
  );
  const total = Math.max(0, subtotal - discount);

  const branchPaymentCards = useMemo(() => {
    const list = (paymentCards ?? []).filter((c) => c.isActive !== false);
    if (selectedBranchId === "all") return list;
    return list.filter((c) => (c.branchIds ?? []).includes(selectedBranchId));
  }, [paymentCards, selectedBranchId]);

  const checkoutChange = Math.max(0, checkoutReceived - total);

  const openCheckout = () => {
    setCartOpen(false);
    setCheckoutPayMethod("cash");
    setCheckoutReceived(total);
    setCheckoutCardId(null);
    setOrderSuccess(false);
    setIsCheckoutOpen(true);
  };

  const resetOrder = () => {
    setCart([]);
    setSelectedTableId(null);
    setDeliveryAddress("");
    setDeliveryPhone("");
    setPhoneKnown(null);
    setDiscount(0);
    setCheckoutPayMethod("cash");
    setCheckoutReceived(0);
    setCheckoutCardId(null);
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

  const orderTypeLabels: Record<OrderType, string> = {
    dine_in: "طاولة",
    takeaway: "سفري",
    delivery: "توصيل",
  };

  const buildDirectReceipt = (paymentLabel: string) => {
    const nowStamp = new Date();
    return {
      restaurantName: appSettings?.restaurantName?.trim() || "المطعم",
      branchName: currentBranch?.name?.trim() || branchLabel,
      mobile1: currentBranch?.mobile1,
      mobile2: currentBranch?.mobile2,
      address: currentBranch?.address,
      logoUrl: currentBranch?.logoUrl,
      invoiceNumber,
      dateLabel: formatDateAr(nowStamp),
      timeLabel: formatClock(nowStamp),
      orderTypeLabel: orderTypeLabels[orderType],
      seatLabel: orderType === "dine_in" ? seatLabel(selectedTable) : null,
      items: cart.map((i) => ({
        name: i.nameAr || i.name,
        quantity: i.cartQuantity,
        unitPrice: i.price,
        lineTotal: i.price * i.cartQuantity,
      })),
      subtotal,
      discount,
      total,
      paymentLabel,
      received: checkoutPayMethod === "cash" ? checkoutReceived : total,
      change: checkoutPayMethod === "cash" ? Math.max(0, checkoutReceived - total) : undefined,
      formatMoney: formatMoneyAmount,
      printerName: devicePrinter?.printerName?.trim() || null,
    };
  };

  const handleCheckout = (
    paymentMethod: "cash" | "card" | "transfer",
    opts?: { cardId?: number | null; cardName?: string; print?: boolean }
  ) => {
    const cardNote =
      paymentMethod === "card" && opts?.cardName
        ? `بطاقة: ${opts.cardName}`
        : undefined;
    const paymentLabel =
      paymentMethod === "cash"
        ? "كاش"
        : paymentMethod === "card"
          ? opts?.cardName
            ? `كارت · ${opts.cardName}`
            : "كارت"
          : "تحويل";
    const receiptData = isDirectSave ? buildDirectReceipt(paymentLabel) : null;

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
          notes: cardNote,
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
          if (opts?.print && receiptData) {
            try {
              printThermalReceipt(receiptData);
              toast({
                title: "تم الحفظ والطباعة",
                description: devicePrinter?.printerName?.trim()
                  ? `ستفتح نافذة الفاتورة — اختر الطابعة «${devicePrinter.printerName.trim()}» (80×80)`
                  : "ستفتح نافذة الفاتورة — اختر طابعة 80×80 من قائمة الطابعات",
              });
            } catch {
              toast({
                variant: "destructive",
                title: "تم الحفظ",
                description:
                  "تعذر فتح نافذة الطباعة — افتح نقطة البيع في Chrome/Edge واسمح بالنوافذ المنبثقة",
              });
            }
          }
        },
      }
    );
  };

  const confirmDirectCheckout = (withPrint: boolean) => {
    if (withPrint && !devicePrinter?.printerName?.trim()) {
      toast({
        variant: "destructive",
        title: "لا توجد طابعة للجهاز",
        description: "سجّل طابعة هذا الجهاز من الإعدادات → الطابعات قبل الطباعة",
      });
      return;
    }
    if (checkoutPayMethod === "cash") {
      if (checkoutReceived < total) return;
      handleCheckout("cash", { print: withPrint });
      return;
    }
    const card = branchPaymentCards.find((c) => c.id === checkoutCardId);
    if (!card) return;
    handleCheckout("card", { cardId: card.id, cardName: card.name, print: withPrint });
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
                    onClick={() => {
                      setPickerEntityType(
                        ((selectedTable?.type ?? "table") as SeatEntityType) || "table"
                      );
                      setIsTablePickerOpen(true);
                    }}
                    className={`inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-2 text-sm font-extrabold transition-all max-w-[14rem] ${
                      selectedTable
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                    }`}
                    title={selectedTable ? selectedTable.location || undefined : "اختر رقم الطاولة"}
                  >
                    {(selectedTable?.type ?? "table") === "room" ? (
                      <DoorOpen className="w-5 h-5 flex-shrink-0" />
                    ) : (selectedTable?.type ?? "table") === "person" ? (
                      <UserRound className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <Table2 className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span className="truncate">{seatLabel(selectedTable)}</span>
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
            {orderType === "delivery" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPhonePadOpen(true)}
                    className={`min-w-0 flex-1 flex items-center gap-2 rounded-xl border-2 bg-background/60 hover:bg-primary/5 px-2.5 py-2 transition-colors text-start ${
                      phoneKnown === true
                        ? "border-success/60"
                        : phoneKnown === false
                          ? "border-destructive/60"
                          : "border-border/60 hover:border-primary/40"
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        phoneKnown === true
                          ? "bg-success/15 text-success"
                          : phoneKnown === false
                            ? "bg-destructive/15 text-destructive"
                            : "bg-primary/15 text-primary"
                      }`}
                    >
                      <Phone className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-muted-foreground">رقم الهاتف</p>
                      <p
                        className={`text-sm font-extrabold tabular-nums truncate ${
                          deliveryPhone ? "text-foreground" : "text-muted-foreground/70"
                        }`}
                        dir="ltr"
                      >
                        {deliveryPhone || "اضغط للإدخال"}
                      </p>
                    </div>
                    {phoneKnown === true ? (
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                    ) : phoneKnown === false ? (
                      <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddressPadOpen(true)}
                    className="min-w-0 flex-1 flex items-center gap-2 rounded-xl border-2 border-border/60 bg-background/60 hover:border-primary/40 hover:bg-primary/5 px-2.5 py-2 transition-colors text-start"
                  >
                    <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-muted-foreground">عنوان التوصيل</p>
                      <p
                        className={`text-sm font-extrabold truncate ${
                          deliveryAddress ? "text-foreground" : "text-muted-foreground/70"
                        }`}
                      >
                        {deliveryAddress || "اضغط للكتابة"}
                      </p>
                    </div>
                  </button>
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
          {/* Discount + subtotal on one line */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDiscountPadOpen(true)}
              className="min-w-0 flex-1 flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 hover:border-primary/40 hover:bg-primary/5 px-2.5 py-2 transition-colors text-start"
            >
              <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                <Percent className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">خصم</span>
              <span
                className={`ms-auto font-display text-xs sm:text-sm font-extrabold tabular-nums truncate ${
                  discount > 0 ? "text-green-500" : "text-foreground"
                }`}
                dir="ltr"
              >
                {discount > 0 ? `- ${formatMoneyAmount(discount)}` : "0"}
              </span>
            </button>

            <div className="min-w-0 flex-1 flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-secondary/40 px-2.5 py-2">
              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">المجموع</span>
              <span className="font-display text-xs sm:text-sm font-extrabold tabular-nums truncate" dir="ltr">
                {formatMoneyAmount(subtotal)}
              </span>
            </div>
          </div>

          <div className="flex justify-between font-bold text-xl text-foreground pt-1 border-t border-border/50">
            <span>الإجمالي</span>
            <span className="text-primary font-display">{formatMoneyAmount(total)}</span>
          </div>

          <Button
            className="w-full h-12 sm:h-14 text-base sm:text-lg touch-target"
            disabled={
              cart.length === 0 ||
              (orderType === "dine_in" && !selectedTableId)
            }
            onClick={openCheckout}
          >
            {orderType === "dine_in" && !selectedTableId
              ? "اختر مكان الجلوس أولاً"
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
          <button
            type="button"
            onClick={() => setIsSearchPadOpen(true)}
            className={`relative w-full text-start ${isPortraitPos ? "max-w-none" : "sm:w-72 md:w-80 xl:w-96"} h-11 xl:h-12 rounded-xl border border-border/50 bg-background/80 px-4 pe-11 flex items-center gap-2 hover:border-primary/40 transition-colors`}
          >
            <Search className="absolute end-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <span
              className={`min-w-0 flex-1 truncate text-sm font-semibold ${
                search ? "text-foreground" : "text-muted-foreground/70"
              }`}
            >
              {search || "ابحث عن صنف..."}
            </span>
            {search ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setSearch("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setSearch("");
                  }
                }}
                className="absolute end-10 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
                aria-label="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            ) : null}
          </button>
        </header>

        <div className={`py-3 flex gap-2 sm:gap-3 overflow-x-auto relative z-10 scrollbar-hide ${isPortraitPos ? "px-4 xl:px-5" : "px-3 sm:px-5 xl:px-6"}`}>
          <Button
            variant={activeCategory === "favorites" ? "default" : "secondary"}
            onClick={() => setActiveCategory("favorites")}
            className={`rounded-full px-3 sm:px-5 flex-shrink-0 touch-target gap-1.5 ${
              activeCategory === "favorites"
                ? "bg-amber-500 hover:bg-amber-500/90 text-white border-amber-500"
                : "text-amber-700 dark:text-amber-400 border border-amber-500/30"
            }`}
          >
            <Star className="w-4 h-4 text-black fill-black" />
            مفضلة
          </Button>
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
              className="rounded-full px-3 sm:px-5 whitespace-nowrap flex-shrink-0 touch-target gap-2"
            >
              {cat.imageUrl ? (
                <img
                  src={cat.imageUrl}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover border border-white/20"
                />
              ) : null}
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
                    {item.isFavorite && (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-amber-500/90 flex items-center justify-center z-10 shadow-md">
                        <Star className="w-3.5 h-3.5 text-black fill-black" />
                      </div>
                    )}
                    <div className="w-full aspect-[4/3] sm:aspect-square rounded-xl bg-gradient-to-br from-secondary to-secondary/40 mb-2 sm:mb-3 flex items-center justify-center overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.nameAr}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ChefHat className="w-10 h-10 sm:w-12 sm:h-12 text-primary/40" />
                      )}
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

      {/* ── Seat Picker: طاولات / غرفات / أشخاص ── */}
      <Dialog
        isOpen={isTablePickerOpen}
        onClose={() => {
          setIsTablePickerOpen(false);
          setIsPersonSearchPadOpen(false);
        }}
        title="اختر رقم الطاولة"
        maxWidth="max-w-5xl"
      >
        <div className="space-y-4">
          <div className="flex p-1 rounded-xl bg-secondary/50 border border-border/50 gap-1">
            {SEAT_TABS.map(({ key, label, icon: Icon }) => {
              const active = pickerEntityType === key;
              const count = seatTypeCounts[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setPickerEntityType(key);
                    if (key !== "person") {
                      setPersonSearch("");
                      setIsPersonSearchPadOpen(false);
                    }
                  }}
                  className={`flex-1 inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-2 sm:px-3 rounded-lg text-sm sm:text-base font-extrabold transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-l from-primary to-amber-500 text-primary-foreground shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? "opacity-100" : "opacity-70"}`} />
                  <span>{label}</span>
                  <span
                    className={`min-w-6 h-6 px-1.5 rounded-full inline-flex items-center justify-center text-[11px] font-display font-bold ${
                      active
                        ? "bg-white/25 text-primary-foreground"
                        : "bg-background/80 text-muted-foreground border border-border/60"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-amber-500/5 to-transparent px-4 py-3 flex items-center gap-3">
            {pickerEntityType === "room" ? (
              <RoomIcon className="w-14 h-auto flex-shrink-0" />
            ) : pickerEntityType === "person" ? (
              <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                <UserRound className="w-6 h-6 text-primary" />
              </div>
            ) : (
              <DiningTableIcon className="w-14 h-auto flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-extrabold text-sm sm:text-base">
                {pickerEntityType === "room"
                  ? "قاعة الغرف"
                  : pickerEntityType === "person"
                    ? "قائمة الأشخاص"
                    : "قاعة الطاولات"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {needsBranchPick
                  ? "اختر فرعاً أولاً لعرض عناصر ذلك الفرع فقط"
                  : pickerEntityType === "person"
                    ? `${branchLabel} — اختر شخصاً (يصبح موجود تلقائياً)`
                    : pickerEntityType === "room"
                      ? `غرف ${branchLabel} — اختر غرفة متاحة للطلب`
                      : `طاولات ${branchLabel} — اختر طاولة متاحة للطلب`}
              </p>
            </div>
          </div>

          {needsBranchPick ? (
            <div className="rounded-3xl border border-dashed border-amber-500/40 bg-amber-500/10 py-14 text-center text-amber-700 dark:text-amber-300">
              <Armchair className="w-12 h-12 mx-auto mb-3 opacity-70" />
              <p className="font-bold">اختر فرعاً من أعلى الشاشة أولاً</p>
              <p className="text-xs mt-1 opacity-80">حتى لا تظهر عناصر الفروع الأخرى مكررة</p>
            </div>
          ) : pickerEntityType === "person" ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl p-[1.5px] bg-gradient-to-l from-primary via-amber-400 to-primary/40 shadow-md shadow-primary/10">
                <button
                  type="button"
                  onClick={() => setIsPersonSearchPadOpen(true)}
                  className="w-full h-14 sm:h-[3.75rem] rounded-[0.9rem] bg-background/95 backdrop-blur-md px-4 pe-12 flex items-center gap-3 text-start hover:bg-background transition-colors"
                >
                  <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-amber-500/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                    <Search className="w-5 h-5 text-primary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-base sm:text-lg font-extrabold ${
                        personSearch ? "text-foreground" : "text-muted-foreground/55"
                      }`}
                    >
                      {personSearch || "ابحث عن شخص بالاسم..."}
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      اضغط لفتح لوحة المفاتيح
                    </span>
                  </span>
                </button>
                {personSearch ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPersonSearch("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setPersonSearch("");
                      }
                    }}
                    className="absolute end-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl border border-border/60 bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center"
                    aria-label="مسح البحث"
                  >
                    <X className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] font-bold text-primary/70 bg-primary/10 border border-primary/20 rounded-lg px-2 py-1">
                    بحث
                  </span>
                )}
              </div>

              {pickerSeats.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/70 bg-secondary/30 py-12 text-center text-muted-foreground">
                  <UserRound className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-bold">
                    {personSearch.trim()
                      ? "لا توجد نتائج لهذا البحث"
                      : seatTypeCounts.person === 0
                        ? "لا يوجد أشخاص لهذا الفرع"
                        : "لا توجد نتائج"}
                  </p>
                  {personSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => setPersonSearch("")}
                      className="mt-3 text-sm font-bold text-primary hover:underline"
                    >
                      مسح البحث
                    </button>
                  )}
                </div>
              ) : (
            <div className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden max-h-[min(55vh,520px)] overflow-y-auto overscroll-contain">
              <div className="divide-y divide-border/50">
                {pickerSeats.map((person, idx) => {
                  const presence = personPresence(person.status);
                  const meta = PERSON_STATUS_META[presence];
                  const isSelected = selectedTableId === person.id;
                  const name = String(person.number);
                  return (
                    <motion.button
                      key={person.id}
                      type="button"
                      disabled={isUpdatingPerson}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.025, 0.3) }}
                      onClick={() => selectPerson(person)}
                      className={`w-full text-start px-4 sm:px-5 py-3.5 sm:py-4 flex items-center gap-3 sm:gap-4 transition-colors cursor-pointer ${
                        isSelected ? "bg-primary/10" : "hover:bg-primary/5"
                      } ${isUpdatingPerson ? "opacity-60" : ""}`}
                    >
                      <div
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-sm sm:text-base font-extrabold border flex-shrink-0 ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary/80 text-foreground border-border/60"
                        }`}
                      >
                        {personInitials(name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-sm sm:text-base truncate">{name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
                          {person.location && (
                            <span className="inline-flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-primary/80" />
                              {person.location}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3 text-primary/80" />
                            <span className="font-display">{person.capacity}</span>
                          </span>
                        </div>
                      </div>
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] sm:text-[11px] font-bold flex-shrink-0 ${meta.chip}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        {meta.label}
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
              )}
            </div>
          ) : pickerSeats.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/70 bg-secondary/30 py-14 text-center text-muted-foreground">
              {pickerEntityType === "room" ? (
                <RoomIcon className="w-20 h-auto mx-auto mb-3 opacity-50" />
              ) : (
                <Armchair className="w-12 h-12 mx-auto mb-3 opacity-50" />
              )}
              <p className="font-bold">
                {pickerEntityType === "room"
                  ? "لا توجد غرف لهذا الفرع"
                  : "لا توجد طاولات لهذا الفرع"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 max-h-[min(62vh,560px)] overflow-y-auto overscroll-contain pe-1">
              {pickerSeats.map((table, idx) => {
                const meta = TABLE_STATUS_META[table.status] ?? TABLE_STATUS_META.available;
                const isAvailable = table.status === "available";
                const isSelected = selectedTableId === table.id;
                const isRoom = pickerEntityType === "room";
                return (
                  <motion.button
                    key={table.id}
                    type="button"
                    disabled={!isAvailable}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.35) }}
                    whileHover={isAvailable ? { y: -4 } : undefined}
                    whileTap={isAvailable ? { scale: 0.97 } : undefined}
                    onClick={() => {
                      if (!isAvailable) return;
                      setSelectedTableId(table.id);
                      setIsTablePickerOpen(false);
                    }}
                    className={`
                      group relative aspect-[4/5] rounded-[1.75rem] border-2 backdrop-blur-xl
                      overflow-hidden text-center shadow-lg shadow-black/5
                      ${meta.card} ${isSelected ? "ring-4 ring-primary/50 border-primary" : meta.ring}
                      transition-shadow duration-300
                      ${isAvailable ? "hover:shadow-xl cursor-pointer" : "opacity-45 cursor-not-allowed grayscale-[0.35]"}
                    `}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${meta.glow}`} />

                    <div className="relative z-10 h-full flex flex-col items-center justify-between p-3 sm:p-4">
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] sm:text-[11px] font-bold ${meta.chip}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {meta.label}
                      </div>

                      <div className="relative w-full max-w-[8.5rem] sm:max-w-[10rem] mx-auto group-hover:scale-105 transition-transform duration-300">
                        {isRoom ? (
                          <RoomIcon
                            number={table.number}
                            className="w-full h-auto drop-shadow-md"
                          />
                        ) : (
                          <DiningTableIcon
                            number={table.number}
                            className="w-full h-auto drop-shadow-md"
                          />
                        )}
                      </div>

                      <div className="w-full space-y-1.5">
                        <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-foreground">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          <span className="font-display">{table.capacity}</span>
                          <span className="text-muted-foreground font-medium">
                            {isRoom ? "سعة" : "مقاعد"}
                          </span>
                        </div>
                        {table.location && (
                          <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground">
                            <MapPin className="w-3 h-3 text-primary/80" />
                            <span className="truncate max-w-[8rem]">{table.location}</span>
                          </div>
                        )}
                        {isSelected && (
                          <div className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-extrabold">
                            <CheckCircle2 className="w-3 h-3" />
                            محددةارة
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>

      {/* ── Payment Dialog ── */}
      <Dialog
        isOpen={isCheckoutOpen}
        onClose={() => !orderSuccess && setIsCheckoutOpen(false)}
        title={orderSuccess ? "✅ تم الطلب بنجاح" : "اختر طريقة الدفع"}
        maxWidth={isDirectSave && !orderSuccess ? "max-w-lg" : "max-w-lg"}
      >
        {orderSuccess ? (
          <div className="text-center py-4 space-y-4">
            <div className="text-6xl">🎉</div>
            <p className="text-lg font-bold">
              {posSaveTarget === "kitchen"
                ? "تم إرسال الطلب لشاشة المطبخ!"
                : posSaveTarget === "none"
                  ? "تم حفظ الطلب بنجاح!"
                  : "تم إرسال الطلب لشاشة الكاشير!"}
            </p>
            <p className="text-sm text-muted-foreground font-display" dir="ltr">
              {invoiceNumber}
            </p>
            {selectedTable && (
              <p className="text-muted-foreground">{seatLabel(selectedTable)}</p>
            )}
            <p className="text-2xl font-bold text-primary font-display">
              {formatMoneyAmount(total)}
            </p>
            <Button className="w-full touch-target" onClick={resetOrder}>
              <RefreshCw className="w-4 h-4 me-2" />
              طلب جديد
            </Button>
          </div>
        ) : isDirectSave ? (
          <div className="space-y-4">
            {orderType === "dine_in" && selectedTable && (
              <div className="px-4 py-2.5 bg-primary/10 rounded-xl text-primary text-sm font-semibold flex items-center gap-2">
                {(selectedTable.type ?? "table") === "room" ? (
                  <DoorOpen className="w-4 h-4" />
                ) : (selectedTable.type ?? "table") === "person" ? (
                  <UserRound className="w-4 h-4" />
                ) : (
                  <Table2 className="w-4 h-4" />
                )}
                {seatLabel(selectedTable)}
                {selectedTable.location ? ` — ${selectedTable.location}` : ""}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 p-1.5 rounded-2xl border border-border/60 bg-secondary/40">
              <button
                type="button"
                onClick={() => {
                  setCheckoutPayMethod("cash");
                  setCheckoutReceived(total);
                  setCheckoutCardId(null);
                }}
                className={`h-14 sm:h-16 rounded-xl flex items-center justify-center gap-2.5 font-extrabold text-sm sm:text-base transition-all ${
                  checkoutPayMethod === "cash"
                    ? "bg-gradient-to-l from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                }`}
              >
                <Banknote className="w-5 h-5 sm:w-6 sm:h-6" />
                كاش
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckoutPayMethod("card");
                  setCheckoutReceived(total);
                }}
                className={`h-14 sm:h-16 rounded-xl flex items-center justify-center gap-2.5 font-extrabold text-sm sm:text-base transition-all ${
                  checkoutPayMethod === "card"
                    ? "bg-gradient-to-l from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                }`}
              >
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
                كارت
              </button>
            </div>

            <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card to-secondary/30 overflow-hidden shadow-sm">
              <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm font-bold">مجموع الفاتورة</span>
                </div>
                <span className="font-display text-xl sm:text-2xl font-extrabold text-primary tabular-nums" dir="ltr">
                  {formatMoneyAmount(total)}
                </span>
              </div>

              <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-foreground">مجموع الواصل</span>
                </div>
                {checkoutPayMethod === "cash" ? (
                  <button
                    type="button"
                    onClick={() => setIsReceivedPadOpen(true)}
                    className="min-w-[7.5rem] rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-display text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums hover:border-emerald-500 transition-colors"
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
                    {formatMoneyAmount(total)}
                  </span>
                )}
              </div>

              {checkoutPayMethod === "cash" && (
                <div className="px-4 py-3 flex items-center justify-between gap-3 bg-secondary/25">
                  <span className="text-sm font-bold text-muted-foreground">الباقي</span>
                  <span
                    className={`font-display text-lg font-extrabold tabular-nums ${
                      checkoutReceived >= total ? "text-amber-500" : "text-rose-500"
                    }`}
                    dir="ltr"
                  >
                    {checkoutReceived >= total
                      ? formatMoneyAmount(checkoutChange)
                      : `نقص ${formatMoneyAmount(total - checkoutReceived)}`}
                  </span>
                </div>
              )}
            </div>

            {checkoutPayMethod === "card" && (
              <div className="space-y-2.5">
                <p className="text-sm font-extrabold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-sky-500" />
                  اختر البطاقة
                </p>
                {branchPaymentCards.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/30 py-8 text-center text-muted-foreground">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-45" />
                    <p className="text-sm font-bold">لا توجد بطاقات نشطة لهذا الفرع</p>
                    <p className="text-xs mt-1 opacity-80">أضف بطاقة من فورم البطاقات أولاً</p>
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
                          className={`text-start rounded-2xl border-2 px-3.5 py-3 transition-all ${
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
                              <p className="text-[10px] text-muted-foreground font-display tabular-nums mt-0.5" dir="ltr">
                                {formatMoneyAmount(Number(card.balance ?? 0))}
                              </p>
                            </div>
                            {active && <CheckCircle2 className="w-5 h-5 text-sky-500 flex-shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                className="h-14 text-sm sm:text-base touch-target gap-2 border-2"
                isLoading={isCreating}
                disabled={
                  isCreating ||
                  (checkoutPayMethod === "cash" && checkoutReceived < total) ||
                  (checkoutPayMethod === "card" && !checkoutCardId)
                }
                onClick={() => confirmDirectCheckout(false)}
              >
                <CheckCircle2 className="w-5 h-5" />
                حفظ الفاتورة
              </Button>
              <Button
                className="h-14 text-sm sm:text-base touch-target gap-2"
                isLoading={isCreating}
                disabled={
                  isCreating ||
                  (checkoutPayMethod === "cash" && checkoutReceived < total) ||
                  (checkoutPayMethod === "card" && !checkoutCardId)
                }
                onClick={() => confirmDirectCheckout(true)}
              >
                <Printer className="w-5 h-5" />
                حفظ وطباعة
              </Button>
            </div>
            {devicePrinter?.printerName?.trim() ? (
              <p className="text-[11px] text-center text-muted-foreground font-semibold">
                طابعة الجهاز: {devicePrinter.printerName.trim()} · 80×80
              </p>
            ) : (
              <p className="text-[11px] text-center text-amber-600 dark:text-amber-400 font-semibold">
                لم تُسجَّل طابعة لهذا الجهاز — من الإعدادات → الطابعات
              </p>
            )}
          </div>
        ) : (
          <>
            {orderType === "dine_in" && selectedTable && (
              <div className="mb-4 px-4 py-2 bg-primary/10 rounded-xl text-primary text-sm font-semibold flex items-center gap-2">
                {(selectedTable.type ?? "table") === "room" ? (
                  <DoorOpen className="w-4 h-4" />
                ) : (selectedTable.type ?? "table") === "person" ? (
                  <UserRound className="w-4 h-4" />
                ) : (
                  <Table2 className="w-4 h-4" />
                )}
                {seatLabel(selectedTable)}
                {selectedTable.location ? ` — ${selectedTable.location}` : ""}
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
        isOpen={isReceivedPadOpen}
        onClose={() => setIsReceivedPadOpen(false)}
        title="مجموع الواصل"
        maxWidth="max-w-sm"
        layer="overlay"
      >
        <NumericKeypad
          value={checkoutReceived}
          suffix={currencySymbol}
          allowDecimal={decimalPlaces > 0}
          maxDecimalPlaces={decimalPlaces}
          label="أدخل المبلغ الواصل"
          onCancel={() => setIsReceivedPadOpen(false)}
          onConfirm={(v) => {
            setCheckoutReceived(Math.max(0, v));
            setIsReceivedPadOpen(false);
          }}
        />
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

      <Dialog
        isOpen={isPhonePadOpen}
        onClose={() => setIsPhonePadOpen(false)}
        title="رقم هاتف التوصيل"
        maxWidth="max-w-sm"
        layer="overlay"
      >
        <NumericKeypad
          mode="digits"
          value={deliveryPhone}
          label="أدخل رقم الهاتف"
          allowPlus
          maxLength={15}
          onCancel={() => setIsPhonePadOpen(false)}
          onConfirm={(v) => {
            setDeliveryPhone(v);
            setIsPhonePadOpen(false);
          }}
        />
      </Dialog>

      <Dialog
        isOpen={isAddressPadOpen}
        onClose={() => setIsAddressPadOpen(false)}
        hideHeader
        maxWidth="max-w-5xl"
        layer="overlay"
      >
        <MultilingualKeyboard
          value={deliveryAddress}
          defaultLang="ar"
          onCancel={() => setIsAddressPadOpen(false)}
          onConfirm={(v) => {
            setDeliveryAddress(v);
            setIsAddressPadOpen(false);
          }}
        />
      </Dialog>

      <Dialog
        isOpen={isSearchPadOpen}
        onClose={() => setIsSearchPadOpen(false)}
        hideHeader
        maxWidth="max-w-5xl"
        layer="overlay"
      >
        <MultilingualKeyboard
          value={search}
          defaultLang="ar"
          onCancel={() => setIsSearchPadOpen(false)}
          onConfirm={(v) => {
            setSearch(v);
            setIsSearchPadOpen(false);
          }}
        />
      </Dialog>

      <Dialog
        isOpen={isPersonSearchPadOpen}
        onClose={() => setIsPersonSearchPadOpen(false)}
        hideHeader
        maxWidth={isPortrait ? "max-w-3xl" : "max-w-7xl"}
        layer="overlay"
      >
        {(() => {
          const landscapePad = !isPortrait;
          const searchPanel = (
            <div
              className={`flex flex-col min-h-0 rounded-3xl border border-border/50 bg-gradient-to-b from-card via-card to-secondary/30 shadow-lg overflow-hidden ${
                landscapePad ? "w-[min(100%,22rem)] flex-shrink-0" : "w-full max-h-[42vh]"
              }`}
              dir="rtl"
            >
              <div className="p-3 sm:p-3.5 border-b border-border/50 bg-primary/5">
                <div className="relative rounded-2xl border border-primary/25 bg-background/90 px-3.5 py-2.5 flex items-center gap-2.5 shadow-inner">
                  <Search className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-muted-foreground mb-0.5">بحث أشخاص</p>
                    <p
                      className={`truncate text-base font-extrabold ${
                        personSearch ? "text-foreground" : "text-muted-foreground/50"
                      }`}
                    >
                      {personSearch || "اكتب للبحث..."}
                    </p>
                  </div>
                  {personSearch ? (
                    <button
                      type="button"
                      onClick={() => setPersonSearch("")}
                      className="w-8 h-8 rounded-xl border border-border/60 bg-secondary/70 text-muted-foreground hover:text-foreground flex items-center justify-center flex-shrink-0"
                      aria-label="مسح"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-border/45">
                {pickerSeats.length === 0 ? (
                  <div className="py-10 px-4 text-center text-muted-foreground">
                    <UserRound className="w-10 h-10 mx-auto mb-2 opacity-45" />
                    <p className="text-sm font-bold">
                      {personSearch.trim() ? "لا توجد نتائج" : "لا يوجد أشخاص"}
                    </p>
                  </div>
                ) : (
                  pickerSeats.map((person) => {
                    const presence = personPresence(person.status);
                    const meta = PERSON_STATUS_META[presence];
                    const isSelected = selectedTableId === person.id;
                    const name = String(person.number);
                    return (
                      <button
                        key={person.id}
                        type="button"
                        disabled={isUpdatingPerson}
                        onClick={() => selectPerson(person)}
                        className={`w-full text-start px-3.5 py-3 flex items-center gap-2.5 transition-colors cursor-pointer ${
                          isSelected ? "bg-primary/10" : "hover:bg-primary/5"
                        } ${isUpdatingPerson ? "opacity-60" : ""}`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold border flex-shrink-0 ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary/80 border-border/60"
                          }`}
                        >
                          {personInitials(name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-sm truncate">{name}</p>
                          {person.location ? (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {person.location}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold flex-shrink-0 ${meta.chip}`}
                        >
                          {meta.label}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );

          return (
            <div
              className={
                landscapePad
                  ? "flex flex-row items-stretch gap-3 sm:gap-4"
                  : "flex flex-col gap-3"
              }
              dir="ltr"
            >
              {landscapePad ? (
                <>
                  {searchPanel}
                  <div className="min-w-0 flex-1">
                    <MultilingualKeyboard
                      value={personSearch}
                      label="بحث عن شخص"
                      defaultLang="ar"
                      showInput={false}
                      onChange={setPersonSearch}
                      onCancel={() => setIsPersonSearchPadOpen(false)}
                      onConfirm={(v) => {
                        setPersonSearch(v.trim());
                        setIsPersonSearchPadOpen(false);
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <MultilingualKeyboard
                    value={personSearch}
                    label="بحث عن شخص"
                    defaultLang="ar"
                    showInput={false}
                    onChange={setPersonSearch}
                    onCancel={() => setIsPersonSearchPadOpen(false)}
                    onConfirm={(v) => {
                      setPersonSearch(v.trim());
                      setIsPersonSearchPadOpen(false);
                    }}
                  />
                  {searchPanel}
                </>
              )}
            </div>
          );
        })()}
      </Dialog>
    </div>
  );
}
