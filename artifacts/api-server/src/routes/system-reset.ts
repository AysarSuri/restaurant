import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

/** Default system admin re-seeded whenever employees are cleared */
export const SYSTEM_ADMIN = {
  name: "Aisar",
  role: "admin" as const,
  pin: "judi2014rudi2020",
  allBranches: true,
  isActive: true,
};

type ResetGroup = {
  key: string;
  labelAr: string;
  descriptionAr: string;
  /** Physical tables truncated for this group (children first) */
  tables: string[];
  /** Re-seed system admin after truncate */
  seedAdmin?: boolean;
  /** Re-seed default app settings row after truncate */
  seedSettings?: boolean;
};

/**
 * Every public business table must appear in exactly one group.
 * Verified against pg_tables / drizzle schemas.
 */
export const RESET_GROUPS: ResetGroup[] = [
  {
    key: "orders",
    labelAr: "الطلبات",
    descriptionAr: "كل الطلبات وأصنافها من نقاط البيع والطاولات",
    tables: ["order_items", "orders"],
  },
  {
    key: "customers",
    labelAr: "الزبائن",
    descriptionAr: "سجل الزبائن وعناوينهم (يُفصل ربطهم من الطلبات دون حذف الطلبات)",
    tables: ["customers"],
  },
  {
    key: "drivers",
    labelAr: "السواق",
    descriptionAr: "سائقو التوصيل (يُفصل ربطهم من الطلبات دون حذف الطلبات)",
    tables: ["drivers"],
  },
  {
    key: "menu",
    labelAr: "القائمة",
    descriptionAr:
      "التصنيفات والأصناف وربطها بالفروع — يتطلب تصفير الطلبات وبنود شراء/مرجع الموردين أولاً إن وُجدت",
    tables: ["menu_item_branches", "menu_items", "menu_categories"],
  },
  {
    key: "item_units",
    labelAr: "وحدات الأصناف",
    descriptionAr: "وحدات القياس المعرفة للأصناف",
    tables: ["item_units"],
  },
  {
    key: "inventory",
    labelAr: "المخزون",
    descriptionAr: "أرصدة وكميات المخزون",
    tables: ["inventory"],
  },
  {
    key: "tables",
    labelAr: "الطاولات",
    descriptionAr: "طاولات المطعم وحالاتها (يُفصل ربطها من الطلبات دون حذف الطلبات)",
    tables: ["restaurant_tables"],
  },
  {
    key: "employees",
    labelAr: "الموظفون",
    descriptionAr:
      "الموظفون وربطهم بالفروع والورديات — يُعاد إنشاء مدير النظام تلقائياً (لا يمسح الطلبات)",
    tables: ["employee_branches", "shift_employees", "employees"],
    seedAdmin: true,
  },
  {
    key: "shifts",
    labelAr: "الورديات",
    descriptionAr: "الورديات وموظفو كل وردية",
    tables: ["shift_employees", "shifts"],
  },
  {
    key: "suppliers",
    labelAr: "الموردون",
    descriptionAr: "الموردون والشراء والمرجوع والحركات",
    tables: [
      "supplier_return_items",
      "supplier_returns",
      "supplier_purchase_items",
      "supplier_purchases",
      "supplier_movements",
      "suppliers",
    ],
  },
  {
    key: "expenses",
    labelAr: "المصاريف",
    descriptionAr: "فواتير المصاريف المسجّلة",
    tables: ["expenses"],
  },
  {
    key: "expense_types",
    labelAr: "أنواع المصاريف",
    descriptionAr: "تصنيفات وأنواع المصاريف — صفّر المصاريف أولاً إن وُجدت فواتير مرتبطة",
    tables: ["expense_types"],
  },
  {
    key: "cash_movements",
    labelAr: "سحوبات ومرجوعات",
    descriptionAr: "حركات السحب والمرجع النقدي",
    tables: ["cash_movements"],
  },
  {
    key: "cards",
    labelAr: "البطاقات",
    descriptionAr:
      "بطاقات الرصيد وربطها بالفروع — صفّر شراء/مرجع/حركات الموردين أولاً إن ارتبطت ببطاقة",
    tables: ["card_branches", "cards"],
  },
  {
    key: "delivery_contacts",
    labelAr: "جهات التوصيل",
    descriptionAr: "أرقام وعناوين التوصيل المحفوظة (مشتركة لكل الفروع)",
    tables: ["delivery_contacts"],
  },
  {
    key: "device_printers",
    labelAr: "طابعات الأجهزة",
    descriptionAr: "تعيينات الطابعات الحرارية وإعدادات البيع لكل جهاز",
    tables: ["device_printers"],
  },
  {
    key: "settings",
    labelAr: "إعدادات المطعم",
    descriptionAr: "اسم المطعم والشعار والعملة وإعدادات البيع — تُعاد القيم الافتراضية",
    tables: ["app_settings"],
    seedSettings: true,
  },
  {
    key: "branches",
    labelAr: "الفروع",
    descriptionAr:
      "فروع المطعم — صفّر أولاً الجداول المرتبطة بفرع إلزامي (مثل الورديات) ثم الفروع",
    tables: ["branches"],
  },
];

