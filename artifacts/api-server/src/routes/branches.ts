import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { branchesTable } from "@workspace/db/schema";
import { eq, desc, count, sql, and, ne } from "drizzle-orm";

const MAX_BRANCHES = 3;
const router: IRouter = Router();

async function isDuplicateName(name: string, excludeId?: number) {
  const normalized = name.trim().toLowerCase();
  const conditions = [
    sql`lower(${branchesTable.name}) = ${normalized}`,
  ];
  if (excludeId != null) {
    conditions.push(ne(branchesTable.id, excludeId));
  }
  const rows = await db
    .select({ id: branchesTable.id })
    .from(branchesTable)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

router.get("/", async (_req, res) => {
  const branches = await db
    .select()
    .from(branchesTable)
    .orderBy(desc(branchesTable.createdAt));
  res.json(branches);
});

router.post("/", async (req, res) => {
  const [{ value: total }] = await db.select({ value: count() }).from(branchesTable);
  if (Number(total) >= MAX_BRANCHES) {
    res.status(400).json({
      success: false,
      message: `لا يمكن إضافة أكثر من ${MAX_BRANCHES} فروع`,
    });
    return;
  }

  const { name, mobile1, mobile2, address, logoUrl, isActive, note } = req.body;
  if (!name?.trim() || !mobile1?.trim()) {
    res.status(400).json({ success: false, message: "اسم الفرع وموبايل 1 مطلوبان" });
    return;
  }

  const trimmedName = String(name).trim();
  if (await isDuplicateName(trimmedName)) {
    res.status(400).json({ success: false, message: "اسم الفرع مستخدم مسبقاً" });
    return;
  }

  const [branch] = await db
    .insert(branchesTable)
    .values({
      name: trimmedName,
      mobile1: String(mobile1).trim(),
      mobile2: mobile2 ? String(mobile2).trim() : null,
      address: address ? String(address).trim() : null,
      logoUrl: logoUrl ? String(logoUrl).trim() : null,
      isActive: isActive ?? true,
      note: note ? String(note).trim() : null,
    })
    .returning();

  res.status(201).json(branch);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, mobile1, mobile2, address, logoUrl, isActive, note } = req.body;

  if (!name?.trim() || !mobile1?.trim()) {
    res.status(400).json({ success: false, message: "اسم الفرع وموبايل 1 مطلوبان" });
    return;
  }

  const trimmedName = String(name).trim();
  if (await isDuplicateName(trimmedName, id)) {
    res.status(400).json({ success: false, message: "اسم الفرع مستخدم مسبقاً" });
    return;
  }

  const [branch] = await db
    .update(branchesTable)
    .set({
      name: trimmedName,
      mobile1: String(mobile1).trim(),
      mobile2: mobile2 ? String(mobile2).trim() : null,
      address: address ? String(address).trim() : null,
      logoUrl: logoUrl ? String(logoUrl).trim() : null,
      isActive: isActive ?? true,
      note: note ? String(note).trim() : null,
    })
    .where(eq(branchesTable.id, id))
    .returning();

  if (!branch) {
    res.status(404).json({ success: false, message: "الفرع غير موجود" });
    return;
  }

  res.json(branch);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(branchesTable).where(eq(branchesTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
