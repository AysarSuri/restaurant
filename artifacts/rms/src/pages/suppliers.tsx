import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useGetSupplierPurchases,
  useCreateSupplierPurchase,
  useUpdateSupplierPurchase,
  useDeleteSupplierPurchase,
  useGetSupplierMovements,
  useCreateSupplierMovement,
  useUpdateSupplierMovement,
  useDeleteSupplierMovement,
  type SupplierMovement,
  useGetSupplierStatement,
  useGetSupplierDebts,
  useGetMenuItems,
  useGetSettings,
  useGetBranches,
  useGetCards,
  getGetSettingsQueryKey,
  getGetSuppliersQueryKey,
  getGetSupplierPurchasesQueryKey,
  getGetSupplierReturnsQueryKey,
  getGetSupplierMovementsQueryKey,
  getGetSupplierDebtsQueryKey,
  getGetSupplierStatementQueryKey,
  type Supplier,
  type SupplierPurchase,
  type SupplierAmountType,
  type SupplierUnitKind,
  type SupplierPaymentMethod,
  type MenuItem,
} from "@workspace/api-client-react";
import { Button, Input, Dialog, Card } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { YmdDateInput } from "@/components/ymd-date-input";
import {
  printSupplierPurchaseThermal,
  printSupplierMovementThermal,
  printSupplierStatementA4,
} from "@/lib/print-receipt";
import { SupplierReturnsPanel } from "@/components/supplier-returns-panel";
import { useI18n } from "@/i18n";
import {
  ArrowLeftRight,
  Building2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Hash,
  Package,
  Plus,
  Printer,
  Scale,
  ShoppingCart,
  StickyNote,
  Trash2,
  Truck,
  Wallet,
  Pencil,
  BadgeDollarSign,
  X,
  Undo2,
} from "lucide-react";

