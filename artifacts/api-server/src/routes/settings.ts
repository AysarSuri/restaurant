import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable, devicePrintersTable, branchesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { parseBranchScope, resolveWriteBranchId } from "../lib/branch-scope";

const router: IRouter = Router();

const DEFAULT_SETTINGS = {
  restaurantName: "المطعم الذكي",
  themePrimary: "38 92% 50%",
};

async function getOrCreateSettings() {
  const [existing] = await db.select().from(appSettingsTable).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(appSettingsTable)
    .values({
      restaurantName: DEFAULT_SETTINGS.restaurantName,
      themePrimary: DEFAULT_SETTINGS.themePrimary,
    })
    .returning();
  return created;
}

function isValidThemePrimary(value: string) {
  // Accept "H S% L%" e.g. "38 92% 50%" or "210 90% 48%"
  return /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(value.trim());
}

router.get("/", async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json({
    restaurantName: settings.restaurantName,
    themePrimary: settings.themePrimary,
    updatedAt: settings.updatedAt,
  });
});

router.put("/", async (req, res) => {
  const settings = await getOrCreateSettings();
  const { restaurantName, themePrimary } = req.body ?? {};

  const nextName =
    restaurantName != null ? String(restaurantName).trim() : settings.restaurantName;
  if (!nextName) {
    res.status(400).json({ success: false, message: "اسم المطعم مطلوب" });
    return;
  }

  let nextTheme = settings.themePrimary;
  if (themePrimary != null) {
    const t = String(themePrimary).trim();
    if (!isValidThemePrimary(t)) {
      res.status(400).json({
        success: false,
        message: "صيغة لون الثيم غير صالحة (مثال: 38 92% 50%)",
      });
      return;
    }
    nextTheme = t;
  }

  const [updated] = await db
    .update(appSettingsTable)
    .set({
      restaurantName: nextName,
      themePrimary: nextTheme,
      updatedAt: new Date(),
    })
    .where(eq(appSettingsTable.id, settings.id))
    .returning();

  res.json({
    restaurantName: updated.restaurantName,
    themePrimary: updated.themePrimary,
    updatedAt: updated.updatedAt,
  });
});

router.get("/printers", async (req, res) => {
  const scope = parseBranchScope(req);
  const rows = await db
    .select({
      id: devicePrintersTable.id,
      branchId: devicePrintersTable.branchId,
      deviceKey: devicePrintersTable.deviceKey,
      deviceName: devicePrintersTable.deviceName,
      printerName: devicePrintersTable.printerName,
      paperSize: devicePrintersTable.paperSize,
      isActive: devicePrintersTable.isActive,
      note: devicePrintersTable.note,
      createdAt: devicePrintersTable.createdAt,
      updatedAt: devicePrintersTable.updatedAt,
      branchName: branchesTable.name,
    })
    .from(devicePrintersTable)
    .leftJoin(branchesTable, eq(devicePrintersTable.branchId, branchesTable.id))
    .orderBy(desc(devicePrintersTable.updatedAt));

  const filtered =
    scope.mode === "one"
      ? rows.filter((r) => r.branchId === scope.branchId)
      : rows;

  res.json(filtered);
});

router.post("/printers", async (req, res) => {
  const scope = parseBranchScope(req);
  const { deviceKey, deviceName, printerName, branchId, note, isActive } = req.body ?? {};

  const key = String(deviceKey ?? "").trim();
  const name = String(deviceName ?? "").trim();
  if (!key || !name) {
    res.status(400).json({ success: false, message: "معرف الجهاز واسم الجهاز مطلوبان" });
    return;
  }

  const resolvedBranchId = resolveWriteBranchId(scope, branchId != null ? Number(branchId) : null);
  const printer = String(printerName ?? "").trim();

  const [existing] = await db
    .select()
    .from(devicePrintersTable)
    .where(eq(devicePrintersTable.deviceKey, key))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(devicePrintersTable)
      .set({
        deviceName: name,
        printerName: printer,
        branchId: resolvedBranchId ?? existing.branchId,
        paperSize: "80x80",
        note: note != null ? String(note).trim() || null : existing.note,
        isActive: isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(devicePrintersTable.id, existing.id))
      .returning();

    let branchName: string | null = null;
    if (updated.branchId) {
      const [b] = await db
        .select({ name: branchesTable.name })
        .from(branchesTable)
        .where(eq(branchesTable.id, updated.branchId));
      branchName = b?.name ?? null;
    }
    res.json({ ...updated, branchName });
    return;
  }

  const [created] = await db
    .insert(devicePrintersTable)
    .values({
      deviceKey: key,
      deviceName: name,
      printerName: printer,
      branchId: resolvedBranchId,
      paperSize: "80x80",
      note: note ? String(note).trim() : null,
      isActive: isActive ?? true,
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

  res.status(201).json({ ...created, branchName });
});

router.put("/printers/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { deviceName, printerName, branchId, note, isActive } = req.body ?? {};

  const [existing] = await db
    .select()
    .from(devicePrintersTable)
    .where(eq(devicePrintersTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "الجهاز غير موجود" });
    return;
  }

  const name = deviceName != null ? String(deviceName).trim() : existing.deviceName;
  if (!name) {
    res.status(400).json({ success: false, message: "اسم الجهاز مطلوب" });
    return;
  }

  const [updated] = await db
    .update(devicePrintersTable)
    .set({
      deviceName: name,
      printerName: printerName != null ? String(printerName).trim() : existing.printerName,
      branchId:
        branchId === null
          ? null
          : branchId != null
            ? Number(branchId)
            : existing.branchId,
      paperSize: "80x80",
      note: note != null ? String(note).trim() || null : existing.note,
      isActive: isActive ?? existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(devicePrintersTable.id, id))
    .returning();

  let branchName: string | null = null;
  if (updated.branchId) {
    const [b] = await db
      .select({ name: branchesTable.name })
      .from(branchesTable)
      .where(eq(branchesTable.id, updated.branchId));
    branchName = b?.name ?? null;
  }

  res.json({ ...updated, branchName });
});

router.delete("/printers/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(devicePrintersTable).where(eq(devicePrintersTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
