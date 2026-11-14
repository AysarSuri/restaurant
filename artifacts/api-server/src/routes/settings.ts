import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable, devicePrintersTable, branchesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { parseBranchScope, resolveWriteBranchId } from "../lib/branch-scope";

const router: IRouter = Router();

const DEFAULT_SETTINGS = {
  restaurantName: "المطعم الذكي",
  themePrimary: "38 92% 50%",
  currencyCode: "iqd",
  currencySymbol: "د.ع",
  currencyName: "دينار عراقي",
  decimalPlaces: 0,
  posSaveTarget: "cashier" as const,
  cashierSendToKitchen: true,
};

const POS_SAVE_TARGETS = new Set(["cashier", "kitchen"]);

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
  const target = POS_SAVE_TARGETS.has(settings.posSaveTarget)
    ? settings.posSaveTarget
    : DEFAULT_SETTINGS.posSaveTarget;
  return {
    restaurantName: settings.restaurantName,
    themePrimary: settings.themePrimary,
    currencyCode: settings.currencyCode,
    currencySymbol: settings.currencySymbol,
    currencyName: settings.currencyName,
    decimalPlaces: settings.decimalPlaces,
    posSaveTarget: target as "cashier" | "kitchen",
    cashierSendToKitchen: settings.cashierSendToKitchen !== false,
    updatedAt: settings.updatedAt,
  };
}

router.get("/", async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json(serializeSettings(settings));
});

router.put("/", async (req, res) => {
  const settings = await getOrCreateSettings();
  const {
    restaurantName,
    themePrimary,
    currencyCode,
    currencySymbol,
    currencyName,
    decimalPlaces,
    posSaveTarget,
    cashierSendToKitchen,
  } = req.body ?? {};

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

  let nextPosSaveTarget = settings.posSaveTarget || DEFAULT_SETTINGS.posSaveTarget;
  if (posSaveTarget != null) {
    const t = String(posSaveTarget).trim().toLowerCase();
    if (!POS_SAVE_TARGETS.has(t)) {
      res.status(400).json({
        success: false,
        message: "وجهة الحفظ غير صالحة (cashier أو kitchen)",
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

  const [updated] = await db
    .update(appSettingsTable)
    .set({
      restaurantName: nextName,
      themePrimary: nextTheme,
      currencyCode: nextCurrencyCode,
      currencySymbol: nextCurrencySymbol,
      currencyName: nextCurrencyName,
      decimalPlaces: nextDecimals,
      posSaveTarget: nextPosSaveTarget,
      cashierSendToKitchen: nextCashierSend,
      updatedAt: new Date(),
    })
    .where(eq(appSettingsTable.id, settings.id))
    .returning();

  res.json(serializeSettings(updated));
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
