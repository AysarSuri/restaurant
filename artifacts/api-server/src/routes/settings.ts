import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable, devicePrintersTable, branchesTable } from "@workspace/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { parseBranchScope, resolveWriteBranchId } from "../lib/branch-scope";
import { ensureSalesDeviceColumns } from "../lib/ensure-sales-columns";

/** Keep a single printer row per deviceKey (delete older duplicates). */
async function keepSinglePrinterForDevice(deviceKey: string, keepId?: number) {
  const rows = await db
    .select({ id: devicePrintersTable.id })
    .from(devicePrintersTable)
    .where(eq(devicePrintersTable.deviceKey, deviceKey))
    .orderBy(desc(devicePrintersTable.updatedAt));
  if (rows.length <= 1) return rows[0]?.id ?? keepId ?? null;
  const primaryId = keepId && rows.some((r) => r.id === keepId) ? keepId : rows[0].id;
  const dupeIds = rows.filter((r) => r.id !== primaryId).map((r) => r.id);
  if (dupeIds.length > 0) {
    await db.delete(devicePrintersTable).where(inArray(devicePrintersTable.id, dupeIds));
  }
  return primaryId;
}

const router: IRouter = Router();

const DEFAULT_SETTINGS = {
  restaurantName: "المطعم الذكي",
  themePrimary: "38 92% 50%",
  currencyCode: "iqd",
  currencySymbol: "د.ع",
  currencyName: "دينار عراقي",
  decimalPlaces: 0,
  posSaveTarget: "kitchen" as const,
  cashierSendToKitchen: true,
  deliveryFee: "0",
};

const POS_SAVE_TARGETS = new Set(["kitchen", "none"]);

const CURRENCY_PRESETS: Record<
  string,
  { symbol: string; name: string; decimalPlaces: number }
> = {
  iqd: { symbol: "د.ع", name: "دينار عراقي", decimalPlaces: 0 },
  usd: { symbol: "$", name: "دولار أمريكي", decimalPlaces: 2 },
  eur: { symbol: "€", name: "يورو", decimalPlaces: 2 },
};

async function getOrCreateSettings() {
  const [existing] = await db.select().from(appSettingsTable).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(appSettingsTable)
    .values({
      restaurantName: DEFAULT_SETTINGS.restaurantName,
      themePrimary: DEFAULT_SETTINGS.themePrimary,
      currencyCode: DEFAULT_SETTINGS.currencyCode,
      currencySymbol: DEFAULT_SETTINGS.currencySymbol,
      currencyName: DEFAULT_SETTINGS.currencyName,
      decimalPlaces: DEFAULT_SETTINGS.decimalPlaces,
      posSaveTarget: DEFAULT_SETTINGS.posSaveTarget,
      cashierSendToKitchen: DEFAULT_SETTINGS.cashierSendToKitchen,
    })
    .returning();
  return created;
}

function isValidThemePrimary(value: string) {
  // Accept "H S% L%" e.g. "38 92% 50%" or "210 90% 48%"
  return /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(value.trim());
}

function clampDecimals(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(4, Math.max(0, Math.floor(n)));
}

function serializeSettings(settings: typeof appSettingsTable.$inferSelect) {
  const target = settings.posSaveTarget === "none" ? "none" : "kitchen";
  const deliveryFee = Math.max(0, parseFloat(String(settings.deliveryFee ?? "0")) || 0);
  return {
    restaurantName: settings.restaurantName,
    logoUrl: settings.logoUrl ?? null,
    mobile: settings.mobile ?? null,
    themePrimary: settings.themePrimary,
    currencyCode: settings.currencyCode,
    currencySymbol: settings.currencySymbol,
    currencyName: settings.currencyName,
    decimalPlaces: settings.decimalPlaces,
    posSaveTarget: target as "kitchen" | "none",
    cashierSendToKitchen: settings.cashierSendToKitchen !== false,
    deliveryFee,
    updatedAt: settings.updatedAt,
  };
}

router.get("/", async (_req, res) => {
  await ensureSalesDeviceColumns();
  const settings = await getOrCreateSettings();
  res.json(serializeSettings(settings));
});

