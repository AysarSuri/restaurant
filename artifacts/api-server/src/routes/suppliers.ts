import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  suppliersTable,
  supplierPurchasesTable,
  supplierPurchaseItemsTable,
  supplierReturnsTable,
  supplierReturnItemsTable,
  supplierMovementsTable,
  menuItemsTable,
  branchesTable,
  cardsTable,
} from "@workspace/db/schema";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  applyWeightedCostAdd,
  applyWeightedCostRemove,
  applyWeightedCostPurchaseReplace,
  applyWeightedCostReturnReplace,
  mapDbItemsToCostLines,
} from "../lib/item-cost-avg";

const router: IRouter = Router();

async function loadPurchaseCostLines(purchaseId: number) {
  const rows = await db
    .select({
      menuItemId: supplierPurchaseItemsTable.menuItemId,
      qty: supplierPurchaseItemsTable.qty,
      unitKind: supplierPurchaseItemsTable.unitKind,
      price: supplierPurchaseItemsTable.price,
    })
    .from(supplierPurchaseItemsTable)
    .where(eq(supplierPurchaseItemsTable.purchaseId, purchaseId));
  return mapDbItemsToCostLines(rows);
}

async function loadReturnCostLines(returnId: number) {
  const rows = await db
    .select({
      menuItemId: supplierReturnItemsTable.menuItemId,
      qty: supplierReturnItemsTable.qty,
      unitKind: supplierReturnItemsTable.unitKind,
      price: supplierReturnItemsTable.price,
    })
    .from(supplierReturnItemsTable)
    .where(eq(supplierReturnItemsTable.returnId, returnId));
  return mapDbItemsToCostLines(rows);
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_TYPES = new Set(["paid", "received", "discount"]);
const UNIT_KINDS = new Set(["major", "minor"]);

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function money(v: unknown): string {
  return num(v).toFixed(2);
}

function qtyStr(v: unknown): string {
  return num(v).toFixed(3);
}

function todayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function normalizeDate(v: unknown): string | null {
  const raw = String(v ?? "").trim();
  if (!DATE_RE.test(raw)) return null;
  return raw;
}

function normalizeTime(v: unknown): string | null {
  const raw = String(v ?? "").trim();
  if (!TIME_RE.test(raw)) return null;
  return raw;
}

async function isDuplicateSupplierCode(code: string, excludeId?: number) {
  const normalized = code.trim().toLowerCase();
  const conditions = [sql`lower(${suppliersTable.code}) = ${normalized}`];
  if (excludeId != null) conditions.push(ne(suppliersTable.id, excludeId));
  const rows = await db
    .select({ id: suppliersTable.id })
    .from(suppliersTable)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

async function isDuplicateSupplierName(name: string, excludeId?: number) {
  const normalized = name.trim().toLowerCase();
  const conditions = [sql`lower(${suppliersTable.name}) = ${normalized}`];
  if (excludeId != null) conditions.push(ne(suppliersTable.id, excludeId));
  const rows = await db
    .select({ id: suppliersTable.id })
    .from(suppliersTable)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

async function nextSupplierCode(): Promise<string> {
  const rows = await db.select({ code: suppliersTable.code }).from(suppliersTable);
  let max = 0;
  for (const row of rows) {
    const match = String(row.code ?? "").trim().match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

async function isDuplicatePurchaseInvoiceNo(invoiceNo: string) {
  const normalized = invoiceNo.trim().toLowerCase();
  const rows = await db
    .select({ id: supplierPurchasesTable.id })
    .from(supplierPurchasesTable)
    .where(sql`lower(${supplierPurchasesTable.invoiceNo}) = ${normalized}`)
    .limit(1);
  return rows.length > 0;
}

async function nextPurchaseInvoiceNo(): Promise<string> {
  const rows = await db
    .select({ invoiceNo: supplierPurchasesTable.invoiceNo })
    .from(supplierPurchasesTable);
  let max = 0;
  for (const row of rows) {
    const match = String(row.invoiceNo ?? "").trim().match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

async function isDuplicateReturnInvoiceNo(invoiceNo: string) {
  const normalized = invoiceNo.trim().toLowerCase();
  const rows = await db
    .select({ id: supplierReturnsTable.id })
    .from(supplierReturnsTable)
    .where(sql`lower(${supplierReturnsTable.invoiceNo}) = ${normalized}`)
    .limit(1);
  return rows.length > 0;
}

async function nextReturnInvoiceNo(): Promise<string> {
  const rows = await db
    .select({ invoiceNo: supplierReturnsTable.invoiceNo })
    .from(supplierReturnsTable);
  let max = 0;
  for (const row of rows) {
    const match = String(row.invoiceNo ?? "").trim().match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

async function isDuplicateMovementInvoiceNo(invoiceNo: string) {
  const normalized = invoiceNo.trim().toLowerCase();
  const rows = await db
    .select({ id: supplierMovementsTable.id })
    .from(supplierMovementsTable)
    .where(sql`lower(${supplierMovementsTable.invoiceNo}) = ${normalized}`)
    .limit(1);
  return rows.length > 0;
}

async function nextMovementInvoiceNo(): Promise<string> {
  const rows = await db
    .select({ invoiceNo: supplierMovementsTable.invoiceNo })
    .from(supplierMovementsTable);
  let max = 0;
  for (const row of rows) {
    const match = String(row.invoiceNo ?? "").trim().match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

function mapSupplier(row: typeof suppliersTable.$inferSelect) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    openingBalance: num(row.openingBalance),
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function computeBalances(supplierIds: number[]) {
  const map = new Map<number, number>();
  for (const id of supplierIds) map.set(id, 0);
  if (supplierIds.length === 0) return map;

  const suppliers = await db
    .select({
      id: suppliersTable.id,
      openingBalance: suppliersTable.openingBalance,
    })
    .from(suppliersTable)
    .where(inArray(suppliersTable.id, supplierIds));

  for (const s of suppliers) {
    map.set(s.id, num(s.openingBalance));
  }

  const purchases = await db
    .select({
      supplierId: supplierPurchasesTable.supplierId,
      total: sql<string>`coalesce(sum(${supplierPurchasesTable.remainingAmount}), 0)`,
    })
    .from(supplierPurchasesTable)
    .where(inArray(supplierPurchasesTable.supplierId, supplierIds))
    .groupBy(supplierPurchasesTable.supplierId);

  for (const p of purchases) {
    map.set(p.supplierId, (map.get(p.supplierId) ?? 0) + num(p.total));
  }

  const returns = await db
    .select({
      supplierId: supplierReturnsTable.supplierId,
      total: sql<string>`coalesce(sum(${supplierReturnsTable.remainingAmount}), 0)`,
    })
    .from(supplierReturnsTable)
    .where(inArray(supplierReturnsTable.supplierId, supplierIds))
    .groupBy(supplierReturnsTable.supplierId);

  for (const r of returns) {
    map.set(r.supplierId, (map.get(r.supplierId) ?? 0) - num(r.total));
  }

  const movements = await db
    .select({
      supplierId: supplierMovementsTable.supplierId,
      amountType: supplierMovementsTable.amountType,
      total: sql<string>`coalesce(sum(${supplierMovementsTable.amount}), 0)`,
    })
    .from(supplierMovementsTable)
    .where(inArray(supplierMovementsTable.supplierId, supplierIds))
    .groupBy(supplierMovementsTable.supplierId, supplierMovementsTable.amountType);

  for (const m of movements) {
    const total = num(m.total);
    const cur = map.get(m.supplierId) ?? 0;
    if (m.amountType === "paid" || m.amountType === "discount" || m.amountType === "received") {
      map.set(m.supplierId, cur - total);
    }
  }

  return map;
}

// ─── Suppliers CRUD ───────────────────────────────────────

router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(suppliersTable)
    .orderBy(asc(suppliersTable.code), asc(suppliersTable.name));
  const balances = await computeBalances(rows.map((r) => r.id));
  res.json(
    rows.map((r) => ({
      ...mapSupplier(r),
      balance: Number((balances.get(r.id) ?? 0).toFixed(2)),
    }))
  );
});

router.post("/", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const notes = String(req.body?.notes ?? "").trim() || null;
  const openingBalance = money(req.body?.openingBalance);

  if (!name) return res.status(400).json({ message: "اسم المورد مطلوب" });
  if (await isDuplicateSupplierName(name)) {
    return res.status(400).json({ message: "اسم المورد مكرر — اختر اسماً مختلفاً" });
  }

  let code = await nextSupplierCode();
  // Rare race: bump until unique
  while (await isDuplicateSupplierCode(code)) {
    code = String(Number(code) + 1);
  }

  const [row] = await db
    .insert(suppliersTable)
    .values({ code, name, openingBalance, notes })
    .returning();
  res.status(201).json({ ...mapSupplier(row), balance: num(row.openingBalance) });
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });

  const code = String(req.body?.code ?? "").trim();
  const name = String(req.body?.name ?? "").trim();
  const notes = String(req.body?.notes ?? "").trim() || null;
  const openingBalance = money(req.body?.openingBalance);

  if (!code) return res.status(400).json({ message: "كود المورد مطلوب" });
  if (!name) return res.status(400).json({ message: "اسم المورد مطلوب" });
  if (await isDuplicateSupplierCode(code, id)) {
    return res.status(400).json({ message: "كود المورد مكرر" });
  }
  if (await isDuplicateSupplierName(name, id)) {
    return res.status(400).json({ message: "اسم المورد مكرر — اختر اسماً مختلفاً" });
  }

  const [row] = await db
    .update(suppliersTable)
    .set({ code, name, openingBalance, notes, updatedAt: new Date() })
    .where(eq(suppliersTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "المورد غير موجود" });

  const balances = await computeBalances([id]);
  res.json({
    ...mapSupplier(row),
    balance: Number((balances.get(id) ?? 0).toFixed(2)),
  });
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });

  const [existing] = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.id, id))
    .limit(1);
  if (!existing) return res.status(404).json({ message: "المورد غير موجود" });

  const blockMsg =
    "لا يمكن حذف المورد لأن اسمه مستخدم في قائمة شراء أو مرجوعات أو حركة المورد أو عليه مبلغ في أسماء الموردين";

  const [purchase] = await db
    .select({ id: supplierPurchasesTable.id })
    .from(supplierPurchasesTable)
    .where(eq(supplierPurchasesTable.supplierId, id))
    .limit(1);
  if (purchase) {
    return res.status(400).json({ message: blockMsg });
  }
  const [retRow] = await db
    .select({ id: supplierReturnsTable.id })
    .from(supplierReturnsTable)
    .where(eq(supplierReturnsTable.supplierId, id))
    .limit(1);
  if (retRow) {
    return res.status(400).json({ message: blockMsg });
  }
  const [movement] = await db
    .select({ id: supplierMovementsTable.id })
    .from(supplierMovementsTable)
    .where(eq(supplierMovementsTable.supplierId, id))
    .limit(1);
  if (movement) {
    return res.status(400).json({ message: blockMsg });
  }

  const opening = Math.abs(num(existing.openingBalance));
  if (opening > 0.009) {
    return res.status(400).json({ message: blockMsg });
  }

  const balances = await computeBalances([id]);
  const balance = Math.abs(balances.get(id) ?? 0);
  if (balance > 0.009) {
    return res.status(400).json({ message: blockMsg });
  }

  const [row] = await db
    .delete(suppliersTable)
    .where(eq(suppliersTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "المورد غير موجود" });
  res.json({ ok: true });
});

// ─── Purchases ────────────────────────────────────────────

async function loadPurchaseItems(purchaseIds: number[]) {
  const map = new Map<number, any[]>();
  if (purchaseIds.length === 0) return map;
  const rows = await db
    .select({
      id: supplierPurchaseItemsTable.id,
      purchaseId: supplierPurchaseItemsTable.purchaseId,
      menuItemId: supplierPurchaseItemsTable.menuItemId,
      qty: supplierPurchaseItemsTable.qty,
      unitKind: supplierPurchaseItemsTable.unitKind,
      unitLabel: supplierPurchaseItemsTable.unitLabel,
      price: supplierPurchaseItemsTable.price,
      amount: supplierPurchaseItemsTable.amount,
      itemNameAr: menuItemsTable.nameAr,
      itemName: menuItemsTable.name,
      majorUnit: menuItemsTable.majorUnit,
      minorUnit: menuItemsTable.minorUnit,
      subunitQty: menuItemsTable.subunitQty,
    })
    .from(supplierPurchaseItemsTable)
    .leftJoin(
      menuItemsTable,
      eq(menuItemsTable.id, supplierPurchaseItemsTable.menuItemId)
    )
    .where(inArray(supplierPurchaseItemsTable.purchaseId, purchaseIds));

  for (const r of rows) {
    const list = map.get(r.purchaseId) ?? [];
    list.push({
      id: r.id,
      menuItemId: r.menuItemId,
      qty: num(r.qty),
      unitKind: r.unitKind,
      unitLabel: r.unitLabel,
      price: num(r.price),
      amount: num(r.amount),
      itemNameAr: r.itemNameAr,
      itemName: r.itemName,
      majorUnit: r.majorUnit,
      minorUnit: r.minorUnit,
      subunitQty: r.subunitQty,
    });
    map.set(r.purchaseId, list);
  }
  return map;
}

async function enrichPurchases(rows: (typeof supplierPurchasesTable.$inferSelect)[]) {
  const supplierIds = [...new Set(rows.map((r) => r.supplierId))];
  const suppliers =
    supplierIds.length === 0
      ? []
      : await db
          .select()
          .from(suppliersTable)
          .where(inArray(suppliersTable.id, supplierIds));
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const itemsMap = await loadPurchaseItems(rows.map((r) => r.id));
  const branchIds = [
    ...new Set(rows.map((r) => r.branchId).filter(Boolean)),
  ] as number[];
  const cardIds = [...new Set(rows.map((r) => r.cardId).filter(Boolean))] as number[];
  const branches =
    branchIds.length === 0
      ? []
      : await db.select().from(branchesTable).where(inArray(branchesTable.id, branchIds));
  const cards =
    cardIds.length === 0
      ? []
      : await db.select().from(cardsTable).where(inArray(cardsTable.id, cardIds));
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const cardMap = new Map(cards.map((c) => [c.id, c.name]));

  return rows.map((r) => {
    const s = supplierMap.get(r.supplierId);
    const paymentMethod = r.paymentMethod === "card" ? "card" : "cash";
    return {
      id: r.id,
      invoiceNo: r.invoiceNo,
      invoiceDate: r.invoiceDate,
      invoiceTime: r.invoiceTime,
      supplierId: r.supplierId,
      supplierCode: s?.code ?? "",
      supplierName: s?.name ?? "",
      notes: r.notes,
      totalQty: num(r.totalQty),
      totalAmount: num(r.totalAmount),
      paidAmount: num(r.paidAmount),
      discountAmount: num(r.discountAmount),
      remainingAmount: num(r.remainingAmount),
      branchId: r.branchId,
      branchName: r.branchId ? branchMap.get(r.branchId) || "" : "",
      paymentMethod,
      cardId: r.cardId,
      cardName: r.cardId ? cardMap.get(r.cardId) || "" : "",
      items: itemsMap.get(r.id) ?? [],
      createdAt: r.createdAt,
    };
  });
}

router.get("/purchases", async (_req, res) => {
  const rows = await db
    .select()
    .from(supplierPurchasesTable)
    .orderBy(desc(supplierPurchasesTable.invoiceDate), desc(supplierPurchasesTable.id));
  res.json(await enrichPurchases(rows));
});

type ParsedPurchaseItem = {
  menuItemId: number;
  qty: string;
  unitKind: string;
  unitLabel: string;
  price: string;
  amount: string;
};

async function parsePurchaseBody(body: any): Promise<
  | { ok: false; status: number; message: string }
  | {
      ok: true;
      invoiceDate: string;
      invoiceTime: string;
      supplierId: number;
      notes: string | null;
      items: ParsedPurchaseItem[];
      totalQty: number;
      totalAmount: number;
      paidAmount: number;
      discountAmount: number;
      remainingAmount: number;
      branchId: number | null;
      paymentMethod: "cash" | "card";
      cardId: number | null;
    }
> {
  const invoiceDate = normalizeDate(body?.invoiceDate) ?? todayDate();
  const invoiceTime = normalizeTime(body?.invoiceTime) ?? nowTime();
  const supplierId = Number(body?.supplierId);
  const notes = String(body?.notes ?? "").trim() || null;
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const paymentMethodRaw = String(body?.paymentMethod ?? body?.payMethod ?? "cash")
    .trim()
    .toLowerCase();
  const paymentMethod: "cash" | "card" =
    paymentMethodRaw === "card" || paymentMethodRaw === "بطاقة" ? "card" : "cash";
  const branchIdRaw = Number(body?.branchId);
  const branchId =
    Number.isFinite(branchIdRaw) && branchIdRaw > 0 ? branchIdRaw : null;
  const cardIdRaw = Number(body?.cardId);
  let cardId =
    paymentMethod === "card" && Number.isFinite(cardIdRaw) && cardIdRaw > 0
      ? cardIdRaw
      : null;

  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    return { ok: false, status: 400, message: "اختر المورد" };
  }
  if (!branchId) {
    return { ok: false, status: 400, message: "اختر الفرع" };
  }
  if (paymentMethod === "card" && !cardId) {
    return { ok: false, status: 400, message: "اختر البطاقة" };
  }
  if (paymentMethod === "cash") cardId = null;
  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.id, supplierId))
    .limit(1);
  if (!supplier) return { ok: false, status: 400, message: "المورد غير موجود" };
  if (rawItems.length === 0) {
    return { ok: false, status: 400, message: "أضف صنفاً واحداً على الأقل" };
  }

  const menuIds = [
    ...new Set(
      rawItems
        .map((it: any) => Number(it.menuItemId))
        .filter((id: number) => Number.isFinite(id) && id > 0)
    ),
  ];
  const menuRows =
    menuIds.length === 0
      ? []
      : await db
          .select()
          .from(menuItemsTable)
          .where(inArray(menuItemsTable.id, menuIds));
  const menuMap = new Map(menuRows.map((m) => [m.id, m]));

  const items: ParsedPurchaseItem[] = [];
  let totalQty = 0;
  let totalAmount = 0;

  for (const it of rawItems) {
    const menuItemId = Number(it.menuItemId);
    const menu = menuMap.get(menuItemId);
    if (!menu) return { ok: false, status: 400, message: "صنف غير صالح في فاتورة الشراء" };
    const unitKind = String(it.unitKind ?? "minor").trim();
    if (!UNIT_KINDS.has(unitKind)) {
      return { ok: false, status: 400, message: "وحدة الصنف يجب أن تكون كبيرة أو صغيرة" };
    }
    const qty = num(it.qty);
    const price = num(it.price);
    if (!(qty > 0)) {
      return { ok: false, status: 400, message: "كمية الصنف يجب أن تكون أكبر من صفر" };
    }
    if (!(price >= 0)) return { ok: false, status: 400, message: "سعر الصنف غير صالح" };
    const amount = Number((qty * price).toFixed(2));
    const unitLabel =
      unitKind === "major"
        ? String(menu.majorUnit || "وحدة كبرى").trim()
        : String(menu.minorUnit || "عدد").trim();
    items.push({
      menuItemId,
      qty: qtyStr(qty),
      unitKind,
      unitLabel,
      price: money(price),
      amount: money(amount),
    });
    totalQty += qty;
    totalAmount += amount;
  }

  const discountAmount = Math.max(0, num(body?.discountAmount));
  const paidAmount = Math.max(0, num(body?.paidAmount));
  if (discountAmount + paidAmount > totalAmount + 0.001) {
    return {
      ok: false,
      status: 400,
      message: "مجموع الدفع والخصم لا يمكن أن يتجاوز مجموع الفاتورة",
    };
  }
  const remainingAmount = Number(
    Math.max(0, totalAmount - discountAmount - paidAmount).toFixed(2)
  );

  return {
    ok: true,
    invoiceDate,
    invoiceTime,
    supplierId,
    notes,
    items,
    totalQty,
    totalAmount,
    paidAmount,
    discountAmount,
    remainingAmount,
    branchId,
    paymentMethod,
    cardId,
  };
}

