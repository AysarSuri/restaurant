import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  expensesTable,
  expenseTypesTable,
  branchesTable,
  cardsTable,
} from "@workspace/db/schema";
import { eq, desc, asc, and, sql, inArray } from "drizzle-orm";
import { parseBranchScope, branchEq, resolveWriteBranchId } from "../lib/branch-scope";
import { requireOpenShiftForBranch } from "../lib/require-open-shift";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function money(v: unknown) {
  return num(v).toFixed(2);
}

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeDate(v: unknown): string | null {
  const raw = String(v ?? "").trim();
  if (!DATE_RE.test(raw)) return null;
  return raw;
}

function dateAtNoon(isoDay: string) {
  return new Date(`${isoDay}T12:00:00`);
}

function parsePaymentFields(body: any): {
  paymentMethod: "cash" | "card";
  cardId: number | null;
  error?: string;
} {
  const paymentMethodRaw = String(body?.paymentMethod ?? body?.payMethod ?? "cash")
    .trim()
    .toLowerCase();
  const paymentMethod: "cash" | "card" =
    paymentMethodRaw === "card" || paymentMethodRaw === "بطاقة" ? "card" : "cash";
  const cardIdRaw = Number(body?.cardId);
  let cardId =
    paymentMethod === "card" && Number.isFinite(cardIdRaw) && cardIdRaw > 0
      ? cardIdRaw
      : null;
  if (paymentMethod === "card" && !cardId) {
    return { paymentMethod, cardId: null, error: "اختر البطاقة" };
  }
  if (paymentMethod === "cash") cardId = null;
  return { paymentMethod, cardId };
}

function mapExpense(
  row: typeof expensesTable.$inferSelect,
  extras?: { typeName?: string; branchName?: string; cardName?: string }
) {
  const expenseDate =
    row.expenseDate ||
    (row.date
      ? `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, "0")}-${String(row.date.getDate()).padStart(2, "0")}`
      : todayDate());
  return {
    id: row.id,
    invoiceNo: row.invoiceNo || String(row.id),
    description: row.description || "",
    descriptionAr: row.descriptionAr,
    notes: row.notes,
    amount: num(row.amount),
    category: row.category || extras?.typeName || "",
    expenseTypeId: row.expenseTypeId,
    expenseTypeName: extras?.typeName || row.category || "",
    expenseDate,
    date: expenseDate,
    employeeId: row.employeeId,
    branchId: row.branchId,
    branchName: extras?.branchName || "",
    paymentMethod: row.paymentMethod === "card" ? "card" : "cash",
    cardId: row.cardId,
    cardName: extras?.cardName || "",
    createdAt: row.createdAt,
  };
}

async function nextExpenseInvoiceNo(): Promise<string> {
  const rows = await db.select({ invoiceNo: expensesTable.invoiceNo }).from(expensesTable);
  let max = 0;
  for (const row of rows) {
    const match = String(row.invoiceNo ?? "").trim().match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

async function enrichExpenses(rows: (typeof expensesTable.$inferSelect)[]) {
  const typeIds = [...new Set(rows.map((r) => r.expenseTypeId).filter(Boolean))] as number[];
  const branchIds = [...new Set(rows.map((r) => r.branchId).filter(Boolean))] as number[];
  const cardIds = [...new Set(rows.map((r) => r.cardId).filter(Boolean))] as number[];

  const types =
    typeIds.length === 0
      ? []
      : await db.select().from(expenseTypesTable).where(inArray(expenseTypesTable.id, typeIds));
  const branches =
    branchIds.length === 0
      ? []
      : await db.select().from(branchesTable).where(inArray(branchesTable.id, branchIds));
  const cards =
    cardIds.length === 0
      ? []
      : await db.select().from(cardsTable).where(inArray(cardsTable.id, cardIds));

  const typeMap = new Map(types.map((t) => [t.id, t.name]));
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const cardMap = new Map(cards.map((c) => [c.id, c.name]));

  return rows.map((r) =>
    mapExpense(r, {
      typeName: r.expenseTypeId ? typeMap.get(r.expenseTypeId) : r.category,
      branchName: r.branchId ? branchMap.get(r.branchId) : "",
      cardName: r.cardId ? cardMap.get(r.cardId) || "" : "",
    })
  );
}

// ─── Expense types ────────────────────────────────────────

router.get("/types", async (_req, res) => {
  const rows = await db
    .select()
    .from(expenseTypesTable)
    .orderBy(asc(expenseTypesTable.name));
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      notes: r.notes,
      createdAt: r.createdAt,
    }))
  );
});

router.post("/types", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const notes = String(req.body?.notes ?? "").trim() || null;
  if (!name) return res.status(400).json({ message: "اسم نوع المصروف مطلوب" });

  const existing = await db
    .select({ id: expenseTypesTable.id })
    .from(expenseTypesTable)
    .where(sql`lower(${expenseTypesTable.name}) = ${name.toLowerCase()}`)
    .limit(1);
  if (existing.length) {
    return res.status(400).json({ message: "نوع المصروف موجود مسبقاً" });
  }

  const [row] = await db
    .insert(expenseTypesTable)
    .values({ name, notes })
    .returning();
  res.status(201).json({
    id: row.id,
    name: row.name,
    notes: row.notes,
    createdAt: row.createdAt,
  });
});