router.put("/", async (req, res) => {
  await ensureSalesDeviceColumns();
  const settings = await getOrCreateSettings();
  const {
    restaurantName,
    logoUrl,
    mobile,
    themePrimary,
    currencyCode,
    currencySymbol,
    currencyName,
    decimalPlaces,
    posSaveTarget,
    cashierSendToKitchen,
    deliveryFee,
  } = req.body ?? {};

  const nextName =
    restaurantName != null ? String(restaurantName).trim() : settings.restaurantName;
  if (!nextName) {
    res.status(400).json({ success: false, message: "اسم المطعم أو الكافتيريا مطلوب" });
    return;
  }

  let nextLogoUrl = settings.logoUrl ?? null;
  if (logoUrl !== undefined) {
    const raw = logoUrl == null ? "" : String(logoUrl).trim();
    nextLogoUrl = raw || null;
  }

  let nextMobile = settings.mobile ?? null;
  if (mobile !== undefined) {
    const raw = mobile == null ? "" : String(mobile).trim();
    nextMobile = raw || null;
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

  let nextCurrencyCode = settings.currencyCode;
  let nextCurrencySymbol = settings.currencySymbol;
  let nextCurrencyName = settings.currencyName;
  let nextDecimals = settings.decimalPlaces;

  if (currencyCode != null) {
    const code = String(currencyCode).trim().toLowerCase();
    if (!["iqd", "usd", "eur", "custom"].includes(code)) {
      res.status(400).json({ success: false, message: "عملة غير صالحة" });
      return;
    }
    nextCurrencyCode = code;
    if (code !== "custom" && CURRENCY_PRESETS[code]) {
      nextCurrencySymbol = CURRENCY_PRESETS[code].symbol;
      nextCurrencyName = CURRENCY_PRESETS[code].name;
      if (decimalPlaces == null) {
        nextDecimals = CURRENCY_PRESETS[code].decimalPlaces;
      }
    }
  }

  if (currencySymbol != null) {
    const s = String(currencySymbol).trim();
    if (!s) {
      res.status(400).json({ success: false, message: "رمز العملة مطلوب" });
      return;
    }
    nextCurrencySymbol = s;
  }
  if (currencyName != null) {
    const n = String(currencyName).trim();
    if (!n) {
      res.status(400).json({ success: false, message: "اسم العملة مطلوب" });
      return;
    }
    nextCurrencyName = n;
  }
  if (decimalPlaces != null) {
    nextDecimals = clampDecimals(decimalPlaces, settings.decimalPlaces);
  }

  let nextPosSaveTarget =
    settings.posSaveTarget === "none" ? "none" : DEFAULT_SETTINGS.posSaveTarget;
  if (posSaveTarget != null) {
    const t = String(posSaveTarget).trim().toLowerCase();
    if (!POS_SAVE_TARGETS.has(t)) {
      res.status(400).json({
        success: false,
        message: "وجهة الحفظ غير صالحة (kitchen أو none)",
      });
      return;
    }
    nextPosSaveTarget = t;
  }

  let nextCashierSend =
    settings.cashierSendToKitchen !== false ? true : false;
  if (cashierSendToKitchen != null) {
    nextCashierSend = Boolean(cashierSendToKitchen);
  }

  let nextDeliveryFee = Math.max(0, parseFloat(String(settings.deliveryFee ?? "0")) || 0);
  if (deliveryFee != null) {
    const n = Number(deliveryFee);
    if (!Number.isFinite(n) || n < 0) {
      res.status(400).json({ success: false, message: "مبلغ التوصيل غير صالح" });
      return;
    }
    nextDeliveryFee = n;
  }

  const [updated] = await db
    .update(appSettingsTable)
    .set({
      restaurantName: nextName,
      logoUrl: nextLogoUrl,
      mobile: nextMobile,
      themePrimary: nextTheme,
      currencyCode: nextCurrencyCode,
      currencySymbol: nextCurrencySymbol,
      currencyName: nextCurrencyName,
      decimalPlaces: nextDecimals,
      posSaveTarget: nextPosSaveTarget,
      cashierSendToKitchen: nextCashierSend,
      deliveryFee: nextDeliveryFee.toString(),
      updatedAt: new Date(),
    })
    .where(eq(appSettingsTable.id, settings.id))
    .returning();

  res.json(serializeSettings(updated));
});

function normalizeSalesPaymentAt(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "cashier" ? "cashier" : "pos";
}

function withSalesDefaults<T extends Record<string, unknown>>(row: T) {
  const legacy = normalizeSalesPaymentAt(row.salesPaymentAt);
  const dineIn = row.salesPaymentAtDineIn != null
    ? normalizeSalesPaymentAt(row.salesPaymentAtDineIn)
    : legacy;
  const takeaway = row.salesPaymentAtTakeaway != null
    ? normalizeSalesPaymentAt(row.salesPaymentAtTakeaway)
    : legacy;
  const delivery = row.salesPaymentAtDelivery != null
    ? normalizeSalesPaymentAt(row.salesPaymentAtDelivery)
    : legacy;
  return {
    ...row,
    salesPaymentAt: legacy,
    salesPaymentAtDineIn: dineIn,
    salesPaymentAtTakeaway: takeaway,
    salesPaymentAtDelivery: delivery,
    salesSendToKitchen: row.salesSendToKitchen !== false,
  };
}

function pickPaymentFields(
  body: Record<string, unknown>,
  existing?: {
    salesPaymentAt?: string | null;
    salesPaymentAtDineIn?: string | null;
    salesPaymentAtTakeaway?: string | null;
    salesPaymentAtDelivery?: string | null;
  }
) {
  const legacyFallback = normalizeSalesPaymentAt(existing?.salesPaymentAt ?? "pos");
  const dineIn =
    body.salesPaymentAtDineIn != null
      ? normalizeSalesPaymentAt(body.salesPaymentAtDineIn)
      : existing?.salesPaymentAtDineIn != null
        ? normalizeSalesPaymentAt(existing.salesPaymentAtDineIn)
        : body.salesPaymentAt != null
          ? normalizeSalesPaymentAt(body.salesPaymentAt)
          : legacyFallback;
  const takeaway =
    body.salesPaymentAtTakeaway != null
      ? normalizeSalesPaymentAt(body.salesPaymentAtTakeaway)
      : existing?.salesPaymentAtTakeaway != null
        ? normalizeSalesPaymentAt(existing.salesPaymentAtTakeaway)
        : body.salesPaymentAt != null
          ? normalizeSalesPaymentAt(body.salesPaymentAt)
          : legacyFallback;
  const delivery =
    body.salesPaymentAtDelivery != null
      ? normalizeSalesPaymentAt(body.salesPaymentAtDelivery)
      : existing?.salesPaymentAtDelivery != null
        ? normalizeSalesPaymentAt(existing.salesPaymentAtDelivery)
        : body.salesPaymentAt != null
          ? normalizeSalesPaymentAt(body.salesPaymentAt)
          : legacyFallback;
  return {
    salesPaymentAtDineIn: dineIn,
    salesPaymentAtTakeaway: takeaway,
    salesPaymentAtDelivery: delivery,
    // Keep legacy column aligned with dine-in for older clients
    salesPaymentAt: dineIn,
  };
}

router.get("/printers", async (_req, res) => {
  await ensureSalesDeviceColumns();
  // Devices are keyed by deviceKey (physical machine). Always return the full
  // list — filtering by X-Branch-Id hid printers right after save when the
  // active header branch differed from the device's branchId.
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
      salesPaymentAt: devicePrintersTable.salesPaymentAt,
      salesPaymentAtDineIn: devicePrintersTable.salesPaymentAtDineIn,
      salesPaymentAtTakeaway: devicePrintersTable.salesPaymentAtTakeaway,
      salesPaymentAtDelivery: devicePrintersTable.salesPaymentAtDelivery,
      salesSendToKitchen: devicePrintersTable.salesSendToKitchen,
      createdAt: devicePrintersTable.createdAt,
      updatedAt: devicePrintersTable.updatedAt,
      branchName: branchesTable.name,
    })
    .from(devicePrintersTable)
    .leftJoin(branchesTable, eq(devicePrintersTable.branchId, branchesTable.id))
    .orderBy(desc(devicePrintersTable.updatedAt));

  // Enforce one printer per device even if old duplicates exist
  const seenKeys = new Set<string>();
  const deduped: typeof rows = [];
  const orphanIds: number[] = [];
  for (const row of rows) {
    if (seenKeys.has(row.deviceKey)) {
      orphanIds.push(row.id);
      continue;
    }
    seenKeys.add(row.deviceKey);
    deduped.push(row);
  }
  if (orphanIds.length > 0) {
    await db.delete(devicePrintersTable).where(inArray(devicePrintersTable.id, orphanIds));
  }

  res.json(deduped.map((row) => withSalesDefaults(row)));
});

