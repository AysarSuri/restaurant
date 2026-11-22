import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  driversTable,
  branchesTable,
  ordersTable,
  shiftsTable,
} from "@workspace/db/schema";
import { and, desc, eq, gte, lte, ne } from "drizzle-orm";
import { parseBranchScope, resolveWriteBranchId } from "../lib/branch-scope";
import { ensureSalesDeviceColumns } from "../lib/ensure-sales-columns";

const router: IRouter = Router();

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseHmToMinutes(hm: string) {
  const [h, m] = String(hm ?? "0:0")
    .split(":")
    .map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function parseDaysOfWeek(raw: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(String(raw ?? "[0,1,2,3,4,5,6]"));
    if (!Array.isArray(parsed)) return [0, 1, 2, 3, 4, 5, 6];
    return parsed.map((d) => Number(d)).filter((d) => Number.isFinite(d));
  } catch {
    return [0, 1, 2, 3, 4, 5, 6];
  }
}

function orderInShift(
  createdAt: Date,
  shift: { startTime: string; endTime: string; daysOfWeek: string }
) {
  const days = parseDaysOfWeek(shift.daysOfWeek);
  if (!days.includes(createdAt.getDay())) return false;
  const t = createdAt.getHours() * 60 + createdAt.getMinutes();
  const start = parseHmToMinutes(shift.startTime);
  const end = parseHmToMinutes(shift.endTime);
  if (start === end) return true;
  if (start < end) return t >= start && t < end;
  return t >= start || t < end;
}

function emptyStats() {
  return {
    orderCount: 0,
    invoiceCount: 0,
    invoiceAmount: 0,
    deliveryAmount: 0,
    grandTotal: 0,
  };
}

function serializeDriver(
  row: typeof driversTable.$inferSelect,
  branchName?: string | null,
  stats = emptyStats()
) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? null,
    vehicleInfo: row.vehicleInfo ?? null,
    branchId: row.branchId ?? null,
    branchName: branchName ?? null,
    isActive: row.isActive !== false,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...stats,
  };
}

router.get("/", async (req, res) => {
  await ensureSalesDeviceColumns();
  const scope = parseBranchScope(req);
  const branchFilter =
    req.query.branchId != null && String(req.query.branchId).trim() !== ""
      ? Number(req.query.branchId)
      : null;
  const shiftId =
    req.query.shiftId != null && String(req.query.shiftId).trim() !== ""
      ? Number(req.query.shiftId)
      : null;
  const driverFilter =
    req.query.driverId != null && String(req.query.driverId).trim() !== ""
      ? Number(req.query.driverId)
      : null;
  const dateRaw = String(req.query.date ?? "").trim();
  const search = String(req.query.search ?? "").trim().toLowerCase();

  const drivers = await db
    .select({
      driver: driversTable,
      branchName: branchesTable.name,
    })
    .from(driversTable)
    .leftJoin(branchesTable, eq(driversTable.branchId, branchesTable.id))
    .orderBy(desc(driversTable.updatedAt));

  let list = drivers.map((r) => serializeDriver(r.driver, r.branchName));

  if (scope.mode === "one") {
    list = list.filter((d) => d.branchId == null || d.branchId === scope.branchId);
  }
  if (branchFilter && Number.isFinite(branchFilter) && branchFilter > 0) {
    list = list.filter((d) => d.branchId == null || d.branchId === branchFilter);
  }
  if (driverFilter && Number.isFinite(driverFilter) && driverFilter > 0) {
    list = list.filter((d) => d.id === driverFilter);
  }
  if (search) {
    list = list.filter(
      (d) =>
        d.name.toLowerCase().includes(search) ||
        (d.phone ?? "").toLowerCase().includes(search) ||
        (d.vehicleInfo ?? "").toLowerCase().includes(search)
    );
  }

  let shift: typeof shiftsTable.$inferSelect | null = null;
  if (shiftId && Number.isFinite(shiftId)) {
    const [s] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, shiftId)).limit(1);
    shift = s ?? null;
  }

  const orderConds = [eq(ordersTable.type, "delivery"), ne(ordersTable.status, "cancelled")];
  if (scope.mode === "one") {
    orderConds.push(eq(ordersTable.branchId, scope.branchId));
  }
  if (branchFilter && Number.isFinite(branchFilter) && branchFilter > 0) {
    orderConds.push(eq(ordersTable.branchId, branchFilter));
  } else if (shift?.branchId) {
    orderConds.push(eq(ordersTable.branchId, shift.branchId));
  }
  if (dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const [y, m, d] = dateRaw.split("-").map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    orderConds.push(gte(ordersTable.createdAt, start));
    orderConds.push(lte(ordersTable.createdAt, end));
  }

  const orders = await db
    .select({
      id: ordersTable.id,
      driverId: ordersTable.driverId,
      status: ordersTable.status,
      subtotal: ordersTable.subtotal,
      discount: ordersTable.discount,
      deliveryFee: ordersTable.deliveryFee,
      total: ordersTable.total,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .where(and(...orderConds));

  const filteredOrders = shift
    ? orders.filter((o) => orderInShift(new Date(o.createdAt), shift!))
    : orders;

  const byDriver = new Map<number, ReturnType<typeof emptyStats>>();
  for (const o of filteredOrders) {
    if (o.driverId == null) continue;
    if (driverFilter && o.driverId !== driverFilter) continue;
    const cur = byDriver.get(o.driverId) ?? emptyStats();
    const deliveryFee = num(o.deliveryFee);
    const total = num(o.total);
    const invoiceAmount = Math.max(0, total - deliveryFee);
    cur.orderCount += 1;
    cur.deliveryAmount += deliveryFee;
    cur.grandTotal += total;
    if (o.status === "paid") {
      cur.invoiceCount += 1;
      cur.invoiceAmount += invoiceAmount;
    }
    byDriver.set(o.driverId, cur);
  }

  const withStats = list.map((d) => {
    const stats = byDriver.get(d.id) ?? emptyStats();
    return { ...d, ...stats };
  });

  const totals = withStats.reduce(
    (acc, d) => {
      acc.orderCount += d.orderCount;
      acc.invoiceCount += d.invoiceCount;
      acc.invoiceAmount += d.invoiceAmount;
      acc.deliveryAmount += d.deliveryAmount;
      acc.grandTotal += d.grandTotal;
      return acc;
    },
    emptyStats()
  );

  res.json({
    drivers: withStats,
    totals,
    filters: {
      date: dateRaw || null,
      branchId: branchFilter,
      shiftId: shiftId && Number.isFinite(shiftId) ? shiftId : null,
      driverId: driverFilter && Number.isFinite(driverFilter) ? driverFilter : null,
    },
  });
});

