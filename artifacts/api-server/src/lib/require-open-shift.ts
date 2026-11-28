import { db } from "@workspace/db";
import { shiftsTable } from "@workspace/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

export const SHIFT_CLOSED_MESSAGE =
  "لا يمكن إضافة أو تعديل أو حذف أي قائمة — لا توجد وردية مفتوحة لهذا الفرع. افتح وردية من إدارة الورديات أولاً.";

/**
 * Open shift for a branch = closedAt IS NULL (per branch, not per device).
 * isActive alone is not enough — heal stale rows when found.
 */
export async function getOpenShiftForBranch(
  branchId: number | null | undefined
): Promise<{ id: number; branchId: number } | null> {
  if (branchId == null || !Number.isFinite(Number(branchId)) || Number(branchId) <= 0) {
    return null;
  }
  const bid = Number(branchId);
  const [openShift] = await db
    .select({
      id: shiftsTable.id,
      branchId: shiftsTable.branchId,
      isActive: shiftsTable.isActive,
    })
    .from(shiftsTable)
    .where(and(eq(shiftsTable.branchId, bid), isNull(shiftsTable.closedAt)))
    .orderBy(desc(shiftsTable.openedAt))
    .limit(1);
  if (!openShift) return null;
  if (openShift.isActive === false) {
    await db
      .update(shiftsTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(eq(shiftsTable.id, openShift.id), isNull(shiftsTable.closedAt)));
  }
  return { id: openShift.id, branchId: openShift.branchId };
}

/** Returns true when the branch has an open (active, not closed) shift. */
export async function hasOpenShiftForBranch(branchId: number): Promise<boolean> {
  return Boolean(await getOpenShiftForBranch(branchId));
}

/**
 * Ensures the branch has an open shift before create / update / delete
 * of any transactional list. Returns an Arabic error message when blocked.
 */
export async function requireOpenShiftForBranch(
  branchId: number | null | undefined
): Promise<string | null> {
  if (branchId == null || !Number.isFinite(Number(branchId)) || Number(branchId) <= 0) {
    return "اختر فرعاً أولاً — لا يمكن حفظ أو تعديل قائمة بدون فرع ووردية مفتوحة.";
  }
  const ok = await hasOpenShiftForBranch(Number(branchId));
  return ok ? null : SHIFT_CLOSED_MESSAGE;
}
