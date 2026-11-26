/** Edit/delete age window for a list. */
export type AgeScope = "none" | "1d" | "2d" | "all";

export type ListPerm = {
  access: boolean;
  create: boolean;
  edit: AgeScope;
  delete: AgeScope;
};

export type ListKey =
  | "menu"
  | "orders"
  | "tables"
  | "expenses"
  | "cash-movements"
  | "suppliers"
  | "inventory"
  | "drivers"
  | "shifts"
  | "cards"
  | "delivery-contacts"
  | "employees"
  | "branches"
  | "reports"
  | "pos"
  | "cashier"
  | "kds"
  | "settings";

export type ListPermissionsMap = Partial<Record<ListKey, ListPerm>>;

export const LIST_CATALOG: {
  key: ListKey;
  nameAr: string;
  href: string;
  /** Lists with dated records support age-scoped edit/delete */
  dated: boolean;
}[] = [
  { key: "pos", nameAr: "نقطة البيع", href: "/pos", dated: false },
  { key: "cashier", nameAr: "الكاشير", href: "/cashier", dated: false },
  { key: "orders", nameAr: "الطلبات", href: "/orders", dated: true },
  { key: "tables", nameAr: "الطاولات / المقاعد", href: "/tables", dated: false },
  { key: "kds", nameAr: "شاشة المطبخ", href: "/kds", dated: false },
  { key: "menu", nameAr: "قائمة الطعام", href: "/menu", dated: true },
  { key: "inventory", nameAr: "المخزن", href: "/inventory", dated: false },
  { key: "drivers", nameAr: "السائقون", href: "/drivers", dated: true },
  { key: "delivery-contacts", nameAr: "جهات التوصيل", href: "/delivery-contacts", dated: true },
  { key: "employees", nameAr: "الموظفون", href: "/employees", dated: false },
  { key: "shifts", nameAr: "الورديات", href: "/shifts", dated: true },
  { key: "suppliers", nameAr: "الموردون", href: "/suppliers", dated: true },
  { key: "expenses", nameAr: "المصروفات", href: "/expenses", dated: true },
  { key: "cash-movements", nameAr: "حركة الصندوق", href: "/cash-movements", dated: true },
  { key: "branches", nameAr: "الفروع", href: "/branches", dated: false },
  { key: "cards", nameAr: "البطاقات", href: "/cards", dated: false },
  { key: "reports", nameAr: "التقارير", href: "/reports", dated: false },
  { key: "settings", nameAr: "الإعدادات", href: "/settings", dated: false },
];

export const AGE_SCOPE_OPTIONS: { value: AgeScope; labelAr: string; hintAr: string }[] = [
  { value: "none", labelAr: "لا", hintAr: "بدون صلاحية" },
  { value: "1d", labelAr: "خلال يوم", hintAr: "سجلات عمرها يوم أو أقل" },
  { value: "2d", labelAr: "خلال يومين", hintAr: "سجلات عمرها يومان أو أقل" },
  { value: "all", labelAr: "كل الأيام", hintAr: "بما فيها كل الأيام القديمة" },
];

export const EMPTY_LIST_PERM: ListPerm = {
  access: false,
  create: false,
  edit: "none",
  delete: "none",
};

export const FULL_LIST_PERM: ListPerm = {
  access: true,
  create: true,
  edit: "all",
  delete: "all",
};

export function emptyListPermissionsMap(): ListPermissionsMap {
  const map: ListPermissionsMap = {};
  for (const row of LIST_CATALOG) {
    map[row.key] = { ...EMPTY_LIST_PERM };
  }
  return map;
}

export function fullListPermissionsMap(): ListPermissionsMap {
  const map: ListPermissionsMap = {};
  for (const row of LIST_CATALOG) {
    map[row.key] = { ...FULL_LIST_PERM };
  }
  return map;
}

function normalizeScope(v: unknown): AgeScope {
  if (v === "1d" || v === "2d" || v === "all" || v === "none") return v;
  return "none";
}

