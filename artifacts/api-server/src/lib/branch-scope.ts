import type { Request } from "express";
import { eq, type SQL, type Column } from "drizzle-orm";

export type BranchScope = { mode: "all" } | { mode: "one"; branchId: number };

/** Read active branch from X-Branch-Id header or ?branchId= (all | number). */
export function parseBranchScope(req: Request): BranchScope {
  const header = (req.headers["x-branch-id"] as string | undefined)?.trim();
  const query = (req.query.branchId as string | undefined)?.trim();
  const raw = header || query;
  if (!raw || raw.toLowerCase() === "all") return { mode: "all" };
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return { mode: "all" };
  return { mode: "one", branchId: id };
}

export function branchEq(column: Column, scope: BranchScope): SQL | undefined {
  if (scope.mode === "all") return undefined;
  return eq(column, scope.branchId);
}

/** Resolve branch id for INSERT. Prefer body, then scoped header. */
export function resolveWriteBranchId(
  scope: BranchScope,
  bodyBranchId?: number | null
): number | null {
  if (typeof bodyBranchId === "number" && Number.isFinite(bodyBranchId) && bodyBranchId > 0) {
    return bodyBranchId;
  }
  if (scope.mode === "one") return scope.branchId;
  return null;
}
