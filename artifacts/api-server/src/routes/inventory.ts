import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { inventoryTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { parseBranchScope, branchEq, resolveWriteBranchId } from "../lib/branch-scope";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const cond = branchEq(inventoryTable.branchId, scope);
  const items = await db
    .select()
    .from(inventoryTable)
    .where(cond)
    .orderBy(desc(inventoryTable.createdAt));
  res.json(items);
});

router.post("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const {
    name,
    nameAr,
    unit,
    currentQuantity,
    minimumQuantity,
    costPerUnit,
    category,
    supplier,
    branchId,
  } = req.body;
  const resolvedBranchId = resolveWriteBranchId(scope, branchId);
  if (!resolvedBranchId) {
    res.status(400).json({ error: "اختر فرعاً قبل إضافة مخزون" });
    return;
  }
  const [item] = await db
    .insert(inventoryTable)
    .values({
      name,
      nameAr,
      unit,
      currentQuantity: currentQuantity.toString(),
      minimumQuantity: minimumQuantity.toString(),
      costPerUnit: costPerUnit?.toString(),
      category,
      supplier,
      branchId: resolvedBranchId,
    })
    .returning();
  res.status(201).json(item);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    name,
    nameAr,
    unit,
    currentQuantity,
    minimumQuantity,
    costPerUnit,
    category,
    supplier,
    branchId,
  } = req.body;
  const [item] = await db
    .update(inventoryTable)
    .set({
      name,
      nameAr,
      unit,
      currentQuantity: currentQuantity?.toString(),
      minimumQuantity: minimumQuantity?.toString(),
      costPerUnit: costPerUnit?.toString(),
      category,
      supplier,
      ...(branchId != null ? { branchId: Number(branchId) } : {}),
    })
    .where(eq(inventoryTable.id, id))
    .returning();
  res.json(item);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(inventoryTable).where(eq(inventoryTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

router.post("/:id/adjust", async (req, res) => {
  const id = parseInt(req.params.id);
  const { adjustment } = req.body;
  const [item] = await db
    .update(inventoryTable)
    .set({
      currentQuantity: sql`current_quantity + ${adjustment}`,
      lastRestockedAt: adjustment > 0 ? new Date() : undefined,
    })
    .where(eq(inventoryTable.id, id))
    .returning();
  res.json(item);
});

export default router;
