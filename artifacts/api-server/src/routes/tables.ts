import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { restaurantTablesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { parseBranchScope, branchEq, resolveWriteBranchId } from "../lib/branch-scope";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const cond = branchEq(restaurantTablesTable.branchId, scope);
  const tables = await db
    .select()
    .from(restaurantTablesTable)
    .where(cond)
    .orderBy(asc(restaurantTablesTable.number));
  res.json(tables);
});

router.post("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const { number, capacity, location, status, branchId } = req.body;
  const resolvedBranchId = resolveWriteBranchId(scope, branchId);
  if (!resolvedBranchId) {
    res.status(400).json({ error: "اختر فرعاً قبل إضافة طاولة" });
    return;
  }
  const [table] = await db
    .insert(restaurantTablesTable)
    .values({
      number,
      capacity,
      location,
      status: status ?? "available",
      branchId: resolvedBranchId,
    })
    .returning();
  res.status(201).json(table);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { number, capacity, location, status, branchId } = req.body;
  const [table] = await db
    .update(restaurantTablesTable)
    .set({
      number,
      capacity,
      location,
      status,
      ...(branchId != null ? { branchId: Number(branchId) } : {}),
    })
    .where(eq(restaurantTablesTable.id, id))
    .returning();
  res.json(table);
});

export default router;