router.put("/types/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });
  const name = String(req.body?.name ?? "").trim();
  const notes = String(req.body?.notes ?? "").trim() || null;
  if (!name) return res.status(400).json({ message: "اسم نوع المصروف مطلوب" });

  const dup = await db
    .select({ id: expenseTypesTable.id })
    .from(expenseTypesTable)
    .where(
      sql`lower(${expenseTypesTable.name}) = ${name.toLowerCase()} and ${expenseTypesTable.id} <> ${id}`
    )
    .limit(1);
  if (dup.length) {
    return res.status(400).json({ message: "نوع المصروف موجود مسبقاً" });
  }

  const [row] = await db
    .update(expenseTypesTable)
    .set({ name, notes })
    .where(eq(expenseTypesTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "نوع المصروف غير موجود" });
  res.json({
    id: row.id,
    name: row.name,
    notes: row.notes,
    createdAt: row.createdAt,
  });
});

router.delete("/types/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });

  const used = await db
    .select({ id: expensesTable.id })
    .from(expensesTable)
    .where(eq(expensesTable.expenseTypeId, id))
    .limit(1);
  if (used.length) {
    return res
      .status(400)
      .json({ message: "لا يمكن حذف النوع — مرتبط بمصاريف مسجّلة" });
  }

  const [row] = await db
    .delete(expenseTypesTable)
    .where(eq(expenseTypesTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "نوع المصروف غير موجود" });
  res.json({ ok: true });
});

// ─── Expenses CRUD ────────────────────────────────────────

router.get("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const conditions = [];
  const branchCond = branchEq(expensesTable.branchId, scope);
  if (branchCond) conditions.push(branchCond);

  const from = normalizeDate(req.query.from ?? req.query.fromDate);
  const to = normalizeDate(req.query.to ?? req.query.toDate);
  const legacyDate = normalizeDate(req.query.date);
  const typeId = Number(req.query.expenseTypeId ?? req.query.typeId);
  const invoiceNo = String(req.query.invoiceNo ?? "").trim().toLowerCase();
  const filterBranchId = Number(req.query.filterBranchId ?? req.query.branchFilter);

  if (legacyDate && !from && !to) {
    conditions.push(
      sql`coalesce(${expensesTable.expenseDate}, to_char(${expensesTable.date}, 'YYYY-MM-DD')) = ${legacyDate}`
    );
  } else {
    if (from) {
      conditions.push(
        sql`coalesce(${expensesTable.expenseDate}, to_char(${expensesTable.date}, 'YYYY-MM-DD')) >= ${from}`
      );
    }
    if (to) {
      conditions.push(
        sql`coalesce(${expensesTable.expenseDate}, to_char(${expensesTable.date}, 'YYYY-MM-DD')) <= ${to}`
      );
    }
  }

  if (Number.isFinite(typeId) && typeId > 0) {
    conditions.push(eq(expensesTable.expenseTypeId, typeId));
  }
  if (Number.isFinite(filterBranchId) && filterBranchId > 0) {
    conditions.push(eq(expensesTable.branchId, filterBranchId));
  }
  if (invoiceNo) {
    conditions.push(sql`lower(${expensesTable.invoiceNo}) like ${`%${invoiceNo}%`}`);
  }

  const paymentMethodFilter = String(req.query.paymentMethod ?? "")
    .trim()
    .toLowerCase();
  const cardIdFilter = Number(req.query.cardId);
  if (Number.isFinite(cardIdFilter) && cardIdFilter > 0) {
    conditions.push(eq(expensesTable.cardId, cardIdFilter));
  } else if (paymentMethodFilter === "card") {
    conditions.push(eq(expensesTable.paymentMethod, "card"));
  } else if (paymentMethodFilter === "cash") {
    conditions.push(
      sql`coalesce(${expensesTable.paymentMethod}, 'cash') <> 'card'`
    );
  }

  const rows = await db
    .select()
    .from(expensesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      desc(sql`coalesce(${expensesTable.expenseDate}, to_char(${expensesTable.date}, 'YYYY-MM-DD'))`),
      desc(expensesTable.id)
    );

  res.json(await enrichExpenses(rows));
});

