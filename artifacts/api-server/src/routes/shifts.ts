import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  shiftsTable,
  shiftEmployeesTable,
  branchesTable,
  employeesTable,
} from "@workspace/db/schema";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { parseBranchScope, resolveWriteBranchId } from "../lib/branch-scope";

const router: IRouter = Router();

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_SET = new Set([0, 1, 2, 3, 4, 5, 6]);

function normalizeTime(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!TIME_RE.test(raw)) return null;
  return raw;
}

function parseDaysOfWeek(input: unknown): number[] {
  let arr: unknown[] = [];
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = input.split(",").map((s) => s.trim());
    }
  } else if (Array.isArray(input)) {
    arr = input;
  }
  const days = [
    ...new Set(
      arr
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d) && DAY_SET.has(d))
    ),
  ].sort((a, b) => a - b);
  return days.length > 0 ? days : [0, 1, 2, 3, 4, 5, 6];
}

function normalizeEmployeeIds(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  return [
    ...new Set(
      input
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];
}

function parseNonNegInt(value: unknown, fallback = 0, max = 24 * 60): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(max, Math.floor(n));
}

function durationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM <= startM) endM += 24 * 60;
  return endM - startM;
}

function isOvernight(startTime: string, endTime: string): boolean {
  return endTime <= startTime;
}

async function isDuplicateName(
  name: string,
  branchId: number,
  excludeId?: number
) {
  const normalized = name.trim().toLowerCase();
  const conditions = [
    sql`lower(${shiftsTable.name}) = ${normalized}`,
    eq(shiftsTable.branchId, branchId),
  ];
  if (excludeId != null) conditions.push(ne(shiftsTable.id, excludeId));
  const rows = await db
    .select({ id: shiftsTable.id })
    .from(shiftsTable)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

async function getEmployeeIdsForShifts(shiftIds: number[]) {
  const map = new Map<number, number[]>();
  if (shiftIds.length === 0) return map;
  const rows = await db
    .select()
    .from(shiftEmployeesTable)
    .where(inArray(shiftEmployeesTable.shiftId, shiftIds));
  for (const row of rows) {
    const list = map.get(row.shiftId) ?? [];
    list.push(row.employeeId);
    map.set(row.shiftId, list);
  }
  return map;
}

async function setShiftEmployees(shiftId: number, employeeIds: number[]) {
  await db
    .delete(shiftEmployeesTable)
    .where(eq(shiftEmployeesTable.shiftId, shiftId));
  if (employeeIds.length === 0) return;
  await db.insert(shiftEmployeesTable).values(
    employeeIds.map((employeeId) => ({ shiftId, employeeId }))
  );
}

function enrichShift(
  shift: typeof shiftsTable.$inferSelect,
  employeeIds: number[],
  employeeNameMap: Map<number, string>,
  branchNameMap: Map<number, string>
) {
  const daysOfWeek = parseDaysOfWeek(shift.daysOfWeek);
  const duration = durationMinutes(shift.startTime, shift.endTime);
  const breakMinutes = Math.max(0, Number(shift.breakMinutes) || 0);
  return {
    ...shift,
    daysOfWeek,
    employeeIds,
    employeeNames: employeeIds.map(
      (id) => employeeNameMap.get(id) ?? `#${id}`
    ),
    branchName: branchNameMap.get(shift.branchId) ?? `فرع #${shift.branchId}`,
    supervisorName: shift.supervisorEmployeeId
      ? employeeNameMap.get(shift.supervisorEmployeeId) ?? null
      : null,
    durationMinutes: duration,
    workMinutes: Math.max(0, duration - breakMinutes),
    isOvernight: isOvernight(shift.startTime, shift.endTime),
  };
}

router.get("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const conditions = [];
  if (scope.mode === "one") {
    conditions.push(eq(shiftsTable.branchId, scope.branchId));
  }

  const shifts = await db
    .select()
    .from(shiftsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(shiftsTable.createdAt));

  const employeeMap = await getEmployeeIdsForShifts(shifts.map((s) => s.id));
  const [branches, employees] = await Promise.all([
    db
      .select({ id: branchesTable.id, name: branchesTable.name })
      .from(branchesTable),
    db
      .select({ id: employeesTable.id, name: employeesTable.name })
      .from(employeesTable),
  ]);
  const branchNameMap = new Map(branches.map((b) => [b.id, b.name]));
  const employeeNameMap = new Map(employees.map((e) => [e.id, e.name]));

  res.json(
    shifts.map((s) =>
      enrichShift(
        s,
        employeeMap.get(s.id) ?? [],
        employeeNameMap,
        branchNameMap
      )
    )
  );
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }
  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id));
  if (!shift) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }
  const employeeMap = await getEmployeeIdsForShifts([id]);
  const [branches, employees] = await Promise.all([
    db
      .select({ id: branchesTable.id, name: branchesTable.name })
      .from(branchesTable),
    db
      .select({ id: employeesTable.id, name: employeesTable.name })
      .from(employeesTable),
  ]);
  const branchNameMap = new Map(branches.map((b) => [b.id, b.name]));
  const employeeNameMap = new Map(employees.map((e) => [e.id, e.name]));
  res.json(
    enrichShift(
      shift,
      employeeMap.get(id) ?? [],
      employeeNameMap,
      branchNameMap
    )
  );
});