router.post("/", async (req, res) => {
  await ensureSalesDeviceColumns();
  const scope = parseBranchScope(req);
  const { name, phone, vehicleInfo, branchId, notes, isActive } = req.body ?? {};
  const trimmed = String(name ?? "").trim();
  if (!trimmed) {
    res.status(400).json({ success: false, message: "اسم السائق مطلوب" });
    return;
  }
  const resolvedBranchId = resolveWriteBranchId(
    scope,
    branchId != null && branchId !== "" ? Number(branchId) : null
  );

  const [created] = await db
    .insert(driversTable)
    .values({
      name: trimmed,
      phone: phone != null ? String(phone).trim() || null : null,
      vehicleInfo: vehicleInfo != null ? String(vehicleInfo).trim() || null : null,
      branchId: resolvedBranchId,
      notes: notes != null ? String(notes).trim() || null : null,
      isActive: isActive !== false,
    })
    .returning();

  let branchName: string | null = null;
  if (created.branchId) {
    const [b] = await db
      .select({ name: branchesTable.name })
      .from(branchesTable)
      .where(eq(branchesTable.id, created.branchId));
    branchName = b?.name ?? null;
  }
  res.status(201).json(serializeDriver(created, branchName));
});

router.put("/:id", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(driversTable).where(eq(driversTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "السائق غير موجود" });
    return;
  }

  const { name, phone, vehicleInfo, branchId, notes, isActive } = req.body ?? {};
  const nextName = name != null ? String(name).trim() : existing.name;
  if (!nextName) {
    res.status(400).json({ success: false, message: "اسم السائق مطلوب" });
    return;
  }

  const [updated] = await db
    .update(driversTable)
    .set({
      name: nextName,
      phone: phone !== undefined ? (String(phone).trim() || null) : existing.phone,
      vehicleInfo:
        vehicleInfo !== undefined
          ? String(vehicleInfo).trim() || null
          : existing.vehicleInfo,
      branchId:
        branchId === null
          ? null
          : branchId !== undefined
            ? Number(branchId) || null
            : existing.branchId,
      notes: notes !== undefined ? String(notes).trim() || null : existing.notes,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(driversTable.id, id))
    .returning();

  let branchName: string | null = null;
  if (updated.branchId) {
    const [b] = await db
      .select({ name: branchesTable.name })
      .from(branchesTable)
      .where(eq(branchesTable.id, updated.branchId));
    branchName = b?.name ?? null;
  }
  res.json(serializeDriver(updated, branchName));
});

router.delete("/:id", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  await db
    .update(ordersTable)
    .set({ driverId: null })
    .where(eq(ordersTable.driverId, id));
  await db.delete(driversTable).where(eq(driversTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
