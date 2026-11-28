import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  appSettingsTable,
  cardBranchesTable,
  cardsTable,
  cashMovementsTable,
  expensesTable,
  ordersTable,
  supplierMovementsTable,
  supplierPurchasesTable,
  supplierReturnsTable,
} from "@workspace/db/schema";
import { and, asc, eq } from "drizzle-orm";
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

function dateFromTimestamp(v: Date | null | undefined): string {
  if (!v) return todayDate();
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
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

/** Route to cash ledger unless card payment with a real cardId. */
function resolveLedger(
  paymentMethod: unknown,
  cardIdRaw: unknown
): { paymentMethod: "cash" | "card"; cardId: number | null } {
  const pm = String(paymentMethod ?? "cash").toLowerCase();
  const cardId = Number(cardIdRaw);
  if (pm === "card" && Number.isFinite(cardId) && cardId > 0) {
    return { paymentMethod: "card", cardId };
  }
  return { paymentMethod: "cash", cardId: null };
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

  const allCards = await db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.isActive, true))
    .orderBy(asc(cardsTable.name));

  let cards = allCards;
  if (branchFilter != null) {
    const links = await db
      .select({ cardId: cardBranchesTable.cardId })
      .from(cardBranchesTable)
      .where(eq(cardBranchesTable.branchId, branchFilter));
    const allowed = new Set(links.map((l) => l.cardId));
    cards = allCards.filter((c) => allowed.has(c.id));
  }

  const cardName = new Map(allCards.map((c) => [c.id, c.name]));

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
        line.cardName ||
          (line.cardId ? cardName.get(line.cardId) : null) ||
          (line.paymentMethod === "card" ? "بطاقة" : "بدون بطاقة"),
        line.cardId,
        line.cardId ? money(allCards.find((c) => c.id === line.cardId)?.openingBalance ?? 0) : 0
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

  const pushSigned = (opts: {
    id: string;
    date: string;
    time?: string | null;
    source: string;
    sourceAr: string;
    label: string;
    invoiceNo?: string | null;
    amount: number;
    paymentMethod: "cash" | "card";
    cardId: number | null;
    branchId?: number | null;
  }) => {
    const signed = money(opts.amount);
    if (Math.abs(signed) < 0.005) return;
    const abs = Math.abs(signed);
    pushLine({
      id: opts.id,
      date: opts.date,
      time: opts.time ?? null,
      source: opts.source,
      sourceAr: opts.sourceAr,
      label: opts.label,
      invoiceNo: opts.invoiceNo ?? null,
      debit: signed < 0 ? abs : 0,
      credit: signed > 0 ? abs : 0,
      signed,
      paymentMethod: opts.paymentMethod,
      cardId: opts.cardId,
      cardName: opts.cardId ? cardName.get(opts.cardId) || null : null,
      branchId: opts.branchId ?? null,
    });
  };

  const branchOk = (id: number | null | undefined) =>
    branchFilter == null || id == null || id === branchFilter;

  // ── Orders (POS / cashier) — +واصل / −مرجع ───────────────
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
      if (o.status === "cancelled") continue;
      const pay = String(o.paymentMethod ?? "").toLowerCase();
      if (pay !== "cash" && pay !== "card" && pay !== "transfer") continue;
      const ledger = resolveLedger(pay, (o as { cardId?: number | null }).cardId);
      const amount = money(o.total);
      const isReturn = amount < 0;
      pushSigned({
        id: `order-${o.id}`,
        // Ledger on collection day when paid_at exists (carryover unpaid → new shift)
        date: dateFromTimestamp(
          (o as { paidAt?: Date | null }).paidAt ?? o.createdAt
        ),
        source: "order",
        sourceAr: isReturn ? "مرجع مبيعات" : "مبيعات",
        label:
          pay === "cash"
            ? `طلب ${o.orderNumber || o.id} (نقد)`
            : pay === "card"
              ? `طلب ${o.orderNumber || o.id} (بطاقة${ledger.cardId && cardName.get(ledger.cardId) ? ` · ${cardName.get(ledger.cardId)}` : ""})`
              : `طلب ${o.orderNumber || o.id} (تحويل)`,
        invoiceNo: o.orderNumber,
        amount,
        paymentMethod: ledger.paymentMethod,
        cardId: ledger.cardId,
        branchId: o.branchId,
      });
    }
  }

  // ── Supplier returns — مبلغ واصل (inflow) ────────────────
  {
    const conds = [];
    const b = branchEq(supplierReturnsTable.branchId, scope);
    if (b) conds.push(b);
    if (branchFilter != null) conds.push(eq(supplierReturnsTable.branchId, branchFilter));
    const rows = await db
      .select()
      .from(supplierReturnsTable)
      .where(conds.length ? and(...conds) : undefined);
    for (const r of rows) {
      if (!branchOk(r.branchId)) continue;
      const amount = money(r.paidAmount);
      if (!(amount > 0)) continue;
      const ledger = resolveLedger(r.paymentMethod, r.cardId);
      pushSigned({
        id: `sup-return-${r.id}`,
        date: r.invoiceDate,
        time: r.invoiceTime,
        source: "supplier_return",
        sourceAr: "مرجع شراء",
        label: `واصل مرجع ${r.invoiceNo}`,
        invoiceNo: r.invoiceNo,
        amount,
        paymentMethod: ledger.paymentMethod,
        cardId: ledger.cardId,
        branchId: r.branchId,
      });
    }
  }

  // ── Cash movements — مرجوع (+) / سحب (−) ─────────────────
  {
    const conds = [];
    const b = branchEq(cashMovementsTable.branchId, scope);
    if (b) conds.push(b);
    if (branchFilter != null) conds.push(eq(cashMovementsTable.branchId, branchFilter));
    const rows = await db
      .select()
      .from(cashMovementsTable)
      .where(conds.length ? and(...conds) : undefined);
    for (const m of rows) {
      if (!branchOk(m.branchId)) continue;
      const amount = money(m.amount);
      if (!(amount > 0)) continue;
      const isReturn = m.kind === "return";
      const ledger = resolveLedger(
        (m as { paymentMethod?: string }).paymentMethod,
        (m as { cardId?: number | null }).cardId
      );
      pushSigned({
        id: `cashmov-${m.id}`,
        date: m.movementDate,
        time: m.movementTime,
        source: "cash_movement",
        sourceAr: isReturn ? "مرجوع" : "سحب",
        label: isReturn ? "مرجوع للصندوق" : "سحب من الصندوق",
        invoiceNo: m.invoiceNo,
        amount: isReturn ? amount : -amount,
        paymentMethod: ledger.paymentMethod,
        cardId: ledger.cardId,
        branchId: m.branchId,
      });
    }
  }

  // ── Supplier purchases — مبلغ الدفع (outflow) ────────────
  {
    const conds = [];
    const b = branchEq(supplierPurchasesTable.branchId, scope);
    if (b) conds.push(b);
    if (branchFilter != null) conds.push(eq(supplierPurchasesTable.branchId, branchFilter));
    const rows = await db
      .select()
      .from(supplierPurchasesTable)
      .where(conds.length ? and(...conds) : undefined);
    for (const p of rows) {
      if (!branchOk(p.branchId)) continue;
      const amount = money(p.paidAmount);
      if (!(amount > 0)) continue;
      const ledger = resolveLedger(p.paymentMethod, p.cardId);
      pushSigned({
        id: `sup-purchase-${p.id}`,
        date: p.invoiceDate,
        time: p.invoiceTime,
        source: "supplier_purchase",
        sourceAr: "شراء مورد",
        label: `دفع فاتورة شراء ${p.invoiceNo}`,
        invoiceNo: p.invoiceNo,
        amount: -amount,
        paymentMethod: ledger.paymentMethod,
        cardId: ledger.cardId,
        branchId: p.branchId,
      });
    }
  }

  // ── Expenses (outflow) ───────────────────────────────────
  {
    const conds = [];
    const b = branchEq(expensesTable.branchId, scope);
    if (b) conds.push(b);
    if (branchFilter != null) conds.push(eq(expensesTable.branchId, branchFilter));
    const rows = await db
      .select()
      .from(expensesTable)
      .where(conds.length ? and(...conds) : undefined);
    for (const e of rows) {
      if (!branchOk(e.branchId)) continue;
      const day =
        e.expenseDate ||
        (e.date
          ? `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}-${String(e.date.getDate()).padStart(2, "0")}`
          : todayDate());
      const amount = money(e.amount);
      if (!(amount > 0)) continue;
      const ledger = resolveLedger(
        (e as { paymentMethod?: string }).paymentMethod,
        (e as { cardId?: number | null }).cardId
      );
      pushSigned({
        id: `expense-${e.id}`,
        date: day,
        source: "expense",
        sourceAr: "مصروف",
        label: e.category || e.description || "مصروف",
        invoiceNo: e.invoiceNo,
        amount: -amount,
        paymentMethod: ledger.paymentMethod,
        cardId: ledger.cardId,
        branchId: e.branchId,
      });
    }
  }

  // ── Supplier movements paid (−) / received (+) ───────────
  {
    const conds = [];
    const b = branchEq(supplierMovementsTable.branchId, scope);
    if (b) conds.push(b);
    if (branchFilter != null) conds.push(eq(supplierMovementsTable.branchId, branchFilter));
    const rows = await db
      .select()
      .from(supplierMovementsTable)
      .where(conds.length ? and(...conds) : undefined);
    for (const m of rows) {
      if (!branchOk(m.branchId)) continue;
      if (m.amountType !== "paid" && m.amountType !== "received") continue;
      const amount = money(m.amount);
      if (!(amount > 0)) continue;
      const ledger = resolveLedger(m.paymentMethod, m.cardId);
      const isIn = m.amountType === "received";
      pushSigned({
        id: `sup-mov-${m.id}`,
        date: m.movementDate,
        time: m.movementTime,
        source: "supplier_movement",
        sourceAr: isIn ? "واصل مورد" : "مدفوع مورد",
        label: isIn ? `واصل مورد ${m.invoiceNo}` : `مدفوع مورد ${m.invoiceNo}`,
        invoiceNo: m.invoiceNo,
        amount: isIn ? amount : -amount,
        paymentMethod: ledger.paymentMethod,
        cardId: ledger.cardId,
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
