import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { expensesTable } from "@workspace/db/schema";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { parseBranchScope, branchEq, resolveWriteBranchId } from "../lib/branch-scope";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const { date } = req.query;
  const conditions = [];
  const branchCond = branchEq(expensesTable.branchId, scope);
  if (branchCond) conditions.push(branchCond);
  if (date) {
    const d = new Date(date as string);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    conditions.push(gte(expensesTable.date, start));
    conditions.push(lte(expensesTable.date, end));
  }
  const expenses = await db
    .select()
    .from(expensesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expensesTable.date));
  res.json(expenses);
});

router.post("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const { description, descriptionAr, amount, category, date, employeeId, branchId } = req.body;
  const resolvedBranchId = resolveWriteBranchId(scope, branchId);
  if (!resolvedBranchId) {
    res.status(400).json({ error: "اختر فرعاً قبل إضافة مصروف" });
    return;
  }
  const [expense] = await db
    .insert(expensesTable)
    .values({
      description,
      descriptionAr,
      amount: amount.toString(),
      category,
      date: new Date(date ?? Date.now()),
      employeeId,
      branchId: resolvedBranchId,
    })
    .returning();
  res.status(201).json(expense);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
