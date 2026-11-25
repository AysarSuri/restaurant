import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMenuItems,
  useGetMenuCategories,
  useCreateOrder,
  useUpdateOrder,
  useGetSettings,
  useGetTables,
  useUpdateTable,
  useGetCards,
  useGetBranches,
  useGetDevicePrinters,
  useGetOrders,
  useGetDrivers,
  useGetShifts,
  getGetOrdersQueryKey,
  getGetTablesQueryKey,
  getGetShiftsQueryKey,
  lookupDeliveryPhone,
  upsertDeliveryContact,
  getGetDeliveryContactsQueryKey,
  type RestaurantTable,
} from "@workspace/api-client-react";
import { Button, Card, Badge, Dialog, Input } from "@/components/ui-elements";
import {
  ShoppingCart, Search, Trash2, Plus, Minus, CreditCard,
  Banknote, ChefHat, ArrowLeft, Table2, MapPin, Phone, RefreshCw, X,
  Clock, CheckCircle2, XCircle, Percent, Users, Armchair, Star,
  DoorOpen, UserRound, Lock, Wallet, Printer, PencilLine, RotateCcw,
  ShoppingBag, Truck, Bike,
} from "lucide-react";
import type { MenuItem, Order } from "@workspace/api-client-react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useCurrency } from "@/hooks/use-currency";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import { BranchSwitcher } from "@/components/branch-switcher";
import { NumericKeypad } from "@/components/numeric-keypad";
import { MultilingualKeyboard } from "@/components/multilingual-keyboard";
import { DiningTableIcon } from "@/components/dining-table-icon";
import { RoomIcon } from "@/components/room-icon";
import { TABLE_STATUS_META } from "@/lib/table-status";
import { getOrCreateDeviceKey } from "@/lib/device-id";
import { printThermalReceipt } from "@/lib/print-receipt";
import { toast } from "@/hooks/use-toast";
import { bumpOrdersLive, subscribeOrdersLive } from "@/lib/orders-live";
import { bumpStockLive } from "@/lib/stock-live";

const isTableOrderSource = (order: { source?: string | null } | null | undefined) =>
  String(order?.source ?? "").toLowerCase() === "table_order";

type SeatEntityType = "table" | "room" | "person";

const SEAT_TABS: {
  key: SeatEntityType;
  labelKey: string;
  icon: typeof Armchair;
}[] = [
  { key: "table", labelKey: "seat.tables", icon: Armchair },
  { key: "room", labelKey: "seat.roomsTab", icon: DoorOpen },
  { key: "person", labelKey: "pos.persons", icon: UserRound },
];

const personInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
};

function seatStatusLabelKey(status: string) {
  if (status === "occupied") return "seat.occupied";
  if (status === "reserved") return "seat.reserved";
  if (status === "cleaning") return "seat.cleaning";
  return "seat.available";
}

