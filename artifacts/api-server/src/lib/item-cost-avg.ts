import { db } from "@workspace/db";
import {
  menuItemsTable,
  supplierPurchasesTable,
  supplierPurchaseItemsTable,
  supplierReturnsTable,
  supplierReturnItemsTable,
  ordersTable,
  orderItemsTable,
} from "@workspace/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { toMinorQty } from "./warehouse-stock";

export type CostLineInput = {
  menuItemId: number;
  qty: number | string;
  unitKind: string;
  /** Invoice line price for the chosen unitKind (major or minor) */
  price: number | string;
};

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Convert invoice unit price → cost per minor unit (عدد). */
export function priceToMinor(
  price: number,
  unitKind: string | null | undefined,
  subunitQty: number
) {
  const sub = Math.max(1, subunitQty || 1);
  const p = Math.max(0, num(price));
  if (String(unitKind).toLowerCase() === "major") {
    return Number((p / sub).toFixed(6));
  }
  return Number(p.toFixed(6));
}

/**
 * Global remaining stock in minor units for a menu item
 * (all branches): purchases − returns − sales.
 * Optionally exclude one purchase/return invoice (for edits).
 */
export async function getRemainingMinor(
  menuItemId: number,
  opts?: { excludePurchaseId?: number; excludeReturnId?: number }
): Promise<number> {
  const [menu] = await db
    .select({ subunitQty: menuItemsTable.subunitQty })
    .from(menuItemsTable)
    .where(eq(menuItemsTable.id, menuItemId))
    .limit(1);
  const sub = Math.max(1, menu?.subunitQty ?? 1);

  const purchaseRows = await db
    .select({
      purchaseId: supplierPurchaseItemsTable.purchaseId,
      qty: supplierPurchaseItemsTable.qty,
      unitKind: supplierPurchaseItemsTable.unitKind,
    })
    .from(supplierPurchaseItemsTable)
    .innerJoin(
      supplierPurchasesTable,
      eq(supplierPurchasesTable.id, supplierPurchaseItemsTable.purchaseId)
    )
    .where(eq(supplierPurchaseItemsTable.menuItemId, menuItemId));

  const returnRows = await db
    .select({
      returnId: supplierReturnItemsTable.returnId,
      qty: supplierReturnItemsTable.qty,
      unitKind: supplierReturnItemsTable.unitKind,
    })
    .from(supplierReturnItemsTable)
    .innerJoin(
      supplierReturnsTable,
      eq(supplierReturnsTable.id, supplierReturnItemsTable.returnId)
    )
    .where(eq(supplierReturnItemsTable.menuItemId, menuItemId));

  const saleRows = await db
    .select({ quantity: orderItemsTable.quantity })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .where(
      and(eq(orderItemsTable.menuItemId, menuItemId), ne(ordersTable.status, "cancelled"))
    );

  let purchased = 0;
  for (const r of purchaseRows) {
    if (opts?.excludePurchaseId != null && r.purchaseId === opts.excludePurchaseId) continue;
    purchased += toMinorQty(num(r.qty), r.unitKind, sub);
  }
  let returned = 0;
  for (const r of returnRows) {
    if (opts?.excludeReturnId != null && r.returnId === opts.excludeReturnId) continue;
    returned += toMinorQty(num(r.qty), r.unitKind, sub);
  }
  const sold = saleRows.reduce((s, r) => s + num(r.quantity), 0);
  return Number((purchased - returned - sold).toFixed(6));
}

type ItemState = { Q: number; C: number; subunitQty: number };

async function loadStates(menuItemIds: number[]): Promise<Map<number, ItemState>> {
  const ids = [...new Set(menuItemIds.filter((id) => Number.isFinite(id) && id > 0))];
  const map = new Map<number, ItemState>();
  for (const id of ids) {
    const [row] = await db
      .select({
        cost: menuItemsTable.cost,
        subunitQty: menuItemsTable.subunitQty,
      })
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, id))
      .limit(1);
    if (!row) continue;
    const Q = await getRemainingMinor(id);
    map.set(id, {
      Q,
      C: Math.max(0, num(row.cost)),
      subunitQty: Math.max(1, row.subunitQty ?? 1),
    });
  }
  return map;
}

function applyAdd(state: ItemState, q: number, p: number): ItemState {
  if (!(q > 0)) return state;
  const den = state.Q + q;
  if (Math.abs(den) < 1e-9) {
    return { ...state, Q: 0, C: p };
  }
  return {
    ...state,
    Q: den,
    C: Number(((state.Q * state.C + q * p) / den).toFixed(6)),
  };
}

