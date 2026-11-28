import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  shiftsTable,
  branchesTable,
  ordersTable,
  orderItemsTable,
  menuItemsTable,
  menuCategoriesTable,
  expensesTable,
  cashMovementsTable,
  supplierPurchasesTable,
  supplierReturnsTable,
  supplierMovementsTable,
  appSettingsTable,
} from "@workspace/db/schema";
import {
  and,
  desc,
  eq,
  gte,
  isNull,
  lt,
  ne,
  or,
  isNotNull,
  sql,
} from "drizzle-orm";
import { parseBranchScope, resolveWriteBranchId } from "../lib/branch-scope";
import { ensureSalesDeviceColumns } from "../lib/ensure-sales-columns";

const router: IRouter = Router();

export type ShiftKind = "morning" | "evening";

const KIND_META: Record<
  ShiftKind,
  { name: string; color: string; startDefault: string; endDefault: string }
> = {
  morning: {
    name: "صباحية",
    color: "#0ea5e9",
    startDefault: "08:00",
    endDefault: "16:00",
  },
  evening: {
    name: "مسائية",
    color: "#64748b",
    startDefault: "16:00",
    endDefault: "00:00",
  },
};

function normalizeKind(value: unknown): ShiftKind | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "morning" || raw === "صباحية" || raw === "صباحي") return "morning";
  if (raw === "evening" || raw === "مسائية" || raw === "مسائي") return "evening";
  return null;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatHm(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseOpenDate(value: unknown): Date | null {
  if (value == null || value === "") return new Date();
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    const now = new Date();
    return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeShift(
  shift: typeof shiftsTable.$inferSelect,
  branchName?: string | null
) {
  const kind = (normalizeKind(shift.kind) ??
    (String(shift.color).toLowerCase().includes("64748b") ? "evening" : "morning")) as ShiftKind;
  const meta = KIND_META[kind];
  const openedAt = shift.openedAt ? new Date(shift.openedAt) : new Date(shift.createdAt);
  const closedAt = shift.closedAt ? new Date(shift.closedAt) : null;
  // Open = not closed yet (per branch). Device does not matter.
  const isOpen = closedAt == null;
  return {
    id: shift.id,
    kind,
    name: meta.name,
    branchId: shift.branchId,
    branchName: branchName ?? null,
    color: meta.color,
    openedAt: openedAt.toISOString(),
    closedAt: closedAt ? closedAt.toISOString() : null,
    openDate: `${openedAt.getFullYear()}-${pad2(openedAt.getMonth() + 1)}-${pad2(openedAt.getDate())}`,
    startTime: formatHm(openedAt),
    endTime: closedAt ? formatHm(closedAt) : null,
    notes: shift.notes ?? null,
    isActive: isOpen,
    isOpen,
    createdAt: shift.createdAt,
    updatedAt: shift.updatedAt,
  };
}

router.get("/", async (req, res) => {
  await ensureSalesDeviceColumns();
  const scope = parseBranchScope(req);
  const conditions = [];
  if (scope.mode === "one") {
    conditions.push(eq(shiftsTable.branchId, scope.branchId));
  }

  const shifts = await db
    .select({
      shift: shiftsTable,
      branchName: branchesTable.name,
    })
    .from(shiftsTable)
    .leftJoin(branchesTable, eq(shiftsTable.branchId, branchesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(shiftsTable.openedAt), desc(shiftsTable.createdAt));

  res.json(shifts.map((r) => serializeShift(r.shift, r.branchName)));
});

function money(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

/** Closed-shift financial report for thermal / detail view */
router.get("/:id/report", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }

  const [row] = await db
    .select({
      shift: shiftsTable,
      branchName: branchesTable.name,
      branchLogoUrl: branchesTable.logoUrl,
      branchAddress: branchesTable.address,
    })
    .from(shiftsTable)
    .leftJoin(branchesTable, eq(shiftsTable.branchId, branchesTable.id))
    .where(eq(shiftsTable.id, id))
    .limit(1);

  if (!row) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }

  const shift = serializeShift(row.shift, row.branchName);
  const openedAt = new Date(shift.openedAt);
  const closedAt = shift.closedAt ? new Date(shift.closedAt) : new Date();
  const branchId = shift.branchId;

  const [settings] = await db.select().from(appSettingsTable).limit(1);
  const restaurantName = settings?.restaurantName?.trim() || "المطعم";
  const logoUrl = (row.branchLogoUrl || settings?.logoUrl || "").trim() || null;
  const mobile = settings?.mobile?.trim() || null;

  const orderReceived = and(
    ne(ordersTable.status, "cancelled"),
    or(isNotNull(ordersTable.paymentMethod), eq(ordersTable.status, "paid"))
  );
  /**
   * واصل sales belong to the shift that COLLECTED payment (paid_shift_id),
   * not the creation shift — so late cashier collection after close lands on
   * the new open shift. Legacy rows without paid_shift_id fall back to createdAt.
   */
  const orderWindow = and(
    eq(ordersTable.branchId, branchId),
    orderReceived,
    or(
      eq(ordersTable.paidShiftId, id),
      and(
        isNull(ordersTable.paidShiftId),
        gte(ordersTable.createdAt, openedAt),
        lt(ordersTable.createdAt, closedAt)
      )
    )
  );

  // Sales by category
  const categoryRows = await db
    .select({
      categoryId: menuCategoriesTable.id,
      categoryName: menuCategoriesTable.nameAr,
      amount: sql<number>`coalesce(sum(${orderItemsTable.totalPrice}::numeric), 0)`,
      qty: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .innerJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
    .innerJoin(
      menuCategoriesTable,
      eq(menuItemsTable.categoryId, menuCategoriesTable.id)
    )
    .where(orderWindow)
    .groupBy(menuCategoriesTable.id, menuCategoriesTable.nameAr)
    .orderBy(sql`sum(${orderItemsTable.totalPrice}::numeric) desc`);

  const salesByCategory = categoryRows.map((r) => ({
    categoryId: r.categoryId,
    name: r.categoryName || "—",
    amount: money(r.amount),
    qty: Number(r.qty) || 0,
  }));
  const salesTotal = money(salesByCategory.reduce((s, r) => s + r.amount, 0));

  const [discountAgg] = await db
    .select({
      total: sql<number>`coalesce(sum(${ordersTable.discount}::numeric), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(ordersTable)
    .where(
      and(orderWindow, sql`coalesce(${ordersTable.discount}::numeric, 0) > 0`)
    );

  const [receivedAgg] = await db
    .select({
      total: sql<number>`coalesce(sum(${ordersTable.total}::numeric), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(ordersTable)
    .where(orderWindow);

  const salesDiscountTotal = money(discountAgg?.total);
  const salesReceivedTotal = money(receivedAgg?.total);
  const salesInvoiceCount = Number(receivedAgg?.count) || 0;

  /**
   * غير واصل on the open (new) shift: all still-unpaid branch invoices
   * (carryover from previous shifts + created this shift). Closed shifts do
   * not keep unpaid in their accounts — they move to the new open shift.
   */
  const isOpenShift = !shift.closedAt;
  let unpaidTotal = 0;
  let unpaidCount = 0;
  if (isOpenShift) {
    const [unpaidAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(${ordersTable.total}::numeric), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.branchId, branchId),
          ne(ordersTable.status, "cancelled"),
          isNull(ordersTable.paymentMethod),
          ne(ordersTable.status, "paid")
        )
      );
    unpaidTotal = money(unpaidAgg?.total);
    unpaidCount = Number(unpaidAgg?.count) || 0;
  }

  // Expenses
  const expenseRows = await db
    .select()
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.branchId, branchId),
        gte(expensesTable.createdAt, openedAt),
        lt(expensesTable.createdAt, closedAt)
      )
    )
    .orderBy(desc(expensesTable.createdAt));

  const expenses = expenseRows.map((e) => ({
    id: e.id,
    invoiceNo: e.invoiceNo,
    label: e.category || e.descriptionAr || e.description || "مصروف",
    amount: money(e.amount),
    date: e.expenseDate || null,
  }));
  const expensesTotal = money(expenses.reduce((s, e) => s + e.amount, 0));

  // Cash movements
  const cashRows = await db
    .select()
    .from(cashMovementsTable)
    .where(
      and(
        eq(cashMovementsTable.branchId, branchId),
        gte(cashMovementsTable.createdAt, openedAt),
        lt(cashMovementsTable.createdAt, closedAt)
      )
    )
    .orderBy(desc(cashMovementsTable.createdAt));

  const withdrawals = cashRows
    .filter((m) => m.kind === "withdrawal")
    .map((m) => ({
      id: m.id,
      invoiceNo: m.invoiceNo,
      amount: money(m.amount),
      notes: m.notes,
      date: m.movementDate,
      time: m.movementTime,
    }));
  const cashReturns = cashRows
    .filter((m) => m.kind === "return")
    .map((m) => ({
      id: m.id,
      invoiceNo: m.invoiceNo,
      amount: money(m.amount),
      notes: m.notes,
      date: m.movementDate,
      time: m.movementTime,
    }));
  const withdrawalsTotal = money(withdrawals.reduce((s, m) => s + m.amount, 0));
  const cashReturnsTotal = money(cashReturns.reduce((s, m) => s + m.amount, 0));
  const showCashMovements =
    Math.abs(withdrawalsTotal) > 0.009 || Math.abs(cashReturnsTotal) > 0.009;

  // Supplier purchases / returns
  const purchaseRows = await db
    .select()
    .from(supplierPurchasesTable)
    .where(
      and(
        eq(supplierPurchasesTable.branchId, branchId),
        gte(supplierPurchasesTable.createdAt, openedAt),
        lt(supplierPurchasesTable.createdAt, closedAt)
      )
    )
    .orderBy(desc(supplierPurchasesTable.createdAt));

  const returnRows = await db
    .select()
    .from(supplierReturnsTable)
    .where(
      and(
        eq(supplierReturnsTable.branchId, branchId),
        gte(supplierReturnsTable.createdAt, openedAt),
        lt(supplierReturnsTable.createdAt, closedAt)
      )
    )
    .orderBy(desc(supplierReturnsTable.createdAt));

  const purchases = purchaseRows.map((p) => ({
    id: p.id,
    invoiceNo: p.invoiceNo,
    totalAmount: money(p.totalAmount),
    paidAmount: money(p.paidAmount),
    discountAmount: money(p.discountAmount),
    date: p.invoiceDate,
  }));
  const supplierReturns = returnRows.map((r) => ({
    id: r.id,
    invoiceNo: r.invoiceNo,
    totalAmount: money(r.totalAmount),
    receivedAmount: money(r.paidAmount),
    discountAmount: money(r.discountAmount),
    date: r.invoiceDate,
  }));

  const purchasesTotal = money(purchases.reduce((s, p) => s + p.totalAmount, 0));
  const purchasesPaidTotal = money(purchases.reduce((s, p) => s + p.paidAmount, 0));
  const purchasesDiscountTotal = money(
    purchases.reduce((s, p) => s + p.discountAmount, 0)
  );
  const returnsTotal = money(
    supplierReturns.reduce((s, r) => s + r.totalAmount, 0)
  );
  const returnsReceivedTotal = money(
    supplierReturns.reduce((s, r) => s + r.receivedAmount, 0)
  );
  const returnsDiscountTotal = money(
    supplierReturns.reduce((s, r) => s + r.discountAmount, 0)
  );

  // Supplier movements paid / received
  const movRows = await db
    .select()
    .from(supplierMovementsTable)
    .where(
      and(
        eq(supplierMovementsTable.branchId, branchId),
        gte(supplierMovementsTable.createdAt, openedAt),
        lt(supplierMovementsTable.createdAt, closedAt)
      )
    );

  const supplierPaidExtra = money(
    movRows
      .filter((m) => m.amountType === "paid")
      .reduce((s, m) => s + Number(m.amount || 0), 0)
  );
  const supplierReceivedExtra = money(
    movRows
      .filter((m) => m.amountType === "received")
      .reduce((s, m) => s + Number(m.amount || 0), 0)
  );
  const supplierDiscountExtra = money(
    movRows
      .filter((m) => m.amountType === "discount")
      .reduce((s, m) => s + Number(m.amount || 0), 0)
  );

  const supplierPaidTotal = money(purchasesPaidTotal + supplierPaidExtra);
  const supplierReceivedTotal = money(
    returnsReceivedTotal + supplierReceivedExtra
  );
  const supplierDiscountTotal = money(
    purchasesDiscountTotal + returnsDiscountTotal + supplierDiscountExtra
  );

  const showSuppliers =
    Math.abs(purchasesTotal) > 0.009 || Math.abs(returnsTotal) > 0.009;

  res.json({
    shift,
    restaurantName,
    logoUrl,
    mobile,
    branchName: row.branchName || shift.branchName || "—",
    branchAddress: row.branchAddress || null,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    sales: {
      byCategory: salesByCategory,
      total: salesTotal,
      discountTotal: salesDiscountTotal,
      receivedTotal: salesReceivedTotal,
      invoiceCount: salesInvoiceCount,
      unpaidTotal,
      unpaidCount,
    },
    expenses: {
      total: expensesTotal,
      items: expenses,
    },
    cashMovements: {
      show: showCashMovements,
      withdrawalsTotal,
      returnsTotal: cashReturnsTotal,
      withdrawals,
      returns: cashReturns,
    },
    suppliers: {
      show: showSuppliers,
      purchasesTotal,
      returnsTotal,
      paidTotal: supplierPaidTotal,
      receivedTotal: supplierReceivedTotal,
      discountTotal: supplierDiscountTotal,
      purchases,
      returns: supplierReturns,
    },
  });
});

router.get("/:id", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }
  const [row] = await db
    .select({
      shift: shiftsTable,
      branchName: branchesTable.name,
    })
    .from(shiftsTable)
    .leftJoin(branchesTable, eq(shiftsTable.branchId, branchesTable.id))
    .where(eq(shiftsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }
  res.json(serializeShift(row.shift, row.branchName));
});

