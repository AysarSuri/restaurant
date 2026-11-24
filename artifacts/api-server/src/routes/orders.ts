import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  ordersTable,
  orderItemsTable,
  menuItemsTable,
  restaurantTablesTable,
  customersTable,
  employeesTable,
  appSettingsTable,
  devicePrintersTable,
} from "@workspace/db/schema";
import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";
import { parseBranchScope, branchEq, resolveWriteBranchId } from "../lib/branch-scope";
import { ensureSalesDeviceColumns } from "../lib/ensure-sales-columns";
import {
  isOrderPaymentReceived,
  syncRestaurantSeatFromOrders,
} from "../lib/seat-sync";

type SalesPaymentAt = "pos" | "cashier";
type OrderTypeKey = "dine_in" | "takeaway" | "delivery";

function normalizeOrderType(value: unknown): OrderTypeKey {
  const t = String(value ?? "").trim().toLowerCase();
  if (t === "takeaway") return "takeaway";
  if (t === "delivery") return "delivery";
  return "dine_in";
}

function paymentAtFromDevice(
  device: {
    salesPaymentAt?: string | null;
    salesPaymentAtDineIn?: string | null;
    salesPaymentAtTakeaway?: string | null;
    salesPaymentAtDelivery?: string | null;
  },
  orderType: OrderTypeKey
): SalesPaymentAt {
  const legacy = device.salesPaymentAt === "cashier" ? "cashier" : "pos";
  const byType =
    orderType === "takeaway"
      ? device.salesPaymentAtTakeaway
      : orderType === "delivery"
        ? device.salesPaymentAtDelivery
        : device.salesPaymentAtDineIn;
  if (byType == null || String(byType).trim() === "") return legacy;
  return String(byType).trim().toLowerCase() === "cashier" ? "cashier" : "pos";
}

