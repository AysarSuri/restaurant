import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { expensesTable } from "@workspace/db/schema";
import { eq, desc, gte, lte, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const { date } = req.query;
  let expenses;
  if (date) {
    const d = new Date(date as string);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    expenses = await db.select().from(expensesTable)
      .where(and(gte(expensesTable.date, start), lte(expensesTable.date, end)))
      .orderBy(desc(expensesTable.date));
  } else {
    expenses = await db.select().from(expensesTable).orderBy(desc(expensesTable.date));
  }
  res.json(expenses);
});

router.post("/", async (req, res) => {
  const { description, descriptionAr, amount, category, date, employeeId } = req.body;
  const [expense] = await db
    .insert(expensesTable)
    .values({ description, descriptionAr, amount: amount.toString(), category, date: new Date(date ?? Date.now()), employeeId })
    .returning();
  res.status(201).json(expense);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