/** Open a new morning/evening shift for a branch. */
router.post("/", async (req, res) => {
  await ensureSalesDeviceColumns();
  const scope = parseBranchScope(req);
  const { kind, branchId, notes, openedAt: openedAtRaw, deviceKey } = req.body ?? {};

  const normalizedKind = normalizeKind(kind);
  if (!normalizedKind) {
    res.status(400).json({ success: false, message: "اختر وردية صباحية أو مسائية" });
    return;
  }
  const resolvedBranchId = resolveWriteBranchId(
    scope,
    branchId != null ? Number(branchId) : null
  );
  if (!resolvedBranchId) {
    res.status(400).json({ success: false, message: "اختر فرعاً للوردية" });
    return;
  }

  const openedAt = parseOpenDate(openedAtRaw);
  if (!openedAt) {
    res.status(400).json({ success: false, message: "تاريخ افتتاح الوردية غير صالح" });
    return;
  }

  const meta = KIND_META[normalizedKind];

  // Only one OPEN shift per BRANCH (shared across devices).
  // After closing, a new shift may be opened the same day (morning/evening).
  const [openOnBranch] = await db
    .select({
      id: shiftsTable.id,
      kind: shiftsTable.kind,
      name: shiftsTable.name,
      openedAt: shiftsTable.openedAt,
    })
    .from(shiftsTable)
    .where(
      and(eq(shiftsTable.branchId, resolvedBranchId), isNull(shiftsTable.closedAt))
    )
    .limit(1);
  if (openOnBranch) {
    const openMeta =
      KIND_META[normalizeKind(openOnBranch.kind) ?? "morning"] ?? meta;
    res.status(400).json({
      success: false,
      message: `لا يمكن فتح وردية جديدة — يوجد وردية ${openMeta.name} مفتوحة لهذا الفرع. أغلقها أولاً ثم افتح وردية أخرى.`,
      openShiftId: openOnBranch.id,
    });
    return;
  }

  const [created] = await db
    .insert(shiftsTable)
    .values({
      name: meta.name,
      kind: normalizedKind,
      branchId: resolvedBranchId,
      startTime: formatHm(openedAt),
      endTime: meta.endDefault,
      breakMinutes: 0,
      graceMinutes: 0,
      daysOfWeek: "[0,1,2,3,4,5,6]",
      color: meta.color,
      openedAt,
      closedAt: null,
      notes: notes != null ? String(notes).trim() || null : null,
      isActive: true,
    })
    .returning();

  // Kick every other logged-in device; keep only the device that opened this shift
  try {
    const { bumpSessionForceLogout } = await import("../lib/session-force-logout");
    const keepKey =
      String(deviceKey ?? "").trim() ||
      String((req.headers["x-device-key"] as string | undefined) ?? "").trim();
    await bumpSessionForceLogout({
      keepDeviceKey: keepKey,
      openedShiftId: created.id,
    });
  } catch {
    /* shift still opens even if gate bump fails */
  }

  const [branch] = await db
    .select({ name: branchesTable.name })
    .from(branchesTable)
    .where(eq(branchesTable.id, resolvedBranchId))
    .limit(1);

  res.status(201).json(serializeShift(created, branch?.name ?? null));
});

