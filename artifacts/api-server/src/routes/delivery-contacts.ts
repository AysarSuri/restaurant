import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { deliveryContactsTable, branchesTable } from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { parseBranchScope, resolveWriteBranchId } from "../lib/branch-scope";
import {
  normalizePhone,
  syncDeliveryContactsFromOrders,
} from "../lib/upsert-delivery-contact";

const router: IRouter = Router();

export { normalizePhone };

function parseCoord(value: unknown): string | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(7);
}

function serialize(row: typeof deliveryContactsTable.$inferSelect, branchName?: string | null) {
  return {
    ...row,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    branchName: branchName ?? null,
  };
}

router.get("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const { search } = req.query;
  /** Pull phones saved on delivery orders but missing from this list */
  try {
    await syncDeliveryContactsFromOrders();
  } catch {
    /* listing should still work if sync fails */
  }
  const rows = await db
    .select({
      contact: deliveryContactsTable,
      branchName: branchesTable.name,
    })
    .from(deliveryContactsTable)
    .leftJoin(branchesTable, eq(deliveryContactsTable.branchId, branchesTable.id))
    .orderBy(desc(deliveryContactsTable.updatedAt));

  let list = rows.map((r) => serialize(r.contact, r.branchName));
  if (scope.mode === "one") {
    list = list.filter((c) => !c.branchId || c.branchId === scope.branchId);
  }
  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    const qDigits = normalizePhone(q);
    list = list.filter(
      (c) =>
        c.phone.includes(qDigits) ||
        c.address.toLowerCase().includes(q) ||
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.gpsLabel ?? "").toLowerCase().includes(q)
    );
  }
  res.json(list);
});

router.get("/by-phone", async (req, res) => {
  const phone = normalizePhone(String(req.query.phone ?? ""));
  if (!phone || phone.replace(/\D/g, "").length < 7) {
    res.status(400).json({ success: false, message: "رقم الهاتف قصير جداً", found: false });
    return;
  }
  const [row] = await db
    .select()
    .from(deliveryContactsTable)
    .where(eq(deliveryContactsTable.phone, phone))
    .limit(1);
  if (!row) {
    res.json({ found: false, contact: null });
    return;
  }
  res.json({ found: true, contact: serialize(row) });
});

router.post("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const {
    phone,
    address,
    name,
    latitude,
    longitude,
    gpsLabel,
    note,
    branchId,
  } = req.body ?? {};

  const normalized = normalizePhone(String(phone ?? ""));
  if (!normalized || normalized.replace(/\D/g, "").length < 7) {
    res.status(400).json({ success: false, message: "رقم هاتف صالح مطلوب" });
    return;
  }

  const addr = String(address ?? "").trim();
  /** Explicit null = shared across all branches (POS). Else resolve from body/scope. */
  const resolvedBranchId =
    branchId === null
      ? null
      : resolveWriteBranchId(
          scope,
          branchId != null ? Number(branchId) : null
        );

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
        name: name != null ? String(name).trim() || null : existing.name,
        latitude: latitude !== undefined ? parseCoord(latitude) : existing.latitude,
        longitude: longitude !== undefined ? parseCoord(longitude) : existing.longitude,
        gpsLabel:
          gpsLabel !== undefined
            ? String(gpsLabel).trim() || null
            : existing.gpsLabel,
        note: note !== undefined ? String(note).trim() || null : existing.note,
        branchId:
          branchId === null ? null : resolvedBranchId ?? existing.branchId,
        updatedAt: new Date(),
      })
      .where(eq(deliveryContactsTable.id, existing.id))
      .returning();
    res.json(serialize(updated));
    return;
  }

  const [created] = await db
    .insert(deliveryContactsTable)
    .values({
      phone: normalized,
      address: addr,
      name: name ? String(name).trim() : null,
      latitude: parseCoord(latitude),
      longitude: parseCoord(longitude),
      gpsLabel: gpsLabel ? String(gpsLabel).trim() : null,
      note: note ? String(note).trim() : null,
      branchId: resolvedBranchId,
    })
    .returning();

  res.status(201).json(serialize(created));
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const {
    phone,
    address,
    name,
    latitude,
    longitude,
    gpsLabel,
    note,
    branchId,
  } = req.body ?? {};

  const [existing] = await db
    .select()
    .from(deliveryContactsTable)
    .where(eq(deliveryContactsTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "غير موجود" });
    return;
  }

  let nextPhone = existing.phone;
  if (phone != null) {
    nextPhone = normalizePhone(String(phone));
    if (!nextPhone || nextPhone.replace(/\D/g, "").length < 7) {
      res.status(400).json({ success: false, message: "رقم هاتف صالح مطلوب" });
      return;
    }
    if (nextPhone !== existing.phone) {
      const [dup] = await db
        .select({ id: deliveryContactsTable.id })
        .from(deliveryContactsTable)
        .where(
          and(
            eq(deliveryContactsTable.phone, nextPhone),
            sql`${deliveryContactsTable.id} <> ${id}`
          )
        )
        .limit(1);
      if (dup) {
        res.status(400).json({ success: false, message: "رقم الهاتف مستخدم مسبقاً" });
        return;
      }
    }
  }

  const [updated] = await db
    .update(deliveryContactsTable)
    .set({
      phone: nextPhone,
      address: address != null ? String(address).trim() : existing.address,
      name: name !== undefined ? String(name ?? "").trim() || null : existing.name,
      latitude: latitude !== undefined ? parseCoord(latitude) : existing.latitude,
      longitude: longitude !== undefined ? parseCoord(longitude) : existing.longitude,
      gpsLabel:
        gpsLabel !== undefined ? String(gpsLabel ?? "").trim() || null : existing.gpsLabel,
      note: note !== undefined ? String(note ?? "").trim() || null : existing.note,
      branchId:
        branchId === null
          ? null
          : branchId != null
            ? Number(branchId)
            : existing.branchId,
      updatedAt: new Date(),
    })
    .where(eq(deliveryContactsTable.id, id))
    .returning();

  res.json(serialize(updated));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(deliveryContactsTable).where(eq(deliveryContactsTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
