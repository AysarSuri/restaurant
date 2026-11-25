import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { restaurantTablesTable, ordersTable } from "@workspace/db/schema";
import { eq, asc, and, ne, sql } from "drizzle-orm";
import { parseBranchScope, branchEq, resolveWriteBranchId } from "../lib/branch-scope";

const router: IRouter = Router();

type SeatType = "table" | "room" | "person";

const normalizeSeatNumber = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

function duplicateError(type: SeatType) {
  if (type === "person") return "اسم الشخص مستخدم مسبقًا في هذا الفرع";
  if (type === "room") return "رقم الغرفة مستخدم مسبقًا في هذا الفرع";
  return "رقم الطاولة مستخدم مسبقًا في هذا الفرع";
}

async function findDuplicateSeat(opts: {
  type: SeatType;
  number: string;
  branchId: number;
  excludeId?: number;
}) {
  const target = normalizeSeatNumber(opts.number);
  if (!target) return null;

  const rows = await db
    .select()
    .from(restaurantTablesTable)
    .where(
      and(
        eq(restaurantTablesTable.type, opts.type),
        eq(restaurantTablesTable.branchId, opts.branchId),
        opts.excludeId != null
          ? ne(restaurantTablesTable.id, opts.excludeId)
          : undefined
      )
    );

  return rows.find((row) => normalizeSeatNumber(row.number) === target) ?? null;
}

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
  const resolvedType: SeatType =
    type === "room" || type === "person" || type === "table" ? type : "table";
  const resolvedNumber = String(number ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!resolvedNumber) {
    res.status(400).json({
      error:
        resolvedType === "person"
          ? "اسم الشخص مطلوب"
          : resolvedType === "room"
            ? "رقم الغرفة مطلوب"
            : "رقم الطاولة مطلوب",
    });
    return;
  }

  const dup = await findDuplicateSeat({
    type: resolvedType,
    number: resolvedNumber,
    branchId: resolvedBranchId,
  });
  if (dup) {
    res.status(400).json({ error: duplicateError(resolvedType) });
    return;
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

  const [existing] = await db
    .select()
    .from(restaurantTablesTable)
    .where(eq(restaurantTablesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const resolvedType: SeatType =
    type === "room" || type === "person" || type === "table"
      ? type
      : ((existing.type as SeatType) ?? "table");
  const nextNumber =
    number !== undefined && number !== null
      ? String(number).trim().replace(/\s+/g, " ")
      : existing.number;
  const nextBranchId =
    branchId != null && Number.isFinite(Number(branchId))
      ? Number(branchId)
      : existing.branchId;

  if (!nextNumber) {
    res.status(400).json({
      error:
        resolvedType === "person"
          ? "اسم الشخص مطلوب"
          : resolvedType === "room"
            ? "رقم الغرفة مطلوب"
            : "رقم الطاولة مطلوب",
    });
    return;
  }

  if (nextBranchId == null || !Number.isFinite(Number(nextBranchId))) {
    res.status(400).json({ error: "عيّن فرعاً لهذه الطاولة/الغرفة/الشخص" });
    return;
  }

  const dup = await findDuplicateSeat({
    type: resolvedType,
    number: nextNumber,
    branchId: nextBranchId,
    excludeId: id,
  });
  if (dup) {
    res.status(400).json({ error: duplicateError(resolvedType) });
    return;
  }

  const [table] = await db
    .update(restaurantTablesTable)
    .set({
      number: nextNumber,
      ...(capacity !== undefined ? { capacity } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(status !== undefined ? { status } : {}),
      type: resolvedType,
      branchId: nextBranchId,
    })
    .where(eq(restaurantTablesTable.id, id))
    .returning();
  res.json(table);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "معرف غير صالح" });
    return;
  }

  const [existing] = await db
    .select()
    .from(restaurantTablesTable)
    .where(eq(restaurantTablesTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }

  const [used] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(eq(ordersTable.tableId, id));
  if ((used?.count ?? 0) > 0) {
    const kind =
      existing.type === "person"
        ? "الشخص"
        : existing.type === "room"
          ? "الغرفة"
          : "الطاولة";
    res.status(400).json({
      error: `لا يمكن حذف ${kind} لأنها مستخدمة في طلبات`,
      message: `لا يمكن حذف ${kind} لأنها مستخدمة في طلبات`,
    });
    return;
  }

  await db.delete(restaurantTablesTable).where(eq(restaurantTablesTable.id, id));
  res.json({ success: true });
});

export default router;