/** Update notes / or close shift when closedAt / close=true */
router.put("/:id", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }
  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }

  const { notes, close, closedAt: closedAtRaw } = req.body ?? {};
  const patch: Partial<typeof shiftsTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (notes !== undefined) {
    patch.notes = String(notes ?? "").trim() || null;
  }

  const wantsClose = close === true || closedAtRaw != null;
  if (wantsClose) {
    if (existing.closedAt) {
      res.status(400).json({ success: false, message: "الوردية مغلقة مسبقاً" });
      return;
    }
    let closedAt = new Date();
    if (closedAtRaw != null && closedAtRaw !== "") {
      const parsed = new Date(String(closedAtRaw));
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ success: false, message: "وقت الإغلاق غير صالح" });
        return;
      }
      closedAt = parsed;
    }
    const openedAt = existing.openedAt ? new Date(existing.openedAt) : new Date(existing.createdAt);
    if (closedAt.getTime() < openedAt.getTime()) {
      res.status(400).json({ success: false, message: "وقت الإغلاق قبل وقت الافتتاح" });
      return;
    }
    patch.closedAt = closedAt;
    patch.endTime = formatHm(closedAt);
    patch.isActive = false;
  }

  const [updated] = await db
    .update(shiftsTable)
    .set(patch)
    .where(eq(shiftsTable.id, id))
    .returning();

  const [branch] = await db
    .select({ name: branchesTable.name })
    .from(branchesTable)
    .where(eq(branchesTable.id, updated.branchId))
    .limit(1);

  res.json(serializeShift(updated, branch?.name ?? null));
});

router.post("/:id/close", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }
  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }
  if (existing.closedAt) {
    res.status(400).json({ success: false, message: "الوردية مغلقة مسبقاً" });
    return;
  }
  const closedAt = new Date();
  const [updated] = await db
    .update(shiftsTable)
    .set({
      closedAt,
      endTime: formatHm(closedAt),
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(shiftsTable.id, id))
    .returning();

  const [branch] = await db
    .select({ name: branchesTable.name })
    .from(branchesTable)
    .where(eq(branchesTable.id, updated.branchId))
    .limit(1);

  res.json(serializeShift(updated, branch?.name ?? null));
});

router.delete("/:id", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }
  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }
  await db.delete(shiftsTable).where(eq(shiftsTable.id, id));
  res.json({ success: true, message: "تم حذف الوردية" });
});

export default router;
