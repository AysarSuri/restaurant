import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  const employees = await db.select().from(employeesTable).orderBy(desc(employeesTable.createdAt));
  res.json(employees);
});

router.post("/", async (req, res) => {
  const { name, role, phone, email, salary, isActive, hireDate } = req.body;
  const [emp] = await db
    .insert(employeesTable)
    .values({ name, role, phone, email, salary: salary?.toString(), isActive: isActive ?? true, hireDate: hireDate ? new Date(hireDate) : null })
    .returning();
  res.status(201).json(emp);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, role, phone, email, salary, isActive, hireDate } = req.body;
  const [emp] = await db
    .update(employeesTable)
    .set({ name, role, phone, email, salary: salary?.toString(), isActive, hireDate: hireDate ? new Date(hireDate) : undefined })
    .where(eq(employeesTable.id, id))
    .returning();
  res.json(emp);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(employeesTable).where(eq(employeesTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
