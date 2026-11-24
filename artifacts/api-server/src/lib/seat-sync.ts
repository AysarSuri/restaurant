import { db } from "@workspace/db";
import { ordersTable, restaurantTablesTable } from "@workspace/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";

/** Matches cashier واصل: payment method or status paid (not kitchen served). */
export function isOrderPaymentReceived(order: {
  paymentMethod?: string | null;
  status?: string | null;
}) {
  if (order.paymentMethod) return true;
  return order.status === "paid";
}

/**
 * Sync table/room/person seat from open غير واصل dine-in invoices:
 * - any unpaid dine-in on this seat → occupied (مشغول / red)
 * - otherwise → available (متاح / green)
 *
 * Call on payment-related order events only (create/pay/clear/cancel),
 * not on kitchen ready/served alone.
 */
export async function syncRestaurantSeatFromOrders(
  tableId: number | null | undefined
) {
  if (tableId == null || !Number.isFinite(Number(tableId))) return;
  const id = Number(tableId);

  const unpaid = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.tableId, id),
        eq(ordersTable.type, "dine_in"),
        ne(ordersTable.status, "cancelled"),
        ne(ordersTable.status, "paid"),
        isNull(ordersTable.paymentMethod)
      )
    )
    .limit(1);

  const nextStatus = unpaid.length > 0 ? "occupied" : "available";
  await db
    .update(restaurantTablesTable)
    .set({ status: nextStatus })
    .where(eq(restaurantTablesTable.id, id));
}
