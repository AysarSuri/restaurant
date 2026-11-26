import { db } from "@workspace/db";
import { deliveryContactsTable, ordersTable } from "@workspace/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";

/** Keep digits only (and leading + if present). */
export function normalizePhone(phone: string): string {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Upsert a delivery contact from POS / order payload.
 * Always shared across branches (branchId = null) so every branch sees it.
 * Returns the saved row, or null when phone is too short.
 */
export async function upsertDeliveryContactFromOrder(input: {
  phone?: string | null;
  address?: string | null;
  name?: string | null;
}): Promise<typeof deliveryContactsTable.$inferSelect | null> {
  const normalized = normalizePhone(String(input.phone ?? ""));
  if (!normalized || normalized.replace(/\D/g, "").length < 7) return null;

  const addr = String(input.address ?? "").trim();
  const name =
    input.name != null && String(input.name).trim()
      ? String(input.name).trim()
      : null;

  const [existing] = await db
    .select()
    .from(deliveryContactsTable)
    .where(eq(deliveryContactsTable.phone, normalized))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(deliveryContactsTable)
      .set({
        address: addr || existing.address,
        name: name ?? existing.name,
        /** Shared for all branches */
        branchId: null,
        updatedAt: new Date(),
      })
      .where(eq(deliveryContactsTable.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(deliveryContactsTable)
    .values({
      phone: normalized,
      address: addr,
      name,
      branchId: null,
    })
    .returning();
  return created ?? null;
}

/**
 * Backfill delivery_contacts from delivery orders that have a phone
 * but were never saved to the contacts list (e.g. client upsert failed).
 */
export async function syncDeliveryContactsFromOrders(): Promise<number> {
  const rows = await db
    .select({
      phone: ordersTable.deliveryPhone,
      address: ordersTable.deliveryAddress,
    })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.type, "delivery"),
        isNotNull(ordersTable.deliveryPhone),
        sql`btrim(${ordersTable.deliveryPhone}) <> ''`
      )
    )
    .orderBy(sql`${ordersTable.createdAt} desc`);

  const seen = new Set<string>();
  let added = 0;
  for (const row of rows) {
    const normalized = normalizePhone(String(row.phone ?? ""));
    if (!normalized || normalized.replace(/\D/g, "").length < 7) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const before = await db
      .select({ id: deliveryContactsTable.id })
      .from(deliveryContactsTable)
      .where(eq(deliveryContactsTable.phone, normalized))
      .limit(1);

    await upsertDeliveryContactFromOrder({
      phone: normalized,
      address: row.address,
    });
    if (before.length === 0) added += 1;
  }
  return added;
}