const ALL_TABLES = [...new Set(RESET_GROUPS.flatMap((g) => g.tables))];

/**
 * Nullable FKs from other tables → clear before truncate so we do NOT
 * CASCADE-wipe unrelated business data (e.g. employees must not erase orders).
 */
const NULLABLE_FK_CLEARS: Array<{ from: string; column: string; to: string }> = [
  { from: "orders", column: "employee_id", to: "employees" },
  { from: "orders", column: "driver_id", to: "drivers" },
  { from: "orders", column: "customer_id", to: "customers" },
  { from: "orders", column: "table_id", to: "restaurant_tables" },
  { from: "orders", column: "branch_id", to: "branches" },
  { from: "expenses", column: "employee_id", to: "employees" },
  { from: "expenses", column: "branch_id", to: "branches" },
  { from: "expenses", column: "expense_type_id", to: "expense_types" },
  { from: "expenses", column: "card_id", to: "cards" },
  { from: "cash_movements", column: "card_id", to: "cards" },
  { from: "shifts", column: "supervisor_employee_id", to: "employees" },
  { from: "cash_movements", column: "branch_id", to: "branches" },
  { from: "customers", column: "branch_id", to: "branches" },
  { from: "inventory", column: "branch_id", to: "branches" },
  { from: "restaurant_tables", column: "branch_id", to: "branches" },
  { from: "drivers", column: "branch_id", to: "branches" },
  { from: "suppliers", column: "branch_id", to: "branches" },
  { from: "supplier_purchases", column: "branch_id", to: "branches" },
  { from: "supplier_purchases", column: "card_id", to: "cards" },
  { from: "supplier_returns", column: "branch_id", to: "branches" },
  { from: "supplier_returns", column: "card_id", to: "cards" },
  { from: "supplier_movements", column: "branch_id", to: "branches" },
  { from: "supplier_movements", column: "card_id", to: "cards" },
  { from: "delivery_contacts", column: "branch_id", to: "branches" },
  { from: "device_printers", column: "branch_id", to: "branches" },
];

