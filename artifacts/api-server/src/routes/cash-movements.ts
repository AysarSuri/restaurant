import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cashMovementsTable, branchesTable } from "@workspace/db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { parseBranchScope, branchEq, resolveWriteBranchId } from "../lib/branch-scope";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const KINDS = new Set(["withdrawal", "return"]);

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

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function normalizeDate(v: unknown): string | null {
  const raw = String(v ?? "").trim();
  if (!DATE_RE.test(raw)) return null;
  return raw;
}

function normalizeTime(v: unknown): string {
  const raw = String(v ?? "").trim();
  if (!TIME_RE.test(raw)) return nowTime();
  const parts = raw.split(":");
  if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`;
  return raw;
}

function normalizeKind(v: unknown): "withdrawal" | "return" {
  const raw = String(v ?? "").trim().toLowerCase();
  if (raw === "return" || raw === "مرجوع") return "return";
  return "withdrawal";
}

function mapRow(
  row: typeof cashMovementsTable.$inferSelect,
  branchName = ""
) {
  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    movementDate: row.movementDate,
    movementTime: row.movementTime,
    kind: row.kind === "return" ? "return" : "withdrawal",
    amount: num(row.amount),
    notes: row.notes,
    branchId: row.branchId,
    branchName,
    createdAt: row.createdAt,
  };
}

async function nextInvoiceNo(): Promise<string> {
  const rows = await db.select({ invoiceNo: cashMovementsTable.invoiceNo }).from(cashMovementsTable);
  let max = 0;
  for (const row of rows) {
    const match = String(row.invoiceNo ?? "").trim().match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

async function enrich(rows: (typeof cashMovementsTable.$inferSelect)[]) {
  const branchIds = [...new Set(rows.map((r) => r.branchId).filter(Boolean))] as number[];
  const branches =
    branchIds.length === 0
      ? []
      : await db.select().from(branchesTable).where(inArray(branchesTable.id, branchIds));
  const map = new Map(branches.map((b) => [b.id, b.name]));
  return rows.map((r) => mapRow(r, r.branchId ? map.get(r.branchId) || "" : ""));
}

router.get("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const conditions = [];
  const branchCond = branchEq(cashMovementsTable.branchId, scope);
  if (branchCond) conditions.push(branchCond);

  const from = normalizeDate(req.query.from);
  const to = normalizeDate(req.query.to);
  const kind = String(req.query.kind ?? "").trim().toLowerCase();
  const invoiceNo = String(req.query.invoiceNo ?? "").trim().toLowerCase();

  if (from) conditions.push(sql`${cashMovementsTable.movementDate} >= ${from}`);
  if (to) conditions.push(sql`${cashMovementsTable.movementDate} <= ${to}`);
  if (kind && KINDS.has(kind)) {
    conditions.push(eq(cashMovementsTable.kind, kind));
  }
  if (invoiceNo) {
    conditions.push(sql`lower(${cashMovementsTable.invoiceNo}) like ${`%${invoiceNo}%`}`);
  }

  const rows = await db
    .select()
    .from(cashMovementsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(cashMovementsTable.movementDate), desc(cashMovementsTable.id));

  res.json(await enrich(rows));
});

router.post("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const movementDate = normalizeDate(req.body?.movementDate ?? req.body?.date) ?? todayDate();
  const movementTime = normalizeTime(req.body?.movementTime ?? req.body?.time);
  const kind = normalizeKind(req.body?.kind ?? req.body?.type);
  const amount = num(req.body?.amount);
  const notes = String(req.body?.notes ?? "").trim() || null;
  let invoiceNo = String(req.body?.invoiceNo ?? "").trim();

  if (!(amount > 0)) return res.status(400).json({ message: "أدخل مبلغاً أكبر من صفر" });

  const resolvedBranchId = resolveWriteBranchId(scope, Number(req.body?.branchId) || null);
  if (!invoiceNo) invoiceNo = await nextInvoiceNo();

  const [row] = await db
    .insert(cashMovementsTable)
    .values({
      invoiceNo,
      movementDate,
      movementTime,
      kind,
      amount: money(amount),
      notes,
      branchId: resolvedBranchId,
    })
    .returning();

  const [full] = await enrich([row]);
  res.status(201).json(full);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });

  const [existing] = await db
    .select()
    .from(cashMovementsTable)
    .where(eq(cashMovementsTable.id, id))
    .limit(1);
  if (!existing) return res.status(404).json({ message: "السجل غير موجود" });

  const scope = parseBranchScope(req);
  const movementDate =
    normalizeDate(req.body?.movementDate ?? req.body?.date) ?? existing.movementDate;
  const movementTime = normalizeTime(
    req.body?.movementTime ?? req.body?.time ?? existing.movementTime
  );
  const kind = normalizeKind(req.body?.kind ?? req.body?.type ?? existing.kind);
  const amount = num(req.body?.amount, num(existing.amount));
  const notes = String(req.body?.notes ?? existing.notes ?? "").trim() || null;
  const invoiceNo =
    String(req.body?.invoiceNo ?? existing.invoiceNo ?? "").trim() || String(existing.id);

  if (!(amount > 0)) return res.status(400).json({ message: "أدخل مبلغاً أكبر من صفر" });

  const resolvedBranchId =
    resolveWriteBranchId(scope, Number(req.body?.branchId) || existing.branchId) ||
    existing.branchId;

  const [row] = await db
    .update(cashMovementsTable)
    .set({
      invoiceNo,
      movementDate,
      movementTime,
      kind,
      amount: money(amount),
      notes,
      branchId: resolvedBranchId,
    })
    .where(eq(cashMovementsTable.id, id))
    .returning();

  const [full] = await enrich([row]);
  res.json(full);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "معرف غير صالح" });
  const [row] = await db
    .delete(cashMovementsTable)
    .where(eq(cashMovementsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "السجل غير موجود" });
  res.json({ ok: true });
});

export default router;
