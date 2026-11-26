import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  ordersTable,
  orderItemsTable,
  menuItemsTable,
  menuCategoriesTable,
  restaurantTablesTable,
  customersTable,
  inventoryTable,
} from "@workspace/db/schema";
import { eq, sql, and, gte, lte, lt, ne, isNotNull, or, type SQL } from "drizzle-orm";
import { parseBranchScope, branchEq } from "../lib/branch-scope";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function combine(...conds: (SQL | undefined)[]) {
  const list = conds.filter((c): c is SQL => Boolean(c));
  if (list.length === 0) return undefined;
  if (list.length === 1) return list[0];
  return and(...list);
}

function money(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeYmd(v: unknown): string | null {
  const raw = String(v ?? "").trim();
  return DATE_RE.test(raw) ? raw : null;
}

function dayStart(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function dayEndExclusive(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0);
}

/** Paid / واصل invoices only (exclude cancelled). */
function orderReceivedCond() {
  return and(
    ne(ordersTable.status, "cancelled"),
    or(isNotNull(ordersTable.paymentMethod), eq(ordersTable.status, "paid"))
  );
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

/**
 * Detailed sales breakdown for reports UI.
 * groupBy: date | item | category
 * Optional filters: from, to, filterBranchId, categoryId, menuItemId
 */
router.get("/sales-breakdown", async (req, res) => {
  const scope = parseBranchScope(req);
  const from = normalizeYmd(req.query.from) ?? todayYmd();
  const to = normalizeYmd(req.query.to) ?? from;
  const rangeStart = from <= to ? from : to;
  const rangeEnd = from <= to ? to : from;
  const groupByRaw = String(req.query.groupBy ?? "date").toLowerCase();
  const groupBy =
    groupByRaw === "item" || groupByRaw === "category" ? groupByRaw : "date";

  const filterBranchId = Number(req.query.filterBranchId ?? req.query.branchId);
  const branchFilter =
    Number.isFinite(filterBranchId) && filterBranchId > 0
      ? filterBranchId
      : scope.mode === "one"
        ? scope.branchId
        : null;

  const categoryId = Number(req.query.categoryId);
  const menuItemId = Number(req.query.menuItemId);
  const hasCategory =
    Number.isFinite(categoryId) && categoryId > 0 ? categoryId : null;
  const hasItem =
    Number.isFinite(menuItemId) && menuItemId > 0 ? menuItemId : null;

  const scopeBranch = branchEq(ordersTable.branchId, scope);
  const where = combine(
    gte(ordersTable.createdAt, dayStart(rangeStart)),
    lt(ordersTable.createdAt, dayEndExclusive(rangeEnd)),
    orderReceivedCond(),
    scopeBranch,
    branchFilter != null ? eq(ordersTable.branchId, branchFilter) : undefined,
    hasCategory != null ? eq(menuItemsTable.categoryId, hasCategory) : undefined,
    hasItem != null ? eq(orderItemsTable.menuItemId, hasItem) : undefined
  );

  type RowOut = {
    key: string;
    label: string;
    labelAr: string;
    qty: number;
    amount: number;
    orderCount: number;
    lineCount: number;
  };

  let rows: RowOut[] = [];

  if (groupBy === "date") {
    const agg = await db
      .select({
        key: sql<string>`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`,
        qty: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`,
        amount: sql<number>`coalesce(sum(${orderItemsTable.totalPrice}::numeric), 0)`,
        orderCount: sql<number>`count(distinct ${ordersTable.id})`,
        lineCount: sql<number>`count(${orderItemsTable.id})`,
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .innerJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
      .where(where)
      .groupBy(sql`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`);
    rows = agg.map((r) => ({
      key: r.key,
      label: r.key,
      labelAr: r.key,
      qty: Number(r.qty) || 0,
      amount: money(r.amount),
      orderCount: Number(r.orderCount) || 0,
      lineCount: Number(r.lineCount) || 0,
    }));
  } else if (groupBy === "item") {
    const agg = await db
      .select({
        key: sql<string>`${orderItemsTable.menuItemId}::text`,
        label: menuItemsTable.name,
        labelAr: menuItemsTable.nameAr,
        categoryNameAr: menuCategoriesTable.nameAr,
        qty: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`,
        amount: sql<number>`coalesce(sum(${orderItemsTable.totalPrice}::numeric), 0)`,
        orderCount: sql<number>`count(distinct ${ordersTable.id})`,
        lineCount: sql<number>`count(${orderItemsTable.id})`,
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .innerJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
      .innerJoin(
        menuCategoriesTable,
        eq(menuItemsTable.categoryId, menuCategoriesTable.id)
      )
      .where(where)
      .groupBy(
        orderItemsTable.menuItemId,
        menuItemsTable.name,
        menuItemsTable.nameAr,
        menuCategoriesTable.nameAr
      )
      .orderBy(sql`sum(${orderItemsTable.totalPrice}::numeric) desc`);
    rows = agg.map((r) => ({
      key: String(r.key),
      label: r.label || r.labelAr || `#${r.key}`,
      labelAr: `${r.labelAr || r.label || `#${r.key}`}${
        r.categoryNameAr ? ` · ${r.categoryNameAr}` : ""
      }`,
      qty: Number(r.qty) || 0,
      amount: money(r.amount),
      orderCount: Number(r.orderCount) || 0,
      lineCount: Number(r.lineCount) || 0,
    }));
  } else {
    const agg = await db
      .select({
        key: sql<string>`${menuCategoriesTable.id}::text`,
        label: menuCategoriesTable.name,
        labelAr: menuCategoriesTable.nameAr,
        qty: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`,
        amount: sql<number>`coalesce(sum(${orderItemsTable.totalPrice}::numeric), 0)`,
        orderCount: sql<number>`count(distinct ${ordersTable.id})`,
        lineCount: sql<number>`count(${orderItemsTable.id})`,
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .innerJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
      .innerJoin(
        menuCategoriesTable,
        eq(menuItemsTable.categoryId, menuCategoriesTable.id)
      )
      .where(where)
      .groupBy(
        menuCategoriesTable.id,
        menuCategoriesTable.name,
        menuCategoriesTable.nameAr
      )
      .orderBy(sql`sum(${orderItemsTable.totalPrice}::numeric) desc`);
    rows = agg.map((r) => ({
      key: String(r.key),
      label: r.label || r.labelAr || `#${r.key}`,
      labelAr: r.labelAr || r.label || `#${r.key}`,
      qty: Number(r.qty) || 0,
      amount: money(r.amount),
      orderCount: Number(r.orderCount) || 0,
      lineCount: Number(r.lineCount) || 0,
    }));
  }

  const summary = {
    totalQty: rows.reduce((s, r) => s + r.qty, 0),
    totalAmount: money(rows.reduce((s, r) => s + r.amount, 0)),
    orderCount: rows.reduce((s, r) => s + r.orderCount, 0),
    lineCount: rows.reduce((s, r) => s + r.lineCount, 0),
    rowCount: rows.length,
  };

  // Distinct order count across whole period (not sum of groups for date/item overlap)
  const [ordersAgg] = await db
    .select({
      orderCount: sql<number>`count(distinct ${ordersTable.id})`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .innerJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
    .where(where);

  summary.orderCount = Number(ordersAgg?.orderCount) || 0;

  res.json({
    from: rangeStart,
    to: rangeEnd,
    groupBy,
    branchId: branchFilter,
    categoryId: hasCategory,
    menuItemId: hasItem,
    summary,
    rows,
  });
});

/**
 * Profit from sales — line details for items with cost mode only (cost > 0).
 * Filters: from, to, filterBranchId, categoryId, menuItemId
 */
router.get("/sales-profit", async (req, res) => {
  const scope = parseBranchScope(req);
  const from = normalizeYmd(req.query.from) ?? todayYmd();
  const to = normalizeYmd(req.query.to) ?? from;
  const rangeStart = from <= to ? from : to;
  const rangeEnd = from <= to ? to : from;

  const filterBranchId = Number(req.query.filterBranchId ?? req.query.branchId);
  const branchFilter =
    Number.isFinite(filterBranchId) && filterBranchId > 0
      ? filterBranchId
      : scope.mode === "one"
        ? scope.branchId
        : null;

  const categoryId = Number(req.query.categoryId);
  const menuItemId = Number(req.query.menuItemId);
  const hasCategory =
    Number.isFinite(categoryId) && categoryId > 0 ? categoryId : null;
  const hasItem =
    Number.isFinite(menuItemId) && menuItemId > 0 ? menuItemId : null;

  const scopeBranch = branchEq(ordersTable.branchId, scope);
  const where = combine(
    gte(ordersTable.createdAt, dayStart(rangeStart)),
    lt(ordersTable.createdAt, dayEndExclusive(rangeEnd)),
    orderReceivedCond(),
    scopeBranch,
    branchFilter != null ? eq(ordersTable.branchId, branchFilter) : undefined,
    isNotNull(menuItemsTable.cost),
    sql`${menuItemsTable.cost}::numeric > 0`,
    hasCategory != null ? eq(menuItemsTable.categoryId, hasCategory) : undefined,
    hasItem != null ? eq(orderItemsTable.menuItemId, hasItem) : undefined
  );

  const lines = await db
    .select({
      id: orderItemsTable.id,
      orderId: ordersTable.id,
      invoiceNo: ordersTable.orderNumber,
      date: sql<string>`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`,
      time: sql<string>`to_char(${ordersTable.createdAt}, 'HH24:MI')`,
      menuItemId: orderItemsTable.menuItemId,
      itemName: menuItemsTable.name,
      itemNameAr: menuItemsTable.nameAr,
      categoryId: menuCategoriesTable.id,
      categoryName: menuCategoriesTable.name,
      categoryNameAr: menuCategoriesTable.nameAr,
      qty: orderItemsTable.quantity,
      unitPrice: orderItemsTable.unitPrice,
      lineSale: orderItemsTable.totalPrice,
      costPrice: menuItemsTable.cost,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .innerJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
    .innerJoin(
      menuCategoriesTable,
      eq(menuItemsTable.categoryId, menuCategoriesTable.id)
    )
    .where(where)
    .orderBy(
      sql`${ordersTable.createdAt} desc`,
      sql`${orderItemsTable.id} asc`
    );

  const rows = lines.map((r) => {
    const qty = Number(r.qty) || 0;
    const unitPrice = money(r.unitPrice);
    const lineSale = money(r.lineSale);
    const costPrice = money(r.costPrice);
    const lineCost = money(qty * costPrice);
    const profit = money(lineSale - lineCost);
    return {
      id: r.id,
      orderId: r.orderId,
      invoiceNo: r.invoiceNo,
      date: r.date,
      time: r.time,
      menuItemId: r.menuItemId,
      itemName: r.itemName,
      itemNameAr: r.itemNameAr || r.itemName,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      categoryNameAr: r.categoryNameAr || r.categoryName,
      qty,
      unitPrice,
      costPrice,
      lineSale,
      lineCost,
      profit,
    };
  });

  const summary = {
    lineCount: rows.length,
    totalQty: rows.reduce((s, r) => s + r.qty, 0),
    totalSale: money(rows.reduce((s, r) => s + r.lineSale, 0)),
    totalCost: money(rows.reduce((s, r) => s + r.lineCost, 0)),
    totalProfit: money(rows.reduce((s, r) => s + r.profit, 0)),
    orderCount: new Set(rows.map((r) => r.orderId)).size,
  };

  res.json({
    from: rangeStart,
    to: rangeEnd,
    branchId: branchFilter,
    categoryId: hasCategory,
    menuItemId: hasItem,
    summary,
    rows,
  });
});

/**
 * Discounts from sales — invoices with discount > 0 in date range.
 * Filters: from, to, filterBranchId
 */
router.get("/sales-discounts", async (req, res) => {
  const scope = parseBranchScope(req);
  const from = normalizeYmd(req.query.from) ?? todayYmd();
  const to = normalizeYmd(req.query.to) ?? from;
  const rangeStart = from <= to ? from : to;
  const rangeEnd = from <= to ? to : from;

  const filterBranchId = Number(req.query.filterBranchId ?? req.query.branchId);
  const branchFilter =
    Number.isFinite(filterBranchId) && filterBranchId > 0
      ? filterBranchId
      : scope.mode === "one"
        ? scope.branchId
        : null;

  const scopeBranch = branchEq(ordersTable.branchId, scope);
  const where = combine(
    gte(ordersTable.createdAt, dayStart(rangeStart)),
    lt(ordersTable.createdAt, dayEndExclusive(rangeEnd)),
    orderReceivedCond(),
    scopeBranch,
    branchFilter != null ? eq(ordersTable.branchId, branchFilter) : undefined,
    sql`coalesce(${ordersTable.discount}::numeric, 0) > 0`
  );

  const list = await db
    .select({
      id: ordersTable.id,
      invoiceNo: ordersTable.orderNumber,
      date: sql<string>`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`,
      time: sql<string>`to_char(${ordersTable.createdAt}, 'HH24:MI')`,
      discount: ordersTable.discount,
      subtotal: ordersTable.subtotal,
      total: ordersTable.total,
      paymentMethod: ordersTable.paymentMethod,
      type: ordersTable.type,
    })
    .from(ordersTable)
    .where(where)
    .orderBy(sql`${ordersTable.createdAt} desc`, sql`${ordersTable.id} desc`);

  const rows = list.map((r) => ({
    id: r.id,
    invoiceNo: r.invoiceNo,
    date: r.date,
    time: r.time,
    discount: money(r.discount),
    subtotal: money(r.subtotal),
    total: money(r.total),
    paymentMethod: r.paymentMethod,
    type: r.type,
  }));

  const summary = {
    invoiceCount: rows.length,
    totalDiscount: money(rows.reduce((s, r) => s + r.discount, 0)),
    totalSales: money(rows.reduce((s, r) => s + r.total, 0)),
  };

  res.json({
    from: rangeStart,
    to: rangeEnd,
    branchId: branchFilter,
    summary,
    rows,
  });
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