router.post("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const expenseDate =
    normalizeDate(req.body?.expenseDate ?? req.body?.date) ?? todayDate();
  const expenseTypeId = Number(req.body?.expenseTypeId);
  const amount = num(req.body?.amount);
  const notes = String(req.body?.notes ?? "").trim() || null;
  const description = String(req.body?.description ?? req.body?.notes ?? "").trim() || "";
  const descriptionAr = String(req.body?.descriptionAr ?? notes ?? "").trim() || null;
  let invoiceNo = String(req.body?.invoiceNo ?? "").trim();

  if (!Number.isFinite(expenseTypeId) || expenseTypeId <= 0) {
    return res.status(400).json({ message: "اختر نوع المصروف" });
  }
  if (!(amount > 0)) return res.status(400).json({ message: "أدخل مبلغاً أكبر من صفر" });

  const [typeRow] = await db
    .select()
    .from(expenseTypesTable)
    .where(eq(expenseTypesTable.id, expenseTypeId))
    .limit(1);
  if (!typeRow) return res.status(400).json({ message: "نوع المصروف غير موجود" });

  const resolvedBranchId = resolveWriteBranchId(scope, Number(req.body?.branchId) || null);
  if (!resolvedBranchId) {
    return res.status(400).json({ message: "اختر فرعاً قبل إضافة مصروف" });
  }
  const shiftErr = await requireOpenShiftForBranch(resolvedBranchId);
  if (shiftErr) return res.status(400).json({ message: shiftErr, error: shiftErr });

  if (!invoiceNo) invoiceNo = await nextExpenseInvoiceNo();

  const payment = parsePaymentFields(req.body);
  if (payment.error) return res.status(400).json({ message: payment.error });

  const [row] = await db
    .insert(expensesTable)
    .values({
      invoiceNo,
      description: description || typeRow.name,
      descriptionAr,
      notes,
      amount: money(amount),
      category: typeRow.name,
      expenseTypeId,
      expenseDate,
      date: dateAtNoon(expenseDate),
      employeeId: req.body?.employeeId ? Number(req.body.employeeId) : null,
      branchId: resolvedBranchId,
      paymentMethod: payment.paymentMethod,
      cardId: payment.cardId,
    })
    .returning();

  const [full] = await enrichExpenses([row]);
  res.status(201).json(full);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });

  const [existing] = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.id, id))
    .limit(1);
  if (!existing) return res.status(404).json({ message: "المصروف غير موجود" });

  const scope = parseBranchScope(req);
  const expenseDate =
    normalizeDate(req.body?.expenseDate ?? req.body?.date) ??
    existing.expenseDate ??
    todayDate();
  const expenseTypeId = Number(req.body?.expenseTypeId ?? existing.expenseTypeId);
  const amount = num(req.body?.amount, num(existing.amount));
  const notes = String(req.body?.notes ?? existing.notes ?? "").trim() || null;
  const description =
    String(req.body?.description ?? existing.description ?? "").trim() || "";
  const descriptionAr =
    String(req.body?.descriptionAr ?? existing.descriptionAr ?? notes ?? "").trim() ||
    null;
  const invoiceNo =
    String(req.body?.invoiceNo ?? existing.invoiceNo ?? "").trim() || String(existing.id);

  if (!Number.isFinite(expenseTypeId) || expenseTypeId <= 0) {
    return res.status(400).json({ message: "اختر نوع المصروف" });
  }
  if (!(amount > 0)) return res.status(400).json({ message: "أدخل مبلغاً أكبر من صفر" });

  const [typeRow] = await db
    .select()
    .from(expenseTypesTable)
    .where(eq(expenseTypesTable.id, expenseTypeId))
    .limit(1);
  if (!typeRow) return res.status(400).json({ message: "نوع المصروف غير موجود" });

  const resolvedBranchId =
    resolveWriteBranchId(scope, Number(req.body?.branchId) || existing.branchId) ||
    existing.branchId;
  if (!resolvedBranchId) {
    return res.status(400).json({ message: "اختر فرعاً" });
  }
  const shiftErr = await requireOpenShiftForBranch(resolvedBranchId);
  if (shiftErr) return res.status(400).json({ message: shiftErr, error: shiftErr });

  const payment = parsePaymentFields(req.body);
  if (payment.error) return res.status(400).json({ message: payment.error });

  const [row] = await db
    .update(expensesTable)
    .set({
      invoiceNo,
      description: description || typeRow.name,
      descriptionAr,
      notes,
      amount: money(amount),
      category: typeRow.name,
      expenseTypeId,
      expenseDate,
      date: dateAtNoon(expenseDate),
      branchId: resolvedBranchId,
      paymentMethod: payment.paymentMethod,
      cardId: payment.cardId,
    })
    .where(eq(expensesTable.id, id))
    .returning();

  const [full] = await enrichExpenses([row]);
  res.json(full);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });
  const [existing] = await db
    .select({ id: expensesTable.id, branchId: expensesTable.branchId })
    .from(expensesTable)
    .where(eq(expensesTable.id, id))
    .limit(1);
  if (!existing) return res.status(404).json({ message: "المصروف غير موجود" });
  const shiftErr = await requireOpenShiftForBranch(existing.branchId);
  if (shiftErr) return res.status(400).json({ message: shiftErr, error: shiftErr });
  const [row] = await db
    .delete(expensesTable)
    .where(eq(expensesTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "المصروف غير موجود" });
  res.json({ ok: true, success: true, message: "Deleted" });
});

export default router;
