import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { employeesTable, employeeBranchesTable } from "@workspace/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { parseBranchScope } from "../lib/branch-scope";
import { ensureEmployeeColumns } from "../lib/ensure-employee-columns";
import { stripEmployeePin } from "../lib/auth-token";

const router: IRouter = Router();

const ALL_BRANCH_ROLES = new Set(["admin", "manager"]);

function roleUsesAllBranches(role: string) {
  return ALL_BRANCH_ROLES.has(role);
}

function boolFlag(v: unknown, fallback = false) {
  if (v == null) return fallback;
  return Boolean(v);
}

function pickMenuFlags(body: Record<string, unknown>, existing?: {
  menuCanAccess?: boolean | null;
  menuCanCreate?: boolean | null;
  menuCanEditNew?: boolean | null;
  menuCanEditOld?: boolean | null;
  menuCanDeleteNew?: boolean | null;
  menuCanDeleteOld?: boolean | null;
  listPermissions?: unknown;
}) {
  const listPermissions =
    body.listPermissions != null && typeof body.listPermissions === "object"
      ? body.listPermissions
      : existing?.listPermissions != null && typeof existing.listPermissions === "object"
        ? existing.listPermissions
        : {};
  return {
    menuCanAccess: boolFlag(
      body.menuCanAccess,
      existing?.menuCanAccess ?? false
    ),
    menuCanCreate: boolFlag(
      body.menuCanCreate,
      existing?.menuCanCreate ?? false
    ),
    menuCanEditNew: boolFlag(
      body.menuCanEditNew,
      existing?.menuCanEditNew ?? false
    ),
    menuCanEditOld: boolFlag(
      body.menuCanEditOld,
      existing?.menuCanEditOld ?? false
    ),
    menuCanDeleteNew: boolFlag(
      body.menuCanDeleteNew,
      existing?.menuCanDeleteNew ?? false
    ),
    menuCanDeleteOld: boolFlag(
      body.menuCanDeleteOld,
      existing?.menuCanDeleteOld ?? false
    ),
    listPermissions,
  };
}

async function getBranchIdsForEmployees(employeeIds: number[]) {
  const map = new Map<number, number[]>();
  if (employeeIds.length === 0) return map;
  const rows = await db
    .select()
    .from(employeeBranchesTable)
    .where(inArray(employeeBranchesTable.employeeId, employeeIds));
  for (const row of rows) {
    const list = map.get(row.employeeId) ?? [];
    list.push(row.branchId);
    map.set(row.employeeId, list);
  }
  return map;
}

async function setEmployeeBranches(
  employeeId: number,
  allBranches: boolean,
  branchIds: number[]
) {
  await db
    .delete(employeeBranchesTable)
    .where(eq(employeeBranchesTable.employeeId, employeeId));
  if (allBranches) return;
  const unique = [
    ...new Set(branchIds.map(Number).filter((id) => Number.isFinite(id) && id > 0)),
  ];
  if (unique.length === 0) return;
  await db.insert(employeeBranchesTable).values(
    unique.map((branchId) => ({ employeeId, branchId }))
  );
}

function withBranches<T extends { id: number; role: string; allBranches?: boolean | null }>(
  emp: T,
  branchMap: Map<number, number[]>
) {
  const allBranches = roleUsesAllBranches(emp.role) || Boolean(emp.allBranches);
  const safe = stripEmployeePin(emp as T & Record<string, unknown>);
  return {
    ...safe,
    allBranches,
    branchIds: allBranches ? [] : branchMap.get(emp.id) ?? [],
  };
}

router.get("/", async (req, res) => {
  await ensureEmployeeColumns();
  const scope = parseBranchScope(req);
  const employees = await db
    .select()
    .from(employeesTable)
    .orderBy(desc(employeesTable.createdAt));
  const branchMap = await getBranchIdsForEmployees(employees.map((e) => e.id));
  let result = employees.map((e) => withBranches(e, branchMap));
  if (scope.mode === "one") {
    const bid = scope.branchId;
    result = result.filter(
      (e) => e.allBranches || (e.branchIds ?? []).includes(bid)
    );
  }
  res.json(result);
});