router.post("/purchases", async (req, res) => {
  const parsed = await parsePurchaseBody(req.body);
  if (!parsed.ok) return res.status(parsed.status).json({ message: parsed.message });

  /** 1) Weighted avg cost BEFORE insert (Q = remaining without this purchase) */
  await applyWeightedCostAdd(
    parsed.items.map((it) => ({
      menuItemId: it.menuItemId,
      qty: it.qty,
      unitKind: it.unitKind,
      price: it.price,
    }))
  );

  // Always assign next sequential invoice number (starts at 1)
  let invoiceNo = await nextPurchaseInvoiceNo();
  while (await isDuplicatePurchaseInvoiceNo(invoiceNo)) {
    invoiceNo = String(Number(invoiceNo) + 1);
  }

  const [purchase] = await db
    .insert(supplierPurchasesTable)
    .values({
      invoiceNo,
      invoiceDate: parsed.invoiceDate,
      invoiceTime: parsed.invoiceTime,
      supplierId: parsed.supplierId,
      notes: parsed.notes,
      totalQty: qtyStr(parsed.totalQty),
      totalAmount: money(parsed.totalAmount),
      paidAmount: money(parsed.paidAmount),
      discountAmount: money(parsed.discountAmount),
      remainingAmount: money(parsed.remainingAmount),
      branchId: parsed.branchId,
      paymentMethod: parsed.paymentMethod,
      cardId: parsed.cardId,
    })
    .returning();

  await db.insert(supplierPurchaseItemsTable).values(
    parsed.items.map((it) => ({
      purchaseId: purchase.id,
      ...it,
    }))
  );

  const [full] = await enrichPurchases([purchase]);
  res.status(201).json(full);
});