router.post("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const {
    name,
    nameAr,
    code,
    branchId,
    startTime,
    endTime,
    breakMinutes,
    graceMinutes,
    daysOfWeek,
    color,
    supervisorEmployeeId,
    notes,
    isActive,
    employeeIds,
  } = req.body ?? {};

  const trimmedName = String(name ?? "").trim();
  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);
  const resolvedBranchId = resolveWriteBranchId(
    scope,
    branchId != null ? Number(branchId) : null
  );
  const staffIds = normalizeEmployeeIds(employeeIds);
  const days = parseDaysOfWeek(daysOfWeek);
  const breakMins = parseNonNegInt(breakMinutes, 0);
  const graceMins = parseNonNegInt(graceMinutes, 0, 180);
  const colorValue = String(color ?? "#0ea5e9").trim() || "#0ea5e9";
  const supervisorId =
    supervisorEmployeeId != null && Number(supervisorEmployeeId) > 0
      ? Number(supervisorEmployeeId)
      : null;

  if (!trimmedName) {
    res.status(400).json({ success: false, message: "اسم الوردية مطلوب" });
    return;
  }
  if (!resolvedBranchId) {
    res.status(400).json({ success: false, message: "اختر فرعاً للوردية" });
    return;
  }
  if (!start || !end) {
    res
      .status(400)
      .json({ success: false, message: "وقت البداية والنهاية بصيغة HH:mm" });
    return;
  }
  if (start === end) {
    res
      .status(400)
      .json({ success: false, message: "وقت البداية والنهاية لا يمكن أن يتساويا" });
    return;
  }
  const duration = durationMinutes(start, end);
  if (breakMins >= duration) {
    res.status(400).json({
      success: false,
      message: "دقائق الاستراحة يجب أن تكون أقل من مدة الوردية",
    });
    return;
  }
  if (await isDuplicateName(trimmedName, resolvedBranchId)) {
    res
      .status(400)
      .json({ success: false, message: "اسم الوردية مستخدم مسبقاً في هذا الفرع" });
    return;
  }

  if (supervisorId != null) {
    const [sup] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(eq(employeesTable.id, supervisorId))
      .limit(1);
    if (!sup) {
      res.status(400).json({ success: false, message: "المشرف غير موجود" });
      return;
    }
  }

  if (staffIds.length > 0) {
    const found = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(inArray(employeesTable.id, staffIds));
    if (found.length !== staffIds.length) {
      res
        .status(400)
        .json({ success: false, message: "بعض الموظفين المحددين غير موجودين" });
      return;
    }
  }

  const [created] = await db
    .insert(shiftsTable)
    .values({
      name: trimmedName,
      nameAr: String(nameAr ?? "").trim() || null,
      code: String(code ?? "").trim() || null,
      branchId: resolvedBranchId,
      startTime: start,
      endTime: end,
      breakMinutes: breakMins,
      graceMinutes: graceMins,
      daysOfWeek: JSON.stringify(days),
      color: colorValue,
      supervisorEmployeeId: supervisorId,
      notes: String(notes ?? "").trim() || null,
      isActive: isActive !== false,
    })
    .returning();

  await setShiftEmployees(created.id, staffIds);

  const employeeMap = await getEmployeeIdsForShifts([created.id]);
  const [branches, employees] = await Promise.all([
    db
      .select({ id: branchesTable.id, name: branchesTable.name })
      .from(branchesTable),
    db
      .select({ id: employeesTable.id, name: employeesTable.name })
      .from(employeesTable),
  ]);
  res.status(201).json(
    enrichShift(
      created,
      employeeMap.get(created.id) ?? [],
      new Map(employees.map((e) => [e.id, e.name])),
      new Map(branches.map((b) => [b.id, b.name]))
    )
  );
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }
  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id));
  if (!existing) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }

  const scope = parseBranchScope(req);
  const {
    name,
    nameAr,
    code,
    branchId,
    startTime,
    endTime,
    breakMinutes,
    graceMinutes,
    daysOfWeek,
    color,
    supervisorEmployeeId,
    notes,
    isActive,
    employeeIds,
  } = req.body ?? {};

  const trimmedName = String(name ?? existing.name).trim();
  const start = normalizeTime(startTime ?? existing.startTime);
  const end = normalizeTime(endTime ?? existing.endTime);
  const resolvedBranchId =
    resolveWriteBranchId(
      scope,
      branchId != null ? Number(branchId) : existing.branchId
    ) ?? existing.branchId;
  const staffIds =
    employeeIds !== undefined
      ? normalizeEmployeeIds(employeeIds)
      : (await getEmployeeIdsForShifts([id])).get(id) ?? [];
  const days =
    daysOfWeek !== undefined
      ? parseDaysOfWeek(daysOfWeek)
      : parseDaysOfWeek(existing.daysOfWeek);
  const breakMins = parseNonNegInt(
    breakMinutes ?? existing.breakMinutes,
    0
  );
  const graceMins = parseNonNegInt(
    graceMinutes ?? existing.graceMinutes,
    0,
    180
  );
  const colorValue =
    String(color ?? existing.color ?? "#0ea5e9").trim() || "#0ea5e9";
  const supervisorId =
    supervisorEmployeeId === null
      ? null
      : supervisorEmployeeId != null && Number(supervisorEmployeeId) > 0
        ? Number(supervisorEmployeeId)
        : existing.supervisorEmployeeId;

  if (!trimmedName) {
    res.status(400).json({ success: false, message: "اسم الوردية مطلوب" });
    return;
  }
  if (!start || !end) {
    res
      .status(400)
      .json({ success: false, message: "وقت البداية والنهاية بصيغة HH:mm" });
    return;
  }
  if (start === end) {
    res
      .status(400)
      .json({ success: false, message: "وقت البداية والنهاية لا يمكن أن يتساويا" });
    return;
  }
  const duration = durationMinutes(start, end);
  if (breakMins >= duration) {
    res.status(400).json({
      success: false,
      message: "دقائق الاستراحة يجب أن تكون أقل من مدة الوردية",
    });
    return;
  }
  if (await isDuplicateName(trimmedName, resolvedBranchId, id)) {
    res
      .status(400)
      .json({ success: false, message: "اسم الوردية مستخدم مسبقاً في هذا الفرع" });
    return;
  }

  const [updated] = await db
    .update(shiftsTable)
    .set({
      name: trimmedName,
      nameAr: String(nameAr ?? existing.nameAr ?? "").trim() || null,
      code: String(code ?? existing.code ?? "").trim() || null,
      branchId: resolvedBranchId,
      startTime: start,
      endTime: end,
      breakMinutes: breakMins,
      graceMinutes: graceMins,
      daysOfWeek: JSON.stringify(days),
      color: colorValue,
      supervisorEmployeeId: supervisorId,
      notes: String(notes ?? existing.notes ?? "").trim() || null,
      isActive: isActive !== undefined ? isActive !== false : existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(shiftsTable.id, id))
    .returning();

  await setShiftEmployees(id, staffIds);

  const employeeMap = await getEmployeeIdsForShifts([id]);
  const [branches, employees] = await Promise.all([
    db
      .select({ id: branchesTable.id, name: branchesTable.name })
      .from(branchesTable),
    db
      .select({ id: employeesTable.id, name: employeesTable.name })
      .from(employeesTable),
  ]);
  res.json(
    enrichShift(
      updated,
      employeeMap.get(id) ?? [],
      new Map(employees.map((e) => [e.id, e.name])),
      new Map(branches.map((b) => [b.id, b.name]))
    )
  );
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }
  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id));
  if (!existing) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }
  await db.delete(shiftsTable).where(eq(shiftsTable.id, id));
  res.json({ success: true, message: "تم حذف الوردية" });
});

export default router;