export function normalizeListPermissions(raw: unknown): ListPermissionsMap {
  const base = emptyListPermissionsMap();
  if (!raw || typeof raw !== "object") return base;
  const src = raw as Record<string, unknown>;
  for (const row of LIST_CATALOG) {
    const p = src[row.key];
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    base[row.key] = {
      access: Boolean(o.access),
      create: Boolean(o.create),
      edit: normalizeScope(o.edit),
      delete: normalizeScope(o.delete),
    };
  }
  return base;
}

/** Migrate legacy menu_* booleans into listPermissions.menu if needed. */
export function listPermissionsFromEmployee(emp: {
  role?: string | null;
  listPermissions?: unknown;
  menuCanAccess?: boolean | null;
  menuCanCreate?: boolean | null;
  menuCanEditNew?: boolean | null;
  menuCanEditOld?: boolean | null;
  menuCanDeleteNew?: boolean | null;
  menuCanDeleteOld?: boolean | null;
}): ListPermissionsMap {
  if (emp.role === "admin" || emp.role === "manager") {
    return fullListPermissionsMap();
  }
  const map = normalizeListPermissions(emp.listPermissions);
  const hasAnyStored =
    emp.listPermissions &&
    typeof emp.listPermissions === "object" &&
    Object.keys(emp.listPermissions as object).length > 0;
  if (!hasAnyStored) {
    // legacy menu flags → menu row
    const edit: AgeScope =
      emp.menuCanEditOld ? "all" : emp.menuCanEditNew ? "2d" : "none";
    const del: AgeScope =
      emp.menuCanDeleteOld ? "all" : emp.menuCanDeleteNew ? "2d" : "none";
    map.menu = {
      access: Boolean(emp.menuCanAccess),
      create: Boolean(emp.menuCanCreate),
      edit,
      delete: del,
    };
  }
  return map;
}

export function recordAgeDays(
  createdAt: string | Date | null | undefined,
  now = Date.now()
): number {
  if (!createdAt) return 0;
  const t = createdAt instanceof Date ? createdAt.getTime() : Date.parse(String(createdAt));
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now - t) / (24 * 60 * 60 * 1000));
}

export function scopeAllows(scope: AgeScope, createdAt: string | Date | null | undefined): boolean {
  if (scope === "none") return false;
  if (scope === "all") return true;
  const age = recordAgeDays(createdAt);
  if (scope === "1d") return age <= 1;
  if (scope === "2d") return age <= 2;
  return false;
}

type AuthLike = {
  role?: string | null;
  listPermissions?: ListPermissionsMap | null;
};

export function resolveListPerm(
  user: AuthLike | null | undefined,
  key: ListKey
): ListPerm {
  if (!user) return { ...EMPTY_LIST_PERM };
  if (user.role === "admin" || user.role === "manager") {
    return { ...FULL_LIST_PERM };
  }
  return user.listPermissions?.[key] ?? { ...EMPTY_LIST_PERM };
}

export function canAccessList(user: AuthLike | null | undefined, key: ListKey): boolean {
  return resolveListPerm(user, key).access;
}

export function canCreateInList(user: AuthLike | null | undefined, key: ListKey): boolean {
  const p = resolveListPerm(user, key);
  return p.access && p.create;
}

export function canEditRecord(
  user: AuthLike | null | undefined,
  key: ListKey,
  createdAt: string | Date | null | undefined
): boolean {
  const p = resolveListPerm(user, key);
  return p.access && scopeAllows(p.edit, createdAt);
}

export function canDeleteRecord(
  user: AuthLike | null | undefined,
  key: ListKey,
  createdAt: string | Date | null | undefined
): boolean {
  const p = resolveListPerm(user, key);
  return p.access && scopeAllows(p.delete, createdAt);
}

/** Bridge for older menu helpers */
export function toLegacyMenuPermissions(map: ListPermissionsMap) {
  const m = map.menu ?? EMPTY_LIST_PERM;
  return {
    access: m.access,
    create: m.create,
    editNew: m.edit === "1d" || m.edit === "2d" || m.edit === "all",
    editOld: m.edit === "all",
    deleteNew: m.delete === "1d" || m.delete === "2d" || m.delete === "all",
    deleteOld: m.delete === "all",
  };
}