router.put("/purchases/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });

  const [existing] = await db
    .select()
    .from(supplierPurchasesTable)
    .where(eq(supplierPurchasesTable.id, id))
    .limit(1);
  if (!existing) return res.status(404).json({ message: "فاتورة الشراء غير موجودة" });

  const parsed = await parsePurchaseBody(req.body);
  if (!parsed.ok) return res.status(parsed.status).json({ message: parsed.message });

  const oldLines = await loadPurchaseCostLines(id);
  const newLines = parsed.items.map((it) => ({
    menuItemId: it.menuItemId,
    qty: it.qty,
    unitKind: it.unitKind,
    price: it.price,
  }));
  /** Reverse old purchase effect then apply new lines (formulas 4 then 1) */
  await applyWeightedCostPurchaseReplace(oldLines, newLines);

  const [purchase] = await db
    .update(supplierPurchasesTable)
    .set({
      invoiceDate: parsed.invoiceDate,
      invoiceTime: parsed.invoiceTime,
      supplierId: parsed.supplierId,
      notes: parsed.notes,
      totalQty: qtyStr(parsed.totalQty),
      totalAmount: money(parsed.totalAmount),
      paidAmount: money(parsed.paidAmount),
      discountAmount: money(parsed.discountAmount),
      remainingAmount: money(parsed.remainingAmount),
      branchId: parsed.branchId,
      paymentMethod: parsed.paymentMethod,
      cardId: parsed.cardId,
    })
    .where(eq(supplierPurchasesTable.id, id))
    .returning();

  await db
    .delete(supplierPurchaseItemsTable)
    .where(eq(supplierPurchaseItemsTable.purchaseId, id));
  await db.insert(supplierPurchaseItemsTable).values(
    parsed.items.map((it) => ({
      purchaseId: id,
      ...it,
    }))
  );

  const [full] = await enrichPurchases([purchase]);
  res.json(full);
});

