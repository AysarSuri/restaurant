import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  ordersTable,
  orderItemsTable,
  menuItemsTable,
  restaurantTablesTable,
  customersTable,
  employeesTable,
} from "@workspace/db/schema";
import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";

const router: IRouter = Router();

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const r = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${y}${m}${d}-${r}`;
}

async function getOrderWithDetails(orderId: number) {
  const [order] = await db
    .select({
      id: ordersTable.id,
      orderNumber: ordersTable.orderNumber,
      type: ordersTable.type,
      status: ordersTable.status,
      tableId: ordersTable.tableId,
      customerId: ordersTable.customerId,
      employeeId: ordersTable.employeeId,
      subtotal: ordersTable.subtotal,
      tax: ordersTable.tax,
      discount: ordersTable.discount,
      total: ordersTable.total,
      paymentMethod: ordersTable.paymentMethod,
      notes: ordersTable.notes,
      deliveryAddress: ordersTable.deliveryAddress,
      deliveryPhone: ordersTable.deliveryPhone,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order) return null;

  const items = await db
    .select({
      id: orderItemsTable.id,
      orderId: orderItemsTable.orderId,
      menuItemId: orderItemsTable.menuItemId,
      quantity: orderItemsTable.quantity,
      unitPrice: orderItemsTable.unitPrice,
      totalPrice: orderItemsTable.totalPrice,
      notes: orderItemsTable.notes,
      status: orderItemsTable.status,
      menuItem: menuItemsTable,
    })
    .from(orderItemsTable)
    .leftJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
    .where(eq(orderItemsTable.orderId, orderId));

  let table = null;
  if (order.tableId) {
    const [t] = await db.select().from(restaurantTablesTable).where(eq(restaurantTablesTable.id, order.tableId));
    table = t;
  }

  let customer = null;
  if (order.customerId) {
    const [c] = await db.select().from(customersTable).where(eq(customersTable.id, order.customerId));
    customer = c;
  }

  return { ...order, items, table, customer };
}

// GET /orders
router.get("/", async (req, res) => {
  const { status, type, date, limit = "50" } = req.query;

  const conditions = [];
  type OrderStatus = typeof ordersTable.status.enumValues[number];
  type OrderType = typeof ordersTable.type.enumValues[number];
  if (status) {
    const statusList = (status as string)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as OrderStatus[];
    if (statusList.length === 1) {
      conditions.push(eq(ordersTable.status, statusList[0]));
    } else if (statusList.length > 1) {
      conditions.push(inArray(ordersTable.status, statusList));
    }
  }
  if (type) conditions.push(eq(ordersTable.type, type as OrderType));
  if (date) {
    const d = new Date(date as string);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    conditions.push(gte(ordersTable.createdAt, start));
    conditions.push(lte(ordersTable.createdAt, end));
  }

  const orders = await db
    .select({
      id: ordersTable.id,
      orderNumber: ordersTable.orderNumber,
      type: ordersTable.type,
      status: ordersTable.status,
      tableId: ordersTable.tableId,
      customerId: ordersTable.customerId,
      employeeId: ordersTable.employeeId,
      subtotal: ordersTable.subtotal,
      tax: ordersTable.tax,
      discount: ordersTable.discount,
      total: ordersTable.total,
      paymentMethod: ordersTable.paymentMethod,
      notes: ordersTable.notes,
      deliveryAddress: ordersTable.deliveryAddress,
      deliveryPhone: ordersTable.deliveryPhone,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(parseInt(limit as string));

  // Enrich with items
  const enriched = await Promise.all(
    orders.map(async (o) => {
      const items = await db
        .select({
          id: orderItemsTable.id,
          orderId: orderItemsTable.orderId,
          menuItemId: orderItemsTable.menuItemId,
          quantity: orderItemsTable.quantity,
          unitPrice: orderItemsTable.unitPrice,
          totalPrice: orderItemsTable.totalPrice,
          notes: orderItemsTable.notes,
          status: orderItemsTable.status,
          menuItem: menuItemsTable,
        })
        .from(orderItemsTable)
        .leftJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
        .where(eq(orderItemsTable.orderId, o.id));

      let table = null;
      if (o.tableId) {
        const [t] = await db.select().from(restaurantTablesTable).where(eq(restaurantTablesTable.id, o.tableId));
        table = t;
      }
      let customer = null;
      if (o.customerId) {
        const [c] = await db.select().from(customersTable).where(eq(customersTable.id, o.customerId));
        customer = c;
      }

      return { ...o, items, table, customer };
    })
  );

  res.json(enriched);
});

// GET /orders/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const order = await getOrderWithDetails(id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(order);
});

// POST /orders
router.post("/", async (req, res) => {
  const { type, tableId, customerId, employeeId, items, discount, notes, deliveryAddress, deliveryPhone } = req.body;

  let subtotal = 0;
  const itemsWithPrice: { menuItemId: number; quantity: number; unitPrice: number; notes?: string }[] = [];

  for (const item of items) {
    const [menuItem] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, item.menuItemId));
    if (!menuItem) continue;
    const unitPrice = parseFloat(menuItem.price);
    subtotal += unitPrice * item.quantity;
    itemsWithPrice.push({ menuItemId: item.menuItemId, quantity: item.quantity, unitPrice, notes: item.notes });
  }

  const discountAmt = parseFloat(discount ?? 0);
  const tax = 0;
  const total = subtotal - discountAmt + tax;

  const [order] = await db
    .insert(ordersTable)
    .values({
      orderNumber: generateOrderNumber(),
      type,
      status: "pending",
      tableId: tableId ?? null,
      customerId: customerId ?? null,
      employeeId: employeeId ?? null,
      subtotal: subtotal.toString(),
      tax: tax.toString(),
      discount: discountAmt.toString(),
      total: total.toString(),
      notes,
      deliveryAddress,
      deliveryPhone,
    })
    .returning();

  // Insert items
  for (const item of itemsWithPrice) {
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      totalPrice: (item.unitPrice * item.quantity).toString(),
      notes: item.notes,
      status: "pending",
    });
  }

  // Update table status if dine_in
  if (type === "dine_in" && tableId) {
    await db.update(restaurantTablesTable).set({ status: "occupied" }).where(eq(restaurantTablesTable.id, tableId));
  }

  const full = await getOrderWithDetails(order.id);
  res.status(201).json(full);
});

// PUT /orders/:id
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { discount, notes, items } = req.body;

  if (items) {
    await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    let subtotal = 0;
    for (const item of items) {
      const [menuItem] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, item.menuItemId));
      if (!menuItem) continue;
      const unitPrice = parseFloat(menuItem.price);
      subtotal += unitPrice * item.quantity;
      await db.insert(orderItemsTable).values({
        orderId: id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: unitPrice.toString(),
        totalPrice: (unitPrice * item.quantity).toString(),
        notes: item.notes,
        status: "pending",
      });
    }
    const discountAmt = parseFloat(discount ?? 0);
    const total = subtotal - discountAmt;
    await db.update(ordersTable)
      .set({ subtotal: subtotal.toString(), discount: discountAmt.toString(), total: total.toString(), notes, updatedAt: new Date() })
      .where(eq(ordersTable.id, id));
  } else if (discount !== undefined || notes !== undefined) {
    await db.update(ordersTable).set({ discount: discount?.toString(), notes, updatedAt: new Date() }).where(eq(ordersTable.id, id));
  }

  const full = await getOrderWithDetails(id);
  res.json(full);
});

// PATCH /orders/:id/status
router.patch("/:id/status", async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;

  await db.update(ordersTable).set({ status, updatedAt: new Date() }).where(eq(ordersTable.id, id));

  // If served, free table
  if (status === "served" || status === "paid" || status === "cancelled") {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (order.tableId) {
      await db.update(restaurantTablesTable).set({ status: "available" }).where(eq(restaurantTablesTable.id, order.tableId));
    }
  }

  const full = await getOrderWithDetails(id);
  res.json(full);
});

// POST /orders/:id/pay
router.post("/:id/pay", async (req, res) => {
  const id = parseInt(req.params.id);
  const { paymentMethod, discount } = req.body;

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const discountAmt = discount !== undefined ? parseFloat(discount) : parseFloat(order.discount ?? "0");
  const subtotal = parseFloat(order.subtotal);
  const total = subtotal - discountAmt;

  await db.update(ordersTable)
    .set({ status: "paid", paymentMethod, discount: discountAmt.toString(), total: total.toString(), updatedAt: new Date() })
    .where(eq(ordersTable.id, id));

  // Free table
  if (order.tableId) {
    await db.update(restaurantTablesTable).set({ status: "available" }).where(eq(restaurantTablesTable.id, order.tableId));
  }

  // Update customer stats
  if (order.customerId) {
    await db.update(customersTable).set({
      totalOrders: sql`total_orders + 1`,
      totalSpent: sql`total_spent + ${total}`,
      loyaltyPoints: sql`loyalty_points + ${Math.floor(total / 1000)}`,
    }).where(eq(customersTable.id, order.customerId));
  }

  const full = await getOrderWithDetails(id);
  res.json(full);
});

export default router;