async function resolveDeviceSalesRouting(
  deviceKey?: string | null,
  orderType?: unknown
) {
  const type = normalizeOrderType(orderType);
  const key = String(deviceKey ?? "").trim();
  if (key) {
    const [device] = await db
      .select({
        salesPaymentAt: devicePrintersTable.salesPaymentAt,
        salesPaymentAtDineIn: devicePrintersTable.salesPaymentAtDineIn,
        salesPaymentAtTakeaway: devicePrintersTable.salesPaymentAtTakeaway,
        salesPaymentAtDelivery: devicePrintersTable.salesPaymentAtDelivery,
        salesSendToKitchen: devicePrintersTable.salesSendToKitchen,
      })
      .from(devicePrintersTable)
      .where(eq(devicePrintersTable.deviceKey, key))
      .limit(1);
    if (device) {
      return {
        paymentAt: paymentAtFromDevice(device, type),
        sendToKitchen: device.salesSendToKitchen !== false,
      };
    }
  }

  const [settings] = await db.select().from(appSettingsTable).limit(1);
  const posSaveTarget = settings?.posSaveTarget === "none" ? "none" : "kitchen";
  return {
    paymentAt: "pos" as SalesPaymentAt,
    sendToKitchen: posSaveTarget !== "none",
  };
}

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
      branchId: ordersTable.branchId,
      tableId: ordersTable.tableId,
      customerId: ordersTable.customerId,
      employeeId: ordersTable.employeeId,
      driverId: ordersTable.driverId,
      subtotal: ordersTable.subtotal,
      tax: ordersTable.tax,
      discount: ordersTable.discount,
      deliveryFee: ordersTable.deliveryFee,
      total: ordersTable.total,
      paymentMethod: ordersTable.paymentMethod,
      collectAtCashier: ordersTable.collectAtCashier,
      posEditedAt: ordersTable.posEditedAt,
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
  const scope = parseBranchScope(req);

  const conditions = [];
  type OrderStatus = typeof ordersTable.status.enumValues[number];
  type OrderType = typeof ordersTable.type.enumValues[number];
  const branchCond = branchEq(ordersTable.branchId, scope);
  if (branchCond) conditions.push(branchCond);
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
      branchId: ordersTable.branchId,
      tableId: ordersTable.tableId,
      customerId: ordersTable.customerId,
      employeeId: ordersTable.employeeId,
      driverId: ordersTable.driverId,
      subtotal: ordersTable.subtotal,
      tax: ordersTable.tax,
      discount: ordersTable.discount,
      deliveryFee: ordersTable.deliveryFee,
      total: ordersTable.total,
      paymentMethod: ordersTable.paymentMethod,
      collectAtCashier: ordersTable.collectAtCashier,
      posEditedAt: ordersTable.posEditedAt,
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
  await ensureSalesDeviceColumns();
  const scope = parseBranchScope(req);
  const {
    type,
    tableId,
    customerId,
    employeeId,
    items,
    discount,
    notes,
    deliveryAddress,
    deliveryPhone,
    deliveryFee,
    driverId,
    branchId,
    paymentMethod,
    deviceKey,
  } = req.body;

  const resolvedBranchId = resolveWriteBranchId(scope, branchId);
  if (!resolvedBranchId) {
    res.status(400).json({ error: "اختر فرعاً قبل إنشاء طلب" });
    return;
  }

  if (type === "delivery") {
    const [salesSettings] = await db.select().from(appSettingsTable).limit(1);
    const requireDriver = salesSettings?.deliveryRequireDriver !== false;
    const requirePhone = salesSettings?.deliveryRequirePhone !== false;
    const requireAddress = salesSettings?.deliveryRequireAddress !== false;
    const phoneDigits = String(deliveryPhone ?? "").replace(/\D/g, "");
    const address = String(deliveryAddress ?? "").trim();
    const driverOk =
      driverId != null && Number.isFinite(Number(driverId)) && Number(driverId) > 0;
    if (requireDriver && !driverOk) {
      res.status(400).json({ error: "اختر السائق لطلب التوصيل" });
      return;
    }
    if (requirePhone && phoneDigits.length < 7) {
      res.status(400).json({ error: "رقم الموبايل مطلوب لطلب التوصيل" });
      return;
    }
    if (requireAddress && !address) {
      res.status(400).json({ error: "عنوان التوصيل مطلوب" });
      return;
    }
  }

  let subtotal = 0;
  const itemsWithPrice: { menuItemId: number; quantity: number; unitPrice: number; notes?: string }[] = [];

  for (const item of items) {
    const [menuItem] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, item.menuItemId));
    if (!menuItem) continue;
    const unitPrice = parseFloat(menuItem.price);
    subtotal += unitPrice * item.quantity;
    itemsWithPrice.push({ menuItemId: item.menuItemId, quantity: item.quantity, unitPrice, notes: item.notes });
  }

  const discountAmt = parseFloat(discount ?? 0) || 0;
  const tax = 0;
  let deliveryFeeAmt = 0;
  if (type === "delivery") {
    if (deliveryFee != null && Number.isFinite(Number(deliveryFee))) {
      deliveryFeeAmt = Math.max(0, Number(deliveryFee));
    } else {
      const [settings] = await db.select().from(appSettingsTable).limit(1);
      deliveryFeeAmt = Math.max(0, parseFloat(String(settings?.deliveryFee ?? "0")) || 0);
    }
  }
  const total = subtotal - discountAmt + tax + deliveryFeeAmt;

  const routing = await resolveDeviceSalesRouting(deviceKey, type);
  const validPay =
    paymentMethod === "cash" || paymentMethod === "card" || paymentMethod === "transfer"
      ? paymentMethod
      : undefined;

  const collectAtCashier = routing.paymentAt === "cashier" && !validPay;
  let initialStatus: "pending" | "preparing" | "paid" = "pending";
  if (collectAtCashier) {
    initialStatus = routing.sendToKitchen ? "preparing" : "pending";
  } else if (routing.sendToKitchen) {
    initialStatus = "preparing";
  } else {
    initialStatus = validPay ? "paid" : "pending";
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      orderNumber: generateOrderNumber(),
      type,
      status: initialStatus,
      branchId: resolvedBranchId,
      tableId: tableId ?? null,
      customerId: customerId ?? null,
      employeeId: employeeId ?? null,
      subtotal: subtotal.toString(),
      tax: tax.toString(),
      discount: discountAmt.toString(),
      deliveryFee: deliveryFeeAmt.toString(),
      total: total.toString(),
      notes,
      deliveryAddress,
      deliveryPhone,
      driverId:
        type === "delivery" && driverId != null && Number.isFinite(Number(driverId))
          ? Number(driverId)
          : null,
      paymentMethod: collectAtCashier ? null : validPay,
      collectAtCashier,
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

  // Seat: غير واصل dine-in → occupied; واصل at create → available
  if (type === "dine_in" && tableId) {
    await syncRestaurantSeatFromOrders(tableId);
  }

  const full = await getOrderWithDetails(order.id);
  res.status(201).json(full);
});