function applyRemove(state: ItemState, q: number, p: number): ItemState {
  if (!(q > 0)) return state;
  const den = state.Q - q;
  if (Math.abs(den) < 1e-9) {
    /** Stock emptied — keep last known minor cost */
    return { ...state, Q: 0, C: state.C };
  }
  return {
    ...state,
    Q: den,
    C: Number(((state.Q * state.C - q * p) / den).toFixed(6)),
  };
}

async function persistCosts(states: Map<number, ItemState>) {
  for (const [id, st] of states) {
    const cost = Math.max(0, Number(st.C.toFixed(2)));
    await db
      .update(menuItemsTable)
      .set({ cost: cost.toFixed(2) })
      .where(eq(menuItemsTable.id, id));
  }
}

function lineMinor(line: CostLineInput, subunitQty: number) {
  const q = toMinorQty(num(line.qty), line.unitKind, subunitQty);
  const p = priceToMinor(num(line.price), line.unitKind, subunitQty);
  return { q, p };
}

/**
 * 1) Purchase create / 2) Return delete:
 * (Q*C + q*p) / (Q + q)
 */
export async function applyWeightedCostAdd(lines: CostLineInput[]) {
  if (!lines.length) return;
  const states = await loadStates(lines.map((l) => l.menuItemId));
  for (const line of lines) {
    const st = states.get(line.menuItemId);
    if (!st) continue;
    const { q, p } = lineMinor(line, st.subunitQty);
    states.set(line.menuItemId, applyAdd(st, q, p));
  }
  await persistCosts(states);
}

/**
 * 3) Return create / 4) Purchase delete:
 * (Q*C - q*p) / (Q - q)
 */
export async function applyWeightedCostRemove(lines: CostLineInput[]) {
  if (!lines.length) return;
  const states = await loadStates(lines.map((l) => l.menuItemId));
  for (const line of lines) {
    const st = states.get(line.menuItemId);
    if (!st) continue;
    const { q, p } = lineMinor(line, st.subunitQty);
    states.set(line.menuItemId, applyRemove(st, q, p));
  }
  await persistCosts(states);
}

/**
 * Purchase update: reverse old lines then apply new lines (in memory on same Q/C).
 */
export async function applyWeightedCostPurchaseReplace(
  oldLines: CostLineInput[],
  newLines: CostLineInput[]
) {
  const ids = [
    ...oldLines.map((l) => l.menuItemId),
    ...newLines.map((l) => l.menuItemId),
  ];
  const states = await loadStates(ids);
  for (const line of oldLines) {
    const st = states.get(line.menuItemId);
    if (!st) continue;
    const { q, p } = lineMinor(line, st.subunitQty);
    states.set(line.menuItemId, applyRemove(st, q, p));
  }
  for (const line of newLines) {
    const st = states.get(line.menuItemId);
    if (!st) continue;
    const { q, p } = lineMinor(line, st.subunitQty);
    states.set(line.menuItemId, applyAdd(st, q, p));
  }
  await persistCosts(states);
}

/**
 * Return update: reverse old return (add back) then apply new return (remove).
 */
export async function applyWeightedCostReturnReplace(
  oldLines: CostLineInput[],
  newLines: CostLineInput[]
) {
  const ids = [
    ...oldLines.map((l) => l.menuItemId),
    ...newLines.map((l) => l.menuItemId),
  ];
  const states = await loadStates(ids);
  for (const line of oldLines) {
    const st = states.get(line.menuItemId);
    if (!st) continue;
    const { q, p } = lineMinor(line, st.subunitQty);
    states.set(line.menuItemId, applyAdd(st, q, p));
  }
  for (const line of newLines) {
    const st = states.get(line.menuItemId);
    if (!st) continue;
    const { q, p } = lineMinor(line, st.subunitQty);
    states.set(line.menuItemId, applyRemove(st, q, p));
  }
  await persistCosts(states);
}

export function mapDbItemsToCostLines(
  rows: {
    menuItemId: number;
    qty: string | number;
    unitKind: string;
    price: string | number;
  }[]
): CostLineInput[] {
  return rows.map((r) => ({
    menuItemId: r.menuItemId,
    qty: r.qty,
    unitKind: r.unitKind,
    price: r.price,
  }));
}