type Section = "hub" | "names" | "purchase" | "returns" | "movement" | "statement" | "debts";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IQ", { maximumFractionDigits: 2 }).format(n);

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Live clock like POS: HH:mm:ss */
function nowTime(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function balanceTone(balance: number) {
  if (balance > 0) return "text-amber-700 dark:text-amber-300";
  if (balance < 0) return "text-emerald-700 dark:text-emerald-300";
  return "text-muted-foreground";
}

function balanceLabel(balance: number) {
  if (balance > 0) return "باقي عندنا";
  if (balance < 0) return "باقي عنده";
  return "متوازن";
}

function movementAmountTypeLabel(type: SupplierAmountType | string) {
  if (type === "received") return "واصل";
  if (type === "discount") return "خصم";
  return "مدفوع";
}

/** Statement invoice type: شراء / مرجوع / مدفوع|واصل|خصم from movement */
function statementDocType(line: {
  docType?: string;
  kind?: string;
  description?: string;
}) {
  const typed = String(line.docType ?? "").trim();
  if (typed) return typed;
  if (line.kind === "purchase") return "شراء";
  if (line.kind === "return") return "مرجوع";
  if (line.kind === "opening") return "رصيد";
  if (line.kind === "movement") {
    const d = String(line.description ?? "");
    if (d.includes("واصل")) return "واصل";
    if (d.includes("خصم")) return "خصم";
    return "مدفوع";
  }
  return "—";
}

/** شراء + واصل → blue; مرجوع + مدفوع + خصم → red */
function statementDocTypeTone(docType: string) {
  if (docType === "شراء" || docType === "واصل") {
    return "text-sky-600 dark:text-sky-400";
  }
  if (docType === "مرجوع" || docType === "مدفوع" || docType === "خصم") {
    return "text-red-600 dark:text-red-400";
  }
  return "text-foreground";
}

type PurchaseLine = {
  key: string;
  menuItemId: string;
  qty: number | "";
  unitKind: SupplierUnitKind;
  price: number | "";
};

const EMPTY_PURCHASE_LINE = (): PurchaseLine => ({
  key: crypto.randomUUID(),
  menuItemId: "",
  qty: "",
  unitKind: "major",
  price: "",
});

const EMPTY_SUPPLIER = { code: "", name: "", openingBalance: "" as string | number, notes: "" };

function nextSupplierCode(list: Supplier[] | undefined): string {
  let max = 0;
  for (const s of list ?? []) {
    const match = String(s.code ?? "").trim().match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

function nextPurchaseInvoiceNo(list: SupplierPurchase[] | undefined): string {
  let max = 0;
  for (const p of list ?? []) {
    const match = String(p.invoiceNo ?? "").trim().match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

function nextMovementInvoiceNo(
  list: { invoiceNo?: string }[] | undefined
): string {
  let max = 0;
  for (const m of list ?? []) {
    const match = String(m.invoiceNo ?? "").trim().match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

function apiErrorMessage(error: unknown, fallback: string) {
  const e = error as { data?: { message?: string }; message?: string } | null;
  const fromData = e?.data?.message?.trim();
  if (fromData) return fromData;
  const raw = e?.message?.trim() || "";
  const stripped = raw.replace(/^HTTP\s+\d+\s+[^:]*:\s*/i, "").trim();
  return stripped || fallback;
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const { formatDate } = useI18n();
  const [section, setSection] = useState<Section>("hub");

  const { data: suppliers, isLoading: loadingSuppliers } = useGetSuppliers();
  const { data: purchases, isLoading: loadingPurchases } = useGetSupplierPurchases();
  const { data: movements, isLoading: loadingMovements } = useGetSupplierMovements();
  const { data: debts, isLoading: loadingDebts, refetch: refetchDebts } = useGetSupplierDebts();
  const { data: menuItems } = useGetMenuItems();
  const { data: branches } = useGetBranches();
  const { data: cards } = useGetCards();
  const { data: appSettings, refetch: refetchSettings } = useGetSettings({
    query: { staleTime: 30_000, refetchOnWindowFocus: true },
  });
  const restaurantName = appSettings?.restaurantName?.trim() || "المطعم";
  const restaurantLogoUrl = appSettings?.logoUrl?.trim() || "";
  const restaurantMobile = appSettings?.mobile?.trim() || "";

  const { mutate: createSupplier, isPending: creatingSupplier } = useCreateSupplier();
  const { mutate: updateSupplier, isPending: updatingSupplier } = useUpdateSupplier();
  const { mutate: deleteSupplier } = useDeleteSupplier();
  const { mutate: createPurchase, isPending: creatingPurchase } = useCreateSupplierPurchase();
  const { mutate: updatePurchase, isPending: updatingPurchase } = useUpdateSupplierPurchase();
  const { mutate: deletePurchase } = useDeleteSupplierPurchase();
  const { mutate: createMovement, isPending: creatingMovement } = useCreateSupplierMovement();
  const { mutate: updateMovement, isPending: updatingMovement } = useUpdateSupplierMovement();
  const { mutate: deleteMovement } = useDeleteSupplierMovement();

  // ── names ──
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER);
  const [supplierError, setSupplierError] = useState("");
  const [supplierNameFilterId, setSupplierNameFilterId] = useState("");

  // ── purchase ──
  const [purchaseForm, setPurchaseForm] = useState({
    invoiceNo: "",
    invoiceDate: todayDate(),
    invoiceTime: nowTime(),
    supplierId: "",
    notes: "",
    paidAmount: 0,
    discountAmount: 0,
    branchId: "",
    paymentMethod: "cash" as SupplierPaymentMethod,
    cardId: "",
  });
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([
    EMPTY_PURCHASE_LINE(),
  ]);
  const [purchaseError, setPurchaseError] = useState("");
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  const [purchaseListSupplierId, setPurchaseListSupplierId] = useState("");
  const [purchaseListBranchId, setPurchaseListBranchId] = useState("");
  const [purchaseListFromDate, setPurchaseListFromDate] = useState(todayDate);
  const [purchaseListToDate, setPurchaseListToDate] = useState(todayDate);
  const [purchaseListInvoiceNo, setPurchaseListInvoiceNo] = useState("");

  useEffect(() => {
    if (section !== "purchase") return;
    if (editingPurchaseId != null) return;
    setPurchaseForm((f) => ({
      ...f,
      invoiceNo: nextPurchaseInvoiceNo(purchases),
    }));
  }, [section, purchases, editingPurchaseId]);

  // Live clock for purchase form — same behavior as POS (paused while editing)
  useEffect(() => {
    if (section !== "purchase") return;
    if (editingPurchaseId != null) return;
    const tick = () => {
      const clock = nowTime();
      setPurchaseForm((f) =>
        f.invoiceTime === clock ? f : { ...f, invoiceTime: clock }
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [section, editingPurchaseId]);

  // ── movement ──
  const [movementFormOpen, setMovementFormOpen] = useState(false);
  const [editingMovementId, setEditingMovementId] = useState<number | null>(null);
  const [movementForm, setMovementForm] = useState({
    invoiceNo: "",
    movementDate: todayDate(),
    movementTime: nowTime(),
    supplierId: "",
    amountType: "paid" as SupplierAmountType,
    amount: "" as number | "",
    notes: "",
    branchId: "",
    paymentMethod: "cash" as SupplierPaymentMethod,
    cardId: "",
  });
  const [movementError, setMovementError] = useState("");
  const [movementListFromDate, setMovementListFromDate] = useState(todayDate);
  const [movementListToDate, setMovementListToDate] = useState(todayDate);
  const [movementListInvoiceNo, setMovementListInvoiceNo] = useState("");
  const [movementListSupplierId, setMovementListSupplierId] = useState("");
  const [movementListBranchId, setMovementListBranchId] = useState("");
  const [movementListAmountType, setMovementListAmountType] = useState("");

  // Live clock for new movement form only (not while editing)
  useEffect(() => {
    if (!movementFormOpen || editingMovementId != null) return;
    const tick = () => {
      const clock = nowTime();
      setMovementForm((f) =>
        f.movementTime === clock ? f : { ...f, movementTime: clock }
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [movementFormOpen, editingMovementId]);

  // ── statement ──
  const [statementSupplierId, setStatementSupplierId] = useState(0);
  const [statementFromDate, setStatementFromDate] = useState(todayDate);
  const [statementToDate, setStatementToDate] = useState(todayDate);
  const statementParams = useMemo(
    () => ({
      from: statementFromDate.trim() || undefined,
      to: statementToDate.trim() || undefined,
    }),
    [statementFromDate, statementToDate]
  );
  const statementDatesValid =
    !statementFromDate ||
    !statementToDate ||
    statementFromDate <= statementToDate;
  const { data: statement, isLoading: loadingStatement, isFetching: fetchingStatement } =
    useGetSupplierStatement(statementSupplierId, statementParams, {
      query: { enabled: statementSupplierId > 0 && statementDatesValid },
    });

  const supplierOptions = useMemo<ComboboxOption[]>(
    () =>
      (suppliers ?? []).map((s) => ({
        value: String(s.id),
        label: s.name,
        subtitle: `كود ${s.code}`,
        icon: Truck,
      })),
    [suppliers]
  );

  const branchOptions = useMemo<ComboboxOption[]>(
    () =>
      (branches ?? []).map((b) => ({
        value: String(b.id),
        label: b.name,
        icon: Building2,
      })),
    [branches]
  );

  const purchaseBranchCardOptions = useMemo<ComboboxOption[]>(() => {
    const branchId = Number(purchaseForm.branchId) || 0;
    return (cards ?? [])
      .filter((c) => c.isActive !== false)
      .filter((c) => (branchId ? (c.branchIds ?? []).includes(branchId) : false))
      .map((c) => ({
        value: String(c.id),
        label: c.name,
        subtitle: fmtMoney(Number(c.balance) || 0),
        icon: CreditCard,
      }));
  }, [cards, purchaseForm.branchId]);

  const movementBranchCardOptions = useMemo<ComboboxOption[]>(() => {
    const branchId = Number(movementForm.branchId) || 0;
    return (cards ?? [])
      .filter((c) => c.isActive !== false)
      .filter((c) => (branchId ? (c.branchIds ?? []).includes(branchId) : false))
      .map((c) => ({
        value: String(c.id),
        label: c.name,
        subtitle: fmtMoney(Number(c.balance) || 0),
        icon: CreditCard,
      }));
  }, [cards, movementForm.branchId]);

  const movementNeedsPayment =
    movementForm.amountType === "paid" || movementForm.amountType === "received";

  const supplierNameSearchOptions = useMemo<ComboboxOption[]>(
    () => [
      {
        value: "",
        label: "كل الموردين",
        subtitle: "عرض بدون فلتر",
        icon: Truck,
      },
      ...supplierOptions,
    ],
    [supplierOptions]
  );

  const movementSupplierSearchOptions = useMemo<ComboboxOption[]>(
    () => [
      {
        value: "",
        label: "كل الموردين",
        subtitle: "عرض بدون فلتر",
        icon: Truck,
      },
      ...supplierOptions,
    ],
    [supplierOptions]
  );

  const filteredNameSuppliers = useMemo(() => {
    const list = suppliers ?? [];
    if (!supplierNameFilterId) return list;
    return list.filter((s) => String(s.id) === supplierNameFilterId);
  }, [suppliers, supplierNameFilterId]);

  const branchSearchOptions = useMemo<ComboboxOption[]>(
    () => [
      {
        value: "",
        label: "كل الفروع",
        subtitle: "عرض بدون فلتر",
        icon: Building2,
      },
      ...branchOptions,
    ],
    [branchOptions]
  );

  const filteredPurchases = useMemo(() => {
    const list = purchases ?? [];
    const invoiceQ = purchaseListInvoiceNo.trim().toLowerCase();
    const from = purchaseListFromDate.trim();
    const to = purchaseListToDate.trim();
    return list.filter((p) => {
      if (purchaseListSupplierId && String(p.supplierId) !== purchaseListSupplierId) {
        return false;
      }
      if (purchaseListBranchId && String(p.branchId ?? "") !== purchaseListBranchId) {
        return false;
      }
      if (invoiceQ && !String(p.invoiceNo ?? "").toLowerCase().includes(invoiceQ)) {
        return false;
      }
      const d = String(p.invoiceDate ?? "");
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [
    purchases,
    purchaseListSupplierId,
    purchaseListBranchId,
    purchaseListFromDate,
    purchaseListToDate,
    purchaseListInvoiceNo,
  ]);

  const menuOptions = useMemo<ComboboxOption[]>(
    () =>
      (menuItems ?? [])
        .filter((m) => m.cost != null && m.cost !== "" && Number(m.cost) > 0)
        .map((m) => ({
          value: String(m.id),
          label: m.nameAr,
          subtitle: m.name,
          icon: Package,
        })),
    [menuItems]
  );

  const amountTypeOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "paid", label: "مدفوع", subtitle: "افتراضي — دفعة للمورد", icon: Wallet },
      { value: "received", label: "واصل", subtitle: "مبلغ واصل من المورد", icon: ArrowLeftRight },
      { value: "discount", label: "خصم", subtitle: "خصم على الحساب", icon: BadgeDollarSign },
    ],
    []
  );

  const movementAmountTypeFilterOptions = useMemo<ComboboxOption[]>(
    () => [
      {
        value: "",
        label: "كل الأنواع",
        subtitle: "عرض بدون فلتر",
        icon: Wallet,
      },
      ...amountTypeOptions,
    ],
    [amountTypeOptions]
  );

  const filteredMovements = useMemo(() => {
    const list = movements ?? [];
    const invoiceQ = movementListInvoiceNo.trim().toLowerCase();
    const from = movementListFromDate.trim();
    const to = movementListToDate.trim();
    return list.filter((m) => {
      if (movementListSupplierId && String(m.supplierId) !== movementListSupplierId) {
        return false;
      }
      if (movementListBranchId && String(m.branchId ?? "") !== movementListBranchId) {
        return false;
      }
      if (movementListAmountType && m.amountType !== movementListAmountType) {
        return false;
      }
      if (invoiceQ && !String(m.invoiceNo ?? "").toLowerCase().includes(invoiceQ)) {
        return false;
      }
      const d = String(m.movementDate ?? "");
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [
    movements,
    movementListSupplierId,
    movementListBranchId,
    movementListAmountType,
    movementListFromDate,
    movementListToDate,
    movementListInvoiceNo,
  ]);

  const purchaseTotals = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    for (const line of purchaseLines) {
      const qty = Number(line.qty) || 0;
      const price = Number(line.price) || 0;
      totalQty += qty;
      totalAmount += qty * price;
    }
    const discountAmount = Math.max(0, Number(purchaseForm.discountAmount) || 0);
    const paidAmount = Math.max(0, Number(purchaseForm.paidAmount) || 0);
    const remainingAmount = Math.max(
      0,
      Number((totalAmount - discountAmount - paidAmount).toFixed(2))
    );
    return { totalQty, totalAmount, discountAmount, paidAmount, remainingAmount };
  }, [purchaseLines, purchaseForm.discountAmount, purchaseForm.paidAmount]);

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetSupplierPurchasesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetSupplierReturnsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetSupplierMovementsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetSupplierDebtsQueryKey() });
    if (statementSupplierId > 0) {
      void queryClient.invalidateQueries({
        queryKey: getGetSupplierStatementQueryKey(statementSupplierId),
      });
    }
  };

  const openNewSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      ...EMPTY_SUPPLIER,
      code: nextSupplierCode(suppliers),
    });
    setSupplierError("");
    setSupplierFormOpen(true);
  };

  const openEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierForm({
      code: s.code,
      name: s.name,
      openingBalance: Number(s.openingBalance) || 0,
      notes: s.notes || "",
    });
    setSupplierError("");
    setSupplierFormOpen(true);
  };

  const saveSupplier = () => {
    const code = supplierForm.code.trim();
    const name = supplierForm.name.trim();
    if (!name) return setSupplierError("اسم المورد مطلوب");
    const nameTaken = (suppliers ?? []).some(
      (s) =>
        s.name.trim().toLowerCase() === name.toLowerCase() &&
        s.id !== editingSupplier?.id
    );
    if (nameTaken) {
      return setSupplierError("اسم المورد مكرر — اختر اسماً مختلفاً");
    }
    if (editingSupplier && !code) return setSupplierError("كود المورد مطلوب");
    setSupplierError("");
    const body = {
      code: editingSupplier ? code : nextSupplierCode(suppliers),
      name,
      openingBalance:
        supplierForm.openingBalance === "" || supplierForm.openingBalance === null
          ? 0
          : Number(supplierForm.openingBalance) || 0,
      notes: supplierForm.notes.trim(),
    };
    if (editingSupplier) {
      updateSupplier(
        { id: editingSupplier.id, data: body },
        {
          onSuccess: () => {
            setSupplierFormOpen(false);
            invalidateAll();
          },
          onError: (e) => setSupplierError(apiErrorMessage(e, "تعذر الحفظ")),
        }
      );
    } else {
      createSupplier(body, {
        onSuccess: () => {
          setSupplierFormOpen(false);
          invalidateAll();
        },
        onError: (e) => setSupplierError(apiErrorMessage(e, "تعذر الحفظ")),
      });
    }
  };

  const findMenu = (id: string): MenuItem | undefined =>
    (menuItems ?? []).find((m) => String(m.id) === id);

  const unitOptionsFor = (menuItemId: string): ComboboxOption[] => {
    const item = findMenu(menuItemId);
    const minor = item?.minorUnit?.trim() || "عدد";
    const major = item?.majorUnit?.trim();
    const opts: ComboboxOption[] = [
      { value: "minor", label: minor, subtitle: "الوحدة الصغرى", icon: Scale },
    ];
    if (major) {
      opts.unshift({
        value: "major",
        label: major,
        subtitle: item?.subunitQty ? `${item.subunitQty} × ${minor}` : "الوحدة الكبرى",
        icon: Scale,
      });
    }
    return opts;
  };

  const resetPurchaseForm = () => {
    setEditingPurchaseId(null);
    setPurchaseError("");
    setPurchaseLines([EMPTY_PURCHASE_LINE()]);
    setPurchaseForm({
      invoiceNo: nextPurchaseInvoiceNo(purchases),
      invoiceDate: todayDate(),
      invoiceTime: nowTime(),
      supplierId: "",
      notes: "",
      paidAmount: 0,
      discountAmount: 0,
      branchId: "",
      paymentMethod: "cash",
      cardId: "",
    });
  };

  const openEditPurchase = (p: SupplierPurchase) => {
    setEditingPurchaseId(p.id);
    setPurchaseError("");
    setPurchaseForm({
      invoiceNo: p.invoiceNo,
      invoiceDate: p.invoiceDate,
      invoiceTime: p.invoiceTime || nowTime(),
      supplierId: String(p.supplierId),
      notes: p.notes || "",
      paidAmount: Number(p.paidAmount) || 0,
      discountAmount: Number(p.discountAmount) || 0,
      branchId: p.branchId ? String(p.branchId) : "",
      paymentMethod: p.paymentMethod === "card" ? "card" : "cash",
      cardId: p.cardId ? String(p.cardId) : "",
    });
    setPurchaseLines(
      p.items.length > 0
        ? p.items.map((it) => ({
            key: crypto.randomUUID(),
            menuItemId: String(it.menuItemId),
            qty: Number(it.qty) || "",
            unitKind: (it.unitKind as SupplierUnitKind) || "major",
            price: Number(it.price) || "",
          }))
        : [EMPTY_PURCHASE_LINE()]
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const savePurchase = () => {
    if (!purchaseForm.supplierId) return setPurchaseError("اختر المورد");
    if (!purchaseForm.branchId) return setPurchaseError("اختر الفرع");
    if (purchaseForm.paymentMethod === "card" && !purchaseForm.cardId) {
      return setPurchaseError("اختر البطاقة");
    }
    const invoiceNo =
      editingPurchaseId != null
        ? purchaseForm.invoiceNo
        : nextPurchaseInvoiceNo(purchases);
    const items = purchaseLines
      .filter((l) => l.menuItemId)
      .map((l) => ({
        menuItemId: Number(l.menuItemId),
        qty: Number(l.qty) || 0,
        unitKind: l.unitKind,
        price: Number(l.price) || 0,
      }));
    if (items.length === 0) return setPurchaseError("أضف صنفاً واحداً على الأقل");
    if (items.some((i) => !(i.qty > 0))) return setPurchaseError("تحقق من الكميات");
    setPurchaseError("");
    if (
      purchaseTotals.discountAmount + purchaseTotals.paidAmount >
      purchaseTotals.totalAmount + 0.001
    ) {
      return setPurchaseError("مجموع الدفع والخصم لا يمكن أن يتجاوز مجموع الفاتورة");
    }
    const body = {
      invoiceNo,
      invoiceDate: purchaseForm.invoiceDate,
      invoiceTime: purchaseForm.invoiceTime,
      supplierId: Number(purchaseForm.supplierId),
      notes: purchaseForm.notes.trim(),
      paidAmount: purchaseTotals.paidAmount,
      discountAmount: purchaseTotals.discountAmount,
      branchId: Number(purchaseForm.branchId) || null,
      paymentMethod: purchaseForm.paymentMethod,
      cardId:
        purchaseForm.paymentMethod === "card"
          ? Number(purchaseForm.cardId) || null
          : null,
      items,
    };
    if (editingPurchaseId != null) {
      updatePurchase(
        { id: editingPurchaseId, data: body },
        {
          onSuccess: () => {
            resetPurchaseForm();
            invalidateAll();
          },
          onError: (e) => setPurchaseError(apiErrorMessage(e, "تعذر تعديل فاتورة الشراء")),
        }
      );
      return;
    }
    createPurchase(body, {
      onSuccess: () => {
        resetPurchaseForm();
        invalidateAll();
      },
      onError: (e) => setPurchaseError(apiErrorMessage(e, "تعذر حفظ فاتورة الشراء")),
    });
  };

  const printPurchaseReport = async (p: SupplierPurchase) => {
    // Always pull latest restaurant identity from settings (name + logo + mobile)
    let settingsSnap = queryClient.getQueryData(getGetSettingsQueryKey()) as
      | typeof appSettings
      | undefined;
    try {
      const fresh = await refetchSettings();
      if (fresh.data) settingsSnap = fresh.data;
    } catch {
      /* keep cached */
    }
    const name = settingsSnap?.restaurantName?.trim() || restaurantName || "المطعم";
    const logo = settingsSnap?.logoUrl?.trim() || restaurantLogoUrl || "";
    const phone = settingsSnap?.mobile?.trim() || restaurantMobile || "";

    const supplier = (suppliers ?? []).find((s) => s.id === p.supplierId);
    const currentBalance = Number(supplier?.balance) || 0;
    const remaining = Number(p.remainingAmount) || 0;
    const oldBalance = Number((currentBalance - remaining).toFixed(2));
    const newBalance = currentBalance;
    printSupplierPurchaseThermal({
      restaurantName: name,
      logoUrl: logo || null,
      mobile: phone || null,
      invoiceNo: p.invoiceNo,
      invoiceDate: p.invoiceDate,
      invoiceTime: p.invoiceTime,
      supplierName: p.supplierName || supplier?.name || "—",
      notes: p.notes,
      items: (p.items ?? []).map((it) => ({
        name: it.itemNameAr || it.itemName || `صنف #${it.menuItemId}`,
        qty: Number(it.qty) || 0,
        unitLabel: it.unitLabel || "",
        price: Number(it.price) || 0,
        amount: Number(it.amount) || 0,
      })),
      totalQty: Number(p.totalQty) || 0,
      totalAmount: Number(p.totalAmount) || 0,
      paidAmount: Number(p.paidAmount) || 0,
      discountAmount: Number(p.discountAmount) || 0,
      remainingAmount: remaining,
      oldBalance,
      newBalance,
      formatMoney: fmtMoney,
    });
  };

  const resetMovementForm = () => {
    setEditingMovementId(null);
    setMovementForm({
      invoiceNo: nextMovementInvoiceNo(movements),
      movementDate: todayDate(),
      movementTime: nowTime(),
      supplierId: "",
      amountType: "paid",
      amount: "",
      notes: "",
      branchId: "",
      paymentMethod: "cash",
      cardId: "",
    });
    setMovementError("");
  };

  const openNewMovement = () => {
    resetMovementForm();
    setMovementFormOpen(true);
  };

  const openEditMovement = (m: SupplierMovement) => {
    setEditingMovementId(m.id);
    setMovementForm({
      invoiceNo: m.invoiceNo,
      movementDate: m.movementDate,
      movementTime: m.movementTime || nowTime(),
      supplierId: String(m.supplierId),
      amountType: m.amountType,
      amount: Number(m.amount) || "",
      notes: m.notes?.trim() || "",
      branchId: m.branchId ? String(m.branchId) : "",
      paymentMethod: m.paymentMethod === "card" ? "card" : "cash",
      cardId: m.cardId ? String(m.cardId) : "",
    });
    setMovementError("");
    setMovementFormOpen(true);
  };

  const printMovementReport = async (m: SupplierMovement) => {
    let settingsSnap = appSettings;
    try {
      const refreshed = await refetchSettings();
      if (refreshed.data) settingsSnap = refreshed.data;
    } catch {
      /* keep cached */
    }
    const name = settingsSnap?.restaurantName?.trim() || restaurantName || "المطعم";
    const logo = settingsSnap?.logoUrl?.trim() || restaurantLogoUrl || "";
    const phone = settingsSnap?.mobile?.trim() || restaurantMobile || "";
    const supplier = (suppliers ?? []).find((s) => s.id === m.supplierId);
    const currentBalance = Number(supplier?.balance) || 0;
    const amount = Number(m.amount) || 0;
    // Movements reduce balance — reverse for "old" snapshot
    const oldBalance = Number((currentBalance + amount).toFixed(2));
    const newBalance = currentBalance;
    printSupplierMovementThermal({
      restaurantName: name,
      logoUrl: logo || null,
      mobile: phone || null,
      invoiceNo: m.invoiceNo,
      movementDate: m.movementDate,
      movementTime: m.movementTime,
      supplierName: m.supplierName || supplier?.name || "—",
      amountTypeLabel: movementAmountTypeLabel(m.amountType),
      amount,
      notes: m.notes,
      oldBalance,
      newBalance,
      formatMoney: fmtMoney,
    });
  };

  const saveMovement = () => {
    if (!movementForm.supplierId) return setMovementError("اختر المورد");
    if (!movementForm.branchId) return setMovementError("اختر الفرع");
    if (movementForm.amount === "" || !(Number(movementForm.amount) > 0)) {
      return setMovementError("أدخل مبلغاً أكبر من صفر");
    }
    const needsPayment =
      movementForm.amountType === "paid" || movementForm.amountType === "received";
    if (needsPayment && movementForm.paymentMethod === "card" && !movementForm.cardId) {
      return setMovementError("اختر البطاقة");
    }
    setMovementError("");
    const body = {
      invoiceNo:
        editingMovementId != null
          ? movementForm.invoiceNo
          : nextMovementInvoiceNo(movements),
      movementDate: movementForm.movementDate,
      movementTime: movementForm.movementTime,
      supplierId: Number(movementForm.supplierId),
      amountType: movementForm.amountType,
      amount: Number(movementForm.amount),
      notes: movementForm.notes.trim(),
      branchId: Number(movementForm.branchId) || null,
      paymentMethod: needsPayment ? movementForm.paymentMethod : ("cash" as const),
      cardId:
        needsPayment && movementForm.paymentMethod === "card"
          ? Number(movementForm.cardId) || null
          : null,
    };

    if (editingMovementId != null) {
      updateMovement(
        { id: editingMovementId, data: body },
        {
          onSuccess: () => {
            setMovementFormOpen(false);
            resetMovementForm();
            invalidateAll();
          },
          onError: (e) => setMovementError(apiErrorMessage(e, "تعذر تعديل الحركة")),
        }
      );
      return;
    }

    createMovement(body, {
      onSuccess: () => {
        setMovementFormOpen(false);
        resetMovementForm();
        invalidateAll();
      },
      onError: (e) => setMovementError(apiErrorMessage(e, "تعذر حفظ الحركة")),
    });
  };

  const escHtml = (value: string) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const printBlock = (title: string, html: string) => {
    const fullHtml = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${escHtml(
      title
    )}</title>
      <style>
        body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:20px;margin:0 0 8px}
        .meta{color:#555;margin-bottom:16px;font-size:13px;line-height:1.6}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #ddd;padding:8px;text-align:center}
        th{background:#f5f5f5}
        .pos{color:#b45309;font-weight:700}
        .neg{color:#047857;font-weight:700}
        .type-blue{color:#0284c7;font-weight:800}
        .type-red{color:#dc2626;font-weight:800}
        @media print{button{display:none}}
      </style></head><body>
      <h1>${escHtml(title)}</h1>
      ${html}
      </body></html>`;

    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, "_blank", "width=960,height=780,left=60,top=40");

    const startPrint = (win: Window) => {
      const run = () => {
        try {
          win.focus();
          win.print();
        } catch {
          /* ignore */
        }
      };
      if (win.document.readyState === "complete") {
        window.setTimeout(run, 120);
      } else {
        win.onload = () => window.setTimeout(run, 120);
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 15000);
    };

    if (popup) {
      startPrint(popup);
      return;
    }

    // Popup blocked — print via hidden iframe
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument || win?.document;
    if (!win || !doc) {
      iframe.remove();
      URL.revokeObjectURL(url);
      window.alert("تعذر فتح تقرير الطباعة — اسمح بالنوافذ المنبثقة ثم أعد المحاولة");
      return;
    }
    doc.open();
    doc.write(fullHtml);
    doc.close();
    URL.revokeObjectURL(url);
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } finally {
        window.setTimeout(() => iframe.remove(), 1500);
      }
    }, 200);
  };

  const printDebtsReport = () => {
    if (!debts) return;
    const rows = debts.items
      .map(
        (d) =>
          `<tr><td>${d.code}</td><td>${d.name}</td><td class="${d.balance > 0 ? "pos" : d.balance < 0 ? "neg" : ""}">${fmtMoney(d.balance)}</td><td>${d.label}</td></tr>`
      )
      .join("");
    printBlock(
      "تقرير ديون الموردين",
      `<div class="meta">إجمالي باقي عندنا: ${fmtMoney(debts.totalOwedByUs)} — إجمالي باقي عنده: ${fmtMoney(debts.totalOwedToUs)}</div>
       <table><thead><tr><th>كود المورد</th><th>اسم المورد</th><th>مبلغ الدين</th><th>البيان</th></tr></thead><tbody>${rows}</tbody></table>`
    );
  };

  const printSupplierNamesReport = () => {
    const list = filteredNameSuppliers;
    if (list.length === 0) return;
    const rows = list
      .map(
        (s) =>
          `<tr>
            <td>${s.code}</td>
            <td>${s.name}</td>
            <td>${fmtMoney(Number(s.openingBalance) || 0)}</td>
            <td class="${(Number(s.balance) || 0) > 0 ? "pos" : (Number(s.balance) || 0) < 0 ? "neg" : ""}">${fmtMoney(Number(s.balance) || 0)}</td>
            <td>${balanceLabel(Number(s.balance) || 0)}</td>
            <td>${s.notes?.trim() || "—"}</td>
          </tr>`
      )
      .join("");
    printBlock(
      "تقرير أسماء الموردين",
      `<div class="meta">عدد الموردين: ${list.length}${
        supplierNameFilterId ? " (بعد الفلتر)" : ""
      }</div>
       <table>
         <thead>
           <tr>
             <th>كود المورد</th>
             <th>اسم المورد</th>
             <th>رصيد افتتاحي</th>
             <th>الرصيد الحالي</th>
             <th>البيان</th>
             <th>ملاحظة</th>
           </tr>
         </thead>
         <tbody>${rows}</tbody>
       </table>`
    );
  };

  const printStatement = async () => {
    if (!statement) return;
    let settingsSnap = appSettings;
    try {
      const refreshed = await refetchSettings();
      if (refreshed.data) settingsSnap = refreshed.data;
    } catch {
      /* keep cached */
    }
    const name = settingsSnap?.restaurantName?.trim() || restaurantName || "المطعم";
    const logo = settingsSnap?.logoUrl?.trim() || restaurantLogoUrl || "";
    const phone = settingsSnap?.mobile?.trim() || restaurantMobile || "";
    const fromLabel = statement.fromDate
      ? formatDate(statement.fromDate)
      : statementFromDate
        ? formatDate(statementFromDate)
        : "—";
    const toLabel = statement.toDate
      ? formatDate(statement.toDate)
      : statementToDate
        ? formatDate(statementToDate)
        : "—";

    try {
      printSupplierStatementA4({
        restaurantName: name,
        logoUrl: logo || null,
        mobile: phone || null,
        supplierName: statement.supplier.name,
        supplierCode: String(statement.supplier.code ?? ""),
        fromLabel,
        toLabel,
        openingBalance: Number(statement.openingBalance) || 0,
        totalDebit: Number(statement.totalDebit) || 0,
        totalCredit: Number(statement.totalCredit) || 0,
        closingBalance: Number(statement.balance) || 0,
        balanceLabel: statement.balanceLabel,
        formatMoney: fmtMoney,
        lines: statement.lines.map((l) => ({
          dateLabel: l.date ? formatDate(l.date) : "—",
          docType: statementDocType(l),
          invoiceNo: String(l.invoiceNo ?? "—"),
          description: l.description || "—",
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          balance: Number(l.balance) || 0,
          kind: l.kind,
        })),
      });
    } catch (e) {
      window.alert(
        e instanceof Error
          ? e.message
          : "تعذر فتح تقرير الكشف — اسمح بالنوافذ المنبثقة"
      );
    }
  };

  const hubCards: {
    id: Section;
    title: string;
    desc: string;
    icon: React.ElementType;
  }[] = [
    {
      id: "names",
      title: "أسماء الموردين",
      desc: "كود المورد، الاسم، رصيد افتتاحي، ملاحظة",
      icon: Truck,
    },
    {
      id: "purchase",
      title: "شراء",
      desc: "فاتورة شراء مع أصناف وكميات ووحدات ومبالغ",
      icon: ShoppingCart,
    },
    {
      id: "returns",
      title: "مرجوعات",
      desc: "فاتورة مرجوع بنفس تفاصيل وترتيب فواتير الشراء",
      icon: Undo2,
    },
    {
      id: "movement",
      title: "حركة المورد",
      desc: "مدفوع / واصل / خصم مع رقم فاتورة وتاريخ",
      icon: ArrowLeftRight,
    },
    {
      id: "statement",
      title: "كشف حساب المورد",
      desc: "كشف واضح مع تقرير قابل للطباعة",
      icon: FileSpreadsheet,
    },
    {
      id: "debts",
      title: "ديون الموردين",
      desc: "أرصدة الموردين وتقرير الديون",
      icon: Scale,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-l from-primary/15 via-amber-500/5 to-transparent p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-primary mb-1">
              Suppliers
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">إدارة الموردين</h1>
            <p className="text-sm text-muted-foreground mt-1 font-semibold">
              أسماء، شراء، مرجوعات، حركات، كشف حساب، وديون — بشكل واضح واحترافي
            </p>
          </div>
          {section !== "hub" ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full h-12 px-5 text-[15px] font-bold touch-manipulation"
              onClick={() => setSection("hub")}
            >
              العودة للقائمة
            </Button>
          ) : null}
        </div>
      </div>

      {section === "hub" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {hubCards.map((card) => {
            const Icon = card.icon;
            const isReturns = card.id === "returns";
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setSection(card.id)}
                className={
                  isReturns
                    ? `
                  group text-start rounded-3xl border-2 border-destructive/40 bg-destructive/5
                  min-h-[9.5rem] sm:min-h-[10.5rem] p-5 sm:p-6
                  hover:border-destructive/70 hover:bg-destructive/10 hover:shadow-lg
                  active:scale-[0.98] active:bg-destructive/15
                  transition-all touch-manipulation select-none
                `
                    : `
                  group text-start rounded-3xl border-2 border-border/70 bg-card/90
                  min-h-[9.5rem] sm:min-h-[10.5rem] p-5 sm:p-6
                  hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg
                  active:scale-[0.98] active:bg-primary/10
                  transition-all touch-manipulation select-none
                `
                }
              >
                <span
                  className={
                    isReturns
                      ? "inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-destructive text-destructive-foreground shadow-md shadow-destructive/25 mb-4 group-hover:scale-105 transition-transform"
                      : "inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25 mb-4 group-hover:scale-105 transition-transform"
                  }
                >
                  <Icon className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.25} />
                </span>
                <h2
                  className={`text-[15px] font-bold leading-snug ${
                    isReturns ? "text-destructive" : ""
                  }`}
                >
                  {card.title}
                </h2>
                <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed font-semibold">
                  {card.desc}
                </p>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ── Names ── */}
      {section === "names" ? (
        <Card className="p-4 sm:p-6 border border-border/50 space-y-4 overflow-hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-[15px] font-bold">أسماء الموردين</h2>
              <p className="text-[13px] text-muted-foreground font-semibold mt-0.5">
                كود المورد · اسم المورد · رصيد افتتاحي · ملاحظة
              </p>
            </div>
            <Button
              type="button"
              className="rounded-full h-12 px-5 text-[15px] font-bold touch-manipulation"
              onClick={openNewSupplier}
            >
              <Plus className="w-5 h-5 me-1.5" /> إضافة مورد
            </Button>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-amber-500/5 to-transparent p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 min-w-0 sm:max-w-sm">
                <ModernCombobox
                  value={supplierNameFilterId}
                  onChange={setSupplierNameFilterId}
                  options={supplierNameSearchOptions}
                  label="بحث حسب المورد"
                  placeholder="ابحث واختر مورداً"
                  icon={Truck}
                  searchable
                  searchPlaceholder="اكتب اسم أو كود المورد..."
                  emptyText="لا يوجد مورد مطابق"
                  labelClassName="text-[15px] font-bold text-foreground"
                  valueClassName="text-[15px] font-bold"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-full h-12 px-5 text-[15px] font-bold border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground touch-manipulation"
                disabled={filteredNameSuppliers.length === 0}
                onClick={printSupplierNamesReport}
              >
                <FileText className="w-5 h-5 me-1.5" /> تقرير أسماء المورد
              </Button>
            </div>
          </div>

          {loadingSuppliers ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (suppliers ?? []).length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-[15px] font-bold">
              لا يوجد موردون بعد
            </p>
          ) : filteredNameSuppliers.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-[15px] font-bold">
              لا توجد نتائج للبحث
            </p>
          ) : (
            <div className="overflow-auto rounded-2xl border border-border/40">
              <table className="w-full text-[15px]">
                <thead className="bg-secondary/50 text-primary">
                  <tr>
                    <th className="text-start p-3 font-bold">كود المورد</th>
                    <th className="text-start p-3 font-bold">اسم المورد</th>
                    <th className="text-start p-3 font-bold">رصيد افتتاحي</th>
                    <th className="text-start p-3 font-bold">الرصيد الحالي</th>
                    <th className="text-start p-3 font-bold">ملاحظة</th>
                    <th className="text-end p-3 font-bold">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNameSuppliers.map((s) => (
                    <tr key={s.id} className="border-t border-border/30">
                      <td className="p-3 font-mono font-bold">{s.code}</td>
                      <td className="p-3 font-bold">{s.name}</td>
                      <td className="p-3 font-bold" dir="ltr">
                        {fmtMoney(Number(s.openingBalance) || 0)}
                      </td>
                      <td className={`p-3 font-bold ${balanceTone(Number(s.balance) || 0)}`} dir="ltr">
                        {fmtMoney(Number(s.balance) || 0)}
                        <span className="ms-2 text-[13px] font-bold">
                          {balanceLabel(Number(s.balance) || 0)}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-muted-foreground">{s.notes || "—"}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => openEditSupplier(s)}
                          >
                            <Pencil className="w-5 h-5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-destructive"
                            onClick={() => {
                              if (!confirm("حذف هذا المورد؟")) return;
                              deleteSupplier(
                                { id: s.id },
                                {
                                  onSuccess: invalidateAll,
                                  onError: (e: any) => alert(e?.message || "تعذر الحذف"),
                                }
                              );
                            }}
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {/* ── Purchase ── */}
      {section === "purchase" ? (
        <div className="space-y-3">
          <Card className="px-3 py-1.5 sm:px-4 sm:py-2 border border-border/50 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold leading-none">
                {editingPurchaseId != null ? "تعديل فاتورة شراء" : "شراء من المورد"}
              </h2>
              {editingPurchaseId != null ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full h-10 px-3 text-[14px] font-bold touch-manipulation"
                  onClick={resetPurchaseForm}
                >
                  <X className="w-4 h-4 me-1" /> إلغاء التعديل
                </Button>
              ) : null}
            </div>

            {/* Header fields — one compact row */}
            <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.65fr)_minmax(0,0.7fr)] gap-x-2 gap-y-1 items-end">
              <div className="col-span-2 lg:col-span-1 min-w-0">
                <ModernCombobox
                  value={purchaseForm.supplierId}
                  onChange={(v) => setPurchaseForm((f) => ({ ...f, supplierId: v }))}
                  options={supplierOptions}
                  label="المورد *"
                  placeholder="اختر المورد"
                  icon={Truck}
                  searchable
                  searchPlaceholder="ابحث باسم أو كود المورد..."
                  emptyText="لا يوجد مورد مطابق"
                  size="sm"
                  labelClassName="text-[14px] font-bold text-foreground !mb-0"
                  valueClassName="text-[14px] font-bold"
                  className="[&>div:first-child]:mb-0.5"
                />
              </div>
              <div className="min-w-0">
                <ModernCombobox
                  value={purchaseForm.branchId}
                  onChange={(branchId) =>
                    setPurchaseForm((f) => ({
                      ...f,
                      branchId,
                      cardId: "",
                    }))
                  }
                  options={branchOptions}
                  label="الفرع *"
                  placeholder="اختر الفرع"
                  icon={Building2}
                  searchable
                  searchPlaceholder="ابحث عن الفرع..."
                  emptyText="لا يوجد فرع"
                  size="sm"
                  labelClassName="text-[14px] font-bold text-foreground !mb-0"
                  valueClassName="text-[14px] font-bold"
                  className="[&>div:first-child]:mb-0.5"
                />
              </div>
              <div className="min-w-0">
                <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                  التاريخ *
                </label>
                <YmdDateInput
                  className="h-10 text-[14px] font-bold"
                  value={purchaseForm.invoiceDate}
                  onChange={(invoiceDate) =>
                    setPurchaseForm((f) => ({ ...f, invoiceDate }))
                  }
                />
              </div>
              <div className="min-w-0">
                <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                  الساعة
                </label>
                <Input
                  className="h-10 text-[14px] font-bold bg-secondary/50 text-muted-foreground cursor-not-allowed font-mono tracking-wide"
                  dir="ltr"
                  value={purchaseForm.invoiceTime}
                  readOnly
                  disabled
                />
              </div>
              <div className="min-w-0 col-span-2 lg:col-span-1">
                <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                  رقم الفاتورة
                </label>
                <div className="relative">
                  <Hash className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="h-10 ps-8 text-[14px] font-bold bg-secondary/50 text-muted-foreground cursor-not-allowed"
                    value={purchaseForm.invoiceNo || nextPurchaseInvoiceNo(purchases)}
                    readOnly
                    disabled
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                ملاحظة
              </label>
              <div className="relative">
                <StickyNote className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="h-10 ps-8 text-[14px] font-bold"
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="اختياري"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/8 via-transparent to-amber-500/5 px-2.5 py-2 sm:px-3 sm:py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-bold">أصناف الفاتورة</h3>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full h-11 px-4 text-[15px] font-bold touch-manipulation"
                  onClick={() =>
                    setPurchaseLines((rows) => [...rows, EMPTY_PURCHASE_LINE()])
                  }
                >
                  <Plus className="w-4 h-4 me-1" /> سطر صنف
                </Button>
              </div>

              <div className="rounded-xl border border-border/50 bg-background/90 overflow-hidden">
                <div className="hidden md:grid grid-cols-[minmax(0,1.7fr)_minmax(4.75rem,0.7fr)_minmax(0,1fr)_minmax(4.75rem,0.7fr)_minmax(4.75rem,0.7fr)_2.75rem] gap-1.5 px-2.5 pt-1.5 pb-1 text-[13px] xl:text-[14px] font-bold text-muted-foreground">
                  <div>الصنف *</div>
                  <div>كمية *</div>
                  <div>الوحدة *</div>
                  <div>سعر *</div>
                  <div>مبلغ</div>
                  <div />
                </div>

                <div className="divide-y divide-border/25">
                  {purchaseLines.map((line, idx) => {
                    const amount = (Number(line.qty) || 0) * (Number(line.price) || 0);
                    return (
                      <div
                        key={line.key}
                        className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-[minmax(0,1.7fr)_minmax(4.75rem,0.7fr)_minmax(0,1fr)_minmax(4.75rem,0.7fr)_minmax(4.75rem,0.7fr)_2.75rem] gap-1.5 px-2.5 py-1.5 items-end"
                      >
                        <div className="col-span-2 sm:col-span-4 md:col-span-1 min-w-0 order-1">
                          <span className="md:hidden text-[13px] font-bold mb-0.5 block text-muted-foreground">
                            الصنف *
                          </span>
                          <ModernCombobox
                            value={line.menuItemId}
                            onChange={(v) => {
                              setPurchaseLines((rows) =>
                                rows.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        menuItemId: v,
                                        unitKind: findMenu(v)?.majorUnit?.trim()
                                          ? "major"
                                          : "minor",
                                      }
                                    : r
                                )
                              );
                              if (!v) return;
                              const qtyId = `purchase-qty-${line.key}`;
                              window.setTimeout(() => {
                                const qtyEl = document.getElementById(
                                  qtyId
                                ) as HTMLInputElement | null;
                                if (!qtyEl) return;
                                qtyEl.focus();
                                try {
                                  qtyEl.select();
                                } catch {
                                  /* ignore */
                                }
                              }, 0);
                            }}
                            options={menuOptions}
                            placeholder="اختر الصنف"
                            emptyText="لا توجد أصناف من نوع تكلفة"
                            icon={Package}
                            valueClassName="text-[15px] font-bold"
                          />
                        </div>

                        <div className="min-w-0 order-2">
                          <span className="md:hidden text-[13px] font-bold mb-0.5 block text-muted-foreground">
                            كمية *
                          </span>
                          <Input
                            id={`purchase-qty-${line.key}`}
                            type="number"
                            min={0}
                            step="0.001"
                            className="h-12 w-full text-[15px] font-bold"
                            dir="ltr"
                            value={line.qty}
                            onChange={(e) =>
                              setPurchaseLines((rows) =>
                                rows.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        qty: e.target.value === "" ? "" : Number(e.target.value),
                                      }
                                    : r
                                )
                              )
                            }
                          />
                        </div>

                        <div className="min-w-0 order-3">
                          <span className="md:hidden text-[13px] font-bold mb-0.5 block text-muted-foreground">
                            الوحدة *
                          </span>
                          <ModernCombobox
                            value={line.unitKind}
                            onChange={(v) =>
                              setPurchaseLines((rows) =>
                                rows.map((r, i) =>
                                  i === idx
                                    ? { ...r, unitKind: (v as SupplierUnitKind) || "major" }
                                    : r
                                )
                              )
                            }
                            options={unitOptionsFor(line.menuItemId)}
                            placeholder="وحدة"
                            icon={Scale}
                            searchable={false}
                            valueClassName="text-[15px] font-bold"
                            className="w-full min-w-0"
                          />
                        </div>

                        <div className="min-w-0 order-4">
                          <span className="md:hidden text-[13px] font-bold mb-0.5 block text-muted-foreground">
                            سعر *
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-12 w-full text-[15px] font-bold"
                            dir="ltr"
                            value={line.price}
                            onChange={(e) =>
                              setPurchaseLines((rows) =>
                                rows.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        price:
                                          e.target.value === "" ? "" : Number(e.target.value),
                                      }
                                    : r
                                )
                              )
                            }
                          />
                        </div>

                        <div className="min-w-0 order-5">
                          <span className="md:hidden text-[13px] font-bold mb-0.5 block text-muted-foreground">
                            مبلغ
                          </span>
                          <div
                            className="h-12 w-full rounded-xl border border-border/60 bg-secondary/40 px-2 flex items-center text-[15px] font-bold"
                            dir="ltr"
                          >
                            {fmtMoney(amount)}
                          </div>
                        </div>

                        <div className="flex items-center justify-end order-6 col-span-2 sm:col-span-1 md:col-span-1 md:justify-center self-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-destructive touch-manipulation"
                            disabled={purchaseLines.length <= 1}
                            onClick={() =>
                              setPurchaseLines((rows) => rows.filter((_, i) => i !== idx))
                            }
                            aria-label="حذف السطر"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border/40 pt-2 space-y-2">
                <div className="grid grid-cols-2 gap-1.5 text-[14px] sm:text-[15px] font-bold">
                  <div className="rounded-xl border border-border/50 bg-background/80 px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">مجموع كمية</span>
                    <span className="text-primary" dir="ltr">
                      {fmtMoney(purchaseTotals.totalQty)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/80 px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">مجموع المبلغ</span>
                    <span className="text-primary" dir="ltr">
                      {fmtMoney(purchaseTotals.totalAmount)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-2 lg:grid-cols-[minmax(13.5rem,1.15fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-2 items-end">
                    <div className="col-span-2 lg:col-span-1 min-w-0">
                      <label className="text-[15px] font-bold text-foreground mb-1 block">
                        طريقة الدفع
                      </label>
                      <div className="grid grid-cols-2 gap-1 p-1 h-12 rounded-xl border border-border/60 bg-secondary/40">
                        <button
                          type="button"
                          onClick={() =>
                            setPurchaseForm((f) => ({
                              ...f,
                              paymentMethod: "cash",
                              cardId: "",
                            }))
                          }
                          className={`rounded-lg flex items-center justify-center gap-1.5 font-extrabold text-[12px] sm:text-[13px] touch-manipulation transition-all ${
                            purchaseForm.paymentMethod === "cash"
                              ? "bg-gradient-to-l from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20"
                              : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                          }`}
                        >
                          <Wallet className="w-3.5 h-3.5 shrink-0" />
                          بدون بطاقة
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPurchaseForm((f) => ({ ...f, paymentMethod: "card" }))
                          }
                          className={`rounded-lg flex items-center justify-center gap-1.5 font-extrabold text-[12px] sm:text-[13px] touch-manipulation transition-all ${
                            purchaseForm.paymentMethod === "card"
                              ? "bg-gradient-to-l from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20"
                              : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5 shrink-0" />
                          بطاقة
                        </button>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <label className="text-[15px] font-bold text-foreground mb-1 block">
                        مبلغ الدفع
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="h-12 text-[15px] font-bold"
                        dir="ltr"
                        value={purchaseForm.paidAmount}
                        onChange={(e) =>
                          setPurchaseForm((f) => ({
                            ...f,
                            paidAmount: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="text-[15px] font-bold text-foreground mb-1 block">
                        خصم
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="h-12 text-[15px] font-bold"
                        dir="ltr"
                        value={purchaseForm.discountAmount}
                        onChange={(e) =>
                          setPurchaseForm((f) => ({
                            ...f,
                            discountAmount: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="text-[15px] font-bold text-foreground mb-1 block">
                        باقي قائمة
                      </label>
                      <div
                        className="h-12 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 flex items-center text-[15px] font-bold text-amber-700 dark:text-amber-300"
                        dir="ltr"
                      >
                        {fmtMoney(purchaseTotals.remainingAmount)}
                      </div>
                    </div>
                  </div>
                  {purchaseForm.paymentMethod === "card" ? (
                    <ModernCombobox
                      value={purchaseForm.cardId}
                      onChange={(cardId) =>
                        setPurchaseForm((f) => ({ ...f, cardId }))
                      }
                      options={purchaseBranchCardOptions}
                      label="البطاقة *"
                      placeholder={
                        purchaseForm.branchId
                          ? "اختر البطاقة حسب الفرع"
                          : "اختر الفرع أولاً"
                      }
                      icon={CreditCard}
                      searchable
                      searchPlaceholder="ابحث عن البطاقة..."
                      emptyText={
                        purchaseForm.branchId
                          ? "لا توجد بطاقة لهذا الفرع"
                          : "اختر الفرع أولاً لعرض البطاقات"
                      }
                      size="sm"
                      labelClassName="text-[14px] font-bold text-foreground !mb-0"
                      valueClassName="text-[14px] font-bold"
                      className="[&>div:first-child]:mb-0.5"
                    />
                  ) : null}
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-0.5">
                  {purchaseError ? (
                    <p className="text-[14px] font-bold text-destructive sm:me-auto">
                      {purchaseError}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    className="rounded-full h-12 px-6 text-[15px] font-bold w-full sm:w-auto touch-manipulation"
                    disabled={creatingPurchase || updatingPurchase}
                    onClick={savePurchase}
                  >
                    {editingPurchaseId != null ? "حفظ التعديلات" : "حفظ فاتورة الشراء"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="px-3 py-2.5 sm:px-4 sm:py-3 border border-border/50 space-y-2 overflow-hidden">
            <h3 className="text-[15px] font-extrabold">فواتير الشراء</h3>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 items-end">
              <div className="min-w-0">
                <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                  من تاريخ
                </label>
                <YmdDateInput
                  className="h-11 text-[14px] font-bold"
                  value={purchaseListFromDate}
                  onChange={setPurchaseListFromDate}
                />
              </div>
              <div className="min-w-0">
                <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                  إلى تاريخ
                </label>
                <YmdDateInput
                  className="h-11 text-[14px] font-bold"
                  value={purchaseListToDate}
                  onChange={setPurchaseListToDate}
                />
              </div>
              <div className="min-w-0">
                <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                  رقم الفاتورة
                </label>
                <div className="relative">
                  <Hash className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="h-11 ps-8 text-[14px] font-bold"
                    dir="ltr"
                    value={purchaseListInvoiceNo}
                    onChange={(e) => setPurchaseListInvoiceNo(e.target.value)}
                    placeholder="بحث برقم الفاتورة"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <ModernCombobox
                  value={purchaseListBranchId}
                  onChange={setPurchaseListBranchId}
                  options={branchSearchOptions}
                  label="الفرع"
                  placeholder="كل الفروع"
                  icon={Building2}
                  searchable
                  size="sm"
                  searchPlaceholder="ابحث عن فرع..."
                  emptyText="لا يوجد فرع مطابق"
                  labelClassName="text-[14px] font-bold text-foreground"
                  valueClassName="text-[14px] font-bold"
                  className="[&>div:first-child]:mb-0.5"
                />
              </div>
              <div className="min-w-0 col-span-2 lg:col-span-1">
                <ModernCombobox
                  value={purchaseListSupplierId}
                  onChange={setPurchaseListSupplierId}
                  options={supplierNameSearchOptions}
                  label="المورد"
                  placeholder="كل الموردين"
                  icon={Truck}
                  searchable
                  size="sm"
                  searchPlaceholder="ابحث عن مورد..."
                  emptyText="لا يوجد مورد مطابق"
                  labelClassName="text-[14px] font-bold text-foreground"
                  valueClassName="text-[14px] font-bold"
                  className="[&>div:first-child]:mb-0.5"
                />
              </div>
            </div>
            {loadingPurchases ? (
              <div className="py-6 flex justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (purchases ?? []).length === 0 ? (
              <p className="text-[14px] font-bold text-muted-foreground text-center py-5">
                لا توجد فواتير بعد
              </p>
            ) : filteredPurchases.length === 0 ? (
              <p className="text-[14px] font-bold text-muted-foreground text-center py-5">
                لا توجد فواتير مطابقة للبحث
              </p>
            ) : (
              <>
                {/* Desktop / tablet table */}
                <div className="hidden md:block overflow-auto rounded-xl border border-border/40">
                  <table className="w-full text-[14px] xl:text-[15px]">
                    <thead className="bg-secondary/50 text-primary">
                      <tr>
                        <th className="text-center p-2.5 font-bold">رقم الفاتورة</th>
                        <th className="text-center p-2.5 font-bold">التاريخ</th>
                        <th className="text-center p-2.5 font-bold">اسم المورد</th>
                        <th className="text-center p-2.5 font-bold">مجموع مبلغ</th>
                        <th className="text-center p-2.5 font-bold">مبلغ الدفع</th>
                        <th className="text-center p-2.5 font-bold">خصم</th>
                        <th className="text-center p-2.5 font-bold">باقي قائمة</th>
                        <th className="text-center p-2.5 font-bold">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPurchases.map((p) => (
                        <tr
                          key={p.id}
                          className={`border-t border-border/30 ${
                            editingPurchaseId === p.id ? "bg-primary/5" : ""
                          }`}
                        >
                          <td className="p-2.5 text-center font-mono font-bold">{p.invoiceNo}</td>
                          <td className="p-2.5 text-center font-bold tabular-nums" dir="ltr">
                            {formatDate(p.invoiceDate)}
                          </td>
                          <td className="p-2.5 text-center font-bold">{p.supplierName || "—"}</td>
                          <td className="p-2.5 text-center font-bold" dir="ltr">
                            {fmtMoney(p.totalAmount)}
                          </td>
                          <td className="p-2.5 text-center font-bold" dir="ltr">
                            {fmtMoney(p.paidAmount || 0)}
                          </td>
                          <td className="p-2.5 text-center font-bold" dir="ltr">
                            {fmtMoney(p.discountAmount || 0)}
                          </td>
                          <td className="p-2.5 text-center font-bold text-amber-700 dark:text-amber-300" dir="ltr">
                            {fmtMoney(p.remainingAmount ?? 0)}
                          </td>
                          <td className="p-2.5">
                            <div className="flex justify-center gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 text-muted-foreground hover:text-primary touch-manipulation"
                                title="تعديل"
                                onClick={() => openEditPurchase(p)}
                              >
                                <Pencil className="w-5 h-5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 text-muted-foreground hover:text-primary touch-manipulation"
                                title="تقرير حراري"
                                onClick={() => printPurchaseReport(p)}
                              >
                                <Printer className="w-5 h-5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 text-destructive touch-manipulation"
                                title="حذف"
                                onClick={() => {
                                  if (!confirm("حذف فاتورة الشراء؟")) return;
                                  if (editingPurchaseId === p.id) resetPurchaseForm();
                                  deletePurchase({ id: p.id }, { onSuccess: invalidateAll });
                                }}
                              >
                                <Trash2 className="w-5 h-5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {filteredPurchases.map((p) => (
                    <div
                      key={p.id}
                      className={`rounded-xl border border-border/40 px-2.5 py-2 space-y-2 ${
                        editingPurchaseId === p.id ? "border-primary/40 bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[15px] font-extrabold">
                            #{p.invoiceNo} — {p.supplierName || "—"}
                          </p>
                          <p className="text-[13px] font-bold text-muted-foreground tabular-nums" dir="ltr">
                            {formatDate(p.invoiceDate)}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[13px] font-bold">
                        <div className="rounded-lg bg-secondary/40 px-2 py-1.5 flex justify-between gap-1">
                          <span className="text-muted-foreground">مجموع</span>
                          <span dir="ltr">{fmtMoney(p.totalAmount)}</span>
                        </div>
                        <div className="rounded-lg bg-secondary/40 px-2 py-1.5 flex justify-between gap-1">
                          <span className="text-muted-foreground">دفع</span>
                          <span dir="ltr">{fmtMoney(p.paidAmount || 0)}</span>
                        </div>
                        <div className="rounded-lg bg-secondary/40 px-2 py-1.5 flex justify-between gap-1">
                          <span className="text-muted-foreground">خصم</span>
                          <span dir="ltr">{fmtMoney(p.discountAmount || 0)}</span>
                        </div>
                        <div className="rounded-lg bg-amber-500/10 px-2 py-1.5 flex justify-between gap-1 text-amber-700 dark:text-amber-300">
                          <span>باقي</span>
                          <span dir="ltr">{fmtMoney(p.remainingAmount ?? 0)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 h-11 text-[14px] font-bold gap-1.5 touch-manipulation"
                          onClick={() => openEditPurchase(p)}
                        >
                          <Pencil className="w-4 h-4" /> تعديل
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 h-11 text-[14px] font-bold gap-1.5 touch-manipulation"
                          onClick={() => printPurchaseReport(p)}
                        >
                          <Printer className="w-4 h-4" /> تقرير
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-destructive touch-manipulation"
                          onClick={() => {
                            if (!confirm("حذف فاتورة الشراء؟")) return;
                            if (editingPurchaseId === p.id) resetPurchaseForm();
                            deletePurchase({ id: p.id }, { onSuccess: invalidateAll });
                          }}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      ) : null}

      {/* ── Returns ── */}
      {section === "returns" ? (
        <SupplierReturnsPanel
          suppliers={suppliers}
          menuItems={menuItems}
          restaurantName={restaurantName}
          restaurantLogoUrl={restaurantLogoUrl}
          restaurantMobile={restaurantMobile}
          onInvalidate={invalidateAll}
        />
      ) : null}

      {/* ── Movement ── */}
      {section === "movement" ? (
        <div className="space-y-4">
          <Card className="p-4 sm:p-6 border border-border/50 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-extrabold">حركة المورد</h2>
                <p className="text-xs text-muted-foreground font-semibold">
                  رقم الفاتورة · تاريخ · ساعة · اسم المورد · نوع المبلغ · ملاحظة
                </p>
              </div>
              <Button
                type="button"
                className="rounded-full h-12 px-5 text-[15px] font-bold touch-manipulation"
                onClick={openNewMovement}
              >
                <Plus className="w-5 h-5 me-1.5" /> إضافة حركة جديدة
              </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 items-end">
              <div className="min-w-0">
                <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                  من تاريخ
                </label>
                <YmdDateInput
                  className="h-11 text-[14px] font-bold"
                  value={movementListFromDate}
                  onChange={setMovementListFromDate}
                />
              </div>
              <div className="min-w-0">
                <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                  إلى تاريخ
                </label>
                <YmdDateInput
                  className="h-11 text-[14px] font-bold"
                  value={movementListToDate}
                  onChange={setMovementListToDate}
                />
              </div>
              <div className="min-w-0">
                <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                  رقم الفاتورة
                </label>
                <div className="relative">
                  <Hash className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="h-11 ps-8 text-[14px] font-bold"
                    dir="ltr"
                    value={movementListInvoiceNo}
                    onChange={(e) => setMovementListInvoiceNo(e.target.value)}
                    placeholder="بحث برقم الفاتورة"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <ModernCombobox
                  value={movementListBranchId}
                  onChange={setMovementListBranchId}
                  options={branchSearchOptions}
                  label="الفرع"
                  placeholder="كل الفروع"
                  icon={Building2}
                  searchable
                  size="sm"
                  searchPlaceholder="ابحث عن فرع..."
                  emptyText="لا يوجد فرع مطابق"
                  labelClassName="text-[14px] font-bold text-foreground"
                  valueClassName="text-[14px] font-bold"
                  className="[&>div:first-child]:mb-0.5"
                />
              </div>
              <div className="min-w-0">
                <ModernCombobox
                  value={movementListSupplierId}
                  onChange={setMovementListSupplierId}
                  options={movementSupplierSearchOptions}
                  label="المورد"
                  placeholder="كل الموردين"
                  icon={Truck}
                  searchable
                  size="sm"
                  searchPlaceholder="ابحث عن مورد..."
                  emptyText="لا يوجد مورد مطابق"
                  labelClassName="text-[14px] font-bold text-foreground"
                  valueClassName="text-[14px] font-bold"
                  className="[&>div:first-child]:mb-0.5"
                />
              </div>
              <div className="min-w-0">
                <ModernCombobox
                  value={movementListAmountType}
                  onChange={setMovementListAmountType}
                  options={movementAmountTypeFilterOptions}
                  label="النوع"
                  placeholder="كل الأنواع"
                  icon={Wallet}
                  searchable={false}
                  size="sm"
                  labelClassName="text-[14px] font-bold text-foreground"
                  valueClassName="text-[14px] font-bold"
                  className="[&>div:first-child]:mb-0.5"
                />
              </div>
            </div>

            {loadingMovements ? (
              <div className="py-8 flex justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (movements ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد حركات بعد</p>
            ) : filteredMovements.length === 0 ? (
              <p className="text-[14px] font-bold text-muted-foreground text-center py-5">
                لا توجد حركات مطابقة للبحث
              </p>
            ) : (
              <div className="overflow-auto rounded-2xl border border-border/40">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-primary">
                    <tr>
                      <th className="text-center p-3 font-bold">الفاتورة</th>
                      <th className="text-center p-3 font-bold">التاريخ</th>
                      <th className="text-center p-3 font-bold">الساعة</th>
                      <th className="text-center p-3 font-bold">المورد</th>
                      <th className="text-center p-3 font-bold">النوع</th>
                      <th className="text-center p-3 font-bold">المبلغ</th>
                      <th className="text-center p-3 font-bold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.map((m) => (
                      <tr
                        key={m.id}
                        className={`border-t border-border/30 ${
                          editingMovementId === m.id ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="p-3 text-center font-mono font-bold">{m.invoiceNo}</td>
                        <td className="p-3 text-center font-bold tabular-nums" dir="ltr">
                          {formatDate(m.movementDate)}
                        </td>
                        <td className="p-3 text-center font-bold tabular-nums font-mono" dir="ltr">
                          {m.movementTime}
                        </td>
                        <td className="p-3 text-center font-bold">{m.supplierName}</td>
                        <td className="p-3 text-center font-bold">
                          {movementAmountTypeLabel(m.amountType)}
                        </td>
                        <td className="p-3 text-center font-bold" dir="ltr">
                          {fmtMoney(m.amount)}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 text-muted-foreground hover:text-primary touch-manipulation"
                              title="تعديل"
                              onClick={() => openEditMovement(m)}
                            >
                              <Pencil className="w-5 h-5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 text-muted-foreground hover:text-primary touch-manipulation"
                              title="تقرير حراري 80×80"
                              onClick={() => void printMovementReport(m)}
                            >
                              <Printer className="w-5 h-5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 text-destructive touch-manipulation"
                              title="حذف"
                              onClick={() => {
                                if (!confirm("حذف الحركة؟")) return;
                                if (editingMovementId === m.id) {
                                  setMovementFormOpen(false);
                                  resetMovementForm();
                                }
                                deleteMovement({ id: m.id }, { onSuccess: invalidateAll });
                              }}
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {/* ── Statement ── */}
      {section === "statement" ? (
        <Card className="p-4 sm:p-6 border border-border/50 space-y-4 touch-ui">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold">كشف حساب المورد</h2>
              <p className="text-xs text-muted-foreground font-semibold">
                كشف مهني حسب الفترة مع رصيد مرحّل وتقرير للطباعة
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-full h-11 px-5 text-[15px] font-bold touch-manipulation"
              disabled={!statement}
              onClick={() => void printStatement()}
            >
              <Printer className="w-4 h-4 me-1.5" /> تقرير الكشف
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
            <div className="min-w-0 col-span-2 lg:col-span-1">
              <ModernCombobox
                value={statementSupplierId ? String(statementSupplierId) : ""}
                onChange={(v) => setStatementSupplierId(Number(v) || 0)}
                options={supplierOptions}
                label="المورد *"
                placeholder="اختر المورد"
                icon={Building2}
                searchable
                size="sm"
                searchPlaceholder="ابحث عن مورد..."
                emptyText="لا يوجد مورد مطابق"
                labelClassName="text-[14px] font-bold text-foreground"
                valueClassName="text-[14px] font-bold"
                className="[&>div:first-child]:mb-0.5"
              />
            </div>
            <div className="min-w-0">
              <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                من تاريخ
              </label>
              <YmdDateInput
                className="h-11 text-[14px] font-bold"
                value={statementFromDate}
                onChange={setStatementFromDate}
              />
            </div>
            <div className="min-w-0">
              <label className="text-[14px] font-bold text-foreground mb-0.5 block leading-none">
                إلى تاريخ
              </label>
              <YmdDateInput
                className="h-11 text-[14px] font-bold"
                value={statementToDate}
                onChange={setStatementToDate}
              />
            </div>
            <div className="min-w-0 col-span-2 lg:col-span-1 flex items-end">
              <p className="text-[12px] font-bold text-muted-foreground pb-2">
                الافتراضي: تاريخ اليوم
              </p>
            </div>
          </div>

          {statementFromDate &&
          statementToDate &&
          statementFromDate > statementToDate ? (
            <p className="text-[14px] font-bold text-destructive">
              تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية
            </p>
          ) : null}

          {!statementSupplierId ? (
            <p className="text-sm text-muted-foreground text-center py-10 font-semibold">
              اختر مورداً لعرض كشف الحساب
            </p>
          ) : loadingStatement ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : statement ? (
            <>
              <div
                className={`grid grid-cols-2 lg:grid-cols-4 gap-2.5 ${
                  fetchingStatement ? "opacity-70" : ""
                }`}
              >
                <div className="rounded-2xl border border-border/50 bg-secondary/30 px-3.5 py-3">
                  <p className="text-[12px] font-bold text-muted-foreground">المورد</p>
                  <p className="font-extrabold text-[15px] mt-0.5 truncate">
                    {statement.supplier.name}
                  </p>
                  <p className="text-[12px] font-mono font-bold text-muted-foreground" dir="ltr">
                    {statement.supplier.code}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-secondary/30 px-3.5 py-3">
                  <p className="text-[12px] font-bold text-muted-foreground">رصيد مرحّل</p>
                  <p
                    className={`text-lg font-black mt-0.5 tabular-nums ${balanceTone(
                      statement.openingBalance ?? 0
                    )}`}
                    dir="ltr"
                  >
                    {fmtMoney(statement.openingBalance ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-secondary/30 px-3.5 py-3">
                  <p className="text-[12px] font-bold text-muted-foreground">مدين / دائن</p>
                  <p className="text-[14px] font-extrabold mt-0.5 tabular-nums" dir="ltr">
                    {fmtMoney(statement.totalDebit ?? 0)}
                    <span className="text-muted-foreground mx-1">/</span>
                    {fmtMoney(statement.totalCredit ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/30 bg-primary/5 px-3.5 py-3">
                  <p className="text-[12px] font-bold text-muted-foreground">الرصيد النهائي</p>
                  <p
                    className={`text-xl font-black mt-0.5 tabular-nums ${balanceTone(
                      statement.balance
                    )}`}
                    dir="ltr"
                  >
                    {fmtMoney(statement.balance)}
                  </p>
                  <p className="text-[12px] font-bold">{statement.balanceLabel}</p>
                </div>
              </div>

              <div className="overflow-auto rounded-2xl border border-border/40">
                <table className="w-full text-[14px]">
                  <thead className="bg-secondary/50 text-primary">
                    <tr>
                      <th className="text-center p-2.5 font-bold">التاريخ</th>
                      <th className="text-center p-2.5 font-bold">النوع</th>
                      <th className="text-center p-2.5 font-bold">رقم الفاتورة</th>
                      <th className="text-center p-2.5 font-bold">البيان</th>
                      <th className="text-center p-2.5 font-bold">مدين</th>
                      <th className="text-center p-2.5 font-bold">دائن</th>
                      <th className="text-center p-2.5 font-bold">الرصيد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.lines.map((l) => (
                      <tr
                        key={l.id}
                        className={`border-t border-border/30 ${
                          l.kind === "opening" ? "bg-secondary/25" : ""
                        }`}
                      >
                        <td className="p-2.5 text-center font-bold tabular-nums" dir="ltr">
                          {l.date ? formatDate(l.date) : "—"}
                        </td>
                        <td
                          className={`p-2.5 text-center font-extrabold ${statementDocTypeTone(
                            statementDocType(l)
                          )}`}
                        >
                          {statementDocType(l)}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold">{l.invoiceNo}</td>
                        <td className="p-2.5 text-center font-bold text-muted-foreground">
                          {l.description || "—"}
                        </td>
                        <td className="p-2.5 text-center font-bold tabular-nums" dir="ltr">
                          {fmtMoney(l.debit)}
                        </td>
                        <td className="p-2.5 text-center font-bold tabular-nums" dir="ltr">
                          {fmtMoney(l.credit)}
                        </td>
                        <td
                          className={`p-2.5 text-center font-black tabular-nums ${balanceTone(
                            l.balance
                          )}`}
                          dir="ltr"
                        >
                          {fmtMoney(l.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </Card>
      ) : null}

      {/* ── Debts ── */}
      {section === "debts" ? (
        <Card className="p-4 sm:p-6 border border-border/50 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold">ديون الموردين</h2>
              <p className="text-xs text-muted-foreground font-semibold">
                كود المورد · اسم المورد · مبلغ الدين · باقي عنده / باقي عندنا
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => void refetchDebts()}
              >
                تحديث
              </Button>
              <Button
                type="button"
                className="rounded-full"
                disabled={!debts?.items?.length}
                onClick={printDebtsReport}
              >
                <FileText className="w-4 h-4 me-1.5" /> تقرير ديون الموردين
              </Button>
            </div>
          </div>

          {debts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  إجمالي باقي عندنا
                </p>
                <p className="text-2xl font-black text-amber-700 dark:text-amber-300" dir="ltr">
                  {fmtMoney(debts.totalOwedByUs)}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  إجمالي باقي عنده
                </p>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300" dir="ltr">
                  {fmtMoney(debts.totalOwedToUs)}
                </p>
              </div>
            </div>
          ) : null}

          {loadingDebts ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (debts?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">لا توجد بيانات</p>
          ) : (
            <div className="overflow-auto rounded-2xl border border-border/40">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-primary">
                  <tr>
                    <th className="text-start p-3 font-bold">كود المورد</th>
                    <th className="text-start p-3 font-bold">اسم المورد</th>
                    <th className="text-start p-3 font-bold">مبلغ الدين</th>
                    <th className="text-start p-3 font-bold">البيان</th>
                  </tr>
                </thead>
                <tbody>
                  {debts!.items.map((d) => (
                    <tr key={d.id} className="border-t border-border/30">
                      <td className="p-3 font-mono font-bold">{d.code}</td>
                      <td className="p-3 font-extrabold">{d.name}</td>
                      <td className={`p-3 font-black ${balanceTone(d.balance)}`} dir="ltr">
                        {fmtMoney(d.balance)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                            d.balance > 0
                              ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                              : d.balance < 0
                                ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                                : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          {d.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      <Dialog
        isOpen={supplierFormOpen}
        onClose={() => setSupplierFormOpen(false)}
        title={editingSupplier ? "تعديل مورد" : "إضافة مورد"}
      >
        <div className="space-y-3">
          <div>
            <label className="text-[15px] font-bold text-foreground mb-1.5 block">
              كود المورد
            </label>
            <Input
              className="h-12 text-[15px] font-bold bg-secondary/50 text-muted-foreground cursor-not-allowed"
              value={supplierForm.code}
              readOnly
              disabled
              dir="ltr"
            />
            <p className="text-[12px] text-muted-foreground mt-1 font-semibold">
              يُولَّد تلقائياً ويزيد مع كل مورد جديد
            </p>
          </div>
          <div>
            <label className="text-[15px] font-bold text-foreground mb-1.5 block">
              اسم المورد *
            </label>
            <Input
              className="h-12 text-[15px] font-bold"
              value={supplierForm.name}
              onChange={(e) => {
                setSupplierForm((f) => ({ ...f, name: e.target.value }));
                if (supplierError) setSupplierError("");
              }}
            />
          </div>
          <div>
            <label className="text-[15px] font-bold text-foreground mb-1.5 block">
              رصيد افتتاحي
            </label>
            <Input
              type="number"
              step="0.01"
              dir="ltr"
              placeholder="فارغ = صفر"
              className="h-12 text-[15px] font-bold placeholder:text-muted-foreground/35 placeholder:font-normal"
              value={supplierForm.openingBalance}
              onChange={(e) =>
                setSupplierForm((f) => ({
                  ...f,
                  openingBalance: e.target.value === "" ? "" : e.target.value,
                }))
              }
            />
            <p className="text-[12px] text-muted-foreground mt-1 font-semibold">
              موجب = باقي عندنا · سالب = باقي عنده
            </p>
          </div>
          <div>
            <label className="text-[15px] font-bold text-foreground mb-1.5 block">
              ملاحظة
            </label>
            <Input
              className="h-12 text-[15px] font-bold"
              value={supplierForm.notes}
              onChange={(e) => setSupplierForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          {supplierError ? (
            <p className="text-[15px] font-bold text-destructive">{supplierError}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 text-[15px] font-bold"
              onClick={() => setSupplierFormOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              className="flex-1 h-12 text-[15px] font-bold"
              disabled={creatingSupplier || updatingSupplier}
              onClick={saveSupplier}
            >
              حفظ
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={movementFormOpen}
        onClose={() => {
          setMovementFormOpen(false);
          resetMovementForm();
        }}
        title={editingMovementId != null ? "تعديل حركة مورد" : "إضافة حركة مورد جديدة"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3.5 touch-ui">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[16px] font-bold text-foreground mb-1.5 block">
                رقم الفاتورة
              </label>
              <div className="relative">
                <Hash className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="h-12 ps-9 text-[16px] font-bold bg-secondary/50 text-muted-foreground cursor-not-allowed"
                  value={movementForm.invoiceNo || nextMovementInvoiceNo(movements)}
                  readOnly
                  disabled
                  dir="ltr"
                />
              </div>
              <p className="text-[12px] text-muted-foreground mt-1 font-semibold">
                {editingMovementId != null
                  ? "رقم الفاتورة ثابت ولا يتغير عند التعديل"
                  : "يُولَّد تلقائياً من 1 ويزيد بدون تكرار"}
              </p>
            </div>
            <div>
              <label className="text-[16px] font-bold text-foreground mb-1.5 block">
                التاريخ *
              </label>
              <YmdDateInput
                className="h-12 text-[16px] font-bold tabular-nums tracking-wide"
                value={movementForm.movementDate}
                onChange={(movementDate) =>
                  setMovementForm((f) => ({ ...f, movementDate }))
                }
              />
            </div>
            <div>
              <label className="text-[16px] font-bold text-foreground mb-1.5 block">
                الساعة
              </label>
              <Input
                className="h-12 text-[16px] font-bold bg-secondary/50 text-muted-foreground cursor-not-allowed font-mono tracking-wide"
                dir="ltr"
                value={movementForm.movementTime}
                readOnly
                disabled
              />
            </div>
            <ModernCombobox
              value={movementForm.supplierId}
              onChange={(v) => setMovementForm((f) => ({ ...f, supplierId: v }))}
              options={supplierOptions}
              label="اسم المورد *"
              placeholder="اختر المورد"
              icon={Truck}
              labelClassName="text-[16px] font-bold text-foreground"
              valueClassName="text-[16px] font-bold"
            />
            <ModernCombobox
              value={movementForm.branchId}
              onChange={(branchId) =>
                setMovementForm((f) => ({
                  ...f,
                  branchId,
                  cardId: "",
                }))
              }
              options={branchOptions}
              label="الفرع *"
              placeholder="اختر الفرع"
              icon={Building2}
              labelClassName="text-[16px] font-bold text-foreground"
              valueClassName="text-[16px] font-bold"
            />
            <ModernCombobox
              value={movementForm.amountType}
              onChange={(v) => {
                const amountType = (v as SupplierAmountType) || "paid";
                setMovementForm((f) => ({
                  ...f,
                  amountType,
                  ...(amountType === "discount"
                    ? { paymentMethod: "cash" as const, cardId: "" }
                    : {}),
                }));
              }}
              options={amountTypeOptions}
              label="نوع المبلغ *"
              placeholder="مدفوع"
              icon={Wallet}
              searchable={false}
              labelClassName="text-[16px] font-bold text-foreground"
              valueClassName="text-[16px] font-bold"
            />
            <div>
              <label className="text-[16px] font-bold text-foreground mb-1.5 block">
                المبلغ *
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="h-12 text-[16px] font-bold"
                dir="ltr"
                value={movementForm.amount}
                placeholder="0"
                onChange={(e) =>
                  setMovementForm((f) => ({
                    ...f,
                    amount: e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>
          {movementNeedsPayment ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl border border-border/60 bg-secondary/40">
                <button
                  type="button"
                  onClick={() =>
                    setMovementForm((f) => ({
                      ...f,
                      paymentMethod: "cash",
                      cardId: "",
                    }))
                  }
                  className={`h-12 rounded-xl flex items-center justify-center gap-2 font-extrabold text-[14px] touch-manipulation transition-all ${
                    movementForm.paymentMethod === "cash"
                      ? "bg-gradient-to-l from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  بدون بطاقة
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMovementForm((f) => ({ ...f, paymentMethod: "card" }))
                  }
                  className={`h-12 rounded-xl flex items-center justify-center gap-2 font-extrabold text-[14px] touch-manipulation transition-all ${
                    movementForm.paymentMethod === "card"
                      ? "bg-gradient-to-l from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/70"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  بطاقة
                </button>
              </div>
              {movementForm.paymentMethod === "card" ? (
                <ModernCombobox
                  value={movementForm.cardId}
                  onChange={(cardId) =>
                    setMovementForm((f) => ({ ...f, cardId }))
                  }
                  options={movementBranchCardOptions}
                  label="البطاقة *"
                  placeholder={
                    movementForm.branchId
                      ? "اختر البطاقة حسب الفرع"
                      : "اختر الفرع أولاً"
                  }
                  icon={CreditCard}
                  searchable
                  searchPlaceholder="ابحث عن البطاقة..."
                  emptyText={
                    movementForm.branchId
                      ? "لا توجد بطاقة لهذا الفرع"
                      : "اختر الفرع أولاً لعرض البطاقات"
                  }
                  labelClassName="text-[16px] font-bold text-foreground"
                  valueClassName="text-[16px] font-bold"
                />
              ) : null}
            </div>
          ) : null}
          <div>
            <label className="text-[16px] font-bold text-foreground mb-1.5 block">
              ملاحظة
            </label>
            <Input
              className="h-12 text-[16px] font-bold"
              value={movementForm.notes}
              onChange={(e) => setMovementForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="اختياري"
            />
          </div>
          {movementError ? (
            <p className="text-[15px] font-bold text-destructive">{movementError}</p>
          ) : null}
          <div className="flex gap-2.5 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-full text-[16px] font-bold touch-manipulation"
              onClick={() => {
                setMovementFormOpen(false);
                resetMovementForm();
              }}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              className="flex-1 h-12 rounded-full text-[16px] font-bold touch-manipulation"
              disabled={creatingMovement || updatingMovement}
              onClick={saveMovement}
            >
              {editingMovementId != null ? "حفظ التعديلات" : "حفظ الحركة"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
