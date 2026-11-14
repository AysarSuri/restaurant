import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { employeesTable, employeeBranchesTable } from "@workspace/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { parseBranchScope } from "../lib/branch-scope";

const router: IRouter = Router();

const ALL_BRANCH_ROLES = new Set(["admin", "manager"]);

function roleUsesAllBranches(role: string) {
  return ALL_BRANCH_ROLES.has(role);
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
  return {
    ...emp,
    allBranches,
    branchIds: allBranches ? [] : branchMap.get(emp.id) ?? [],
  };
}

router.get("/", async (req, res) => {
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
  const { name, role, phone, email, salary, isActive, hireDate, allBranches, branchIds } =
    req.body;

  if (!name?.trim() || !role) {
    res.status(400).json({ success: false, message: "الاسم والمنصب مطلوبان" });
    return;
  }

  const usesAll = roleUsesAllBranches(role) || allBranches === true;
  if (!usesAll && (!Array.isArray(branchIds) || branchIds.length === 0)) {
    res.status(400).json({
      success: false,
      message: "اختر فرعاً واحداً على الأقل لهذا الموظف",
    });
    return;
  }

  const [emp] = await db
    .insert(employeesTable)
    .values({
      name: String(name).trim(),
      role,
      phone,
      email,
      salary: salary?.toString(),
      isActive: isActive ?? true,
      allBranches: usesAll,
      hireDate: hireDate ? new Date(hireDate) : null,
    })
    .returning();

  await setEmployeeBranches(emp.id, usesAll, usesAll ? [] : branchIds);
  const branchMap = await getBranchIdsForEmployees([emp.id]);
  res.status(201).json(withBranches(emp, branchMap));
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, role, phone, email, salary, isActive, hireDate, allBranches, branchIds } =
    req.body;

  if (!name?.trim() || !role) {
    res.status(400).json({ success: false, message: "الاسم والمنصب مطلوبان" });
    return;
  }

  const usesAll = roleUsesAllBranches(role) || allBranches === true;
  if (!usesAll && (!Array.isArray(branchIds) || branchIds.length === 0)) {
    res.status(400).json({
      success: false,
      message: "اختر فرعاً واحداً على الأقل لهذا الموظف",
    });
    return;
  }

  const [emp] = await db
    .update(employeesTable)
    .set({
      name: String(name).trim(),
      role,
      phone,
      email,
      salary: salary?.toString(),
      isActive,
      allBranches: usesAll,
      hireDate: hireDate ? new Date(hireDate) : undefined,
    })
    .where(eq(employeesTable.id, id))
    .returning();

  if (!emp) {
    res.status(404).json({ success: false, message: "الموظف غير موجود" });
    return;
  }

  await setEmployeeBranches(id, usesAll, usesAll ? [] : branchIds ?? []);
  const branchMap = await getBranchIdsForEmployees([id]);
  res.json(withBranches(emp, branchMap));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(employeeBranchesTable).where(eq(employeeBranchesTable.employeeId, id));
  await db.delete(employeesTable).where(eq(employeesTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