/** Non-nullable FKs that block truncate — map target → human label of blocker group */
const BLOCKING_FK_HINTS: Array<{
  from: string;
  column: string;
  to: string;
  resetFirstKey: string;
  resetFirstLabelAr: string;
}> = [
  {
    from: "order_items",
    column: "menu_item_id",
    to: "menu_items",
    resetFirstKey: "orders",
    resetFirstLabelAr: "الطلبات",
  },
  {
    from: "supplier_purchase_items",
    column: "menu_item_id",
    to: "menu_items",
    resetFirstKey: "suppliers",
    resetFirstLabelAr: "الموردون",
  },
  {
    from: "supplier_return_items",
    column: "menu_item_id",
    to: "menu_items",
    resetFirstKey: "suppliers",
    resetFirstLabelAr: "الموردون",
  },
  {
    from: "supplier_purchases",
    column: "supplier_id",
    to: "suppliers",
    resetFirstKey: "suppliers",
    resetFirstLabelAr: "الموردون",
  },
  {
    from: "supplier_returns",
    column: "supplier_id",
    to: "suppliers",
    resetFirstKey: "suppliers",
    resetFirstLabelAr: "الموردون",
  },
  {
    from: "supplier_movements",
    column: "supplier_id",
    to: "suppliers",
    resetFirstKey: "suppliers",
    resetFirstLabelAr: "الموردون",
  },
  {
    from: "expenses",
    column: "expense_type_id",
    to: "expense_types",
    resetFirstKey: "expenses",
    resetFirstLabelAr: "المصاريف",
  },
  {
    from: "shifts",
    column: "branch_id",
    to: "branches",
    resetFirstKey: "shifts",
    resetFirstLabelAr: "الورديات",
  },
  {
    from: "menu_items",
    column: "category_id",
    to: "menu_categories",
    resetFirstKey: "menu",
    resetFirstLabelAr: "القائمة",
  },
];

async function countRows(table: string): Promise<number> {
  const result = await db.execute(
    sql.raw(`SELECT count(*)::int AS c FROM "${table}"`)
  );
  const asRows = (result as { rows?: Array<{ c: number }> }).rows;
  if (Array.isArray(asRows) && asRows[0]) return Number(asRows[0].c) || 0;
  if (Array.isArray(result) && result[0]) {
    return Number((result[0] as { c: number }).c) || 0;
  }
  return 0;
}

async function countNonNullFk(from: string, column: string): Promise<number> {
  const result = await db.execute(
    sql.raw(
      `SELECT count(*)::int AS c FROM "${from}" WHERE "${column}" IS NOT NULL`
    )
  );
  const asRows = (result as { rows?: Array<{ c: number }> }).rows;
  if (Array.isArray(asRows) && asRows[0]) return Number(asRows[0].c) || 0;
  if (Array.isArray(result) && result[0]) {
    return Number((result[0] as { c: number }).c) || 0;
  }
  return 0;
}

class ResetBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResetBlockedError";
  }
}

/**
 * Truncate only the named tables without CASCADE wiping unrelated data.
 * Clears nullable FKs first; blocks with a clear Arabic message when hard FKs remain.
 */
async function truncateTablesSafe(tables: string[]) {
  if (tables.length === 0) return;
  const target = new Set(tables);

  for (const ref of NULLABLE_FK_CLEARS) {
    if (!target.has(ref.to)) continue;
    if (target.has(ref.from)) continue;
    try {
      await db.execute(
        sql.raw(
          `UPDATE "${ref.from}" SET "${ref.column}" = NULL WHERE "${ref.column}" IS NOT NULL`
        )
      );
    } catch {
      /* table/column may not exist in older DBs */
    }
  }

  const blockers: string[] = [];
  for (const ref of BLOCKING_FK_HINTS) {
    if (!target.has(ref.to)) continue;
    if (target.has(ref.from)) continue;
    try {
      const n = await countNonNullFk(ref.from, ref.column);
      if (n > 0) {
        blockers.push(`${ref.resetFirstLabelAr} (${ref.from})`);
      }
    } catch {
      /* ignore missing */
    }
  }
  if (blockers.length > 0) {
    const unique = [...new Set(blockers)];
    throw new ResetBlockedError(
      `لا يمكن التصفير الآن لوجود بيانات مرتبطة. صفّر أولاً: ${unique.join(" · ")}`
    );
  }

  const list = tables.map((t) => `"${t}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY`));
}

/** Full wipe — all known tables in one statement (FK-safe together). */
async function truncateAllKnownTables() {
  const list = ALL_TABLES.map((t) => `"${t}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`));
}

async function seedSystemAdmin() {
  const [emp] = await db
    .insert(employeesTable)
    .values({
      name: SYSTEM_ADMIN.name,
      role: SYSTEM_ADMIN.role,
      pin: SYSTEM_ADMIN.pin,
      allBranches: SYSTEM_ADMIN.allBranches,
      isActive: SYSTEM_ADMIN.isActive,
      listPermissions: {},
    })
    .returning();
  return emp;
}

