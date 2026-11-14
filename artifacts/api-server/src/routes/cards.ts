import { randomUUID } from "crypto";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cardsTable, cardBranchesTable, branchesTable } from "@workspace/db/schema";
import { eq, and, ne, sql, inArray, desc } from "drizzle-orm";
import { parseBranchScope } from "../lib/branch-scope";

const router: IRouter = Router();

async function isDuplicateName(name: string, excludeId?: number) {
  const normalized = name.trim().toLowerCase();
  const conditions = [sql`lower(${cardsTable.name}) = ${normalized}`];
  if (excludeId != null) conditions.push(ne(cardsTable.id, excludeId));
  const rows = await db
    .select({ id: cardsTable.id })
    .from(cardsTable)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

function normalizeBranchIds(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  return [
    ...new Set(
      input
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];
}

async function getBranchIdsForCards(cardIds: number[]) {
  const map = new Map<number, number[]>();
  if (cardIds.length === 0) return map;
  const rows = await db
    .select()
    .from(cardBranchesTable)
    .where(inArray(cardBranchesTable.cardId, cardIds));
  for (const row of rows) {
    const list = map.get(row.cardId) ?? [];
    list.push(row.branchId);
    map.set(row.cardId, list);
  }
  return map;
}

async function setCardBranches(cardId: number, branchIds: number[]) {
  await db.delete(cardBranchesTable).where(eq(cardBranchesTable.cardId, cardId));
  if (branchIds.length === 0) return;
  await db.insert(cardBranchesTable).values(
    branchIds.map((branchId) => ({ cardId, branchId }))
  );
}

function parseMoney(value: unknown, fallback = "0"): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n.toFixed(2);
}

function withBranches<T extends { id: number }>(
  card: T,
  branchMap: Map<number, number[]>,
  branchNameMap: Map<number, string>
) {
  const branchIds = branchMap.get(card.id) ?? [];
  return {
    ...card,
    branchIds,
    branchNames: branchIds.map((id) => branchNameMap.get(id) ?? `فرع #${id}`),
    openingBalance: Number((card as any).openingBalance ?? 0),
    balance: Number((card as any).balance ?? 0),
  };
}

router.get("/", async (req, res) => {
  const scope = parseBranchScope(req);
  const cards = await db.select().from(cardsTable).orderBy(desc(cardsTable.createdAt));
  const branchMap = await getBranchIdsForCards(cards.map((c) => c.id));
  const branches = await db.select({ id: branchesTable.id, name: branchesTable.name }).from(branchesTable);
  const branchNameMap = new Map(branches.map((b) => [b.id, b.name]));

  let result = cards.map((c) => withBranches(c, branchMap, branchNameMap));
  if (scope.mode === "one") {
    const bid = scope.branchId;
    result = result.filter((c) => (c.branchIds ?? []).includes(bid));
  }
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [card] = await db.select().from(cardsTable).where(eq(cardsTable.id, id));
  if (!card) {
    res.status(404).json({ success: false, message: "البطاقة غير موجودة" });
    return;
  }
  const branchMap = await getBranchIdsForCards([id]);
  const branches = await db.select({ id: branchesTable.id, name: branchesTable.name }).from(branchesTable);
  const branchNameMap = new Map(branches.map((b) => [b.id, b.name]));
  res.json(withBranches(card, branchMap, branchNameMap));
});

router.post("/", async (req, res) => {
  const { name, openingBalance, note, isActive, branchIds } = req.body;
  const trimmedName = String(name ?? "").trim();
  const branches = normalizeBranchIds(branchIds);

  if (!trimmedName) {
    res.status(400).json({ success: false, message: "اسم البطاقة مطلوب" });
    return;
  }
  if (branches.length === 0) {
    res.status(400).json({ success: false, message: "اختر فرعاً واحداً على الأقل" });
    return;
  }
  if (await isDuplicateName(trimmedName)) {
    res.status(400).json({ success: false, message: "اسم البطاقة مستخدم مسبقاً" });
    return;
  }

  const money = parseMoney(openingBalance, "0");
  const qrToken = `RMS-CARD-${randomUUID()}`;

  const [card] = await db
    .insert(cardsTable)
    .values({
      name: trimmedName,
      openingBalance: money,
      balance: money,
      qrToken,
      note: note ? String(note).trim() : null,
      isActive: isActive ?? true,
    })
    .returning();

  await setCardBranches(card.id, branches);

  const branchMap = await getBranchIdsForCards([card.id]);
  const allBranches = await db
    .select({ id: branchesTable.id, name: branchesTable.name })
    .from(branchesTable);
  const branchNameMap = new Map(allBranches.map((b) => [b.id, b.name]));
  res.status(201).json(withBranches(card, branchMap, branchNameMap));
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, openingBalance, note, isActive, branchIds, balance } = req.body;
  const trimmedName = String(name ?? "").trim();
  const branches = normalizeBranchIds(branchIds);

  if (!trimmedName) {
    res.status(400).json({ success: false, message: "اسم البطاقة مطلوب" });
    return;
  }
  if (branches.length === 0) {
    res.status(400).json({ success: false, message: "اختر فرعاً واحداً على الأقل" });
    return;
  }
  if (await isDuplicateName(trimmedName, id)) {
    res.status(400).json({ success: false, message: "اسم البطاقة مستخدم مسبقاً" });
    return;
  }

  const [existing] = await db.select().from(cardsTable).where(eq(cardsTable.id, id));
  if (!existing) {
    res.status(404).json({ success: false, message: "البطاقة غير موجودة" });
    return;
  }

  const opening = parseMoney(openingBalance, String(existing.openingBalance));
  // Keep live balance unless explicitly provided; opening edit alone doesn't rewrite spent balance.
  const nextBalance =
    balance != null ? parseMoney(balance, String(existing.balance)) : String(existing.balance);

  const [card] = await db
    .update(cardsTable)
    .set({
      name: trimmedName,
      openingBalance: opening,
      balance: nextBalance,
      note: note ? String(note).trim() : null,
      isActive: isActive ?? true,
    })
    .where(eq(cardsTable.id, id))
    .returning();

  await setCardBranches(id, branches);

  const branchMap = await getBranchIdsForCards([id]);
  const allBranches = await db
    .select({ id: branchesTable.id, name: branchesTable.name })
    .from(branchesTable);
  const branchNameMap = new Map(allBranches.map((b) => [b.id, b.name]));
  res.json(withBranches(card, branchMap, branchNameMap));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(cardsTable).where(eq(cardsTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
