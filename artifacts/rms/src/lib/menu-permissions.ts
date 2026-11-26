/** Items/categories created within this many days count as «new». */
export const MENU_NEW_DAYS = 30;

export type MenuPermissions = {
  access: boolean;
  create: boolean;
  editNew: boolean;
  editOld: boolean;
  deleteNew: boolean;
  deleteOld: boolean;
};

export const EMPTY_MENU_PERMISSIONS: MenuPermissions = {
  access: false,
  create: false,
  editNew: false,
  editOld: false,
  deleteNew: false,
  deleteOld: false,
};

export const FULL_MENU_PERMISSIONS: MenuPermissions = {
  access: true,
  create: true,
  editNew: true,
  editOld: true,
  deleteNew: true,
  deleteOld: true,
};

export function isMenuRecordNew(
  createdAt: string | Date | null | undefined,
  now = Date.now()
): boolean {
  if (!createdAt) return true;
  const t = createdAt instanceof Date ? createdAt.getTime() : Date.parse(String(createdAt));
  if (!Number.isFinite(t)) return true;
  const ageMs = now - t;
  return ageMs <= MENU_NEW_DAYS * 24 * 60 * 60 * 1000;
}

type AuthLike = {
  role?: string | null;
  menuPermissions?: Partial<MenuPermissions> | null;
};

/** Admin / manager always have full menu rights. */
export function resolveMenuPermissions(user: AuthLike | null | undefined): MenuPermissions {
  if (!user) return EMPTY_MENU_PERMISSIONS;
  if (user.role === "admin" || user.role === "manager") {
    return FULL_MENU_PERMISSIONS;
  }
  const p = user.menuPermissions ?? {};
  return {
    access: Boolean(p.access),
    create: Boolean(p.create),
    editNew: Boolean(p.editNew),
    editOld: Boolean(p.editOld),
    deleteNew: Boolean(p.deleteNew),
    deleteOld: Boolean(p.deleteOld),
  };
}

export function canEditMenuRecord(
  perms: MenuPermissions,
  createdAt: string | Date | null | undefined
): boolean {
  return isMenuRecordNew(createdAt) ? perms.editNew : perms.editOld;
}

export function canDeleteMenuRecord(
  perms: MenuPermissions,
  createdAt: string | Date | null | undefined
): boolean {
  return isMenuRecordNew(createdAt) ? perms.deleteNew : perms.deleteOld;
}

export function menuPermissionsFromEmployee(emp: {
  menuCanAccess?: boolean | null;
  menuCanCreate?: boolean | null;
  menuCanEditNew?: boolean | null;
  menuCanEditOld?: boolean | null;
  menuCanDeleteNew?: boolean | null;
  menuCanDeleteOld?: boolean | null;
  role?: string | null;
}): MenuPermissions {
  if (emp.role === "admin" || emp.role === "manager") {
    return FULL_MENU_PERMISSIONS;
  }
  return {
    access: Boolean(emp.menuCanAccess),
    create: Boolean(emp.menuCanCreate),
    editNew: Boolean(emp.menuCanEditNew),
    editOld: Boolean(emp.menuCanEditOld),
    deleteNew: Boolean(emp.menuCanDeleteNew),
    deleteOld: Boolean(emp.menuCanDeleteOld),
  };
}