router.post("/", async (req, res) => {
  await ensureEmployeeColumns();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const {
    name,
    role,
    phone,
    email,
    pin,
    salary,
    isActive,
    hireDate,
    allBranches,
    branchIds,
  } = body;

  if (!name || !String(name).trim() || !role) {
    res.status(400).json({ success: false, message: "الاسم والمنصب مطلوبان" });
    return;
  }

  const roleStr = String(role);
  const usesAll = roleUsesAllBranches(roleStr) || allBranches === true;
  if (!usesAll && (!Array.isArray(branchIds) || branchIds.length === 0)) {
    res.status(400).json({
      success: false,
      message: "اختر فرعاً واحداً على الأقل لهذا الموظف",
    });
    return;
  }

  const pinValue =
    pin != null && String(pin).trim() !== "" ? String(pin).trim() : null;
  const menuFlags = pickMenuFlags(body);

  const [emp] = await db
    .insert(employeesTable)
    .values({
      name: String(name).trim(),
      role: roleStr as typeof employeesTable.$inferInsert.role,
      phone: phone != null ? String(phone) : null,
      email: email != null ? String(email) : null,
      pin: pinValue,
      salary: salary != null ? String(salary) : null,
      isActive: isActive !== false,
      allBranches: usesAll,
      ...menuFlags,
      hireDate: hireDate ? new Date(String(hireDate)) : null,
    })
    .returning();

  await setEmployeeBranches(
    emp.id,
    usesAll,
    usesAll ? [] : (branchIds as number[])
  );
  const branchMap = await getBranchIdsForEmployees([emp.id]);
  res.status(201).json(withBranches(emp, branchMap));
});

router.put("/:id", async (req, res) => {
  await ensureEmployeeColumns();
  const id = parseInt(req.params.id, 10);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const {
    name,
    role,
    phone,
    email,
    pin,
    salary,
    isActive,
    hireDate,
    allBranches,
    branchIds,
  } = body;

  if (!name || !String(name).trim() || !role) {
    res.status(400).json({ success: false, message: "الاسم والمنصب مطلوبان" });
    return;
  }

  const [existing] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "الموظف غير موجود" });
    return;
  }

  const roleStr = String(role);
  const usesAll = roleUsesAllBranches(roleStr) || allBranches === true;
  if (!usesAll && (!Array.isArray(branchIds) || branchIds.length === 0)) {
    res.status(400).json({
      success: false,
      message: "اختر فرعاً واحداً على الأقل لهذا الموظف",
    });
    return;
  }

  const pinValue =
    pin === undefined
      ? undefined
      : pin != null && String(pin).trim() !== ""
        ? String(pin).trim()
        : null;

  const menuFlags = pickMenuFlags(body, existing);

  const [emp] = await db
    .update(employeesTable)
    .set({
      name: String(name).trim(),
      role: roleStr as typeof employeesTable.$inferInsert.role,
      phone: phone != null ? String(phone) : null,
      email: email != null ? String(email) : null,
      ...(pinValue !== undefined ? { pin: pinValue } : {}),
      salary: salary != null ? String(salary) : null,
      isActive: isActive !== false,
      allBranches: usesAll,
      ...menuFlags,
      hireDate: hireDate ? new Date(String(hireDate)) : undefined,
    })
    .where(eq(employeesTable.id, id))
    .returning();

  await setEmployeeBranches(id, usesAll, usesAll ? [] : ((branchIds as number[]) ?? []));
  const branchMap = await getBranchIdsForEmployees([id]);
  res.json(withBranches(emp, branchMap));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(employeeBranchesTable).where(eq(employeeBranchesTable.employeeId, id));
  await db.delete(employeesTable).where(eq(employeesTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