router.delete("/purchases/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });

  const oldLines = await loadPurchaseCostLines(id);
  /** 4) Delete purchase line(s): (Q*C - q*p) / (Q - q) while stock still includes them */
  await applyWeightedCostRemove(oldLines);

  const [row] = await db
    .delete(supplierPurchasesTable)
    .where(eq(supplierPurchasesTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "فاتورة الشراء غير موجودة" });
  res.json({ ok: true });
});

// ─── Returns (مرجوعات) ────────────────────────────────────

async function loadReturnItems(returnIds: number[]) {
  const map = new Map<number, any[]>();
  if (returnIds.length === 0) return map;
  const rows = await db
    .select({
      id: supplierReturnItemsTable.id,
      returnId: supplierReturnItemsTable.returnId,
      menuItemId: supplierReturnItemsTable.menuItemId,
      qty: supplierReturnItemsTable.qty,
      unitKind: supplierReturnItemsTable.unitKind,
      unitLabel: supplierReturnItemsTable.unitLabel,
      price: supplierReturnItemsTable.price,
      amount: supplierReturnItemsTable.amount,
      itemNameAr: menuItemsTable.nameAr,
      itemName: menuItemsTable.name,
      majorUnit: menuItemsTable.majorUnit,
      minorUnit: menuItemsTable.minorUnit,
      subunitQty: menuItemsTable.subunitQty,
    })
    .from(supplierReturnItemsTable)
    .leftJoin(menuItemsTable, eq(menuItemsTable.id, supplierReturnItemsTable.menuItemId))
    .where(inArray(supplierReturnItemsTable.returnId, returnIds));

  for (const r of rows) {
    const list = map.get(r.returnId) ?? [];
    list.push({
      id: r.id,
      menuItemId: r.menuItemId,
      qty: num(r.qty),
      unitKind: r.unitKind,
      unitLabel: r.unitLabel,
      price: num(r.price),
      amount: num(r.amount),
      itemNameAr: r.itemNameAr,
      itemName: r.itemName,
      majorUnit: r.majorUnit,
      minorUnit: r.minorUnit,
      subunitQty: r.subunitQty,
    });
    map.set(r.returnId, list);
  }
  return map;
}

