import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  ordersTable,
  orderItemsTable,
  menuItemsTable,
  restaurantTablesTable,
  customersTable,
  inventoryTable,
} from "@workspace/db/schema";
import { eq, sql, and, gte, lte, type SQL } from "drizzle-orm";
import { parseBranchScope, branchEq } from "../lib/branch-scope";

const router: IRouter = Router();

function combine(...conds: (SQL | undefined)[]) {
  const list = conds.filter((c): c is SQL => Boolean(c));
  if (list.length === 0) return undefined;
  if (list.length === 1) return list[0];
  return and(...list);
}

router.get("/dashboard", async (req, res) => {
  const scope = parseBranchScope(req);
  const orderBranch = branchEq(ordersTable.branchId, scope);
  const tableBranch = branchEq(restaurantTablesTable.branchId, scope);
  const invBranch = branchEq(inventoryTable.branchId, scope);
  const custBranch = branchEq(customersTable.branchId, scope);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayRevResult] = await db
    .select({ total: sql<number>`coalesce(sum(total::numeric), 0)` })
    .from(ordersTable)
    .where(
      combine(
        gte(ordersTable.createdAt, todayStart),
        lte(ordersTable.createdAt, todayEnd),
        eq(ordersTable.status, "paid"),
        orderBranch
      )
    );

  const [todayOrdersResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ordersTable)
    .where(
      combine(
        gte(ordersTable.createdAt, todayStart),
        lte(ordersTable.createdAt, todayEnd),
        orderBranch
      )
    );

  const [activeOrdersResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ordersTable)
    .where(combine(sql`status NOT IN ('paid', 'cancelled')`, orderBranch));

  const [availableTablesResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(restaurantTablesTable)
    .where(combine(eq(restaurantTablesTable.status, "available"), tableBranch));

  const [totalTablesResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(restaurantTablesTable)
    .where(tableBranch);

  const [lowStockResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryTable)
    .where(combine(sql`current_quantity::numeric <= minimum_quantity::numeric`, invBranch));

  const [totalCustomersResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customersTable)
    .where(custBranch);

  const [monthRevResult] = await db
    .select({ total: sql<number>`coalesce(sum(total::numeric), 0)` })
    .from(ordersTable)
    .where(combine(gte(ordersTable.createdAt, monthStart), eq(ordersTable.status, "paid"), orderBranch));

  const [monthOrdersResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ordersTable)
    .where(combine(gte(ordersTable.createdAt, monthStart), orderBranch));

  const [prevMonthRevResult] = await db
    .select({ total: sql<number>`coalesce(sum(total::numeric), 0)` })
    .from(ordersTable)
    .where(
      combine(
        gte(ordersTable.createdAt, prevMonthStart),
        lte(ordersTable.createdAt, prevMonthEnd),
        eq(ordersTable.status, "paid"),
        orderBranch
      )
    );

  const todayRevenue = Number(todayRevResult.total);
  const monthRevenue = Number(monthRevResult.total);
  const prevMonthRevenue = Number(prevMonthRevResult.total);
  const revenueGrowth =
    prevMonthRevenue > 0 ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

  res.json({
    todayRevenue,
    todayOrders: Number(todayOrdersResult.count),
    activeOrders: Number(activeOrdersResult.count),
    availableTables: Number(availableTablesResult.count),
    totalTables: Number(totalTablesResult.count),
    lowStockItems: Number(lowStockResult.count),
    totalCustomers: Number(totalCustomersResult.count),
    monthRevenue,
    monthOrders: Number(monthOrdersResult.count),
    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    ordersGrowth: 0,
  });
});

router.get("/sales", async (req, res) => {
  const scope = parseBranchScope(req);
  const orderBranch = branchEq(ordersTable.branchId, scope);
  const { period = "daily", date } = req.query;
  const now = date ? new Date(date as string) : new Date();
  let data: { label: string; revenue: number; orders: number }[] = [];

  if (period === "daily") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const rows = await db
      .select({
        day: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
        revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
        orders: sql<number>`count(*)`,
      })
      .from(ordersTable)
      .where(
        combine(
          gte(ordersTable.createdAt, start),
          lte(ordersTable.createdAt, end),
          eq(ordersTable.status, "paid"),
          orderBranch
        )
      )
      .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(created_at, 'YYYY-MM-DD')`);

    const map: Record<string, { revenue: number; orders: number }> = {};
    for (const row of rows) map[row.day] = { revenue: Number(row.revenue), orders: Number(row.orders) };

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      data.push({ label: key, revenue: map[key]?.revenue ?? 0, orders: map[key]?.orders ?? 0 });
    }
  } else if (period === "monthly") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    const rows = await db
      .select({
        month: sql<string>`to_char(created_at, 'YYYY-MM')`,
        revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
        orders: sql<number>`count(*)`,
      })
      .from(ordersTable)
      .where(
        combine(
          gte(ordersTable.createdAt, start),
          lte(ordersTable.createdAt, end),
          eq(ordersTable.status, "paid"),
          orderBranch
        )
      )
      .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
      .orderBy(sql`to_char(created_at, 'YYYY-MM')`);
    data = rows.map((r) => ({ label: r.month, revenue: Number(r.revenue), orders: Number(r.orders) }));
  } else if (period === "weekly") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 27);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const rows = await db
      .select({
        week: sql<string>`to_char(date_trunc('week', created_at), 'YYYY-MM-DD')`,
        revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
        orders: sql<number>`count(*)`,
      })
      .from(ordersTable)
      .where(
        combine(
          gte(ordersTable.createdAt, start),
          lte(ordersTable.createdAt, end),
          eq(ordersTable.status, "paid"),
          orderBranch
        )
      )
      .groupBy(sql`date_trunc('week', created_at)`)
      .orderBy(sql`date_trunc('week', created_at)`);
    data = rows.map((r) => ({ label: r.week, revenue: Number(r.revenue), orders: Number(r.orders) }));
  } else {
    const rows = await db
      .select({
        year: sql<string>`to_char(created_at, 'YYYY')`,
        revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
        orders: sql<number>`count(*)`,
      })
      .from(ordersTable)
      .where(combine(eq(ordersTable.status, "paid"), orderBranch))
      .groupBy(sql`to_char(created_at, 'YYYY')`)
      .orderBy(sql`to_char(created_at, 'YYYY')`);
    data = rows.map((r) => ({ label: r.year, revenue: Number(r.revenue), orders: Number(r.orders) }));
  }

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const pmRows = await db
    .select({
      method: ordersTable.paymentMethod,
      total: sql<number>`coalesce(sum(total::numeric), 0)`,
    })
    .from(ordersTable)
    .where(combine(eq(ordersTable.status, "paid"), orderBranch))
    .groupBy(ordersTable.paymentMethod);

  const byPaymentMethod: Record<string, number> = {};
  for (const r of pmRows) if (r.method) byPaymentMethod[r.method] = Number(r.total);

  const typeRows = await db
    .select({
      type: ordersTable.type,
      count: sql<number>`count(*)`,
    })
    .from(ordersTable)
    .where(orderBranch)
    .groupBy(ordersTable.type);

  const byOrderType: Record<string, number> = {};
  for (const r of typeRows) byOrderType[r.type] = Number(r.count);

  res.json({ period, totalRevenue, totalOrders, averageOrderValue, data, byPaymentMethod, byOrderType });
});

router.get("/top-items", async (req, res) => {
  const scope = parseBranchScope(req);
  const orderBranch = branchEq(ordersTable.branchId, scope);
  const { limit = "10", period = "monthly" } = req.query;
  const now = new Date();
  let start: Date;
  if (period === "daily") start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (period === "weekly") start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  else start = new Date(now.getFullYear(), now.getMonth(), 1);

  const rows = await db
    .select({
      menuItemId: orderItemsTable.menuItemId,
      name: menuItemsTable.name,
      nameAr: menuItemsTable.nameAr,
      imageUrl: menuItemsTable.imageUrl,
      totalQuantity: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`,
      totalRevenue: sql<number>`coalesce(sum(${orderItemsTable.totalPrice}::numeric), 0)`,
    })
    .from(orderItemsTable)
    .leftJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
    .leftJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(combine(gte(ordersTable.createdAt, start), eq(ordersTable.status, "paid"), orderBranch))
    .groupBy(orderItemsTable.menuItemId, menuItemsTable.name, menuItemsTable.nameAr, menuItemsTable.imageUrl)
    .orderBy(sql`sum(${orderItemsTable.quantity}) desc`)
    .limit(parseInt(limit as string));

  res.json(
    rows.map((r) => ({
      menuItemId: r.menuItemId,
      name: r.name,
      nameAr: r.nameAr,
      imageUrl: r.imageUrl,
      totalQuantity: Number(r.totalQuantity),
      totalRevenue: Number(r.totalRevenue),
    }))
  );
});

export default router;