function seatLabel(
  seat: { type?: string | null; number: string | number } | undefined | null,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (!seat) return t("tables.chooseNumber");
  const type = (seat.type ?? "table") as SeatEntityType;
  if (type === "person") return String(seat.number);
  if (type === "room") return t("tables.roomN", { n: seat.number });
  return t("tables.tableN", { n: seat.number });
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

/** Full date + time (Latin digits) for edit-lists rows */
function formatListDateTime(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

function isPosOrderReceived(order: Pick<Order, "paymentMethod" | "status">) {
  if (order.paymentMethod) return true;
  return order.status === "paid";
}

interface CartItem extends MenuItem {
  cartQuantity: number;
  price: number;
  /** Return/refund line — shown in red with a negative amount */
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

type OrderType = "dine_in" | "takeaway" | "delivery";

function menuItemDisplayName(
  item: Pick<MenuItem, "name" | "nameAr">,
  locale: string
) {
  if (locale === "en") {
    const english = item.name?.trim();
    return english || item.nameAr;
  }
  const arabic = item.nameAr?.trim();
  return arabic || item.name;
}

export default function POS() {
  const { t, locale, formatDate } = useI18n();
  const queryClient = useQueryClient();
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
  /** Drivers for the active POS branch (plus unassigned). */
  const driversBranchParam =
    selectedBranchId === "all" ? ("" as const) : selectedBranchId;
  const { data: driversData, isLoading: driversLoading } = useGetDrivers({
    params: {
      branchId: driversBranchParam,
    },
    query: {
      queryKey: ["/api/drivers", { scope: "pos-branch", branchId: driversBranchParam }],
    },
  });
  const { data: shiftsData, isLoading: shiftsLoading } = useGetShifts({
      query: {
        queryKey: [...getGetShiftsQueryKey(), selectedBranchId],
        staleTime: 5_000,
        refetchInterval: 15_000,
        refetchOnWindowFocus: true,
      },
    });
  const { mutate: createOrder, isPending: isCreating } = useCreateOrder();
  const { mutate: updateOrder, isPending: isUpdatingOrder } = useUpdateOrder();
  const { mutate: updateTable, isPending: isUpdatingPerson } = useUpdateTable();
  const isSavingOrder = isCreating || isUpdatingOrder;
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

  /** Settings → Numbers: amount/phone numeric pads */
  const amountPadEnabled = devicePrinter?.virtualNumericKeypad === true;
  /** Settings → Keyboard: multilingual text pads (search, address, person) */
  const textKeyboardEnabled = devicePrinter?.virtualKeyboard === true;

  const salesSendToKitchen =
    devicePrinter != null
      ? devicePrinter.salesSendToKitchen !== false
      : appSettings?.posSaveTarget !== "none";

  /** POS seats: only the selected branch (same number OK on other branches) */
  const branchTables = useMemo(() => {
    const list = tables ?? [];
    if (selectedBranchId === "all") return [];
    return list.filter((t) => t.branchId === selectedBranchId);
  }, [tables, selectedBranchId]);

  /** null = all, "favorites" = favorites only, number = category id */
  const [activeCategory, setActiveCategory] = useState<number | "favorites" | null>("favorites");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");

  const salesPaymentAt = useMemo(() => {
    if (!devicePrinter) return "pos" as const;
    const legacy = devicePrinter.salesPaymentAt === "cashier" ? "cashier" : "pos";
    const byType =
      orderType === "takeaway"
        ? devicePrinter.salesPaymentAtTakeaway
        : orderType === "delivery"
          ? devicePrinter.salesPaymentAtDelivery
          : devicePrinter.salesPaymentAtDineIn;
    if (byType == null) return legacy;
    return byType === "cashier" ? ("cashier" as const) : ("pos" as const);
  }, [devicePrinter, orderType]);
  /** Pay at POS — always show cash/card + received form (kitchen toggle is independent) */
  const payAtPos = salesPaymentAt === "pos";
  /** Save invoice for cashier collection — no payment dialog */
  const saveForCashier = salesPaymentAt === "cashier";
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
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
  /** "all" = seat pick; "openOrders" = all today lists; "tableOrders" = dine-in only */
  const [seatPickerMode, setSeatPickerMode] = useState<"all" | "openOrders" | "tableOrders">("all");
  const [pickerEntityType, setPickerEntityType] = useState<SeatEntityType>("table");
  const [personSearch, setPersonSearch] = useState("");
  const [isPersonSearchPadOpen, setIsPersonSearchPadOpen] = useState(false);
  const [isDiscountPadOpen, setIsDiscountPadOpen] = useState(false);
  const [isPhonePadOpen, setIsPhonePadOpen] = useState(false);
  const [isAddressPadOpen, setIsAddressPadOpen] = useState(false);

  const [isDeliveryFormOpen, setIsDeliveryFormOpen] = useState(false);
  const [isSearchPadOpen, setIsSearchPadOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(() => currentInvoiceNumber());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (amountPadEnabled) return;
    setIsDiscountPadOpen(false);
    setIsReceivedPadOpen(false);
    setIsPhonePadOpen(false);
  }, [amountPadEnabled]);

  useEffect(() => {
    if (textKeyboardEnabled) return;
    setIsSearchPadOpen(false);
    setIsAddressPadOpen(false);
    setIsPersonSearchPadOpen(false);
  }, [textKeyboardEnabled]);

  const [orderSuccess, setOrderSuccess] = useState(false);
  /** When set, POS is editing an existing stored order (load items + save via update). */
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  /** Invoice loaded from guest tablet «طلب طاولة» */
  const [editingFromTableOrder, setEditingFromTableOrder] = useState(false);
  /** Pulse «قوائم طلب طاولة» when a new tablet order arrives */
  const [tableOrderPulse, setTableOrderPulse] = useState(false);
  const knownTableOrderIdsRef = useRef<Set<number> | null>(null);
  /** When on, tapping menu items adds return (negative) lines in red. */
  const [isReturnMode, setIsReturnMode] = useState(false);

  const todayDateKey = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, [now.getFullYear(), now.getMonth(), now.getDate()]);

  const todayOrdersParams = useMemo(
    () => ({ date: todayDateKey, limit: 500 }),
    [todayDateKey]
  );

  const { data: todayOrders, refetch: refetchTodayOrders } = useGetOrders(
    todayOrdersParams,
    {
      query: {
        queryKey: [...getGetOrdersQueryKey(todayOrdersParams), selectedBranchId],
        refetchInterval: 1_500,
        staleTime: 800,
      },
    }
  );

  const todayBranchOrders = useMemo(() => {
    const list = todayOrders ?? [];
    const filtered =
      selectedBranchId === "all"
        ? list
        : list.filter((o) => o.branchId === selectedBranchId);
    // Newest first by created date+time (exclude cancelled from edit picker)
    return [...filtered]
      .filter((o) => o.status !== "cancelled")
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [todayOrders, selectedBranchId]);

  /** Guest-tablet table orders only (source = table_order) */
  const todayTableOrders = useMemo(
    () => todayBranchOrders.filter((o) => isTableOrderSource(o)),
    [todayBranchOrders]
  );

  const unpaidTableOrderCount = useMemo(
    () => todayTableOrders.filter((o) => !isPosOrderReceived(o)).length,
    [todayTableOrders]
  );

  const pickerListOrders =
    seatPickerMode === "tableOrders" ? todayTableOrders : todayBranchOrders;

  const openSeatStages = useMemo(() => {
    const map = new Map<number, { cashier: boolean; kitchen: boolean }>();
    for (const order of todayBranchOrders) {
      const tableId = order.tableId;
      if (tableId == null) continue;
      const prev = map.get(tableId) ?? { cashier: false, kitchen: false };
      if (order.status === "pending" || order.status === "confirmed") prev.cashier = true;
      if (
        order.status === "preparing" ||
        order.status === "ready" ||
        order.status === "served"
      ) {
        prev.kitchen = true;
      }
      map.set(tableId, prev);
    }
    return map;
  }, [todayBranchOrders]);

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
  }, [branchTables, personSearch, pickerEntityType]);

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

  const openShiftForBranch = useMemo(() => {
    if (selectedBranchId === "all") return null;
    const list = shiftsData ?? [];
    return (
      list.find(
        (s) =>
          s.branchId === selectedBranchId &&
          s.isOpen === true &&
          !s.closedAt
      ) ?? null
    );
  }, [shiftsData, selectedBranchId]);

  const shiftClosed =
    !needsBranchPick &&
    !(shiftsLoading && shiftsData == null) &&
    openShiftForBranch == null;

  const shiftClosedReason = () =>
    shiftClosed ? t("pos.shiftClosedBlock") : null;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return subscribeOrdersLive(() => {
      void refetchTodayOrders();
    });
  }, [refetchTodayOrders]);

  useEffect(() => {
    const ids = new Set(todayTableOrders.map((o) => o.id));
    const prev = knownTableOrderIdsRef.current;
    if (prev == null) {
      knownTableOrderIdsRef.current = ids;
      return;
    }
    const newcomers = todayTableOrders.filter((o) => !prev.has(o.id));
    knownTableOrderIdsRef.current = ids;
    if (newcomers.length === 0) return;
    setTableOrderPulse(true);
    const latest = newcomers[0];
    toast({
      title: t("pos.newTableOrderToast"),
      description: latest.orderNumber
        ? t("pos.newTableOrderToastDesc", { n: latest.orderNumber })
        : undefined,
    });
    const timer = window.setTimeout(() => setTableOrderPulse(false), 6_000);
    return () => window.clearTimeout(timer);
  }, [todayTableOrders, t]);

  const startNewOrderSession = () => {
    setInvoiceNumber(nextInvoiceNumber());
  };

  const formatIQD = (val: number) => formatValue(val);

  const liveClock = formatClock(now);
  const liveDate = formatDate(now);

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

  const closeSeatPicker = () => {
    setIsTablePickerOpen(false);
    setIsPersonSearchPadOpen(false);
    setSeatPickerMode("all");
  };

  const openSeatPicker = (mode: "all" | "openOrders" | "tableOrders" = "all") => {
    setSeatPickerMode(mode);
    setPersonSearch("");
    setIsPersonSearchPadOpen(false);
    if (mode === "all") {
      setPickerEntityType("table");
    }
    if (mode === "openOrders" || mode === "tableOrders") {
      void refetchTodayOrders();
    }
    setIsTablePickerOpen(true);
  };

  const loadOrderIntoCurrentCart = (order: Order) => {
    const menuById = new Map((items ?? []).map((m) => [m.id, m]));
    const nextCart: CartItem[] = [];
    for (const line of order.items ?? []) {
      const menuItemId = Number(line.menuItemId);
      if (!Number.isFinite(menuItemId)) continue;
      const rawQty = Number(line.quantity) || 0;
      if (rawQty === 0) continue;
      const asReturn = rawQty < 0;
      const qty = Math.max(1, Math.abs(rawQty));
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
    setDiscount(Number(order.discount) || 0);
    setInvoiceNumber(order.orderNumber || invoiceNumber);
    setEditingOrderId(order.id);
    setEditingFromTableOrder(isTableOrderSource(order));
    setOrderSuccess(false);
    setCartOpen(true);
  };

  const finishPersonSelection = (personId: number) => {
    setSelectedTableId(personId);
    setPersonSearch("");
    setIsPersonSearchPadOpen(false);
    closeSeatPicker();
  };

  /** Pick person seat without forcing status — seat sync follows unpaid/paid invoices */
  const selectPerson = (person: RestaurantTable) => {
    if (isUpdatingPerson) return;
    finishPersonSelection(person.id);
  };

  const selectTodayOrder = (order: Order) => {
    loadOrderIntoCurrentCart(order);
    const nextType = (order.type as OrderType) || "dine_in";
    setOrderType(nextType);
    if (nextType === "dine_in" && order.tableId != null) {
      const seat =
        branchTables.find((t) => t.id === order.tableId) ??
        (order.table as RestaurantTable | undefined);
      if (seat && (seat.type ?? "table") === "person") {
        selectPerson(seat);
        return;
      }
      setSelectedTableId(order.tableId);
      closeSeatPicker();
      return;
    }
    setSelectedTableId(null);
    if (nextType === "delivery") {
      setDeliveryPhone(order.deliveryPhone ?? "");
      setDeliveryAddress(order.deliveryAddress ?? "");
    }
    closeSeatPicker();
  };

  const orderListTitle = (order: Order) => {
    if (order.type === "takeaway") return t("order.takeaway");
    if (order.type === "delivery") {
      return order.deliveryPhone?.trim() || t("order.delivery");
    }
    const seat =
      branchTables.find((t) => t.id === order.tableId) ??
      (order.table as RestaurantTable | undefined);
    return seat ? seatLabel(seat, t) : t("order.dineIn");
  };

  const addToCart = (item: MenuItem) => {
    if (needsBranchPick) return;
    if (shiftClosed) {
      toast({ title: t("pos.shiftClosedBlock"), variant: "destructive" });
      return;
    }
    const asReturn = isReturnMode;
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.id === item.id && Boolean(i.isReturn) === asReturn
      );
      if (existing)
        return prev.map((i) =>
          i.id === item.id && Boolean(i.isReturn) === asReturn
            ? { ...i, cartQuantity: i.cartQuantity + 1 }
            : i
        );
      return [
        ...prev,
        {
          ...item,
          price: Number(item.price),
          cartQuantity: 1,
          isReturn: asReturn || undefined,
        },
      ];
    });
  };

  const updateQuantity = (id: number, delta: number, isReturn = false) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.id === id && Boolean(i.isReturn) === isReturn
            ? { ...i, cartQuantity: i.cartQuantity + delta }
            : i
        )
        .filter((i) => i.cartQuantity > 0)
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + cartLineAmount(item), 0);
  const deliveryFeeAmount =
    orderType === "delivery" ? Math.max(0, Number(appSettings?.deliveryFee) || 0) : 0;
  const total = subtotal - discount + deliveryFeeAmount;

  const activeDrivers = useMemo(() => {
    const list = (driversData?.drivers ?? []).filter((x) => x.isActive !== false);
    const branchId = selectedBranchId === "all" ? null : selectedBranchId;
    const forBranch =
      branchId == null
        ? list
        : list.filter((d) => d.branchId == null || d.branchId === branchId);
    return [...forBranch].sort((a, b) => {
      const rank = (d: (typeof forBranch)[number]) => {
        if (branchId != null && d.branchId === branchId) return 0;
        if (d.branchId == null) return 1;
        return 2;
      };
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "ar");
    });
  }, [driversData?.drivers, selectedBranchId]);

  const selectedDriver = useMemo(
    () => activeDrivers.find((d) => d.id === selectedDriverId) ?? null,
    [activeDrivers, selectedDriverId]
  );

  useEffect(() => {
    if (selectedDriverId == null) return;
    if (!activeDrivers.some((d) => d.id === selectedDriverId)) {
      setSelectedDriverId(null);
    }
  }, [activeDrivers, selectedDriverId]);

  const branchPaymentCards = useMemo(() => {
    const list = (paymentCards ?? []).filter((c) => c.isActive !== false);
    if (selectedBranchId === "all") return list;
    return list.filter((c) => (c.branchIds ?? []).includes(selectedBranchId));
  }, [paymentCards, selectedBranchId]);

  const checkoutChange = Math.max(0, checkoutReceived - total);

  const deliveryPhoneDigits = deliveryPhone.replace(/\D/g, "");
  const requireDeliveryDriver = appSettings?.deliveryRequireDriver !== false;
  const requireDeliveryPhone = appSettings?.deliveryRequirePhone !== false;
  const requireDeliveryAddress = appSettings?.deliveryRequireAddress !== false;
  const deliveryReady =
    orderType !== "delivery" ||
    ((!requireDeliveryDriver || selectedDriverId != null) &&
      (!requireDeliveryPhone || deliveryPhoneDigits.length >= 7) &&
      (!requireDeliveryAddress || deliveryAddress.trim().length > 0));

  const deliveryBlockReason = () => {
    if (orderType !== "delivery") return null;
    if (requireDeliveryDriver && selectedDriverId == null) return t("pos.needDriver");
    if (requireDeliveryPhone && deliveryPhoneDigits.length < 7)
      return t("pos.needDeliveryPhone");
    if (requireDeliveryAddress && !deliveryAddress.trim())
      return t("pos.needDeliveryAddress");
    return null;
  };

  const openCheckout = () => {
    const blocked = deliveryBlockReason();
    if (blocked) {
      toast({ title: blocked, variant: "destructive" });
      setIsDeliveryFormOpen(true);
      return;
    }
    /** New lists only — editing an existing invoice stays allowed */
    if (editingOrderId == null) {
      const shiftBlocked = shiftClosedReason();
      if (shiftBlocked) {
        toast({ title: shiftBlocked, variant: "destructive" });
        return;
      }
    }
    setCartOpen(false);
    setCheckoutPayMethod("cash");
    setCheckoutReceived(total);
    setCheckoutCardId(null);
    setOrderSuccess(false);
    if (saveForCashier) {
      const lineItems = cart.map((i) => ({
        menuItemId: i.id,
        quantity: cartLineSignedQty(i),
      }));
      const afterCashierSave = () => {
        void persistDeliveryContactIfNeeded({ notify: false });
        invalidateOrdersQueries();
        setOrderSuccess(true);
        setIsCheckoutOpen(true);
      };
      // Save invoice without payment — appears unpaid on cashier
      if (editingOrderId != null) {
        updateOrder(
          {
            id: editingOrderId,
            data: {
              discount: discount || undefined,
              items: lineItems,
            },
          },
          { onSuccess: afterCashierSave }
        );
        return;
      }
      createOrder(
        {
          data: {
            type: orderType,
            tableId: orderType === "dine_in" ? selectedTableId ?? undefined : undefined,
            branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
            items: lineItems,
            discount: discount || undefined,
            deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
            deliveryPhone: orderType === "delivery" ? deliveryPhone : undefined,
            deliveryFee: orderType === "delivery" ? deliveryFeeAmount : undefined,
            driverId: orderType === "delivery" ? selectedDriverId : undefined,
            deviceKey,
          } as any,
        },
        { onSuccess: afterCashierSave }
      );
      return;
    }
    setIsCheckoutOpen(true);
  };

  const resetOrder = () => {
    setCart([]);
    setSelectedTableId(null);
    setDeliveryAddress("");
    setDeliveryPhone("");
    setSelectedDriverId(null);
    setPhoneKnown(null);
    setDiscount(0);
    setCheckoutPayMethod("cash");
    setCheckoutReceived(0);
    setCheckoutCardId(null);
    setIsCheckoutOpen(false);
    setOrderSuccess(false);
    setEditingOrderId(null);
    setEditingFromTableOrder(false);
    setIsReturnMode(false);
    startNewOrderSession();
  };

  const invalidateOrdersQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock"] });
    void refetchTodayOrders();
    void refetchTables();
    bumpOrdersLive();
    bumpStockLive();
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

  /**
   * If phone is not in «أرقام التوصيل», save phone + address there after
   * delivery details are confirmed / order is saved.
   */
  const persistDeliveryContactIfNeeded = async (opts?: { notify?: boolean }) => {
    if (orderType !== "delivery") return false;
    const digits = deliveryPhone.replace(/\D/g, "");
    const address = deliveryAddress.trim();
    if (digits.length < 7 || !address) return false;

    let known = phoneKnown;
    if (known == null) {
      try {
        const res = await lookupDeliveryPhone(deliveryPhone);
        known = Boolean(res.found);
        setPhoneKnown(known);
      } catch {
        known = false;
      }
    }

    /** Always upsert so address stays current; toast only for brand-new numbers */
    const wasNew = known === false;
    try {
      await upsertDeliveryContact({
        phone: deliveryPhone,
        address,
        branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
      });
      setPhoneKnown(true);
      void queryClient.invalidateQueries({ queryKey: getGetDeliveryContactsQueryKey() });
      if (wasNew && opts?.notify !== false) {
        toast({
          title: t("pos.deliveryContactSaved"),
          description: t("pos.deliveryContactSavedDesc"),
        });
      }
      return true;
    } catch {
      return false;
    }
  };

  const orderTypeLabels: Record<OrderType, string> = {
    dine_in: t("order.dineIn"),
    takeaway: t("order.takeaway"),
    delivery: t("order.delivery"),
  };

  const buildDirectReceipt = (paymentLabel: string) => {
    const nowStamp = new Date();
    return {
      restaurantName: appSettings?.restaurantName?.trim() || t("pos.fallbackRestaurant"),
      branchName: currentBranch?.name?.trim() || branchLabel,
      mobile1: currentBranch?.mobile1,
      mobile2: currentBranch?.mobile2,
      address: currentBranch?.address,
      logoUrl: currentBranch?.logoUrl,
      invoiceNumber,
      dateLabel: formatDate(nowStamp),
      timeLabel: formatClock(nowStamp),
      orderTypeLabel: orderTypeLabels[orderType],
      seatLabel: orderType === "dine_in" ? seatLabel(selectedTable, t) : null,
      items: cart.map((i) => ({
        name: `${i.isReturn ? `${t("pos.returnLine")} · ` : ""}${menuItemDisplayName(i, locale)}`,
        quantity: cartLineSignedQty(i),
        unitPrice: i.price,
        lineTotal: cartLineAmount(i),
      })),
      subtotal,
      discount,
      deliveryFee: deliveryFeeAmount,
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
    const blocked = deliveryBlockReason();
    if (blocked) {
      toast({ title: blocked, variant: "destructive" });
      return;
    }
    if (editingOrderId == null) {
      const shiftBlocked = shiftClosedReason();
      if (shiftBlocked) {
        toast({ title: shiftBlocked, variant: "destructive" });
        return;
      }
    }
    const cardNote =
      paymentMethod === "card" && opts?.cardName
        ? t("pos.cardLine", { name: opts.cardName })
        : undefined;
    const paymentLabel =
      paymentMethod === "cash"
        ? t("pos.cash")
        : paymentMethod === "card"
          ? opts?.cardName
            ? t("pos.cardNamed", { name: opts.cardName })
            : t("pos.cardShort")
          : t("common.transfer");
    const receiptData = payAtPos ? buildDirectReceipt(paymentLabel) : null;
    const lineItems = cart.map((i) => ({
      menuItemId: i.id,
      quantity: cartLineSignedQty(i),
    }));

    const afterSaveSuccess = () => {
      void persistDeliveryContactIfNeeded({ notify: false });
      invalidateOrdersQueries();
      setOrderSuccess(true);
      if (opts?.print && receiptData) {
        try {
          printThermalReceipt(receiptData);
          toast({
            title: t("pos.savedPrinted"),
            description: devicePrinter?.printerName?.trim()
              ? t("pos.printNamed", { name: devicePrinter.printerName.trim() })
              : t("pos.printGeneric"),
          });
        } catch {
          toast({
            variant: "destructive",
            title: t("pos.saved"),
            description: t("pos.printPopupBlocked"),
          });
        }
      }
    };

    if (editingOrderId != null) {
      updateOrder(
        {
          id: editingOrderId,
          data: {
            discount: discount || undefined,
            notes: cardNote,
            items: lineItems,
          },
        },
        { onSuccess: afterSaveSuccess }
      );
      return;
    }

    createOrder(
      {
        data: {
          type: orderType,
          tableId: orderType === "dine_in" ? selectedTableId ?? undefined : undefined,
          branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
          items: lineItems,
          discount: discount || undefined,
          deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
          deliveryPhone: orderType === "delivery" ? deliveryPhone : undefined,
          deliveryFee: orderType === "delivery" ? deliveryFeeAmount : undefined,
          driverId: orderType === "delivery" ? selectedDriverId : undefined,
          paymentMethod,
          notes: cardNote,
          deviceKey,
        } as any,
      },
      { onSuccess: afterSaveSuccess }
    );
  };

  const confirmDirectCheckout = (withPrint: boolean) => {
    if (withPrint && !devicePrinter?.printerName?.trim()) {
      toast({
        variant: "destructive",
        title: t("pos.noPrinter"),
        description: t("pos.registerPrinter"),
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
          {editingFromTableOrder ? (
            <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-[11px] sm:text-xs font-extrabold text-sky-900 dark:text-sky-100 leading-snug">
              {t("pos.fromTableOrderBanner")}
            </div>
          ) : null}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
              <h2 className="font-extrabold flex items-center gap-1 shrink-0 text-sm sm:text-[0.95rem] leading-none">
                <ShoppingCart className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="whitespace-nowrap">
                  {isPortraitPos && !compact ? t("pos.orderPane") : t("pos.currentOrder")}
                </span>
              </h2>
              <span
                className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] sm:text-xs font-extrabold text-primary font-display tabular-nums shrink-0"
                dir="ltr"
                title={t("pos.listNumber")}
              >
                {invoiceNumber}
              </span>
              {editingOrderId != null && (
                <span className="inline-flex items-center rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-200 shrink-0">
                  {t("pos.editLists")}
                </span>
              )}
              {editingFromTableOrder && (
                <span
                  className="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-extrabold text-sky-800 dark:text-sky-200 shrink-0 max-w-[14rem] truncate"
                  title={t("pos.fromTableOrderBanner")}
                >
                  {t("pos.fromTableOrderBadge")}
                </span>
              )}
              {isReturnMode && (
                <span className="inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 dark:text-rose-300 shrink-0">
                  {t("pos.return")}
                </span>
              )}
              {orderType === "dine_in" && (
                <button
                  type="button"
                  onClick={() => {
                    setPickerEntityType(
                      ((selectedTable?.type ?? "table") as SeatEntityType) || "table"
                    );
                    openSeatPicker("all");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-extrabold transition-all min-w-0 max-w-[11rem] shrink ${
                    selectedTable
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                  }`}
                  title={selectedTable ? selectedTable.location || undefined : t("tables.chooseNumber")}
                >
                  {(selectedTable?.type ?? "table") === "room" ? (
                    <DoorOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (selectedTable?.type ?? "table") === "person" ? (
                    <UserRound className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <Table2 className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <span className="truncate">{seatLabel(selectedTable, t)}</span>
                </button>
              )}
              {orderType === "delivery" && (
                <button
                  type="button"
                  onClick={() => setIsDeliveryFormOpen(true)}
                  className={`min-w-0 flex-1 inline-flex items-center gap-1.5 rounded-xl border-2 px-2 py-1 text-start transition-all touch-manipulation ${
                    deliveryReady
                      ? "border-cyan-500/45 bg-gradient-to-l from-cyan-500/15 via-sky-500/10 to-transparent hover:border-cyan-500/70"
                      : "border-rose-500/50 bg-gradient-to-l from-rose-500/12 via-orange-500/8 to-transparent hover:border-rose-500/70"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      deliveryReady
                        ? "bg-cyan-500 text-white shadow-sm shadow-cyan-500/30"
                        : "bg-rose-500/15 text-rose-600"
                    }`}
                  >
                    <Bike className="w-3.5 h-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[10px] sm:text-[11px] leading-tight">
                    <span className="font-extrabold me-1">{t("pos.deliveryDetails")}</span>
                    <span className="text-muted-foreground font-bold">
                      {t("drivers.name")}
                      {requireDeliveryDriver ? "*" : ""}:
                    </span>{" "}
                    <span className="font-extrabold">
                      {selectedDriver?.name || t("pos.selectDriver")}
                    </span>
                    <span className="text-muted-foreground mx-1">·</span>
                    <span className="text-muted-foreground font-bold">
                      {t("common.phoneNumber")}
                      {requireDeliveryPhone ? "*" : ""}:
                    </span>{" "}
                    <span className="font-extrabold tabular-nums" dir="ltr">
                      {deliveryPhone || t("keyboard.tapToEnter")}
                    </span>
                    <span className="text-muted-foreground mx-1">·</span>
                    <span className="text-muted-foreground font-bold">
                      {t("pos.deliveryAddress")}
                      {requireDeliveryAddress ? "*" : ""}:
                    </span>{" "}
                    <span className="font-extrabold">
                      {deliveryAddress.trim() || t("keyboard.tapToType")}
                    </span>
                  </span>
                  <span className="text-[10px] font-extrabold text-primary shrink-0">
                    {t("pos.editDeliveryDetails")}
                  </span>
                </button>
              )}
            </div>
            {compact && (
              <button
                onClick={() => setCartOpen(false)}
                className="touch-target w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary flex-shrink-0"
              >
                <X className="w-4 h-4" />
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
                  if (type !== "delivery") {
                    setSelectedDriverId(null);
                    setIsDeliveryFormOpen(false);
                  } else {
                    setIsDeliveryFormOpen(true);
                  }
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
        </div>

        {/* Cart Items — single-row professional lines */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
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
                className={`group flex items-center gap-2 sm:gap-2.5 rounded-2xl border px-2.5 py-2 shadow-[0_6px_18px_-14px_rgba(0,0,0,0.45)] transition-colors ${
                  isReturnLine
                    ? "border-rose-500/45 bg-gradient-to-l from-rose-500/15 via-rose-500/10 to-card/90 hover:border-rose-500/70"
                    : "border-border/50 bg-gradient-to-l from-secondary/70 via-card/80 to-card/90 hover:border-primary/35"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p
                      className={`truncate text-sm font-extrabold leading-tight ${
                        isReturnLine ? "text-rose-700 dark:text-rose-300" : ""
                      }`}
                    >
                      {menuItemDisplayName(item, locale)}
                    </p>
                    {isReturnLine && (
                      <span className="flex-shrink-0 rounded-full border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-700 dark:text-rose-300">
                        {t("pos.returnLine")}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={`flex flex-shrink-0 items-center gap-0.5 rounded-xl border p-0.5 ${
                    isReturnLine
                      ? "border-rose-500/40 bg-rose-500/10"
                      : "border-border/60 bg-background/70"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, -1, isReturnLine)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-secondary transition-colors"
                    aria-label={t("inventory.decrease")}
                  >
                    <Minus className="w-4.5 h-4.5" />
                  </button>
                  <span
                    className={`min-w-[1.85rem] text-center font-display font-extrabold text-base tabular-nums ${
                      isReturnLine ? "text-rose-700 dark:text-rose-300" : ""
                    }`}
                  >
                    {isReturnLine ? `-${item.cartQuantity}` : item.cartQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, 1, isReturnLine)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      isReturnLine
                        ? "text-rose-600 hover:bg-rose-500/15"
                        : "text-primary hover:bg-primary/15"
                    }`}
                    aria-label={t("common.increase")}
                  >
                    <Plus className="w-4.5 h-4.5" />
                  </button>
                </div>

                <span
                  className={`flex-shrink-0 font-display text-xs sm:text-sm font-bold tabular-nums whitespace-nowrap ${
                    isReturnLine ? "text-rose-600 dark:text-rose-400" : "text-primary"
                  }`}
                  dir="ltr"
                >
                  {formatMoneyAmount(lineAmount)}
                </span>

                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, -item.cartQuantity, isReturnLine)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-destructive/25 text-destructive hover:bg-destructive/15 transition-colors"
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </motion.div>
              );
            })}
          </AnimatePresence>
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-16">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p>{t("pos.emptyCart")}</p>
            </div>
          )}
        </div>

        {/* Summary & Checkout */}
        <div className="p-5 bg-card border-t border-border/50 space-y-4">
          {/* Discount + subtotal on one line */}
          <div className="flex items-center gap-2">
            {amountPadEnabled ? (
              <button
                type="button"
                onClick={() => setIsDiscountPadOpen(true)}
                className="min-w-0 flex-1 flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 hover:border-primary/40 hover:bg-primary/5 px-2.5 py-2 transition-colors text-start"
              >
                <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                  <Percent className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                  {t("pos.discountShort")}
                </span>
                <span
                  className={`ms-auto font-display text-xs sm:text-sm font-extrabold tabular-nums truncate ${
                    discount > 0 ? "text-green-500" : "text-foreground"
                  }`}
                  dir="ltr"
                >
                  {discount > 0 ? `- ${formatMoneyAmount(discount)}` : "0"}
                </span>
              </button>
            ) : (
              <div className="min-w-0 flex-1 flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-2.5 py-1.5">
                <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                  <Percent className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                  {t("pos.discountShort")}
                </span>
                <Input
                  type="number"
                  min={0}
                  step={decimalPlaces > 0 ? "0.01" : "1"}
                  inputMode="decimal"
                  amountPad
                  className="ms-auto h-8 w-[6.5rem] px-2 text-xs font-extrabold tabular-nums"
                  dir="ltr"
                  value={discount > 0 ? discount : ""}
                  placeholder="0"
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    const next = Math.min(v, subtotal > 0 ? subtotal : v);
                    setDiscount(next);
                  }}
                />
              </div>
            )}

            <div className="min-w-0 flex-1 flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-secondary/40 px-2.5 py-2">
              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{t("pos.sum")}</span>
              <span className="font-display text-xs sm:text-sm font-extrabold tabular-nums truncate" dir="ltr">
                {formatMoneyAmount(subtotal)}
              </span>
            </div>
          </div>

          {deliveryFeeAmount > 0 ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-2.5 py-2">
              <span className="text-xs sm:text-sm text-sky-700 dark:text-sky-300 font-bold inline-flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5" />
                {t("pos.deliveryFee")}
              </span>
              <span className="font-display text-xs sm:text-sm font-extrabold tabular-nums text-sky-700 dark:text-sky-300" dir="ltr">
                {formatMoneyAmount(deliveryFeeAmount)}
              </span>
            </div>
          ) : null}

          <div className="flex items-stretch gap-2.5 pt-1">
            <div
              className={`min-w-0 flex-1 relative overflow-hidden rounded-2xl border px-3.5 py-2.5 sm:px-4 sm:py-3 ${
                total < 0
                  ? "border-rose-500/35 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent"
                  : "border-primary/35 bg-gradient-to-br from-primary/20 via-primary/8 to-amber-500/10 shadow-[0_10px_28px_-16px_hsl(var(--primary)/0.55)]"
              }`}
            >
              <div className="absolute -end-6 -top-8 h-20 w-20 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
              <p className="relative text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {t("common.total")}
              </p>
              <p
                className={`relative mt-0.5 font-display text-xl sm:text-2xl md:text-[1.7rem] font-black tabular-nums leading-none tracking-tight truncate ${
                  total < 0 ? "text-rose-600 dark:text-rose-400" : "text-primary"
                }`}
                dir="ltr"
              >
                {formatMoneyAmount(total)}
              </p>
            </div>

            <Button
              className="h-auto min-h-[3.25rem] sm:min-h-[3.75rem] px-4 sm:px-5 text-sm sm:text-base font-extrabold touch-target rounded-2xl shadow-lg shadow-primary/20 whitespace-normal text-center leading-tight max-w-[46%] sm:max-w-[42%]"
              isLoading={saveForCashier && isSavingOrder}
              disabled={
                cart.length === 0 ||
                (orderType === "dine_in" && !selectedTableId) ||
                !deliveryReady ||
                isSavingOrder
              }
              onClick={openCheckout}
            >
              {orderType === "dine_in" && !selectedTableId
                ? t("pos.chooseSeatFirst")
                : orderType === "delivery" && !deliveryReady
                  ? t("pos.deliveryRequiresAll")
                  : saveForCashier
                    ? t("pos.saveInvoice")
                    : t("pos.payAndInvoice")}
            </Button>
          </div>
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
              ? "px-4 py-2.5 xl:px-5 xl:py-3"
              : "px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3 xl:px-6 xl:py-3.5 sm:flex-row sm:items-center sm:justify-between"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="icon" className="touch-target flex-shrink-0" onClick={() => window.history.back()}>
              <ArrowLeft />
            </Button>
            <div className="min-w-0">
              <h1 className={`font-extrabold truncate ${isPortraitPos ? "text-2xl xl:text-3xl" : "text-lg sm:text-xl md:text-2xl xl:text-3xl"}`}>
                {t("pos.title")}
              </h1>
              <p className="text-xs sm:text-sm text-primary font-display tracking-widest uppercase truncate">
                {branchLabel} · {isPortraitPos ? t("pos.itemsScreen") : "POS"}
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
          {textKeyboardEnabled ? (
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
                {search || t("pos.searchItem")}
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
                  aria-label={t("pos.clearSearch")}
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              ) : null}
            </button>
          ) : (
            <div
              className={`relative w-full ${isPortraitPos ? "max-w-none" : "sm:w-72 md:w-80 xl:w-96"}`}
            >
              <Search className="absolute end-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("pos.searchItem")}
                noTextKeyboard
                className="h-11 xl:h-12 pe-11 text-sm font-semibold"
              />
            </div>
          )}
        </header>

        <div className={`py-3 flex gap-2 sm:gap-3 overflow-x-auto relative z-10 scrollbar-hide ${isPortraitPos ? "px-4 xl:px-5" : "px-3 sm:px-5 xl:px-6"}`}>
          <Button
            variant={activeCategory === "favorites" ? "default" : "secondary"}
            onClick={() => setActiveCategory("favorites")}
            className={`rounded-full px-3 sm:px-5 flex-shrink-0 touch-target gap-1.5 shadow-none hover:translate-y-0 ${
              activeCategory === "favorites"
                ? "bg-amber-500 hover:bg-amber-500/90 text-white border border-amber-500 from-amber-500 to-amber-500"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/15"
            }`}
          >
            <Star className="w-4 h-4 text-black fill-black" />
            {t("pos.favorites")}
          </Button>
          <Button
            variant={activeCategory === null ? "default" : "secondary"}
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-4 sm:px-6 flex-shrink-0 touch-target shadow-none hover:translate-y-0 ${
              activeCategory === null
                ? "bg-primary hover:bg-primary/90 text-primary-foreground border border-primary from-primary to-primary shadow-md shadow-primary/25"
                : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 hover:text-primary"
            }`}
          >
            {t("common.all")}
          </Button>
          {categories?.map((cat) => {
            const selected = activeCategory === cat.id;
            return (
              <Button
                key={cat.id}
                variant={selected ? "default" : "secondary"}
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-full px-3 sm:px-5 whitespace-nowrap flex-shrink-0 touch-target gap-2 shadow-none hover:translate-y-0 ${
                  selected
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground border border-primary from-primary to-primary shadow-md shadow-primary/25"
                    : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 hover:text-primary"
                }`}
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
            );
          })}
        </div>

        <div className={`flex-1 overflow-y-auto relative z-10 ${isCompactPos ? "pb-28 p-3 sm:p-4" : isPortraitPos ? "p-4 xl:p-5" : "p-3 sm:p-4 md:p-5 xl:p-6"}`}>
          {needsBranchPick && (
            <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
              {t("pos.allBranchesBlock")}
            </div>
          )}
          {shiftClosed && (
            <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
              {t("pos.shiftClosedBlock")}
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
                const inCart = cart.find(
                  (c) => c.id === item.id && Boolean(c.isReturn) === isReturnMode
                );
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
                        isReturnMode
                          ? inCart
                            ? "border-rose-500/80 shadow-lg shadow-rose-500/20 ring-1 ring-rose-500/40"
                            : "border-rose-500/35 hover:border-rose-500/70 hover:shadow-xl hover:shadow-rose-500/15"
                          : inCart
                            ? "border-primary/70 shadow-lg shadow-primary/15 ring-1 ring-primary/30"
                            : "border-border/50 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10"
                      }`}
                  >
                    {inCart && (
                      <div
                        className={`absolute top-2 left-2 min-w-7 h-7 px-1.5 rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-md ${
                          isReturnMode
                            ? "bg-rose-600 text-white"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        {isReturnMode ? `-${inCart.cartQuantity}` : inCart.cartQuantity}
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
                          alt={menuItemDisplayName(item, locale)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ChefHat className="w-10 h-10 sm:w-12 sm:h-12 text-primary/40" />
                      )}
                    </div>
                    <div className="mt-auto">
                      <h3 className="font-extrabold text-sm sm:text-base leading-tight mb-2 line-clamp-2">
                        {menuItemDisplayName(item, locale)}
                      </h3>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-primary font-extrabold font-display text-sm sm:text-lg">
                          {formatIQD(Number(item.price))}
                          <span className="text-[10px] ms-1 font-bold opacity-70">{currencySymbol}</span>
                        </div>
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isReturnMode
                              ? "bg-rose-500/15 text-rose-600"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
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

        <footer
          className={`relative z-20 flex-shrink-0 border-t border-border/60 bg-card/85 backdrop-blur-xl safe-pb ${
            isPortraitPos ? "px-4 py-3 xl:px-5" : "px-3 py-2.5 sm:px-5 xl:px-6"
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsReturnMode((v) => !v)}
              className={`group relative inline-flex h-12 sm:h-14 min-w-[7.5rem] flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-2xl border-2 px-3.5 sm:px-4 text-sm sm:text-base font-extrabold transition-all active:scale-[0.98] ${
                isReturnMode
                  ? "border-rose-400/80 bg-gradient-to-l from-rose-600 via-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/35 hover:brightness-110"
                  : "border-rose-500/40 bg-gradient-to-l from-rose-500/12 via-card to-card text-rose-700 dark:text-rose-300 hover:border-rose-500/70 hover:from-rose-500/18"
              }`}
              title={t("pos.returnModeOn")}
              aria-pressed={isReturnMode}
            >
              <span
                className={`absolute inset-0 pointer-events-none transition-opacity ${
                  isReturnMode
                    ? "bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.28),transparent_55%)] opacity-100"
                    : "opacity-0 group-hover:opacity-100 bg-[radial-gradient(circle_at_20%_15%,hsla(var(--primary),0.08),transparent_55%)]"
                }`}
              />
              <span
                className={`relative inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition-colors ${
                  isReturnMode
                    ? "border-white/35 bg-white/20 text-white shadow-inner"
                    : "border-rose-500/35 bg-rose-500/15 text-rose-600 dark:text-rose-300 group-hover:bg-rose-500/25"
                }`}
              >
                <RotateCcw
                  className={`w-[1.15rem] h-[1.15rem] sm:w-5 sm:h-5 ${
                    isReturnMode ? "animate-[spin_0.7s_ease-out]" : ""
                  }`}
                  strokeWidth={2.35}
                />
              </span>
              <span className="relative truncate tracking-tight">{t("pos.return")}</span>
              {isReturnMode ? (
                <span className="relative hidden sm:inline-flex h-2 w-2 rounded-full bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.25)]" />
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => {
                setTableOrderPulse(false);
                openSeatPicker("tableOrders");
              }}
              className={`group relative inline-flex h-12 sm:h-14 min-w-0 flex-[1.25] items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 bg-gradient-to-l from-sky-500/15 via-card to-card px-3 sm:px-4 text-sm sm:text-base font-extrabold text-sky-800 dark:text-sky-200 shadow-md shadow-sky-500/10 transition-all hover:border-sky-500/70 hover:from-sky-500/25 active:scale-[0.98] ${
                tableOrderPulse
                  ? "border-sky-500/80 ring-2 ring-sky-400/50 animate-pulse"
                  : unpaidTableOrderCount > 0
                    ? "border-sky-500/65"
                    : "border-sky-500/40"
              }`}
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsla(199,89%,48%,0.18),transparent_55%)] pointer-events-none opacity-80" />
              <span className="relative inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-300">
                <Table2 className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.25} />
              </span>
              <span className="relative truncate">{t("pos.tableOrderLists")}</span>
              {todayTableOrders.length > 0 ? (
                <span
                  className={`relative ms-0.5 inline-flex min-w-6 h-6 items-center justify-center rounded-full border px-1.5 text-[11px] font-display font-bold tabular-nums ${
                    unpaidTableOrderCount > 0 || tableOrderPulse
                      ? "bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/40"
                      : "bg-sky-500/20 border-sky-500/30 text-sky-800 dark:text-sky-100"
                  }`}
                >
                  {unpaidTableOrderCount > 0 ? unpaidTableOrderCount : todayTableOrders.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => openSeatPicker("openOrders")}
              className="group relative inline-flex h-12 sm:h-14 min-w-0 flex-[1.45] items-center justify-center gap-2 overflow-hidden rounded-2xl border border-primary/35 bg-gradient-to-l from-primary via-primary to-amber-500 px-4 text-sm sm:text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_55%)] pointer-events-none" />
              <PencilLine className="relative w-5 h-5" />
              <span className="relative truncate">{t("pos.editLists")}</span>
              {todayBranchOrders.length > 0 && (
                <span className="relative ms-0.5 inline-flex min-w-6 h-6 items-center justify-center rounded-full bg-white/25 px-1.5 text-[11px] font-display font-bold tabular-nums">
                  {todayBranchOrders.length}
                </span>
              )}
            </button>

            {selectedTable && (
              <div className="hidden md:flex max-w-[11rem] flex-col items-end leading-tight rounded-xl border border-primary/25 bg-primary/10 px-3 py-2">
                <span className="text-[10px] font-bold text-primary/80">{t("pos.selectedMark")}</span>
                <span className="truncate text-xs font-extrabold text-foreground">
                  {seatLabel(selectedTable, t)}
                </span>
              </div>
            )}
          </div>
        </footer>
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
        <span>{t("pos.cart", { count: cart.reduce((n, i) => n + i.cartQuantity, 0) })}</span>
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

      {/* ── Seat picker: tables / rooms / people ── */}
      <Dialog
        isOpen={isTablePickerOpen}
        onClose={closeSeatPicker}
        title={
          seatPickerMode === "openOrders"
            ? t("pos.editListsTitle")
            : seatPickerMode === "tableOrders"
              ? t("pos.tableOrderListsTitle")
              : t("tables.chooseNumber")
        }
        maxWidth="max-w-5xl"
      >
        <div className="space-y-4">
          {seatPickerMode === "openOrders" || seatPickerMode === "tableOrders" ? (
            <>
              <div
                className={`rounded-2xl border px-4 py-3 flex items-start justify-between gap-3 ${
                  seatPickerMode === "tableOrders"
                    ? "border-sky-500/30 bg-gradient-to-l from-sky-500/12 via-primary/5 to-transparent"
                    : "border-amber-500/25 bg-gradient-to-l from-amber-500/10 via-primary/5 to-transparent"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {seatPickerMode === "tableOrders"
                      ? t("pos.tableOrderListsTitle")
                      : t("pos.editListsTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {seatPickerMode === "tableOrders"
                      ? t("pos.tableOrderListsHint")
                      : t("pos.editListsHint")}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-extrabold tabular-nums ${
                    seatPickerMode === "tableOrders"
                      ? "border-sky-500/30 bg-sky-500/15 text-sky-800 dark:text-sky-200"
                      : "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {t("pos.todayListsCount", { n: pickerListOrders.length })}
                </span>
              </div>

              {needsBranchPick ? (
                <div className="rounded-3xl border border-dashed border-amber-500/40 bg-amber-500/10 py-14 text-center text-amber-700 dark:text-amber-300">
                  <Armchair className="w-12 h-12 mx-auto mb-3 opacity-70" />
                  <p className="font-bold">{t("pos.pickBranchFirstTitle")}</p>
                  <p className="text-xs mt-1 opacity-80">{t("pos.pickBranchFirstHint")}</p>
                </div>
              ) : pickerListOrders.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/70 bg-secondary/30 py-14 text-center text-muted-foreground">
                  {seatPickerMode === "tableOrders" ? (
                    <Table2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  ) : (
                    <PencilLine className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  )}
                  <p className="font-bold">
                    {seatPickerMode === "tableOrders"
                      ? t("pos.noTableOrderLists")
                      : t("pos.noOpenSeats")}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden max-h-[min(62vh,560px)] overflow-y-auto overscroll-contain shadow-sm">
                  <div className="divide-y divide-border/50">
                    {pickerListOrders.map((order, idx) => {
                      const seat =
                        branchTables.find((t) => t.id === order.tableId) ??
                        (order.table as RestaurantTable | undefined);
                      const seatType = (seat?.type ?? "table") as SeatEntityType;
                      const isSelected = editingOrderId === order.id;
                      const received = isPosOrderReceived(order);
                      const typeLabel =
                        order.type === "takeaway"
                          ? t("order.takeaway")
                          : order.type === "delivery"
                            ? t("order.delivery")
                            : seatType === "room"
                              ? t("seat.room")
                              : seatType === "person"
                                ? t("seat.person")
                                : t("seat.table");
                      const payable = (() => {
                        const subtotal = Number(order.subtotal) || 0;
                        const discount = Math.max(0, Number(order.discount) || 0);
                        const deliveryFee = Math.max(
                          0,
                          Number((order as Order & { deliveryFee?: number }).deliveryFee) || 0
                        );
                        if (subtotal > 0 || discount > 0 || deliveryFee > 0) {
                          return Math.max(0, subtotal - discount + deliveryFee);
                        }
                        return Math.max(0, Number(order.total) || 0);
                      })();
                      return (
                        <motion.button
                          key={order.id}
                          type="button"
                          disabled={isUpdatingPerson}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.02, 0.28) }}
                          onClick={() => selectTodayOrder(order)}
                          className={`w-full text-start px-4 sm:px-5 py-3.5 sm:py-4 flex items-center gap-3 sm:gap-4 transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-primary/10"
                              : received
                                ? "hover:bg-emerald-500/5"
                                : "hover:bg-amber-500/5"
                          } ${isUpdatingPerson ? "opacity-60" : ""}`}
                        >
                          <div className="flex flex-col items-center gap-1 flex-shrink-0">
                            <span className="text-[11px] font-black tabular-nums text-muted-foreground">
                              #{idx + 1}
                            </span>
                            <div
                              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center border overflow-hidden ${
                                isSelected
                                  ? "bg-primary/15 border-primary/40 text-primary"
                                  : received
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                    : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
                              }`}
                            >
                              {order.type === "takeaway" ? (
                                <ShoppingBag className="w-6 h-6" />
                              ) : order.type === "delivery" ? (
                                <Truck className="w-6 h-6" />
                              ) : seatType === "room" ? (
                                <RoomIcon className="w-10 h-auto" />
                              ) : seatType === "person" ? (
                                <UserRound className="w-6 h-6" />
                              ) : (
                                <DiningTableIcon className="w-10 h-auto" />
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-extrabold text-sm sm:text-base truncate">
                                {orderListTitle(order)}
                              </p>
                              <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/70 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                {typeLabel}
                              </span>
                              {isTableOrderSource(order) ? (
                                <span className="inline-flex items-center rounded-full border border-sky-500/35 bg-sky-500/15 px-2 py-0.5 text-[10px] font-extrabold text-sky-800 dark:text-sky-200">
                                  {t("pos.fromTableOrderBadge")}
                                </span>
                              ) : null}
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${
                                  received
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                    : "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30"
                                }`}
                              >
                                {received
                                  ? t("cashier.colPaid")
                                  : t("cashier.colUnpaid")}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] sm:text-xs text-muted-foreground">
                              <span className="font-display font-bold text-foreground/80">
                                {order.orderNumber}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 tabular-nums font-bold text-foreground/85"
                                dir="ltr"
                              >
                                <Clock className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                                {formatListDateTime(order.createdAt)}
                              </span>
                              {order.type === "delivery" && order.deliveryAddress ? (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 text-primary/80" />
                                  {order.deliveryAddress}
                                </span>
                              ) : null}
                              {seat?.location && order.type === "dine_in" ? (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 text-primary/80" />
                                  {seat.location}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="font-display text-sm sm:text-base font-extrabold tabular-nums text-foreground">
                              {formatMoneyAmount(payable)}
                            </span>
                            {isSelected ? (
                              <CheckCircle2 className="w-5 h-5 text-primary" />
                            ) : (
                              <span className="w-5 h-5 rounded-full border border-border/70" />
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
          <div className="flex p-1 rounded-xl bg-secondary/50 border border-border/50 gap-1">
            {SEAT_TABS.map(({ key, labelKey, icon: Icon }) => {
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
                  <span>{t(labelKey)}</span>
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
                  ? t("pos.roomHall")
                  : pickerEntityType === "person"
                    ? t("pos.personList")
                    : t("pos.tableHall")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {needsBranchPick
                  ? t("menu.pickBranchFirst")
                  : pickerEntityType === "person"
                    ? t("pos.pickPerson", { branch: branchLabel })
                    : pickerEntityType === "room"
                      ? t("pos.pickRoom", { branch: branchLabel })
                      : t("pos.pickTable", { branch: branchLabel })}
              </p>
            </div>
          </div>

          {needsBranchPick ? (
            <div className="rounded-3xl border border-dashed border-amber-500/40 bg-amber-500/10 py-14 text-center text-amber-700 dark:text-amber-300">
              <Armchair className="w-12 h-12 mx-auto mb-3 opacity-70" />
              <p className="font-bold">{t("pos.pickBranchFirstTitle")}</p>
              <p className="text-xs mt-1 opacity-80">{t("pos.pickBranchFirstHint")}</p>
            </div>
          ) : pickerEntityType === "person" ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl p-[1.5px] bg-gradient-to-l from-primary via-amber-400 to-primary/40 shadow-md shadow-primary/10">
                {textKeyboardEnabled ? (
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
                      {personSearch || t("pos.searchPerson")}
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      {t("pos.tapKeyboard")}
                    </span>
                  </span>
                </button>
                ) : (
                  <div className="w-full h-14 sm:h-[3.75rem] rounded-[0.9rem] bg-background/95 backdrop-blur-md px-3 pe-12 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-amber-500/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                      <Search className="w-5 h-5 text-primary" />
                    </span>
                    <Input
                      type="search"
                      value={personSearch}
                      onChange={(e) => setPersonSearch(e.target.value)}
                      placeholder={t("pos.searchPerson")}
                      noTextKeyboard
                      className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-base font-extrabold"
                    />
                  </div>
                )}
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
                    aria-label={t("pos.clearSearch")}
                  >
                    <X className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] font-bold text-primary/70 bg-primary/10 border border-primary/20 rounded-lg px-2 py-1">
                    {t("pos.search")}
                  </span>
                )}
              </div>

              {pickerSeats.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/70 bg-secondary/30 py-12 text-center text-muted-foreground">
                  <UserRound className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-bold">
                    {personSearch.trim()
                      ? t("pos.noSearchResults")
                      : seatTypeCounts.person === 0
                        ? t("pos.noPersonsForBranch")
                        : t("common.noResults")}
                  </p>
                  {personSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => setPersonSearch("")}
                      className="mt-3 text-sm font-bold text-primary hover:underline"
                    >
                      {t("pos.clearSearch")}
                    </button>
                  )}
                </div>
              ) : (
            <div className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden max-h-[min(55vh,520px)] overflow-y-auto overscroll-contain">
              <div className="divide-y divide-border/50">
                {pickerSeats.map((person, idx) => {
                  const meta =
                    TABLE_STATUS_META[person.status] ?? TABLE_STATUS_META.available;
                  const isSelected = selectedTableId === person.id;
                  const name = String(person.number);
                  const openStage = openSeatStages.get(person.id);
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
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
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
                          {openStage?.cashier && (
                            <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-extrabold">
                              {t("pos.openOnCashier")}
                            </span>
                          )}
                          {openStage?.kitchen && (
                            <span className="rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 px-2 py-0.5 text-[10px] font-extrabold">
                              {t("pos.openOnKitchen")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] sm:text-[11px] font-bold flex-shrink-0 ${meta.chip}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        {t(seatStatusLabelKey(person.status))}
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
                  ? t("pos.noRoomsForBranch")
                  : t("pos.noTablesForBranch")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 max-h-[min(62vh,560px)] overflow-y-auto overscroll-contain pe-1">
              {pickerSeats.map((table, idx) => {
                const meta = TABLE_STATUS_META[table.status] ?? TABLE_STATUS_META.available;
                const openStage = openSeatStages.get(table.id);
                // Allow pick when available/occupied or already has an open invoice
                const canPick =
                  table.status === "available" ||
                  table.status === "occupied" ||
                  Boolean(openStage);
                const isSelected = selectedTableId === table.id;
                const isRoom = pickerEntityType === "room";
                return (
                  <motion.button
                    key={table.id}
                    type="button"
                    disabled={!canPick}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.35) }}
                    whileHover={canPick ? { y: -4 } : undefined}
                    whileTap={canPick ? { scale: 0.97 } : undefined}
                    onClick={() => {
                      if (!canPick) return;
                      setSelectedTableId(table.id);
                      closeSeatPicker();
                    }}
                    className={`
                      group relative aspect-[4/5] rounded-[1.75rem] border-2 backdrop-blur-xl
                      overflow-hidden text-center shadow-lg shadow-black/5
                      ${meta.card} ${isSelected ? "ring-4 ring-primary/50 border-primary" : meta.ring}
                      transition-shadow duration-300
                      ${canPick ? "hover:shadow-xl cursor-pointer" : "opacity-45 cursor-not-allowed grayscale-[0.35]"}
                    `}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${meta.glow}`} />

                    <div className="relative z-10 h-full flex flex-col items-center justify-between p-3 sm:p-4">
                      <div className="w-full flex flex-col items-center gap-1.5">
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] sm:text-[11px] font-bold ${meta.chip}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          {t(seatStatusLabelKey(table.status))}
                        </div>
                        {openStage && (
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {openStage.cashier && (
                              <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-extrabold text-white shadow-sm">
                                {t("pos.openOnCashier")}
                              </span>
                            )}
                            {openStage.kitchen && (
                              <span className="rounded-full bg-sky-500/90 px-2 py-0.5 text-[9px] font-extrabold text-white shadow-sm">
                                {t("pos.openOnKitchen")}
                              </span>
                            )}
                          </div>
                        )}
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
                            {isRoom ? t("seat.capacity") : t("seat.seats")}
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
                            {t("pos.selectedMark")}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
            </>
          )}
        </div>
      </Dialog>

      {/* ── Payment Dialog ── */}
      <Dialog
        isOpen={isCheckoutOpen}
        onClose={() => !orderSuccess && setIsCheckoutOpen(false)}
        title={orderSuccess ? t("tableOrder.success") : t("pos.choosePayment")}
        maxWidth="max-w-lg"
      >
        {orderSuccess ? (
          <div className="text-center py-4 space-y-4">
            <div className="text-6xl">🎉</div>
            <p className="text-lg font-bold">
              {saveForCashier
                ? t("pos.sentToCashier")
                : salesSendToKitchen
                  ? t("pos.sentToKitchen")
                  : t("pos.orderSaved")}
            </p>
            <p className="text-sm text-muted-foreground font-display" dir="ltr">
              {invoiceNumber}
            </p>
            {selectedTable && (
              <p className="text-muted-foreground">{seatLabel(selectedTable, t)}</p>
            )}
            <p className="text-2xl font-bold text-primary font-display">
              {formatMoneyAmount(total)}
            </p>
            <Button className="w-full touch-target" onClick={resetOrder}>
              <RefreshCw className="w-4 h-4 me-2" />
              {t("pos.newOrder")}
            </Button>
          </div>
        ) : (
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
                {seatLabel(selectedTable, t)}
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
                  setCheckoutReceived(total);
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
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-muted-foreground">
                  {t("cashier.subtotal")}
                </span>
                <span
                  className="font-display text-base sm:text-lg font-extrabold tabular-nums"
                  dir="ltr"
                >
                  {formatMoneyAmount(subtotal)}
                </span>
              </div>

              <div className="px-4 py-3 border-b border-border/40">
                {amountPadEnabled ? (
                  <button
                    type="button"
                    onClick={() => setIsDiscountPadOpen(true)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border-2 border-border/60 bg-background/70 hover:border-amber-500/50 hover:bg-amber-500/5 px-3 py-2.5 transition-colors touch-manipulation"
                  >
                    <span className="inline-flex items-center gap-2 font-extrabold text-sm">
                      <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                        <Percent className="w-4 h-4" />
                      </span>
                      {t("pos.invoiceDiscount")}
                    </span>
                    <span
                      className={`font-display text-lg sm:text-xl font-extrabold tabular-nums ${
                        discount > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground"
                      }`}
                      dir="ltr"
                    >
                      {discount > 0
                        ? `− ${formatMoneyAmount(discount)}`
                        : formatMoneyAmount(0)}
                    </span>
                  </button>
                ) : (
                  <div className="w-full flex items-center justify-between gap-3 rounded-xl border-2 border-border/60 bg-background/70 px-3 py-2.5">
                    <span className="inline-flex items-center gap-2 font-extrabold text-sm">
                      <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                        <Percent className="w-4 h-4" />
                      </span>
                      {t("pos.invoiceDiscount")}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={decimalPlaces > 0 ? "0.01" : "1"}
                      inputMode="decimal"
                      amountPad
                      className="h-10 w-[8.5rem] text-base font-extrabold tabular-nums"
                      dir="ltr"
                      value={discount > 0 ? discount : ""}
                      placeholder="0"
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        const next = Math.min(v, subtotal > 0 ? subtotal : v);
                        setDiscount(next);
                        const nextTotal = subtotal - next + deliveryFeeAmount;
                        if (isCheckoutOpen && !orderSuccess) {
                          setCheckoutReceived(Math.max(0, nextTotal));
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {deliveryFeeAmount > 0 ? (
                <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-sky-700 dark:text-sky-300 inline-flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5" />
                    {t("pos.deliveryFee")}
                  </span>
                  <span
                    className="font-display text-base sm:text-lg font-extrabold tabular-nums text-sky-700 dark:text-sky-300"
                    dir="ltr"
                  >
                    {formatMoneyAmount(deliveryFeeAmount)}
                  </span>
                </div>
              ) : null}

              <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm font-bold">{t("pos.invoiceTotal")}</span>
                </div>
                <span className="font-display text-xl sm:text-2xl font-extrabold text-primary tabular-nums" dir="ltr">
                  {formatMoneyAmount(total)}
                </span>
              </div>

              <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-foreground">{t("pos.receivedTotal")}</span>
                </div>
                {checkoutPayMethod === "cash" ? (
                  amountPadEnabled ? (
                    <button
                      type="button"
                      onClick={() => setIsReceivedPadOpen(true)}
                      className="min-w-[7.5rem] rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-display text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums hover:border-emerald-500 transition-colors touch-manipulation"
                      dir="ltr"
                    >
                      {formatMoneyAmount(checkoutReceived)}
                    </button>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      step={decimalPlaces > 0 ? "0.01" : "1"}
                      inputMode="decimal"
                      amountPad
                      className="min-w-[7.5rem] h-11 w-[8.5rem] border-2 border-emerald-500/40 bg-emerald-500/10 text-lg font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400"
                      dir="ltr"
                      value={checkoutReceived > 0 ? checkoutReceived : ""}
                      placeholder="0"
                      onChange={(e) =>
                        setCheckoutReceived(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                  )
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

              {checkoutPayMethod === "cash" ? (
                <div className="px-4 py-3 flex items-center justify-between gap-3 bg-secondary/25">
                  <span className="text-sm font-bold text-muted-foreground">{t("pos.change")}</span>
                  <span
                    className={`font-display text-lg font-extrabold tabular-nums ${
                      checkoutReceived >= total ? "text-amber-500" : "text-rose-500"
                    }`}
                    dir="ltr"
                  >
                    {checkoutReceived >= total
                      ? formatMoneyAmount(checkoutChange)
                      : t("pos.shortage", { amount: formatMoneyAmount(total - checkoutReceived) })}
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
                              <p className="text-[10px] text-muted-foreground font-display tabular-nums mt-0.5" dir="ltr">
                                {formatMoneyAmount(Number(card.balance ?? 0))}
                              </p>
                            </div>
                            {active ? <CheckCircle2 className="w-5 h-5 text-sky-500 flex-shrink-0" /> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                className="h-14 text-sm sm:text-base touch-target gap-2 border-2"
                isLoading={isSavingOrder}
                disabled={
                  isSavingOrder ||
                  (checkoutPayMethod === "cash" && checkoutReceived < total) ||
                  (checkoutPayMethod === "card" && !checkoutCardId)
                }
                onClick={() => confirmDirectCheckout(false)}
              >
                <CheckCircle2 className="w-5 h-5" />
                {t("pos.saveInvoice")}
              </Button>
              <Button
                className="h-14 text-sm sm:text-base touch-target gap-2"
                isLoading={isSavingOrder}
                disabled={
                  isSavingOrder ||
                  (checkoutPayMethod === "cash" && checkoutReceived < total) ||
                  (checkoutPayMethod === "card" && !checkoutCardId)
                }
                onClick={() => confirmDirectCheckout(true)}
              >
                <Printer className="w-5 h-5" />
                {t("pos.saveAndPrint")}
              </Button>
            </div>
            {devicePrinter?.printerName?.trim() ? (
              <p className="text-[11px] text-center text-muted-foreground font-semibold">
                {t("pos.devicePrinter", { name: devicePrinter.printerName.trim() })}
              </p>
            ) : (
              <p className="text-[11px] text-center text-amber-600 dark:text-amber-400 font-semibold">
                {t("pos.printerMissing")}
              </p>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={amountPadEnabled && isReceivedPadOpen}
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

      <Dialog
        isOpen={amountPadEnabled && isDiscountPadOpen}
        onClose={() => setIsDiscountPadOpen(false)}
        title={t("pos.invoiceDiscount")}
        maxWidth="max-w-sm"
        layer="overlay"
      >
        <NumericKeypad
          value={discount}
          suffix={currencySymbol}
          allowDecimal={decimalPlaces > 0}
          maxDecimalPlaces={decimalPlaces}
          maxValue={subtotal > 0 ? subtotal : undefined}
          label={t("pos.enterDiscount")}
          onCancel={() => setIsDiscountPadOpen(false)}
          onConfirm={(v) => {
            const next = Math.max(0, Math.min(v, subtotal > 0 ? subtotal : v));
            setDiscount(next);
            const nextTotal = subtotal - next + deliveryFeeAmount;
            if (isCheckoutOpen && !orderSuccess) {
              setCheckoutReceived(Math.max(0, nextTotal));
            }
            setIsDiscountPadOpen(false);
          }}
        />
      </Dialog>

      <Dialog
        isOpen={isDeliveryFormOpen}
        onClose={() => setIsDeliveryFormOpen(false)}
        hideHeader
        maxWidth="max-w-xl"
      >
        <div className="flex flex-col gap-4" dir="rtl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center shrink-0">
                <Bike className="w-6 h-6" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  {t("pos.deliveryDetails")}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
                  {t("pos.deliveryDetailsHint")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsDeliveryFormOpen(false)}
              className="rounded-full min-h-11 min-w-11 p-2.5 hover:bg-secondary transition-colors flex-shrink-0 touch-manipulation inline-flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-extrabold">
                {t("drivers.name")}
                {requireDeliveryDriver ? (
                  <span className="text-rose-500 ms-1">*</span>
                ) : null}
              </p>
              {selectedDriver ? (
                <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                  {selectedDriver.name}
                </span>
              ) : null}
            </div>
            {driversLoading ? (
              <div className="rounded-2xl border border-border/60 bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground font-semibold">
                {t("common.loading")}
              </div>
            ) : activeDrivers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground font-semibold">
                {t("pos.noDriversAvailable")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[min(36vh,280px)] overflow-y-auto overscroll-contain pe-0.5">
                {activeDrivers.map((driver) => {
                  const selected = selectedDriverId === driver.id;
                  return (
                    <button
                      key={driver.id}
                      type="button"
                      onClick={() => setSelectedDriverId(driver.id)}
                      className={`touch-manipulation text-start rounded-2xl border-2 px-3.5 py-3 transition-all ${
                        selected
                          ? "border-cyan-500 bg-cyan-500/15 shadow-md shadow-cyan-500/15 ring-1 ring-cyan-500/30"
                          : "border-border/60 bg-background/50 hover:border-cyan-500/40 hover:bg-cyan-500/5"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            selected
                              ? "bg-cyan-500 text-white"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          <Bike className="w-5 h-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-sm truncate">{driver.name}</p>
                          {(driver.phone || driver.vehicleInfo || driver.branchName) && (
                            <p className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">
                              {[driver.phone, driver.vehicleInfo, driver.branchName]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        {selected ? (
                          <CheckCircle2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-2">
            {amountPadEnabled ? (
              <button
                type="button"
                onClick={() => setIsPhonePadOpen(true)}
                className={`w-full touch-manipulation text-start rounded-2xl border-2 px-3.5 py-3.5 transition-all ${
                  phoneKnown === true
                    ? "border-success/55 bg-success/5"
                    : requireDeliveryPhone && deliveryPhoneDigits.length < 7
                      ? "border-rose-500/55 bg-rose-500/5 ring-1 ring-rose-500/15"
                      : phoneKnown === false
                        ? "border-destructive/55 bg-destructive/5"
                        : "border-border/60 bg-background/50 hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      phoneKnown === true
                        ? "bg-success/15 text-success"
                        : requireDeliveryPhone && deliveryPhoneDigits.length < 7
                          ? "bg-rose-500/15 text-rose-600"
                          : phoneKnown === false
                            ? "bg-destructive/15 text-destructive"
                            : "bg-primary/15 text-primary"
                    }`}
                  >
                    <Phone className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-muted-foreground">
                      {t("common.phoneNumber")}
                      {requireDeliveryPhone ? " *" : ""}
                    </p>
                    <p
                      className={`text-base font-extrabold tabular-nums truncate mt-0.5 ${
                        deliveryPhone ? "text-foreground" : "text-muted-foreground/70"
                      }`}
                      dir="ltr"
                    >
                      {deliveryPhone || t("keyboard.tapToEnter")}
                    </p>
                  </div>
                  {phoneKnown === true ? (
                    <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                  ) : phoneKnown === false ? (
                    <XCircle className="w-5 h-5 text-destructive shrink-0" />
                  ) : (
                    <PencilLine className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              </button>
            ) : (
              <div
                className={`w-full rounded-2xl border-2 px-3.5 py-3 transition-all ${
                  phoneKnown === true
                    ? "border-success/55 bg-success/5"
                    : requireDeliveryPhone && deliveryPhoneDigits.length < 7
                      ? "border-rose-500/55 bg-rose-500/5"
                      : phoneKnown === false
                        ? "border-destructive/55 bg-destructive/5"
                        : "border-border/60 bg-background/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-muted-foreground mb-1">
                      {t("common.phoneNumber")}
                      {requireDeliveryPhone ? " *" : ""}
                    </p>
                    <Input
                      type="tel"
                      inputMode="tel"
                      noAmountPad
                      noTextKeyboard
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                      placeholder={t("keyboard.tapToEnter")}
                      className="h-10 text-base font-extrabold tabular-nums"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            )}

            {textKeyboardEnabled ? (
              <button
                type="button"
                onClick={() => setIsAddressPadOpen(true)}
                className={`w-full touch-manipulation text-start rounded-2xl border-2 px-3.5 py-3.5 transition-all ${
                  !requireDeliveryAddress || deliveryAddress.trim()
                    ? "border-border/60 bg-background/50 hover:border-amber-500/40 hover:bg-amber-500/5"
                    : "border-rose-500/55 bg-rose-500/5 ring-1 ring-rose-500/15"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      !requireDeliveryAddress || deliveryAddress.trim()
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-rose-500/15 text-rose-600"
                    }`}
                  >
                    <MapPin className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-muted-foreground">
                      {t("pos.deliveryAddress")}
                      {requireDeliveryAddress ? " *" : ""}
                    </p>
                    <p
                      className={`text-base font-extrabold truncate mt-0.5 ${
                        deliveryAddress.trim() ? "text-foreground" : "text-muted-foreground/70"
                      }`}
                    >
                      {deliveryAddress.trim() || t("keyboard.tapToType")}
                    </p>
                  </div>
                  <PencilLine className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            ) : (
              <div
                className={`w-full rounded-2xl border-2 px-3.5 py-3 ${
                  !requireDeliveryAddress || deliveryAddress.trim()
                    ? "border-border/60 bg-background/50"
                    : "border-rose-500/55 bg-rose-500/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-muted-foreground mb-1">
                      {t("pos.deliveryAddress")}
                      {requireDeliveryAddress ? " *" : ""}
                    </p>
                    <Input
                      type="text"
                      noTextKeyboard
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder={t("keyboard.tapToType")}
                      className="h-10 text-base font-extrabold"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          <Button
            type="button"
            className="w-full h-12 rounded-2xl text-base font-extrabold shadow-lg shadow-cyan-500/20"
            onClick={() => {
              const blocked = deliveryBlockReason();
              if (blocked) {
                toast({ title: blocked, variant: "destructive" });
                return;
              }
              void persistDeliveryContactIfNeeded({ notify: true });
              setIsDeliveryFormOpen(false);
            }}
          >
            {t("pos.confirmDeliveryDetails")}
          </Button>
        </div>
      </Dialog>

      <Dialog
        isOpen={amountPadEnabled && isPhonePadOpen}
        onClose={() => setIsPhonePadOpen(false)}
        title={t("pos.deliveryPhoneTitle")}
        maxWidth="max-w-sm"
        layer="overlay"
      >
        <NumericKeypad
          mode="digits"
          value={deliveryPhone}
          label={t("delivery.enterPhone")}
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
        isOpen={textKeyboardEnabled && isAddressPadOpen}
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
        isOpen={textKeyboardEnabled && isSearchPadOpen}
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
        isOpen={textKeyboardEnabled && isPersonSearchPadOpen}
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
                    <p className="text-[10px] font-bold text-muted-foreground mb-0.5">{t("pos.personSearchTitle")}</p>
                    <p
                      className={`truncate text-base font-extrabold ${
                        personSearch ? "text-foreground" : "text-muted-foreground/50"
                      }`}
                    >
                      {personSearch || t("keyboard.typeToSearch")}
                    </p>
                  </div>
                  {personSearch ? (
                    <button
                      type="button"
                      onClick={() => setPersonSearch("")}
                      className="w-8 h-8 rounded-xl border border-border/60 bg-secondary/70 text-muted-foreground hover:text-foreground flex items-center justify-center flex-shrink-0"
                      aria-label={t("common.clear")}
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
                      {personSearch.trim() ? t("common.noResults") : t("pos.noPersons")}
                    </p>
                  </div>
                ) : (
                  pickerSeats.map((person) => {
                    const meta =
                      TABLE_STATUS_META[person.status] ?? TABLE_STATUS_META.available;
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
                          {t(seatStatusLabelKey(person.status))}
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
                      label={t("pos.personSearch")}
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
                    label={t("pos.personSearch")}
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