async function enrichReturns(rows: (typeof supplierReturnsTable.$inferSelect)[]) {
  const supplierIds = [...new Set(rows.map((r) => r.supplierId))];
  const suppliers =
    supplierIds.length === 0
      ? []
      : await db
          .select()
          .from(suppliersTable)
          .where(inArray(suppliersTable.id, supplierIds));
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const itemsMap = await loadReturnItems(rows.map((r) => r.id));
  const branchIds = [
    ...new Set(rows.map((r) => r.branchId).filter(Boolean)),
  ] as number[];
  const cardIds = [...new Set(rows.map((r) => r.cardId).filter(Boolean))] as number[];
  const branches =
    branchIds.length === 0
      ? []
      : await db.select().from(branchesTable).where(inArray(branchesTable.id, branchIds));
  const cards =
    cardIds.length === 0
      ? []
      : await db.select().from(cardsTable).where(inArray(cardsTable.id, cardIds));
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const cardMap = new Map(cards.map((c) => [c.id, c.name]));

  return rows.map((r) => {
    const s = supplierMap.get(r.supplierId);
    const paymentMethod = r.paymentMethod === "card" ? "card" : "cash";
    return {
      id: r.id,
      invoiceNo: r.invoiceNo,
      invoiceDate: r.invoiceDate,
      invoiceTime: r.invoiceTime,
      supplierId: r.supplierId,
      supplierCode: s?.code ?? "",
      supplierName: s?.name ?? "",
      notes: r.notes,
      totalQty: num(r.totalQty),
      totalAmount: num(r.totalAmount),
      paidAmount: num(r.paidAmount),
      discountAmount: num(r.discountAmount),
      remainingAmount: num(r.remainingAmount),
      branchId: r.branchId,
      branchName: r.branchId ? branchMap.get(r.branchId) || "" : "",
      paymentMethod,
      cardId: r.cardId,
      cardName: r.cardId ? cardMap.get(r.cardId) || "" : "",
      items: itemsMap.get(r.id) ?? [],
      createdAt: r.createdAt,
    };
  });
}

router.get("/returns", async (_req, res) => {
  const rows = await db
    .select()
    .from(supplierReturnsTable)
    .orderBy(desc(supplierReturnsTable.invoiceDate), desc(supplierReturnsTable.id));
  res.json(await enrichReturns(rows));
});

router.post("/returns", async (req, res) => {
  const parsed = await parsePurchaseBody(req.body);
  if (!parsed.ok) return res.status(parsed.status).json({ message: parsed.message });

  /** 3) Return qty: (Q*C - q*p) / (Q - q) before stock decreases */
  await applyWeightedCostRemove(
    parsed.items.map((it) => ({
      menuItemId: it.menuItemId,
      qty: it.qty,
      unitKind: it.unitKind,
      price: it.price,
    }))
  );

  let invoiceNo = await nextReturnInvoiceNo();
  while (await isDuplicateReturnInvoiceNo(invoiceNo)) {
    invoiceNo = String(Number(invoiceNo) + 1);
  }

  const [ret] = await db
    .insert(supplierReturnsTable)
    .values({
      invoiceNo,
      invoiceDate: parsed.invoiceDate,
      invoiceTime: parsed.invoiceTime,
      supplierId: parsed.supplierId,
      notes: parsed.notes,
      totalQty: qtyStr(parsed.totalQty),
      totalAmount: money(parsed.totalAmount),
      paidAmount: money(parsed.paidAmount),
      discountAmount: money(parsed.discountAmount),
      remainingAmount: money(parsed.remainingAmount),
      branchId: parsed.branchId,
      paymentMethod: parsed.paymentMethod,
      cardId: parsed.cardId,
    })
    .returning();

  await db.insert(supplierReturnItemsTable).values(
    parsed.items.map((it) => ({
      returnId: ret.id,
      ...it,
    }))
  );

  const [full] = await enrichReturns([ret]);
  res.status(201).json(full);
});

