import { db } from "@workspace/db";
import {
  menuItemsTable,
  menuCategoriesTable,
  supplierPurchasesTable,
  supplierPurchaseItemsTable,
  supplierReturnsTable,
  supplierReturnItemsTable,
  ordersTable,
  orderItemsTable,
} from "@workspace/db/schema";
import { and, eq, gte, lte, ne, sql, type SQL } from "drizzle-orm";
import type { BranchScope } from "./branch-scope";
import { branchEq } from "./branch-scope";

export type WarehouseStockRow = {
  menuItemId: number;
  code: string;
  name: string;
  nameAr: string;
  categoryId: number;
  categoryName: string;
  categoryNameAr: string;
  majorUnit: string | null;
  minorUnit: string;
  subunitQty: number;
  costPerMinor: number;
  purchasedMinor: number;
  returnedMinor: number;
  soldMinor: number;
  remainingMinor: number;
  remainingMajor: number;
  remainingMinorPart: number;
  remainingLabel: string;
  totalCost: number;
};

export type WarehouseMovementLine = {
  id: number;
  date: string;
  time?: string | null;
  docNo: string;
  qty: number;
  unitKind: "major" | "minor" | "sale";
  unitLabel: string;
  qtyMinor: number;
  amount?: number;
  note?: string | null;
};

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function itemCode(id: number) {
  return `ITM-${String(id).padStart(4, "0")}`;
}

export function toMinorQty(
  qty: number,
  unitKind: string | null | undefined,
  subunitQty: number
) {
  const sub = Math.max(1, subunitQty || 1);
  const q = Math.abs(num(qty));
  if (String(unitKind).toLowerCase() === "major") return q * sub;
  return q;
}

export function splitMinor(
  remainingMinor: number,
  subunitQty: number,
  majorUnit: string | null | undefined,
  minorUnit: string
) {
  const sub = Math.max(1, subunitQty || 1);
  const signed = num(remainingMinor);
  const abs = Math.abs(signed);
  const major = Math.floor(abs / sub);
  const minorPart = Number((abs % sub).toFixed(3));
  const majorLabel = (majorUnit ?? "").trim() || null;
  const minorLabel = (minorUnit ?? "").trim() || "عدد";

  let label: string;
  if (majorLabel && sub > 1) {
    const parts: string[] = [];
    if (major > 0) parts.push(`${major} ${majorLabel}`);
    if (minorPart > 0 || major === 0) parts.push(`${minorPart} ${minorLabel}`);
    label = parts.join(" و ");
  } else {
    label = `${signed} ${minorLabel}`;
  }

  if (signed < 0 && !label.startsWith("-")) label = `− ${label}`;

  return {
    remainingMajor: signed < 0 ? -major : major,
    remainingMinorPart: signed < 0 ? -minorPart : minorPart,
    remainingLabel: label,
  };
}

