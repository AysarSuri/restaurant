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
  /** Physical tables truncated for this group (order does not matter with CASCADE) */
  tables: string[];
  /** Re-seed system admin after truncate */
  seedAdmin?: boolean;
  /** Re-seed default app settings row after truncate */
  seedSettings?: boolean;
};

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
    descriptionAr: "سجل الزبائن وعناوينهم",
    tables: ["customers"],
  },
  {
    key: "drivers",
    labelAr: "السواق",
    descriptionAr: "سائقو التوصيل وربطهم بالطلبات",
    tables: ["drivers"],
  },
  {
    key: "menu",
    labelAr: "القائمة",
    descriptionAr: "التصنيفات والأصناف وربطها بالفروع",
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
    descriptionAr: "طاولات المطعم وحالاتها",
    tables: ["restaurant_tables"],
  },
  {
    key: "employees",
    labelAr: "الموظفون",
    descriptionAr: "الموظفون وربطهم بالفروع — يُعاد إنشاء مدير النظام تلقائياً",
    tables: ["employee_branches", "employees"],
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
    descriptionAr: "تصنيفات وأنواع المصاريف",
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
    descriptionAr: "بطاقات الرصيد وربطها بالفروع",
    tables: ["card_branches", "cards"],
  },
  {
    key: "delivery_contacts",
    labelAr: "جهات التوصيل",
    descriptionAr: "أرقام وعناوين التوصيل المحفوظة",
    tables: ["delivery_contacts"],
  },
  {
    key: "device_printers",
    labelAr: "طابعات الأجهزة",
    descriptionAr: "تعيينات الطابعات الحرارية للأجهزة",
    tables: ["device_printers"],
  },
  {
    key: "settings",
    labelAr: "إعدادات المطعم",
    descriptionAr: "اسم المطعم والشعار والعملة وإعدادات البيع",
    tables: ["app_settings"],
    seedSettings: true,
  },
  {
    key: "branches",
    labelAr: "الفروع",
    descriptionAr:
      "فروع المطعم (قد يمسح أيضاً الروابط المرتبطة بالفروع عبر CASCADE)",
    tables: ["branches"],
  },
];

const ALL_TABLES = [
  ...new Set(RESET_GROUPS.flatMap((g) => g.tables)),
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

async function truncateTables(tables: string[]) {
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t}"`).join(", ");
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
    })
    .returning();
  return emp;
}

async function seedDefaultSettings() {
  await db.execute(sql.raw(`
    INSERT INTO app_settings (
      restaurant_name, theme_primary, currency_code, currency_symbol,
      currency_name, decimal_places, pos_save_target, cashier_send_to_kitchen
    ) VALUES (
      'المطعم الذكي', '38 92% 50%', 'iqd', 'د.ع',
      'دينار عراقي', 0, 'cashier', true
    )
  `));
}

router.get("/tables", async (_req, res) => {
  const groups = [];
  for (const g of RESET_GROUPS) {
    let rows = 0;
    for (const t of g.tables) {
      try {
        rows += await countRows(t);
      } catch {
        /* table may not exist yet */
      }
    }
    groups.push({
      key: g.key,
      labelAr: g.labelAr,
      descriptionAr: g.descriptionAr,
      tableCount: g.tables.length,
      rowCount: rows,
      seedsAdmin: Boolean(g.seedAdmin),
    });
  }
  res.json({
    groups,
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
    await truncateTables(group.tables);
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
      message: `تم تصفير: ${group.labelAr}`,
      adminSeeded: Boolean(admin),
      admin: admin
        ? { id: admin.id, name: admin.name, role: admin.role }
        : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذر التصفير";
    res.status(500).json({ message: msg });
  }
});

router.post("/all", async (_req, res) => {
  try {
    await truncateTables(ALL_TABLES);
    const admin = await seedSystemAdmin();
    await seedDefaultSettings();
    res.json({
      ok: true,
      message: "تم تصفير جميع الجداول وإعادة إنشاء مدير النظام",
      adminSeeded: true,
      admin: { id: admin.id, name: admin.name, role: admin.role },
      clearedGroups: RESET_GROUPS.map((g) => g.key),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذر تصفير البرنامج";
    res.status(500).json({ message: msg });
  }
});

export default router;