router.put("/returns/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });

  const [existing] = await db
    .select()
    .from(supplierReturnsTable)
    .where(eq(supplierReturnsTable.id, id))
    .limit(1);
  if (!existing) return res.status(404).json({ message: "فاتورة المرجوع غير موجودة" });

  const parsed = await parsePurchaseBody(req.body);
  if (!parsed.ok) return res.status(parsed.status).json({ message: parsed.message });

  const oldLines = await loadReturnCostLines(id);
  const newLines = parsed.items.map((it) => ({
    menuItemId: it.menuItemId,
    qty: it.qty,
    unitKind: it.unitKind,
    price: it.price,
  }));
  /** Undo old return then apply new return (formulas 2 then 3) */
  await applyWeightedCostReturnReplace(oldLines, newLines);

  const [ret] = await db
    .update(supplierReturnsTable)
    .set({
      invoiceDate: parsed.invoiceDate,
      invoiceTime: parsed.invoiceTime,
      supplierId: parsed.supplierId,
      notes: parsed.notes,
      totalQty: qtyStr(parsed.totalQty),
      totalAmount: money(parsed.totalAmount),
      paidAmount: money(parsed.paidAmount),
      discountAmount: money(parsed.discountAmount),
      remainingAmount: money(parsed.remainingAmount),
      branchId: parsed.branchId,
      paymentMethod: parsed.paymentMethod,
      cardId: parsed.cardId,
    })
    .where(eq(supplierReturnsTable.id, id))
    .returning();

  await db.delete(supplierReturnItemsTable).where(eq(supplierReturnItemsTable.returnId, id));
  await db.insert(supplierReturnItemsTable).values(
    parsed.items.map((it) => ({
      returnId: id,
      ...it,
    }))
  );

  const [full] = await enrichReturns([ret]);
  res.json(full);
});

router.delete("/returns/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });

  const oldLines = await loadReturnCostLines(id);
  /** 2) Delete return line(s): (Q*C + q*p) / (Q + q) while return still in stock calc */
  await applyWeightedCostAdd(oldLines);

  const [row] = await db
    .delete(supplierReturnsTable)
    .where(eq(supplierReturnsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "فاتورة المرجوع غير موجودة" });
  res.json({ ok: true });
});

// ─── Movements ────────────────────────────────────────────

async function enrichMovements(rows: (typeof supplierMovementsTable.$inferSelect)[]) {
  const supplierIds = [...new Set(rows.map((r) => r.supplierId))];
  const suppliers =
    supplierIds.length === 0
      ? []
      : await db
          .select()
          .from(suppliersTable)
          .where(inArray(suppliersTable.id, supplierIds));
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const branchIds = [
    ...new Set(rows.map((r) => r.branchId).filter(Boolean)),
  ] as number[];
  const cardIds = [...new Set(rows.map((r) => r.cardId).filter(Boolean))] as number[];
  const branches =
    branchIds.length === 0
      ? []
      : await db.select().from(branchesTable).where(inArray(branchesTable.id, branchIds));
  const cards =
    cardIds.length === 0
      ? []
      : await db.select().from(cardsTable).where(inArray(cardsTable.id, cardIds));
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const cardMap = new Map(cards.map((c) => [c.id, c.name]));
  return rows.map((r) => {
    const s = supplierMap.get(r.supplierId);
    const paymentMethod = r.paymentMethod === "card" ? "card" : "cash";
    return {
      id: r.id,
      invoiceNo: r.invoiceNo,
      movementDate: r.movementDate,
      movementTime: r.movementTime,
      supplierId: r.supplierId,
      supplierCode: s?.code ?? "",
      supplierName: s?.name ?? "",
      amountType: r.amountType,
      amount: num(r.amount),
      notes: r.notes,
      branchId: r.branchId,
      branchName: r.branchId ? branchMap.get(r.branchId) || "" : "",
      paymentMethod,
      cardId: r.cardId,
      cardName: r.cardId ? cardMap.get(r.cardId) || "" : "",
      createdAt: r.createdAt,
    };
  });
}

function parseMovementPayment(body: any, amountType: string) {
  const needsPayment = amountType === "paid" || amountType === "received";
  const branchIdRaw = Number(body?.branchId);
  const branchId =
    Number.isFinite(branchIdRaw) && branchIdRaw > 0 ? branchIdRaw : null;
  const paymentMethodRaw = String(body?.paymentMethod ?? body?.payMethod ?? "cash")
    .trim()
    .toLowerCase();
  let paymentMethod: "cash" | "card" =
    needsPayment &&
    (paymentMethodRaw === "card" || paymentMethodRaw === "بطاقة")
      ? "card"
      : "cash";
  const cardIdRaw = Number(body?.cardId);
  let cardId =
    paymentMethod === "card" && Number.isFinite(cardIdRaw) && cardIdRaw > 0
      ? cardIdRaw
      : null;

  if (!branchId) {
    return { ok: false as const, status: 400, message: "اختر الفرع" };
  }
  if (!needsPayment) {
    paymentMethod = "cash";
    cardId = null;
  } else if (paymentMethod === "card" && !cardId) {
    return { ok: false as const, status: 400, message: "اختر البطاقة" };
  }
  if (paymentMethod === "cash") cardId = null;

  return {
    ok: true as const,
    branchId,
    paymentMethod,
    cardId,
  };
}

router.get("/movements", async (_req, res) => {
  const rows = await db
    .select()
    .from(supplierMovementsTable)
    .orderBy(desc(supplierMovementsTable.movementDate), desc(supplierMovementsTable.id));
  res.json(await enrichMovements(rows));
});