async function seedDefaultSettings() {
  await db.execute(sql.raw(`
    INSERT INTO app_settings (
      restaurant_name, theme_primary, currency_code, currency_symbol,
      currency_name, decimal_places, pos_save_target, cashier_send_to_kitchen,
      delivery_fee, delivery_require_driver, delivery_require_phone, delivery_require_address
    ) VALUES (
      'المطعم الذكي', '38 92% 50%', 'iqd', 'د.ع',
      'دينار عراقي', 0, 'cashier', true,
      0, true, true, true
    )
  `));
}

/** Ensure every public base table is covered by RESET_GROUPS (dev safety). */
async function listUncoveredPublicTables(): Promise<string[]> {
  try {
    const result = await db.execute(
      sql.raw(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `)
    );
    const rows =
      (result as { rows?: Array<{ tablename: string }> }).rows ??
      (Array.isArray(result) ? (result as Array<{ tablename: string }>) : []);
    const covered = new Set(ALL_TABLES);
    return rows
      .map((r) => r.tablename)
      .filter((name) => name && !covered.has(name));
  } catch {
    return [];
  }
}

router.get("/tables", async (_req, res) => {
  const tableCounts = new Map<string, number>();
  for (const t of ALL_TABLES) {
    try {
      tableCounts.set(t, await countRows(t));
    } catch {
      tableCounts.set(t, 0);
    }
  }

  const groups = [];
  for (const g of RESET_GROUPS) {
    const rows = g.tables.reduce((sum, t) => sum + (tableCounts.get(t) ?? 0), 0);
    groups.push({
      key: g.key,
      labelAr: g.labelAr,
      descriptionAr: g.descriptionAr,
      tables: g.tables,
      tableCount: g.tables.length,
      rowCount: rows,
      seedsAdmin: Boolean(g.seedAdmin),
    });
  }

  const uncovered = await listUncoveredPublicTables();
  let uniqueRowCount = 0;
  for (const n of tableCounts.values()) uniqueRowCount += n;

  res.json({
    groups,
    uniqueRowCount,
    tableCoverage: {
      coveredCount: ALL_TABLES.length,
      uncovered,
      complete: uncovered.length === 0,
    },
    adminSeed: {
      name: SYSTEM_ADMIN.name,
      role: SYSTEM_ADMIN.role,
      note: "يُنشأ تلقائياً عند تصفير الموظفين أو تصفير الكل",
    },
  });
});

router.post("/table/:key", async (req, res) => {
  const key = String(req.params.key || "").trim();
  const group = RESET_GROUPS.find((g) => g.key === key);
  if (!group) {
    return res.status(404).json({ message: "جدول غير معروف" });
  }

  try {
    await truncateTablesSafe(group.tables);
    let admin = null;
    if (group.seedAdmin) {
      admin = await seedSystemAdmin();
    }
    if (group.seedSettings) {
      await seedDefaultSettings();
    }
    res.json({
      ok: true,
      key: group.key,
      labelAr: group.labelAr,
      tables: group.tables,
      message: `تم تصفير: ${group.labelAr}`,
      adminSeeded: Boolean(admin),
      admin: admin
        ? { id: admin.id, name: admin.name, role: admin.role }
        : undefined,
    });
  } catch (e) {
    if (e instanceof ResetBlockedError) {
      return res.status(409).json({ message: e.message });
    }
    const msg = e instanceof Error ? e.message : "تعذر التصفير";
    res.status(500).json({ message: msg });
  }
});

router.post("/all", async (_req, res) => {
  try {
    await truncateAllKnownTables();
    const admin = await seedSystemAdmin();
    await seedDefaultSettings();
    res.json({
      ok: true,
      message: "تم تصفير جميع الجداول وإعادة إنشاء مدير النظام",
      adminSeeded: true,
      admin: { id: admin.id, name: admin.name, role: admin.role },
      clearedGroups: RESET_GROUPS.map((g) => g.key),
      clearedTables: ALL_TABLES,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذر تصفير البرنامج";
    res.status(500).json({ message: msg });
  }
});

export default router;