function parseDayStart(raw?: string | null) {
  if (!raw) return null;
  const d = new Date(String(raw).slice(0, 10) + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDayEnd(raw?: string | null) {
  if (!raw) return null;
  const d = new Date(String(raw).slice(0, 10) + "T23:59:59.999");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Stockable menu items = have cost (same rule as supplier purchase lists). */
export async function listWarehouseStock(scope: BranchScope): Promise<WarehouseStockRow[]> {
  const items = await db
    .select({
      id: menuItemsTable.id,
      name: menuItemsTable.name,
      nameAr: menuItemsTable.nameAr,
      categoryId: menuItemsTable.categoryId,
      categoryName: menuCategoriesTable.name,
      categoryNameAr: menuCategoriesTable.nameAr,
      cost: menuItemsTable.cost,
      majorUnit: menuItemsTable.majorUnit,
      minorUnit: menuItemsTable.minorUnit,
      subunitQty: menuItemsTable.subunitQty,
    })
    .from(menuItemsTable)
    .leftJoin(menuCategoriesTable, eq(menuCategoriesTable.id, menuItemsTable.categoryId))
    .where(sql`${menuItemsTable.cost} is not null and ${menuItemsTable.cost}::numeric > 0`)
    .orderBy(menuItemsTable.nameAr);

  if (items.length === 0) return [];

  const purchaseConds: SQL[] = [];
  const returnConds: SQL[] = [];
  const salesConds: SQL[] = [ne(ordersTable.status, "cancelled")];
  const pBranch = branchEq(supplierPurchasesTable.branchId, scope);
  const rBranch = branchEq(supplierReturnsTable.branchId, scope);
  const oBranch = branchEq(ordersTable.branchId, scope);
  if (pBranch) purchaseConds.push(pBranch);
  if (rBranch) returnConds.push(rBranch);
  if (oBranch) salesConds.push(oBranch);

  const purchaseLines = await db
    .select({
      menuItemId: supplierPurchaseItemsTable.menuItemId,
      qty: supplierPurchaseItemsTable.qty,
      unitKind: supplierPurchaseItemsTable.unitKind,
      subunitQty: menuItemsTable.subunitQty,
    })
    .from(supplierPurchaseItemsTable)
    .innerJoin(
      supplierPurchasesTable,
      eq(supplierPurchasesTable.id, supplierPurchaseItemsTable.purchaseId)
    )
    .innerJoin(menuItemsTable, eq(menuItemsTable.id, supplierPurchaseItemsTable.menuItemId))
    .where(purchaseConds.length ? and(...purchaseConds) : undefined);

  const returnLines = await db
    .select({
      menuItemId: supplierReturnItemsTable.menuItemId,
      qty: supplierReturnItemsTable.qty,
      unitKind: supplierReturnItemsTable.unitKind,
      subunitQty: menuItemsTable.subunitQty,
    })
    .from(supplierReturnItemsTable)
    .innerJoin(
      supplierReturnsTable,
      eq(supplierReturnsTable.id, supplierReturnItemsTable.returnId)
    )
    .innerJoin(menuItemsTable, eq(menuItemsTable.id, supplierReturnItemsTable.menuItemId))
    .where(returnConds.length ? and(...returnConds) : undefined);

  const saleLines = await db
    .select({
      menuItemId: orderItemsTable.menuItemId,
      quantity: orderItemsTable.quantity,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .where(and(...salesConds));

  const purchased = new Map<number, number>();
  const returned = new Map<number, number>();
  const sold = new Map<number, number>();

  for (const line of purchaseLines) {
    const add = toMinorQty(num(line.qty), line.unitKind, line.subunitQty ?? 1);
    purchased.set(line.menuItemId, (purchased.get(line.menuItemId) ?? 0) + add);
  }
  for (const line of returnLines) {
    const add = toMinorQty(num(line.qty), line.unitKind, line.subunitQty ?? 1);
    returned.set(line.menuItemId, (returned.get(line.menuItemId) ?? 0) + add);
  }
  for (const line of saleLines) {
    sold.set(line.menuItemId, (sold.get(line.menuItemId) ?? 0) + num(line.quantity));
  }

  return items.map((it) => {
    const sub = Math.max(1, it.subunitQty ?? 1);
    const minorUnit = (it.minorUnit ?? "").trim() || "عدد";
    const cost = num(it.cost);
    const purchasedMinor = purchased.get(it.id) ?? 0;
    const returnedMinor = returned.get(it.id) ?? 0;
    const soldMinor = sold.get(it.id) ?? 0;
    const remainingMinor = Number(
      (purchasedMinor - returnedMinor - soldMinor).toFixed(3)
    );
    const split = splitMinor(remainingMinor, sub, it.majorUnit, minorUnit);
    const totalCost = Number((remainingMinor * cost).toFixed(2));
    return {
      menuItemId: it.id,
      code: itemCode(it.id),
      name: it.name,
      nameAr: it.nameAr,
      categoryId: it.categoryId,
      categoryName: it.categoryName ?? "",
      categoryNameAr: it.categoryNameAr ?? "",
      majorUnit: it.majorUnit,
      minorUnit,
      subunitQty: sub,
      costPerMinor: cost,
      purchasedMinor,
      returnedMinor,
      soldMinor,
      remainingMinor,
      remainingMajor: split.remainingMajor,
      remainingMinorPart: split.remainingMinorPart,
      remainingLabel: split.remainingLabel,
      totalCost,
    };
  });
}

export async function getWarehouseItemMovements(
  menuItemId: number,
  scope: BranchScope,
  fromDate?: string | null,
  toDate?: string | null
) {
  const [item] = await db
    .select({
      id: menuItemsTable.id,
      name: menuItemsTable.name,
      nameAr: menuItemsTable.nameAr,
      categoryId: menuItemsTable.categoryId,
      categoryName: menuCategoriesTable.name,
      categoryNameAr: menuCategoriesTable.nameAr,
      cost: menuItemsTable.cost,
      majorUnit: menuItemsTable.majorUnit,
      minorUnit: menuItemsTable.minorUnit,
      subunitQty: menuItemsTable.subunitQty,
    })
    .from(menuItemsTable)
    .leftJoin(menuCategoriesTable, eq(menuCategoriesTable.id, menuItemsTable.categoryId))
    .where(eq(menuItemsTable.id, menuItemId))
    .limit(1);

  if (!item) return null;

  const sub = Math.max(1, item.subunitQty ?? 1);
  const minorUnit = (item.minorUnit ?? "").trim() || "عدد";
  const from = parseDayStart(fromDate);
  const to = parseDayEnd(toDate);

  const purchaseConds: SQL[] = [eq(supplierPurchaseItemsTable.menuItemId, menuItemId)];
  const returnConds: SQL[] = [eq(supplierReturnItemsTable.menuItemId, menuItemId)];
  const salesConds: SQL[] = [
    eq(orderItemsTable.menuItemId, menuItemId),
    ne(ordersTable.status, "cancelled"),
  ];

  const pBranch = branchEq(supplierPurchasesTable.branchId, scope);
  const rBranch = branchEq(supplierReturnsTable.branchId, scope);
  const oBranch = branchEq(ordersTable.branchId, scope);
  if (pBranch) purchaseConds.push(pBranch);
  if (rBranch) returnConds.push(rBranch);
  if (oBranch) salesConds.push(oBranch);

  if (from) {
    purchaseConds.push(gte(supplierPurchasesTable.invoiceDate, from.toISOString().slice(0, 10)));
    returnConds.push(gte(supplierReturnsTable.invoiceDate, from.toISOString().slice(0, 10)));
    salesConds.push(gte(ordersTable.createdAt, from));
  }
  if (to) {
    purchaseConds.push(lte(supplierPurchasesTable.invoiceDate, to.toISOString().slice(0, 10)));
    returnConds.push(lte(supplierReturnsTable.invoiceDate, to.toISOString().slice(0, 10)));
    salesConds.push(lte(ordersTable.createdAt, to));
  }

  const purchaseRows = await db
    .select({
      id: supplierPurchaseItemsTable.id,
      qty: supplierPurchaseItemsTable.qty,
      unitKind: supplierPurchaseItemsTable.unitKind,
      unitLabel: supplierPurchaseItemsTable.unitLabel,
      amount: supplierPurchaseItemsTable.amount,
      invoiceNo: supplierPurchasesTable.invoiceNo,
      invoiceDate: supplierPurchasesTable.invoiceDate,
      invoiceTime: supplierPurchasesTable.invoiceTime,
      notes: supplierPurchasesTable.notes,
    })
    .from(supplierPurchaseItemsTable)
    .innerJoin(
      supplierPurchasesTable,
      eq(supplierPurchasesTable.id, supplierPurchaseItemsTable.purchaseId)
    )
    .where(and(...purchaseConds));

  const returnRows = await db
    .select({
      id: supplierReturnItemsTable.id,
      qty: supplierReturnItemsTable.qty,
      unitKind: supplierReturnItemsTable.unitKind,
      unitLabel: supplierReturnItemsTable.unitLabel,
      amount: supplierReturnItemsTable.amount,
      invoiceNo: supplierReturnsTable.invoiceNo,
      invoiceDate: supplierReturnsTable.invoiceDate,
      invoiceTime: supplierReturnsTable.invoiceTime,
      notes: supplierReturnsTable.notes,
    })
    .from(supplierReturnItemsTable)
    .innerJoin(
      supplierReturnsTable,
      eq(supplierReturnsTable.id, supplierReturnItemsTable.returnId)
    )
    .where(and(...returnConds));

  const saleRows = await db
    .select({
      id: orderItemsTable.id,
      quantity: orderItemsTable.quantity,
      totalPrice: orderItemsTable.totalPrice,
      orderNumber: ordersTable.orderNumber,
      createdAt: ordersTable.createdAt,
      notes: ordersTable.notes,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .where(and(...salesConds));

  const purchases: WarehouseMovementLine[] = purchaseRows
    .map((r) => {
      const qty = num(r.qty);
      const qtyMinor = toMinorQty(qty, r.unitKind, sub);
      return {
        id: r.id,
        date: r.invoiceDate,
        time: r.invoiceTime,
        docNo: r.invoiceNo,
        qty,
        unitKind: (r.unitKind === "major" ? "major" : "minor") as "major" | "minor",
        unitLabel: r.unitLabel || (r.unitKind === "major" ? item.majorUnit ?? "" : minorUnit),
        qtyMinor,
        amount: num(r.amount),
        note: r.notes,
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);

  const returns: WarehouseMovementLine[] = returnRows
    .map((r) => {
      const qty = num(r.qty);
      const qtyMinor = toMinorQty(qty, r.unitKind, sub);
      return {
        id: r.id,
        date: r.invoiceDate,
        time: r.invoiceTime,
        docNo: r.invoiceNo,
        qty,
        unitKind: (r.unitKind === "major" ? "major" : "minor") as "major" | "minor",
        unitLabel: r.unitLabel || (r.unitKind === "major" ? item.majorUnit ?? "" : minorUnit),
        qtyMinor,
        amount: num(r.amount),
        note: r.notes,
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);

  const sales: WarehouseMovementLine[] = saleRows
    .map((r) => {
      const qty = num(r.quantity);
      const created = r.createdAt ? new Date(r.createdAt) : null;
      const date = created
        ? `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`
        : "";
      const time = created
        ? `${String(created.getHours()).padStart(2, "0")}:${String(created.getMinutes()).padStart(2, "0")}:${String(created.getSeconds()).padStart(2, "0")}`
        : null;
      return {
        id: r.id,
        date,
        time,
        docNo: r.orderNumber,
        qty,
        unitKind: "sale" as const,
        unitLabel: minorUnit,
        qtyMinor: qty,
        amount: num(r.totalPrice),
        note: r.notes,
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);

  const purchasedMinor = purchases.reduce((s, l) => s + l.qtyMinor, 0);
  const returnedMinor = returns.reduce((s, l) => s + l.qtyMinor, 0);
  const soldMinor = sales.reduce((s, l) => s + l.qtyMinor, 0);
  const remainingMinor = Number((purchasedMinor - returnedMinor - soldMinor).toFixed(3));
  const split = splitMinor(remainingMinor, sub, item.majorUnit, minorUnit);
  const cost = num(item.cost);

  return {
    item: {
      menuItemId: item.id,
      code: itemCode(item.id),
      name: item.name,
      nameAr: item.nameAr,
      categoryId: item.categoryId,
      categoryName: item.categoryName ?? "",
      categoryNameAr: item.categoryNameAr ?? "",
      majorUnit: item.majorUnit,
      minorUnit,
      subunitQty: sub,
      costPerMinor: cost,
      purchasedMinor,
      returnedMinor,
      soldMinor,
      remainingMinor,
      remainingMajor: split.remainingMajor,
      remainingMinorPart: split.remainingMinorPart,
      remainingLabel: split.remainingLabel,
      totalCost: Number((remainingMinor * cost).toFixed(2)),
    } satisfies WarehouseStockRow,
    purchases,
    returns,
    sales,
    totals: {
      purchasedMinor,
      returnedMinor,
      soldMinor,
      remainingMinor,
      remainingLabel: split.remainingLabel,
    },
  };
}