router.post("/movements", async (req, res) => {
  const movementDate = normalizeDate(req.body?.movementDate) ?? todayDate();
  const movementTime = normalizeTime(req.body?.movementTime) ?? nowTime();
  const supplierId = Number(req.body?.supplierId);
  const amountType = String(req.body?.amountType ?? "paid").trim();
  const amount = num(req.body?.amount);
  const notes = String(req.body?.notes ?? "").trim() || null;

  // Always assign next sequential invoice number (starts at 1, no duplicates)
  let invoiceNo = await nextMovementInvoiceNo();
  while (await isDuplicateMovementInvoiceNo(invoiceNo)) {
    invoiceNo = String(Number(invoiceNo) + 1);
  }

  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    return res.status(400).json({ message: "اختر المورد" });
  }
  if (!AMOUNT_TYPES.has(amountType)) {
    return res.status(400).json({ message: "نوع المبلغ غير صالح" });
  }
  if (!(amount > 0)) return res.status(400).json({ message: "المبلغ يجب أن يكون أكبر من صفر" });

  const payment = parseMovementPayment(req.body, amountType);
  if (!payment.ok) return res.status(payment.status).json({ message: payment.message });

  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.id, supplierId))
    .limit(1);
  if (!supplier) return res.status(400).json({ message: "المورد غير موجود" });

  const [row] = await db
    .insert(supplierMovementsTable)
    .values({
      invoiceNo,
      movementDate,
      movementTime,
      supplierId,
      amountType,
      amount: money(amount),
      notes,
      branchId: payment.branchId,
      paymentMethod: payment.paymentMethod,
      cardId: payment.cardId,
    })
    .returning();

  const [full] = await enrichMovements([row]);
  res.status(201).json(full);
});

router.put("/movements/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });

  const [existing] = await db
    .select()
    .from(supplierMovementsTable)
    .where(eq(supplierMovementsTable.id, id))
    .limit(1);
  if (!existing) return res.status(404).json({ message: "الحركة غير موجودة" });

  const movementDate = normalizeDate(req.body?.movementDate) ?? existing.movementDate;
  const movementTime = normalizeTime(req.body?.movementTime) ?? existing.movementTime;
  const supplierId = Number(req.body?.supplierId);
  const amountType = String(req.body?.amountType ?? existing.amountType).trim();
  const amount = num(req.body?.amount);
  const notes = String(req.body?.notes ?? "").trim() || null;

  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    return res.status(400).json({ message: "اختر المورد" });
  }
  if (!AMOUNT_TYPES.has(amountType)) {
    return res.status(400).json({ message: "نوع المبلغ غير صالح" });
  }
  if (!(amount > 0)) return res.status(400).json({ message: "المبلغ يجب أن يكون أكبر من صفر" });

  const payment = parseMovementPayment(req.body, amountType);
  if (!payment.ok) return res.status(payment.status).json({ message: payment.message });

  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.id, supplierId))
    .limit(1);
  if (!supplier) return res.status(400).json({ message: "المورد غير موجود" });

  const [row] = await db
    .update(supplierMovementsTable)
    .set({
      // invoice number stays locked after create
      movementDate,
      movementTime,
      supplierId,
      amountType,
      amount: money(amount),
      notes,
      branchId: payment.branchId,
      paymentMethod: payment.paymentMethod,
      cardId: payment.cardId,
    })
    .where(eq(supplierMovementsTable.id, id))
    .returning();

  const [full] = await enrichMovements([row]);
  res.json(full);
});

router.delete("/movements/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });
  const [row] = await db
    .delete(supplierMovementsTable)
    .where(eq(supplierMovementsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "الحركة غير موجودة" });
  res.json({ ok: true });
});

// ─── Statement ────────────────────────────────────────────

