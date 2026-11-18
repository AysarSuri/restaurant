import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  suppliersTable,
  supplierPurchasesTable,
  supplierPurchaseItemsTable,
  supplierMovementsTable,
  menuItemsTable,
} from "@workspace/db/schema";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

const router: IRouter = Router();

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
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
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

  const [purchase] = await db
    .select({ id: supplierPurchasesTable.id })
    .from(supplierPurchasesTable)
    .where(eq(supplierPurchasesTable.supplierId, id))
    .limit(1);
  if (purchase) {
    return res.status(400).json({ message: "لا يمكن حذف مورد له فواتير شراء" });
  }
  const [movement] = await db
    .select({ id: supplierMovementsTable.id })
    .from(supplierMovementsTable)
    .where(eq(supplierMovementsTable.supplierId, id))
    .limit(1);
  if (movement) {
    return res.status(400).json({ message: "لا يمكن حذف مورد له حركات" });
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

  return rows.map((r) => {
    const s = supplierMap.get(r.supplierId);
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

router.post("/purchases", async (req, res) => {
  const invoiceNo = String(req.body?.invoiceNo ?? "").trim();
  const invoiceDate = normalizeDate(req.body?.invoiceDate) ?? todayDate();
  const invoiceTime = normalizeTime(req.body?.invoiceTime) ?? nowTime();
  const supplierId = Number(req.body?.supplierId);
  const notes = String(req.body?.notes ?? "").trim() || null;
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!invoiceNo) return res.status(400).json({ message: "رقم الفاتورة مطلوب" });
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    return res.status(400).json({ message: "اختر المورد" });
  }
  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.id, supplierId))
    .limit(1);
  if (!supplier) return res.status(400).json({ message: "المورد غير موجود" });
  if (rawItems.length === 0) {
    return res.status(400).json({ message: "أضف صنفاً واحداً على الأقل" });
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

  const items: {
    menuItemId: number;
    qty: string;
    unitKind: string;
    unitLabel: string;
    price: string;
    amount: string;
  }[] = [];

  let totalQty = 0;
  let totalAmount = 0;

  for (const it of rawItems) {
    const menuItemId = Number(it.menuItemId);
    const menu = menuMap.get(menuItemId);
    if (!menu) return res.status(400).json({ message: "صنف غير صالح في فاتورة الشراء" });
    const unitKind = String(it.unitKind ?? "minor").trim();
    if (!UNIT_KINDS.has(unitKind)) {
      return res.status(400).json({ message: "وحدة الصنف يجب أن تكون كبيرة أو صغيرة" });
    }
    const qty = num(it.qty);
    const price = num(it.price);
    if (!(qty > 0)) return res.status(400).json({ message: "كمية الصنف يجب أن تكون أكبر من صفر" });
    if (!(price >= 0)) return res.status(400).json({ message: "سعر الصنف غير صالح" });
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

  const discountAmount = Math.max(0, num(req.body?.discountAmount));
  const paidAmount = Math.max(0, num(req.body?.paidAmount));
  if (discountAmount + paidAmount > totalAmount + 0.001) {
    return res
      .status(400)
      .json({ message: "مجموع الدفع والخصم لا يمكن أن يتجاوز مجموع الفاتورة" });
  }
  const remainingAmount = Number(
    Math.max(0, totalAmount - discountAmount - paidAmount).toFixed(2)
  );

  const [purchase] = await db
    .insert(supplierPurchasesTable)
    .values({
      invoiceNo,
      invoiceDate,
      invoiceTime,
      supplierId,
      notes,
      totalQty: qtyStr(totalQty),
      totalAmount: money(totalAmount),
      paidAmount: money(paidAmount),
      discountAmount: money(discountAmount),
      remainingAmount: money(remainingAmount),
    })
    .returning();

  await db.insert(supplierPurchaseItemsTable).values(
    items.map((it) => ({
      purchaseId: purchase.id,
      ...it,
    }))
  );

  const [full] = await enrichPurchases([purchase]);
  res.status(201).json(full);
});

router.delete("/purchases/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });
  const [row] = await db
    .delete(supplierPurchasesTable)
    .where(eq(supplierPurchasesTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "فاتورة الشراء غير موجودة" });
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
  return rows.map((r) => {
    const s = supplierMap.get(r.supplierId);
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
      createdAt: r.createdAt,
    };
  });
}

router.get("/movements", async (_req, res) => {
  const rows = await db
    .select()
    .from(supplierMovementsTable)
    .orderBy(desc(supplierMovementsTable.movementDate), desc(supplierMovementsTable.id));
  res.json(await enrichMovements(rows));
});