router.post("/printers", async (req, res) => {
  await ensureSalesDeviceColumns();
  const scope = parseBranchScope(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const {
    deviceKey,
    deviceName,
    printerName,
    branchId,
    note,
    isActive,
    salesSendToKitchen,
  } = body;

  const key = String(deviceKey ?? "").trim();
  const name = String(deviceName ?? "").trim();
  if (!key || !name) {
    res.status(400).json({ success: false, message: "معرف الجهاز واسم الجهاز مطلوبان" });
    return;
  }

  const resolvedBranchId = resolveWriteBranchId(scope, branchId != null ? Number(branchId) : null);
  const printer = String(printerName ?? "").trim();

  // One printer only per device — update existing (and purge duplicates)
  const existingId = await keepSinglePrinterForDevice(key);
  const [existing] = existingId
    ? await db
        .select()
        .from(devicePrintersTable)
        .where(eq(devicePrintersTable.id, existingId))
        .limit(1)
    : [];

  if (existing) {
    const paymentFields = pickPaymentFields(body, existing);
    const [updated] = await db
      .update(devicePrintersTable)
      .set({
        deviceName: name,
        printerName: printer,
        branchId: resolvedBranchId ?? existing.branchId,
        paperSize: "80x80",
        note: note != null ? String(note).trim() || null : existing.note,
        isActive: isActive ?? existing.isActive,
        ...paymentFields,
        salesSendToKitchen:
          salesSendToKitchen != null
            ? Boolean(salesSendToKitchen)
            : existing.salesSendToKitchen !== false,
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
    res.json(withSalesDefaults({ ...updated, branchName }));
    return;
  }

  const createPayment = pickPaymentFields(body);
  try {
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
        ...createPayment,
        salesSendToKitchen: salesSendToKitchen != null ? Boolean(salesSendToKitchen) : true,
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

    res.status(201).json(withSalesDefaults({ ...created, branchName }));
  } catch {
    // Race: another row was inserted for this device — update instead
    const fallbackId = await keepSinglePrinterForDevice(key);
    if (!fallbackId) {
      res.status(400).json({
        success: false,
        message: "لا يمكن تسجيل أكثر من طابعة لنفس الجهاز",
      });
      return;
    }
    const [updated] = await db
      .update(devicePrintersTable)
      .set({
        deviceName: name,
        printerName: printer,
        branchId: resolvedBranchId,
        paperSize: "80x80",
        note: note != null ? String(note).trim() || null : null,
        isActive: isActive ?? true,
        ...createPayment,
        salesSendToKitchen: salesSendToKitchen != null ? Boolean(salesSendToKitchen) : true,
        updatedAt: new Date(),
      })
      .where(eq(devicePrintersTable.id, fallbackId))
      .returning();
    let branchName: string | null = null;
    if (updated.branchId) {
      const [b] = await db
        .select({ name: branchesTable.name })
        .from(branchesTable)
        .where(eq(branchesTable.id, updated.branchId));
      branchName = b?.name ?? null;
    }
    res.json(withSalesDefaults({ ...updated, branchName }));
  }
});

router.put("/printers/:id", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const {
    deviceName,
    printerName,
    branchId,
    note,
    isActive,
    salesSendToKitchen,
  } = body;

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

  const paymentFields = pickPaymentFields(body, existing);
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
      ...paymentFields,
      salesSendToKitchen:
        salesSendToKitchen != null
          ? Boolean(salesSendToKitchen)
          : existing.salesSendToKitchen !== false,
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

  res.json(withSalesDefaults({ ...updated, branchName }));
});

router.delete("/printers/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(devicePrintersTable).where(eq(devicePrintersTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