router.get("/statement/:supplierId", async (req, res) => {
  const supplierId = Number(req.params.supplierId);
  if (!Number.isFinite(supplierId)) {
    return res.status(400).json({ message: "معرف المورد غير صالح" });
  }
  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.id, supplierId))
    .limit(1);
  if (!supplier) return res.status(404).json({ message: "المورد غير موجود" });

  const fromDate = normalizeDate(req.query?.from) ?? normalizeDate(req.query?.fromDate);
  const toDate = normalizeDate(req.query?.to) ?? normalizeDate(req.query?.toDate);
  if (fromDate && toDate && fromDate > toDate) {
    return res.status(400).json({ message: "تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية" });
  }

  const purchases = await db
    .select()
    .from(supplierPurchasesTable)
    .where(eq(supplierPurchasesTable.supplierId, supplierId))
    .orderBy(asc(supplierPurchasesTable.invoiceDate), asc(supplierPurchasesTable.id));

  const returns = await db
    .select()
    .from(supplierReturnsTable)
    .where(eq(supplierReturnsTable.supplierId, supplierId))
    .orderBy(asc(supplierReturnsTable.invoiceDate), asc(supplierReturnsTable.id));

  const movements = await db
    .select()
    .from(supplierMovementsTable)
    .where(eq(supplierMovementsTable.supplierId, supplierId))
    .orderBy(asc(supplierMovementsTable.movementDate), asc(supplierMovementsTable.id));

  type Line = {
    id: string;
    kind: "opening" | "purchase" | "return" | "movement";
    /** Visible invoice type: شراء | مرجوع | مدفوع | واصل | خصم | رصيد */
    docType: string;
    date: string;
    /** Kept for chronological sort; not shown in UI */
    time: string;
    invoiceNo: string;
    /** Notes / بيان */
    description: string;
    debit: number;
    credit: number;
    balance: number;
  };

  type Event = {
    sort: string;
    date: string;
    time: string;
    applySilent: () => void;
    applyVisible: () => void;
  };

  const noteText = (v: unknown) => {
    const s = String(v ?? "").trim();
    return s || "—";
  };

  const lines: Line[] = [];
  let running = num(supplier.openingBalance);
  let totalDebit = 0;
  let totalCredit = 0;

  const pushVisible = (line: Omit<Line, "balance">) => {
    const next: Line = {
      ...line,
      balance: Number(running.toFixed(2)),
    };
    lines.push(next);
    totalDebit += line.debit;
    totalCredit += line.credit;
  };

  const events: Event[] = [];

  for (const p of purchases) {
    const notes = noteText(p.notes);
    const time = p.invoiceTime || "00:00:00";
    events.push({
      sort: `${p.invoiceDate}T${time}|P${p.id}|0`,
      date: p.invoiceDate,
      time,
      applySilent: () => {
        running += num(p.totalAmount);
        running -= num(p.discountAmount);
        running -= num(p.paidAmount);
      },
      applyVisible: () => {
        const amount = num(p.totalAmount);
        const discount = num(p.discountAmount);
        const paid = num(p.paidAmount);
        running += amount;
        pushVisible({
          id: `purchase-${p.id}`,
          kind: "purchase",
          docType: "شراء",
          date: p.invoiceDate,
          time,
          invoiceNo: p.invoiceNo,
          description: notes,
          debit: amount,
          credit: 0,
        });
        if (discount > 0) {
          running -= discount;
          pushVisible({
            id: `purchase-discount-${p.id}`,
            kind: "purchase",
            docType: "شراء",
            date: p.invoiceDate,
            time,
            invoiceNo: p.invoiceNo,
            description: notes,
            debit: 0,
            credit: discount,
          });
        }
        if (paid > 0) {
          running -= paid;
          pushVisible({
            id: `purchase-paid-${p.id}`,
            kind: "purchase",
            docType: "شراء",
            date: p.invoiceDate,
            time,
            invoiceNo: p.invoiceNo,
            description: notes,
            debit: 0,
            credit: paid,
          });
        }
      },
    });
  }

  for (const r of returns) {
    const notes = noteText(r.notes);
    const time = r.invoiceTime || "00:00:00";
    events.push({
      sort: `${r.invoiceDate}T${time}|R${r.id}|0`,
      date: r.invoiceDate,
      time,
      applySilent: () => {
        running -= num(r.totalAmount);
        running += num(r.discountAmount);
        running += num(r.paidAmount);
      },
      applyVisible: () => {
        const amount = num(r.totalAmount);
        const discount = num(r.discountAmount);
        const paid = num(r.paidAmount);
        running -= amount;
        pushVisible({
          id: `return-${r.id}`,
          kind: "return",
          docType: "مرجوع",
          date: r.invoiceDate,
          time,
          invoiceNo: r.invoiceNo,
          description: notes,
          debit: 0,
          credit: amount,
        });
        if (discount > 0) {
          running += discount;
          pushVisible({
            id: `return-discount-${r.id}`,
            kind: "return",
            docType: "مرجوع",
            date: r.invoiceDate,
            time,
            invoiceNo: r.invoiceNo,
            description: notes,
            debit: discount,
            credit: 0,
          });
        }
        if (paid > 0) {
          running += paid;
          pushVisible({
            id: `return-paid-${r.id}`,
            kind: "return",
            docType: "مرجوع",
            date: r.invoiceDate,
            time,
            invoiceNo: r.invoiceNo,
            description: notes,
            debit: paid,
            credit: 0,
          });
        }
      },
    });
  }

  for (const m of movements) {
    const docType =
      m.amountType === "paid"
        ? "مدفوع"
        : m.amountType === "received"
          ? "واصل"
          : "خصم";
    const notes = noteText(m.notes);
    const time = m.movementTime || "00:00:00";
    events.push({
      sort: `${m.movementDate}T${time}|M${m.id}|0`,
      date: m.movementDate,
      time,
      applySilent: () => {
        running -= num(m.amount);
      },
      applyVisible: () => {
        const amount = num(m.amount);
        running -= amount;
        pushVisible({
          id: `movement-${m.id}`,
          kind: "movement",
          docType,
          date: m.movementDate,
          time,
          invoiceNo: m.invoiceNo,
          description: notes,
          debit: 0,
          credit: amount,
        });
      },
    });
  }

  events.sort((a, b) => a.sort.localeCompare(b.sort));

  // Bring forward: apply everything before fromDate silently
  for (const e of events) {
    if (fromDate && e.date < fromDate) e.applySilent();
  }

  const openingBalance = Number(running.toFixed(2));
  lines.push({
    id: "opening",
    kind: "opening",
    docType: "رصيد",
    date: fromDate || "",
    time: "",
    invoiceNo: "—",
    description: fromDate ? "رصيد مرحّل" : "رصيد افتتاحي",
    debit: openingBalance > 0 ? openingBalance : 0,
    credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
    balance: openingBalance,
  });
  // Opening line should not inflate period totals
  totalDebit = 0;
  totalCredit = 0;

  for (const e of events) {
    if (fromDate && e.date < fromDate) continue;
    if (toDate && e.date > toDate) continue;
    e.applyVisible();
  }

  const closing = Number(running.toFixed(2));
  res.json({
    supplier: {
      ...mapSupplier(supplier),
      balance: closing,
    },
    fromDate: fromDate || null,
    toDate: toDate || null,
    openingBalance,
    balance: closing,
    balanceLabel: closing > 0 ? "باقي عندنا" : closing < 0 ? "باقي عنده" : "متوازن",
    totalDebit: Number(totalDebit.toFixed(2)),
    totalCredit: Number(totalCredit.toFixed(2)),
    lines,
  });
});

// ─── Debts report ─────────────────────────────────────────

router.get("/debts", async (_req, res) => {
  const rows = await db
    .select()
    .from(suppliersTable)
    .orderBy(asc(suppliersTable.code));
  const balances = await computeBalances(rows.map((r) => r.id));
  const debts = rows.map((r) => {
    const balance = Number((balances.get(r.id) ?? 0).toFixed(2));
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      balance,
      label:
        balance > 0 ? "باقي عندنا" : balance < 0 ? "باقي عنده" : "متوازن",
    };
  });
  res.json({
    items: debts,
    totalOwedByUs: Number(
      debts.filter((d) => d.balance > 0).reduce((s, d) => s + d.balance, 0).toFixed(2)
    ),
    totalOwedToUs: Number(
      debts
        .filter((d) => d.balance < 0)
        .reduce((s, d) => s + Math.abs(d.balance), 0)
        .toFixed(2)
    ),
  });
});

export default router;
