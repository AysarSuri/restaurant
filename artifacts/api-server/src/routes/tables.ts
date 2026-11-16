import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { restaurantTablesTable } from "@workspace/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { parseBranchScope, branchEq, resolveWriteBranchId } from "../lib/branch-scope";

const router: IRouter = Router();

const normalizePersonName = (value: string) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

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
  const { number, capacity, location, status, type, branchId } = req.body;
  const resolvedBranchId = resolveWriteBranchId(scope, branchId);
  if (!resolvedBranchId) {
    res.status(400).json({ error: "اختر فرعاً قبل إضافة طاولة" });
    return;
  }
  const resolvedType =
    type === "room" || type === "person" || type === "table" ? type : "table";
  const resolvedNumber =
    resolvedType === "person"
      ? String(number ?? "")
          .trim()
          .replace(/\s+/g, " ")
      : number;
  if (!resolvedNumber) {
    res.status(400).json({
      error: resolvedType === "person" ? "اسم الشخص مطلوب" : "رقم الطاولة مطلوب",
    });
    return;
  }
  if (resolvedType === "person") {
    const existing = await db
      .select()
      .from(restaurantTablesTable)
      .where(
        and(
          eq(restaurantTablesTable.type, "person"),
          eq(restaurantTablesTable.branchId, resolvedBranchId)
        )
      );
    const target = normalizePersonName(resolvedNumber);
    if (existing.some((row) => normalizePersonName(row.number) === target)) {
      res.status(400).json({ error: "اسم الشخص مستخدم مسبقًا" });
      return;
    }
  }
  const [table] = await db
    .insert(restaurantTablesTable)
    .values({
      number: resolvedNumber,
      capacity,
      type: resolvedType,
      location,
      status: status ?? "available",
      branchId: resolvedBranchId,
    })
    .returning();
  res.status(201).json(table);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { number, capacity, location, status, type, branchId } = req.body;
  const resolvedType =
    type === "room" || type === "person" || type === "table" ? type : undefined;
  const [table] = await db
    .update(restaurantTablesTable)
    .set({
      number,
      capacity,
      location,
      status,
      ...(resolvedType ? { type: resolvedType } : {}),
      ...(branchId != null ? { branchId: Number(branchId) } : {}),
    })
    .where(eq(restaurantTablesTable.id, id))
    .returning();
  res.json(table);
});

export default router;
