import { db } from "@workspace/db";
import { shiftsTable } from "@workspace/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const SHIFT_CLOSED_MESSAGE =
  "لا يمكن إضافة أو تعديل أو حذف أي قائمة — لا توجد وردية مفتوحة لهذا الفرع. افتح وردية من إدارة الورديات أولاً.";

/** Returns true when the branch has an open (active, not closed) shift. */
export async function hasOpenShiftForBranch(branchId: number): Promise<boolean> {
  if (!Number.isFinite(branchId) || branchId <= 0) return false;
  const [openShift] = await db
    .select({ id: shiftsTable.id })
    .from(shiftsTable)
    .where(
      and(
        eq(shiftsTable.branchId, branchId),
        eq(shiftsTable.isActive, true),
        isNull(shiftsTable.closedAt)
      )
    )
    .limit(1);
  return Boolean(openShift);
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
