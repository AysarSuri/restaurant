import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { shiftsTable, branchesTable } from "@workspace/db/schema";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { parseBranchScope, resolveWriteBranchId } from "../lib/branch-scope";
import { ensureSalesDeviceColumns } from "../lib/ensure-sales-columns";

const router: IRouter = Router();

export type ShiftKind = "morning" | "evening";

const KIND_META: Record<
  ShiftKind,
  { name: string; color: string; startDefault: string; endDefault: string }
> = {
  morning: {
    name: "صباحية",
    color: "#0ea5e9",
    startDefault: "08:00",
    endDefault: "16:00",
  },
  evening: {
    name: "مسائية",
    color: "#64748b",
    startDefault: "16:00",
    endDefault: "00:00",
  },
};

function normalizeKind(value: unknown): ShiftKind | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "morning" || raw === "صباحية" || raw === "صباحي") return "morning";
  if (raw === "evening" || raw === "مسائية" || raw === "مسائي") return "evening";
  return null;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatHm(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function dayBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

function parseOpenDate(value: unknown): Date | null {
  if (value == null || value === "") return new Date();
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    const now = new Date();
    return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeShift(
  shift: typeof shiftsTable.$inferSelect,
  branchName?: string | null
) {
  const kind = (normalizeKind(shift.kind) ??
    (String(shift.color).toLowerCase().includes("64748b") ? "evening" : "morning")) as ShiftKind;
  const meta = KIND_META[kind];
  const openedAt = shift.openedAt ? new Date(shift.openedAt) : new Date(shift.createdAt);
  const closedAt = shift.closedAt ? new Date(shift.closedAt) : null;
  const isOpen = closedAt == null && shift.isActive !== false;
  return {
    id: shift.id,
    kind,
    name: meta.name,
    branchId: shift.branchId,
    branchName: branchName ?? null,
    color: meta.color,
    openedAt: openedAt.toISOString(),
    closedAt: closedAt ? closedAt.toISOString() : null,
    openDate: `${openedAt.getFullYear()}-${pad2(openedAt.getMonth() + 1)}-${pad2(openedAt.getDate())}`,
    startTime: formatHm(openedAt),
    endTime: closedAt ? formatHm(closedAt) : null,
    notes: shift.notes ?? null,
    isActive: isOpen,
    isOpen,
    createdAt: shift.createdAt,
    updatedAt: shift.updatedAt,
  };
}

router.get("/", async (req, res) => {
  await ensureSalesDeviceColumns();
  const scope = parseBranchScope(req);
  const conditions = [];
  if (scope.mode === "one") {
    conditions.push(eq(shiftsTable.branchId, scope.branchId));
  }

  const shifts = await db
    .select({
      shift: shiftsTable,
      branchName: branchesTable.name,
    })
    .from(shiftsTable)
    .leftJoin(branchesTable, eq(shiftsTable.branchId, branchesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(shiftsTable.openedAt), desc(shiftsTable.createdAt));

  res.json(shifts.map((r) => serializeShift(r.shift, r.branchName)));
});

router.get("/:id", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }
  const [row] = await db
    .select({
      shift: shiftsTable,
      branchName: branchesTable.name,
    })
    .from(shiftsTable)
    .leftJoin(branchesTable, eq(shiftsTable.branchId, branchesTable.id))
    .where(eq(shiftsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }
  res.json(serializeShift(row.shift, row.branchName));
});

/** Open a new morning/evening shift for a branch. */
router.post("/", async (req, res) => {
  await ensureSalesDeviceColumns();
  const scope = parseBranchScope(req);
  const { kind, branchId, notes, openedAt: openedAtRaw } = req.body ?? {};

  const normalizedKind = normalizeKind(kind);
  if (!normalizedKind) {
    res.status(400).json({ success: false, message: "اختر وردية صباحية أو مسائية" });
    return;
  }
  const resolvedBranchId = resolveWriteBranchId(
    scope,
    branchId != null ? Number(branchId) : null
  );
  if (!resolvedBranchId) {
    res.status(400).json({ success: false, message: "اختر فرعاً للوردية" });
    return;
  }

  const openedAt = parseOpenDate(openedAtRaw);
  if (!openedAt) {
    res.status(400).json({ success: false, message: "تاريخ افتتاح الوردية غير صالح" });
    return;
  }

  const meta = KIND_META[normalizedKind];
  const { start: dayStart, end: dayEnd } = dayBounds(openedAt);

  // Only one open shift per branch (morning or evening)
  const [openOnBranch] = await db
    .select({
      id: shiftsTable.id,
      kind: shiftsTable.kind,
      name: shiftsTable.name,
    })
    .from(shiftsTable)
    .where(
      and(
        eq(shiftsTable.branchId, resolvedBranchId),
        eq(shiftsTable.isActive, true),
        isNull(shiftsTable.closedAt)
      )
    )
    .limit(1);
  if (openOnBranch) {
    const openMeta =
      KIND_META[normalizeKind(openOnBranch.kind) ?? "morning"] ?? meta;
    res.status(400).json({
      success: false,
      message: `لا يمكن فتح وردية جديدة — يوجد وردية ${openMeta.name} مفتوحة لهذا الفرع. أغلقها أولاً ثم افتح وردية أخرى.`,
    });
    return;
  }

  // One shift of this kind per branch per calendar day
  const [sameDay] = await db
    .select({ id: shiftsTable.id })
    .from(shiftsTable)
    .where(
      and(
        eq(shiftsTable.branchId, resolvedBranchId),
        eq(shiftsTable.kind, normalizedKind),
        gte(shiftsTable.openedAt, dayStart),
        lte(shiftsTable.openedAt, dayEnd)
      )
    )
    .limit(1);
  if (sameDay) {
    res.status(400).json({
      success: false,
      message: `وردية ${meta.name} موجودة مسبقاً لهذا الفرع في نفس اليوم`,
    });
    return;
  }

  const [created] = await db
    .insert(shiftsTable)
    .values({
      name: meta.name,
      kind: normalizedKind,
      branchId: resolvedBranchId,
      startTime: formatHm(openedAt),
      endTime: meta.endDefault,
      breakMinutes: 0,
      graceMinutes: 0,
      daysOfWeek: "[0,1,2,3,4,5,6]",
      color: meta.color,
      openedAt,
      closedAt: null,
      notes: notes != null ? String(notes).trim() || null : null,
      isActive: true,
    })
    .returning();

  const [branch] = await db
    .select({ name: branchesTable.name })
    .from(branchesTable)
    .where(eq(branchesTable.id, resolvedBranchId))
    .limit(1);

  res.status(201).json(serializeShift(created, branch?.name ?? null));
});

/** Update notes / or close shift when closedAt / close=true */
router.put("/:id", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }
  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }

  const { notes, close, closedAt: closedAtRaw } = req.body ?? {};
  const patch: Partial<typeof shiftsTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (notes !== undefined) {
    patch.notes = String(notes ?? "").trim() || null;
  }

  const wantsClose = close === true || closedAtRaw != null;
  if (wantsClose) {
    if (existing.closedAt) {
      res.status(400).json({ success: false, message: "الوردية مغلقة مسبقاً" });
      return;
    }
    let closedAt = new Date();
    if (closedAtRaw != null && closedAtRaw !== "") {
      const parsed = new Date(String(closedAtRaw));
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ success: false, message: "وقت الإغلاق غير صالح" });
        return;
      }
      closedAt = parsed;
    }
    const openedAt = existing.openedAt ? new Date(existing.openedAt) : new Date(existing.createdAt);
    if (closedAt.getTime() < openedAt.getTime()) {
      res.status(400).json({ success: false, message: "وقت الإغلاق قبل وقت الافتتاح" });
      return;
    }
    patch.closedAt = closedAt;
    patch.endTime = formatHm(closedAt);
    patch.isActive = false;
  }

  const [updated] = await db
    .update(shiftsTable)
    .set(patch)
    .where(eq(shiftsTable.id, id))
    .returning();

  const [branch] = await db
    .select({ name: branchesTable.name })
    .from(branchesTable)
    .where(eq(branchesTable.id, updated.branchId))
    .limit(1);

  res.json(serializeShift(updated, branch?.name ?? null));
});

router.post("/:id/close", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }
  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }
  if (existing.closedAt) {
    res.status(400).json({ success: false, message: "الوردية مغلقة مسبقاً" });
    return;
  }
  const closedAt = new Date();
  const [updated] = await db
    .update(shiftsTable)
    .set({
      closedAt,
      endTime: formatHm(closedAt),
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(shiftsTable.id, id))
    .returning();

  const [branch] = await db
    .select({ name: branchesTable.name })
    .from(branchesTable)
    .where(eq(branchesTable.id, updated.branchId))
    .limit(1);

  res.json(serializeShift(updated, branch?.name ?? null));
});

router.delete("/:id", async (req, res) => {
  await ensureSalesDeviceColumns();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "معرف غير صالح" });
    return;
  }
  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "الوردية غير موجودة" });
    return;
  }
  await db.delete(shiftsTable).where(eq(shiftsTable.id, id));
  res.json({ success: true, message: "تم حذف الوردية" });
});

export default router;
