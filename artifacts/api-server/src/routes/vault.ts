import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  appSettingsTable,
  cardsTable,
  cashMovementsTable,
  expensesTable,
  ordersTable,
  supplierMovementsTable,
  supplierPurchasesTable,
} from "@workspace/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { parseBranchScope, branchEq } from "../lib/branch-scope";
import { ensureVaultColumns } from "../lib/ensure-vault-columns";
import { isOrderPaymentReceived } from "../lib/seat-sync";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function money(v: unknown) {
  return Number(num(v).toFixed(2));
}

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeDate(v: unknown): string | null {
  const raw = String(v ?? "").trim();
  if (!DATE_RE.test(raw)) return null;
  return raw;
}

function dayBefore(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type LedgerLine = {
  id: string;
  date: string;
  time?: string | null;
  source: string;
  sourceAr: string;
  label: string;
  invoiceNo?: string | null;
  debit: number;
  credit: number;
  signed: number;
  balanceAfter?: number;
  paymentMethod: "cash" | "card";
  cardId: number | null;
  cardName?: string | null;
  branchId?: number | null;
};

type AccountStatement = {
  key: string;
  kind: "cash" | "card";
  titleAr: string;
  cardId: number | null;
  openingBalance: number;
  openingBeforeFrom: number;
  periodDebit: number;
  periodCredit: number;
  periodNet: number;
  closingBalance: number;
  lines: LedgerLine[];
};

function emptyAccount(
  key: string,
  kind: "cash" | "card",
  titleAr: string,
  cardId: number | null,
  openingBalance: number
): AccountStatement {
  return {
    key,
    kind,
    titleAr,
    cardId,
    openingBalance,
    openingBeforeFrom: openingBalance,
    periodDebit: 0,
    periodCredit: 0,
    periodNet: 0,
    closingBalance: openingBalance,
    lines: [],
  };
}

router.get("/statement", async (req, res) => {
  await ensureVaultColumns();
  const scope = parseBranchScope(req);
  const from = normalizeDate(req.query.from) ?? todayDate();
  const to = normalizeDate(req.query.to) ?? from;
  const filterBranchId = Number(req.query.filterBranchId ?? req.query.branchId);
  const branchFilter =
    Number.isFinite(filterBranchId) && filterBranchId > 0
      ? filterBranchId
      : scope.mode === "one"
        ? scope.branchId
        : null;

  const [settings] = await db.select().from(appSettingsTable).limit(1);
  const cashOpening = money(settings?.cashOpeningBalance ?? 0);

  const cards = await db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.isActive, true))
    .orderBy(asc(cardsTable.name));

  const accounts = new Map<string, AccountStatement>();
  accounts.set("cash", emptyAccount("cash", "cash", "بدون بطاقة (نقد)", null, cashOpening));
  for (const c of cards) {
    const key = `card:${c.id}`;
    accounts.set(
      key,
      emptyAccount(key, "card", c.name, c.id, money(c.openingBalance))
    );
  }

  const pushLine = (line: LedgerLine) => {
    const key =
      line.paymentMethod === "card" && line.cardId != null
        ? `card:${line.cardId}`
        : "cash";
    let acc = accounts.get(key);
    if (!acc) {
      acc = emptyAccount(
        key,
        line.paymentMethod === "card" ? "card" : "cash",
        line.cardName || (line.paymentMethod === "card" ? "بطاقة" : "بدون بطاقة"),
        line.cardId,
        0
      );
      accounts.set(key, acc);
    }
    if (line.date < from) {
      acc.openingBeforeFrom = money(acc.openingBeforeFrom + line.signed);
      return;
    }
    if (line.date > to) return;
    acc.lines.push(line);
    acc.periodDebit = money(acc.periodDebit + line.debit);
    acc.periodCredit = money(acc.periodCredit + line.credit);
    acc.periodNet = money(acc.periodNet + line.signed);
  };

  const branchOk = (id: number | null | undefined) =>
    branchFilter == null || id == null || id === branchFilter;

  // ── Orders (cash in when paid) ───────────────────────────
  {
    const conds = [];
    const b = branchEq(ordersTable.branchId, scope);
    if (b) conds.push(b);
    if (branchFilter != null) conds.push(eq(ordersTable.branchId, branchFilter));
    const rows = await db
      .select()
      .from(ordersTable)
      .where(conds.length ? and(...conds) : undefined);
    for (const o of rows) {
      if (!isOrderPaymentReceived(o)) continue;
      if (!branchOk(o.branchId)) continue;
      const pay = String(o.paymentMethod ?? "").toLowerCase();
      if (pay !== "cash" && pay !== "card" && pay !== "transfer") continue;
      const day = o.createdAt
        ? `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, "0")}-${String(o.createdAt.getDate()).padStart(2, "0")}`
        : todayDate();
      const amount = money(o.total);
      if (!(amount > 0)) continue;
      /** Card/transfer sales without cardId stay in cash ledger as labeled inflow */
      const method: "cash" | "card" = pay === "cash" ? "cash" : "cash";
      pushLine({
        id: `order-${o.id}`,
        date: day,
        time: null,
        source: "order",
        sourceAr: "مبيعات",
        label:
          pay === "cash"
            ? `طلب ${o.orderNumber || o.id} (نقد)`
            : `طلب ${o.orderNumber || o.id} (${pay === "card" ? "بطاقة" : "تحويل"})`,
        invoiceNo: o.orderNumber,
        debit: 0,
        credit: amount,
        signed: amount,
        paymentMethod: method,
        cardId: null,
        branchId: o.branchId,
      });
    }
  }

  // ── Expenses ─────────────────────────────────────────────
  {
    const conds = [];
    const b = branchEq(expensesTable.branchId, scope);
    if (b) conds.push(b);
    if (branchFilter != null) conds.push(eq(expensesTable.branchId, branchFilter));
    const rows = await db
      .select()
      .from(expensesTable)
      .where(conds.length ? and(...conds) : undefined);
    const cardName = new Map(cards.map((c) => [c.id, c.name]));
    for (const e of rows) {
      if (!branchOk(e.branchId)) continue;
      const day =
        e.expenseDate ||
        (e.date
          ? `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}-${String(e.date.getDate()).padStart(2, "0")}`
          : todayDate());
      const amount = money(e.amount);
      if (!(amount > 0)) continue;
      const pm = String((e as { paymentMethod?: string }).paymentMethod ?? "cash") === "card"
        ? "card"
        : "cash";
      const cardId =
        pm === "card" && (e as { cardId?: number | null }).cardId
          ? Number((e as { cardId?: number | null }).cardId)
          : null;
      pushLine({
        id: `expense-${e.id}`,
        date: day,
        source: "expense",
        sourceAr: "مصروف",
        label: e.category || e.description || "مصروف",
        invoiceNo: e.invoiceNo,
        debit: amount,
        credit: 0,
        signed: -amount,
        paymentMethod: pm === "card" && cardId ? "card" : "cash",
        cardId: pm === "card" ? cardId : null,
        cardName: cardId ? cardName.get(cardId) || null : null,
        branchId: e.branchId,
      });
    }
  }

  // ── Cash movements ───────────────────────────────────────
  {
    const conds = [];
    const b = branchEq(cashMovementsTable.branchId, scope);
    if (b) conds.push(b);
    if (branchFilter != null) conds.push(eq(cashMovementsTable.branchId, branchFilter));
    const rows = await db
      .select()
      .from(cashMovementsTable)
      .where(conds.length ? and(...conds) : undefined);
    const cardName = new Map(cards.map((c) => [c.id, c.name]));
    for (const m of rows) {
      if (!branchOk(m.branchId)) continue;
      const amount = money(m.amount);
      if (!(amount > 0)) continue;
      const isReturn = m.kind === "return";
      const pm = String((m as { paymentMethod?: string }).paymentMethod ?? "cash") === "card"
        ? "card"
        : "cash";
      const cardId =
        pm === "card" && (m as { cardId?: number | null }).cardId
          ? Number((m as { cardId?: number | null }).cardId)
          : null;
      pushLine({
        id: `cashmov-${m.id}`,
        date: m.movementDate,
        time: m.movementTime,
        source: "cash_movement",
        sourceAr: isReturn ? "مرجوع" : "سحب",
        label: isReturn ? "مرجوع للصندوق" : "سحب من الصندوق",
        invoiceNo: m.invoiceNo,
        debit: isReturn ? 0 : amount,
        credit: isReturn ? amount : 0,
        signed: isReturn ? amount : -amount,
        paymentMethod: pm === "card" && cardId ? "card" : "cash",
        cardId: pm === "card" ? cardId : null,
        cardName: cardId ? cardName.get(cardId) || null : null,
        branchId: m.branchId,
      });
    }
  }

  // ── Supplier purchases (paid amount) ─────────────────────
  {
    const conds = [];
    const b = branchEq(supplierPurchasesTable.branchId, scope);
    if (b) conds.push(b);
    if (branchFilter != null) conds.push(eq(supplierPurchasesTable.branchId, branchFilter));
    const rows = await db
      .select()
      .from(supplierPurchasesTable)
      .where(conds.length ? and(...conds) : undefined);
    const cardName = new Map(cards.map((c) => [c.id, c.name]));
    for (const p of rows) {
      if (!branchOk(p.branchId)) continue;
      const amount = money(p.paidAmount);
      if (!(amount > 0)) continue;
      const pm = p.paymentMethod === "card" ? "card" : "cash";
      const cardId = pm === "card" && p.cardId ? p.cardId : null;
      pushLine({
        id: `sup-purchase-${p.id}`,
        date: p.invoiceDate,
        time: p.invoiceTime,
        source: "supplier_purchase",
        sourceAr: "شراء مورد",
        label: `دفع فاتورة شراء ${p.invoiceNo}`,
        invoiceNo: p.invoiceNo,
        debit: amount,
        credit: 0,
        signed: -amount,
        paymentMethod: pm === "card" && cardId ? "card" : "cash",
        cardId,
        cardName: cardId ? cardName.get(cardId) || null : null,
        branchId: p.branchId,
      });
    }
  }

  // ── Supplier movements paid/received ─────────────────────
  {
    const conds = [];
    const b = branchEq(supplierMovementsTable.branchId, scope);
    if (b) conds.push(b);
    if (branchFilter != null) conds.push(eq(supplierMovementsTable.branchId, branchFilter));
    const rows = await db
      .select()
      .from(supplierMovementsTable)
      .where(conds.length ? and(...conds) : undefined);
    const cardName = new Map(cards.map((c) => [c.id, c.name]));
    for (const m of rows) {
      if (!branchOk(m.branchId)) continue;
      if (m.amountType !== "paid" && m.amountType !== "received") continue;
      const amount = money(m.amount);
      if (!(amount > 0)) continue;
      const pm = m.paymentMethod === "card" ? "card" : "cash";
      const cardId = pm === "card" && m.cardId ? m.cardId : null;
      const isIn = m.amountType === "received";
      pushLine({
        id: `sup-mov-${m.id}`,
        date: m.movementDate,
        time: m.movementTime,
        source: "supplier_movement",
        sourceAr: isIn ? "واصل مورد" : "مدفوع مورد",
        label: isIn ? `واصل مورد ${m.invoiceNo}` : `مدفوع مورد ${m.invoiceNo}`,
        invoiceNo: m.invoiceNo,
        debit: isIn ? 0 : amount,
        credit: isIn ? amount : 0,
        signed: isIn ? amount : -amount,
        paymentMethod: pm === "card" && cardId ? "card" : "cash",
        cardId,
        cardName: cardId ? cardName.get(cardId) || null : null,
        branchId: m.branchId,
      });
    }
  }

  const statements: AccountStatement[] = [];
  for (const acc of accounts.values()) {
    acc.lines.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.time ?? "").localeCompare(String(b.time ?? "")) || a.id.localeCompare(b.id);
    });
    let running = acc.openingBeforeFrom;
    acc.lines = acc.lines.map((line) => {
      running = money(running + line.signed);
      return { ...line, balanceAfter: running };
    });
    acc.closingBalance = money(acc.openingBeforeFrom + acc.periodNet);
    if (
      acc.kind === "cash" ||
      acc.lines.length > 0 ||
      Math.abs(acc.openingBalance) > 0.009 ||
      Math.abs(acc.openingBeforeFrom) > 0.009
    ) {
      statements.push(acc);
    }
  }

  statements.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "cash" ? -1 : 1;
    return a.titleAr.localeCompare(b.titleAr, "ar");
  });

  res.json({
    from,
    to,
    openingAsOf: dayBefore(from),
    cashOpeningBalance: cashOpening,
    branchId: branchFilter,
    accounts: statements,
  });
});

router.put("/cash-opening", async (req, res) => {
  await ensureVaultColumns();
  const amount = money(req.body?.cashOpeningBalance ?? req.body?.amount);
  const [existing] = await db.select().from(appSettingsTable).limit(1);
  if (!existing) {
    const [created] = await db
      .insert(appSettingsTable)
      .values({
        restaurantName: "المطعم الذكي",
        cashOpeningBalance: amount.toFixed(2),
      } as any)
      .returning();
    return res.json({
      cashOpeningBalance: money(created.cashOpeningBalance),
    });
  }
  const [updated] = await db
    .update(appSettingsTable)
    .set({
      cashOpeningBalance: amount.toFixed(2),
      updatedAt: new Date(),
    } as any)
    .where(eq(appSettingsTable.id, existing.id))
    .returning();
  res.json({
    cashOpeningBalance: money((updated as any).cashOpeningBalance),
  });
});

export default router;