router.post("/movements", async (req, res) => {
  const invoiceNo = String(req.body?.invoiceNo ?? "").trim();
  const movementDate = normalizeDate(req.body?.movementDate) ?? todayDate();
  const movementTime = normalizeTime(req.body?.movementTime) ?? nowTime();
  const supplierId = Number(req.body?.supplierId);
  const amountType = String(req.body?.amountType ?? "paid").trim();
  const amount = num(req.body?.amount);
  const notes = String(req.body?.notes ?? "").trim() || null;

  if (!invoiceNo) return res.status(400).json({ message: "رقم الفاتورة مطلوب" });
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    return res.status(400).json({ message: "اختر المورد" });
  }
  if (!AMOUNT_TYPES.has(amountType)) {
    return res.status(400).json({ message: "نوع المبلغ غير صالح" });
  }
  if (!(amount > 0)) return res.status(400).json({ message: "المبلغ يجب أن يكون أكبر من صفر" });

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
    })
    .returning();

  const [full] = await enrichMovements([row]);
  res.status(201).json(full);
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

  const purchases = await db
    .select()
    .from(supplierPurchasesTable)
    .where(eq(supplierPurchasesTable.supplierId, supplierId))
    .orderBy(asc(supplierPurchasesTable.invoiceDate), asc(supplierPurchasesTable.id));

  const movements = await db
    .select()
    .from(supplierMovementsTable)
    .where(eq(supplierMovementsTable.supplierId, supplierId))
    .orderBy(asc(supplierMovementsTable.movementDate), asc(supplierMovementsTable.id));

  type Line = {
    id: string;
    kind: "opening" | "purchase" | "movement";
    date: string;
    time: string;
    invoiceNo: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  };

  const lines: Line[] = [];
  let running = num(supplier.openingBalance);
  lines.push({
    id: "opening",
    kind: "opening",
    date: "",
    time: "",
    invoiceNo: "—",
    description: "رصيد افتتاحي",
    debit: running > 0 ? running : 0,
    credit: running < 0 ? Math.abs(running) : 0,
    balance: Number(running.toFixed(2)),
  });

  type Event = {
    sort: string;
    date: string;
    time: string;
    apply: () => void;
  };
  const events: Event[] = [];

  for (const p of purchases) {
    events.push({
      sort: `${p.invoiceDate}T${p.invoiceTime}|P${p.id}`,
      date: p.invoiceDate,
      time: p.invoiceTime,
      apply: () => {
        const amount = num(p.totalAmount);
        const discount = num(p.discountAmount);
        const paid = num(p.paidAmount);
        running += amount;
        lines.push({
          id: `purchase-${p.id}`,
          kind: "purchase",
          date: p.invoiceDate,
          time: p.invoiceTime,
          invoiceNo: p.invoiceNo,
          description: "فاتورة شراء",
          debit: amount,
          credit: 0,
          balance: Number(running.toFixed(2)),
        });
        if (discount > 0) {
          running -= discount;
          lines.push({
            id: `purchase-discount-${p.id}`,
            kind: "purchase",
            date: p.invoiceDate,
            time: p.invoiceTime,
            invoiceNo: p.invoiceNo,
            description: "خصم فاتورة شراء",
            debit: 0,
            credit: discount,
            balance: Number(running.toFixed(2)),
          });
        }
        if (paid > 0) {
          running -= paid;
          lines.push({
            id: `purchase-paid-${p.id}`,
            kind: "purchase",
            date: p.invoiceDate,
            time: p.invoiceTime,
            invoiceNo: p.invoiceNo,
            description: "دفع على فاتورة شراء",
            debit: 0,
            credit: paid,
            balance: Number(running.toFixed(2)),
          });
        }
      },
    });
  }

  for (const m of movements) {
    const typeLabel =
      m.amountType === "paid"
        ? "مدفوع"
        : m.amountType === "received"
          ? "واصل"
          : "خصم";
    events.push({
      sort: `${m.movementDate}T${m.movementTime}|M${m.id}`,
      date: m.movementDate,
      time: m.movementTime,
      apply: () => {
        const amount = num(m.amount);
        running -= amount;
        lines.push({
          id: `movement-${m.id}`,
          kind: "movement",
          date: m.movementDate,
          time: m.movementTime,
          invoiceNo: m.invoiceNo,
          description: `حركة مورد — ${typeLabel}`,
          debit: 0,
          credit: amount,
          balance: Number(running.toFixed(2)),
        });
      },
    });
  }

  events.sort((a, b) => a.sort.localeCompare(b.sort));
  for (const e of events) e.apply();

  res.json({
    supplier: mapSupplier(supplier),
    balance: Number(running.toFixed(2)),
    balanceLabel: running > 0 ? "باقي عندنا" : running < 0 ? "باقي عنده" : "متوازن",
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
