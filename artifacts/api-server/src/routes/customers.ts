import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db/schema";
import { eq, ilike, or, desc, and } from "drizzle-orm";
import { parseBranchScope, branchEq, resolveWriteBranchId } from "../lib/branch-scope";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const { search } = req.query;
  const branchCond = branchEq(customersTable.branchId, scope);
  const searchCond = search
    ? or(
        ilike(customersTable.name, `%${search}%`),
        ilike(customersTable.phone, `%${search}%`)
      )
    : undefined;
  const where =
    branchCond && searchCond
      ? and(branchCond, searchCond)
      : branchCond ?? searchCond;

  const customers = await db
    .select()
    .from(customersTable)
    .where(where)
    .orderBy(desc(customersTable.createdAt));
  res.json(customers);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(customer);
});

router.post("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const { name, phone, email, address, notes, branchId } = req.body;
  const resolvedBranchId = resolveWriteBranchId(scope, branchId);
  if (!resolvedBranchId) {
    res.status(400).json({ error: "اختر فرعاً قبل إضافة عميل" });
    return;
  }
  const [customer] = await db
    .insert(customersTable)
    .values({ name, phone, email, address, notes, branchId: resolvedBranchId })
    .returning();
  res.status(201).json(customer);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, phone, email, address, notes, branchId } = req.body;
  const [customer] = await db
    .update(customersTable)
    .set({
      name,
      phone,
      email,
      address,
      notes,
      ...(branchId != null ? { branchId: Number(branchId) } : {}),
    })
    .where(eq(customersTable.id, id))
    .returning();
  res.json(customer);
});

export default router;