// PUT /orders/:id
router.put("/:id", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id);
  const { discount, notes, items, deliveryFee } = req.body;

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

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
    const discountAmt =
      discount !== undefined ? parseFloat(discount) || 0 : parseFloat(existing.discount ?? "0") || 0;
    let deliveryFeeAmt = parseFloat(existing.deliveryFee ?? "0") || 0;
    if (existing.type === "delivery") {
      if (deliveryFee != null && Number.isFinite(Number(deliveryFee))) {
        deliveryFeeAmt = Math.max(0, Number(deliveryFee));
      }
    } else {
      deliveryFeeAmt = 0;
    }
    const total = subtotal - discountAmt + deliveryFeeAmt;
    const editedAt = new Date();
    await db.update(ordersTable)
      .set({
        subtotal: subtotal.toString(),
        discount: discountAmt.toString(),
        deliveryFee: deliveryFeeAmt.toString(),
        total: total.toString(),
        notes,
        posEditedAt: editedAt,
        updatedAt: editedAt,
      })
      .where(eq(ordersTable.id, id));
  } else if (discount !== undefined || notes !== undefined || deliveryFee !== undefined) {
    const discountAmt =
      discount !== undefined ? parseFloat(discount) || 0 : parseFloat(existing.discount ?? "0") || 0;
    let deliveryFeeAmt = parseFloat(existing.deliveryFee ?? "0") || 0;
    if (existing.type === "delivery" && deliveryFee != null && Number.isFinite(Number(deliveryFee))) {
      deliveryFeeAmt = Math.max(0, Number(deliveryFee));
    }
    const subtotal = parseFloat(existing.subtotal) || 0;
    const total = subtotal - discountAmt + deliveryFeeAmt;
    const editedAt = new Date();
    await db
      .update(ordersTable)
      .set({
        discount: discountAmt.toString(),
        deliveryFee: deliveryFeeAmt.toString(),
        total: total.toString(),
        notes: notes !== undefined ? notes : existing.notes,
        posEditedAt: editedAt,
        updatedAt: editedAt,
      })
      .where(eq(ordersTable.id, id));
  }

  const full = await getOrderWithDetails(id);
  res.json(full);
});

// PATCH /orders/:id/status
router.patch("/:id/status", async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, paymentMethod, clearPayment, discount } = req.body;

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (clearPayment === true) {
    // Move invoice back to غير واصل (cashier unpaid board)
    patch.paymentMethod = null;
    patch.collectAtCashier = true;
    if (typeof status === "string" && status) {
      patch.status = status;
    } else if (order.status === "paid" || order.status === "served") {
      // Keep kitchen-friendly open status when undoing a paid-only mark
      patch.status = "preparing";
    }
  } else {
    if (typeof status === "string" && status) patch.status = status;
    if (paymentMethod === "cash" || paymentMethod === "card" || paymentMethod === "transfer") {
      patch.paymentMethod = paymentMethod;
      patch.collectAtCashier = false;
    }
    // Allow cashier/POS to set invoice discount at collect time
    if (discount !== undefined && discount !== null) {
      const subtotal = parseFloat(String(order.subtotal ?? "0")) || 0;
      const deliveryFeeAmt = parseFloat(String(order.deliveryFee ?? "0")) || 0;
      const taxAmt = parseFloat(String(order.tax ?? "0")) || 0;
      const discountAmt = Math.max(0, parseFloat(String(discount)) || 0);
      const capped = Math.min(discountAmt, subtotal > 0 ? subtotal : discountAmt);
      patch.discount = capped.toString();
      patch.total = Math.max(0, subtotal - capped + deliveryFeeAmt + taxAmt).toString();
    }
  }

  await db.update(ordersTable).set(patch).where(eq(ordersTable.id, id));

  const nextStatus = String(patch.status ?? order.status);
  const nextPay =
    clearPayment === true
      ? null
      : paymentMethod === "cash" || paymentMethod === "card" || paymentMethod === "transfer"
        ? paymentMethod
        : order.paymentMethod;
  const paymentChanged =
    clearPayment === true ||
    paymentMethod === "cash" ||
    paymentMethod === "card" ||
    paymentMethod === "transfer";
  const seatRelevant =
    order.tableId != null &&
    order.type === "dine_in" &&
    (paymentChanged ||
      nextStatus === "cancelled" ||
      nextStatus === "paid" ||
      isOrderPaymentReceived({ paymentMethod: nextPay, status: nextStatus }) !==
        isOrderPaymentReceived(order));

  // Do NOT free seat on kitchen "served" alone — only payment / cancel sync
  if (seatRelevant) {
    await syncRestaurantSeatFromOrders(order.tableId);
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
  const deliveryFeeAmt = parseFloat(order.deliveryFee ?? "0") || 0;
  const total = subtotal - discountAmt + deliveryFeeAmt;

  await db.update(ordersTable)
    .set({ status: "paid", paymentMethod, discount: discountAmt.toString(), total: total.toString(), updatedAt: new Date() })
    .where(eq(ordersTable.id, id));

  // واصل → sync seat (available if no other unpaid dine-in on this seat)
  if (order.tableId && order.type === "dine_in") {
    await syncRestaurantSeatFromOrders(order.tableId);
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
