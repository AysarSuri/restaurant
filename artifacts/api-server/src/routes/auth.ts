import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  employeesTable,
  employeeBranchesTable,
  restaurantTablesTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  safeEqualPin,
  signAuthToken,
  type AuthRole,
} from "../lib/auth-token";
import { ensureEmployeeColumns } from "../lib/ensure-employee-columns";
import { logger } from "../lib/logger";
import type { AuthedRequest } from "../middleware/require-auth";

const router: IRouter = Router();

const ALL_BRANCH_ROLES = new Set(["admin", "manager"]);
const failedLogins = new Map<string, { count: number; resetAt: number }>();

function tableLoginPin() {
  return (process.env.TABLE_LOGIN_PIN || "1234").trim();
}

function trackFailedLogin(key: string) {
  const now = Date.now();
  const cur = failedLogins.get(key);
  if (!cur || cur.resetAt < now) {
    failedLogins.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return 1;
  }
  cur.count += 1;
  failedLogins.set(key, cur);
  return cur.count;
}

function clearFailedLogin(key: string) {
  failedLogins.delete(key);
}

router.post("/login", async (req, res) => {
  await ensureEmployeeColumns();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const role = String(body.role ?? "").trim() as AuthRole | "";
  const pin = String(body.pin ?? "");
  const ip = String(req.ip || req.socket.remoteAddress || "unknown");
  const failKey = `${ip}:${role}`;

  if (!role) {
    res.status(400).json({ success: false, message: "اختر الدور أولاً" });
    return;
  }
  if (!pin) {
    res.status(400).json({ success: false, message: "أدخل رمز الدخول" });
    return;
  }

  // Table / waiter device login
  if (role === "table" || role === "waiter") {
    const tableId = Number(body.tableId);
    if (!Number.isFinite(tableId) || tableId <= 0) {
      res.status(400).json({ success: false, message: "اختر الطاولة" });
      return;
    }
    if (!safeEqualPin(pin, tableLoginPin())) {
      const n = trackFailedLogin(failKey);
      logger.warn({ ip, role, tableId, attempts: n }, "failed table login");
      res.status(401).json({ success: false, message: "رمز الدخول غير صحيح" });
      return;
    }
    const [table] = await db
      .select()
      .from(restaurantTablesTable)
      .where(eq(restaurantTablesTable.id, tableId))
      .limit(1);
    if (!table) {
      res.status(404).json({ success: false, message: "الطاولة غير موجودة" });
      return;
    }
    clearFailedLogin(failKey);
    const token = signAuthToken({
      role: "table",
      name: `طاولة ${table.number}`,
      tableId: table.id,
      tableNumber: table.number,
      allBranches: false,
      branchIds: table.branchId != null ? [table.branchId] : [],
    });
    res.json({
      success: true,
      token,
      user: {
        name: `طاولة ${table.number}`,
        role: "table" as const,
        tableId: table.id,
        tableNumber: table.number,
        allBranches: false,
        branchIds: table.branchId != null ? [table.branchId] : [],
        selectedBranchId: table.branchId ?? undefined,
      },
    });
    return;
  }

  const employeeId = Number(body.employeeId);
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    res.status(400).json({ success: false, message: "اختر الموظف" });
    return;
  }

  const [emp] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId))
    .limit(1);
  if (!emp || emp.isActive === false) {
    res.status(401).json({ success: false, message: "الموظف غير موجود أو غير نشط" });
    return;
  }

  if (role !== emp.role) {
    res.status(401).json({
      success: false,
      message: "الدور لا يطابق الموظف المحدد",
    });
    return;
  }

  const expectedPin = (emp.pin && String(emp.pin).trim()) || "1234";
  if (!safeEqualPin(pin, expectedPin)) {
    const n = trackFailedLogin(failKey);
    logger.warn({ ip, role, employeeId, attempts: n }, "failed employee login");
    res.status(401).json({ success: false, message: "رمز الدخول غير صحيح" });
    return;
  }

  const branchRows = await db
    .select()
    .from(employeeBranchesTable)
    .where(eq(employeeBranchesTable.employeeId, emp.id));
  const allBranches =
    ALL_BRANCH_ROLES.has(emp.role) || Boolean(emp.allBranches);
  const branchIds = allBranches
    ? []
    : branchRows.map((r) => r.branchId).filter((id) => Number.isFinite(id));

  clearFailedLogin(failKey);
  const authRole = emp.role as AuthRole;
  const listPermissions =
    emp.listPermissions && typeof emp.listPermissions === "object"
      ? (emp.listPermissions as Record<string, unknown>)
      : {};

  const token = signAuthToken({
    role: authRole,
    name: emp.name,
    employeeId: emp.id,
    allBranches,
    branchIds,
    listPermissions,
  });

  res.json({
    success: true,
    token,
    user: {
      name: emp.name,
      role: authRole,
      employeeId: emp.id,
      allBranches,
      branchIds,
      listPermissions,
      menuCanAccess: emp.menuCanAccess,
      menuCanCreate: emp.menuCanCreate,
      menuCanEditNew: emp.menuCanEditNew,
      menuCanEditOld: emp.menuCanEditOld,
      menuCanDeleteNew: emp.menuCanDeleteNew,
      menuCanDeleteOld: emp.menuCanDeleteOld,
    },
  });
});

router.get("/me", (req: AuthedRequest, res) => {
  if (!req.auth) {
    res.status(401).json({ success: false, message: "غير مسجل" });
    return;
  }
  res.json({ success: true, user: req.auth });
});

export default router;
