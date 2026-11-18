import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  menuCategoriesTable,
  menuItemsTable,
  menuItemBranchesTable,
  itemUnitsTable,
} from "@workspace/db/schema";
import { eq, asc, inArray, ne, and, or, sql } from "drizzle-orm";
import { parseBranchScope } from "../lib/branch-scope";
import {
  persistCategoryImageDataUrl,
  persistMenuItemImageDataUrl,
} from "../lib/category-image";

const LOCKED_MINOR_UNIT = "عدد";

const DEFAULT_ITEM_UNITS = [
  { nameAr: "كرتون", name: "Carton" },
  { nameAr: "صندوق", name: "Box" },
  { nameAr: "كيس", name: "Bag" },
  { nameAr: "علبة", name: "Can" },
  { nameAr: "باكيت", name: "Pack" },
  { nameAr: "دزينة", name: "Dozen" },
];

function normalizeCostUnitFields(body: {
  cost?: unknown;
  majorUnit?: unknown;
  subunitQty?: unknown;
}) {
  const rawCost = body.cost;
  const hasCost =
    rawCost !== null &&
    rawCost !== undefined &&
    rawCost !== "" &&
    Number.isFinite(Number(rawCost)) &&
    Number(rawCost) > 0;

  if (!hasCost) {
    return {
      cost: null as string | null,
      majorUnit: null as string | null,
      minorUnit: null as string | null,
      subunitQty: null as number | null,
    };
  }

  const majorUnit = String(body.majorUnit ?? "").trim();
  const subunitQty = Math.floor(Number(body.subunitQty));
  if (!majorUnit) {
    return { error: "اختر الوحدة الكبرى" as const };
  }
  if (!Number.isFinite(subunitQty) || subunitQty < 1) {
    return { error: "عدد الكمية الفرعية يجب أن يكون 1 أو أكثر" as const };
  }

  return {
    cost: Number(rawCost).toFixed(2),
    majorUnit,
    minorUnit: LOCKED_MINOR_UNIT,
    subunitQty,
  };
}

async function findDuplicateMenuItemName(
  nameAr: string,
  name: string,
  excludeId?: number
) {
  const ar = String(nameAr ?? "").trim().toLowerCase();
  const en = String(name ?? "").trim().toLowerCase();
  if (!ar && !en) return null;

  const nameMatch = or(
    sql`lower(trim(${menuItemsTable.nameAr})) = ${ar}`,
    sql`lower(trim(${menuItemsTable.name})) = ${en}`
  );

  const where =
    excludeId != null
      ? and(ne(menuItemsTable.id, excludeId), nameMatch)
      : nameMatch;

  const [dup] = await db
    .select({
      id: menuItemsTable.id,
      nameAr: menuItemsTable.nameAr,
      name: menuItemsTable.name,
    })
    .from(menuItemsTable)
    .where(where)
    .limit(1);

  return dup ?? null;
}

const router: IRouter = Router();

async function ensureDefaultItemUnits() {
  const existing = await db.select({ id: itemUnitsTable.id }).from(itemUnitsTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(itemUnitsTable).values(
    DEFAULT_ITEM_UNITS.map((u) => ({
      nameAr: u.nameAr,
      name: u.name,
      isActive: true,
    }))
  );
}

// GET /menu/units
router.get("/units", async (_req, res) => {
  await ensureDefaultItemUnits();
  const units = await db
    .select()
    .from(itemUnitsTable)
    .where(eq(itemUnitsTable.isActive, true))
    .orderBy(asc(itemUnitsTable.nameAr));
  res.json(units);
});

// POST /menu/units
router.post("/units", async (req, res) => {
  const nameAr = String(req.body?.nameAr ?? "").trim();
  const name = String(req.body?.name ?? "").trim() || null;
  if (!nameAr) {
    res.status(400).json({ success: false, message: "اسم الوحدة مطلوب" });
    return;
  }
  const [dup] = await db
    .select({ id: itemUnitsTable.id })
    .from(itemUnitsTable)
    .where(sql`lower(trim(${itemUnitsTable.nameAr})) = ${nameAr.toLowerCase()}`)
    .limit(1);
  if (dup) {
    res.status(400).json({ success: false, message: "اسم الوحدة مستخدم مسبقاً" });
    return;
  }
  const [created] = await db
    .insert(itemUnitsTable)
    .values({ nameAr, name, isActive: true })
    .returning();
  res.status(201).json(created);
});

async function getBranchIdsForItems(itemIds: number[]) {
  const map = new Map<number, number[]>();
  if (itemIds.length === 0) return map;
  const rows = await db
    .select()
    .from(menuItemBranchesTable)
    .where(inArray(menuItemBranchesTable.menuItemId, itemIds));
  for (const row of rows) {
    const list = map.get(row.menuItemId) ?? [];
    list.push(row.branchId);
    map.set(row.menuItemId, list);
  }
  return map;
}

async function setItemBranches(menuItemId: number, allBranches: boolean, branchIds: number[]) {
  await db.delete(menuItemBranchesTable).where(eq(menuItemBranchesTable.menuItemId, menuItemId));
  if (allBranches || branchIds.length === 0) return;
  const unique = [...new Set(branchIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (unique.length === 0) return;
  await db.insert(menuItemBranchesTable).values(
    unique.map((branchId) => ({ menuItemId, branchId }))
  );
}

function withBranches<T extends { id: number; allBranches?: boolean | null }>(
  item: T,
  branchMap: Map<number, number[]>
) {
  const allBranches = item.allBranches ?? true;
  return {
    ...item,
    allBranches,
    branchIds: allBranches ? [] : branchMap.get(item.id) ?? [],
  };
}

// GET /menu/categories
router.get("/categories", async (_req, res) => {
  const cats = await db
    .select()
    .from(menuCategoriesTable)
    .orderBy(asc(menuCategoriesTable.sortOrder), asc(menuCategoriesTable.id));
  res.json(cats);
});

// POST /menu/categories
router.post("/categories", async (req, res) => {
  const { name, nameAr, nameKu, icon, imageUrl, sortOrder } = req.body;
  let savedImage: string | null = null;
  try {
    savedImage = persistCategoryImageDataUrl(imageUrl);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "تعذر حفظ صورة التصنيف" });
    return;
  }
  const [cat] = await db
    .insert(menuCategoriesTable)
    .values({
      name,
      nameAr,
      nameKu,
      icon,
      imageUrl: savedImage,
      sortOrder,
    })
    .returning();
  res.status(201).json(cat);
});

// PUT /menu/categories/:id
router.put("/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, nameAr, nameKu, icon, imageUrl, sortOrder } = req.body;

  const [existing] = await db
    .select()
    .from(menuCategoriesTable)
    .where(eq(menuCategoriesTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "التصنيف غير موجود" });
    return;
  }

  let nextImage = existing.imageUrl;
  if (imageUrl !== undefined) {
    try {
      if (imageUrl === null || imageUrl === "") {
        nextImage = null;
      } else {
        nextImage = persistCategoryImageDataUrl(imageUrl);
      }
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "تعذر حفظ صورة التصنيف" });
      return;
    }
  }

  const [cat] = await db
    .update(menuCategoriesTable)
    .set({
      name,
      nameAr,
      nameKu,
      icon,
      imageUrl: nextImage,
      sortOrder,
    })
    .where(eq(menuCategoriesTable.id, id))
    .returning();
  res.json(cat);
});

// DELETE /menu/categories/:id
router.delete("/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(menuCategoriesTable).where(eq(menuCategoriesTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

// GET /menu/items
router.get("/items", async (req, res) => {
  const { categoryId, available } = req.query;
  const scope = parseBranchScope(req);

  const rows = await db
    .select({
      id: menuItemsTable.id,
      categoryId: menuItemsTable.categoryId,
      name: menuItemsTable.name,
      nameAr: menuItemsTable.nameAr,
      nameKu: menuItemsTable.nameKu,
      description: menuItemsTable.description,
      descriptionAr: menuItemsTable.descriptionAr,
      price: menuItemsTable.price,
      cost: menuItemsTable.cost,
      majorUnit: menuItemsTable.majorUnit,
      minorUnit: menuItemsTable.minorUnit,
      subunitQty: menuItemsTable.subunitQty,
      imageUrl: menuItemsTable.imageUrl,
      isAvailable: menuItemsTable.isAvailable,
      isFavorite: menuItemsTable.isFavorite,
      allBranches: menuItemsTable.allBranches,
      preparationTime: menuItemsTable.preparationTime,
      calories: menuItemsTable.calories,
      sortOrder: menuItemsTable.sortOrder,
      createdAt: menuItemsTable.createdAt,
      category: menuCategoriesTable,
    })
    .from(menuItemsTable)
    .leftJoin(menuCategoriesTable, eq(menuItemsTable.categoryId, menuCategoriesTable.id))
    .orderBy(asc(menuItemsTable.sortOrder), asc(menuItemsTable.id));

  let items = rows;
  if (categoryId) {
    const cid = parseInt(categoryId as string);
    items = items.filter((i) => i.categoryId === cid);
  }
  if (available !== undefined) {
    const avail = available === "true";
    items = items.filter((i) => i.isAvailable === avail);
  }

  const branchMap = await getBranchIdsForItems(items.map((i) => i.id));
  let result = items.map((i) => withBranches(i, branchMap));

  if (scope.mode === "one") {
    const bid = scope.branchId;
    result = result.filter(
      (i) => i.allBranches || (i.branchIds ?? []).includes(bid)
    );
  }

  res.json(result);
});

// GET /menu/items/:id
router.get("/items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [item] = await db
    .select({
      id: menuItemsTable.id,
      categoryId: menuItemsTable.categoryId,
      name: menuItemsTable.name,
      nameAr: menuItemsTable.nameAr,
      nameKu: menuItemsTable.nameKu,
      description: menuItemsTable.description,
      descriptionAr: menuItemsTable.descriptionAr,
      price: menuItemsTable.price,
      cost: menuItemsTable.cost,
      majorUnit: menuItemsTable.majorUnit,
      minorUnit: menuItemsTable.minorUnit,
      subunitQty: menuItemsTable.subunitQty,
      imageUrl: menuItemsTable.imageUrl,
      isAvailable: menuItemsTable.isAvailable,
      isFavorite: menuItemsTable.isFavorite,
      allBranches: menuItemsTable.allBranches,
      preparationTime: menuItemsTable.preparationTime,
      calories: menuItemsTable.calories,
      sortOrder: menuItemsTable.sortOrder,
      createdAt: menuItemsTable.createdAt,
      category: menuCategoriesTable,
    })
    .from(menuItemsTable)
    .leftJoin(menuCategoriesTable, eq(menuItemsTable.categoryId, menuCategoriesTable.id))
    .where(eq(menuItemsTable.id, id));

  if (!item) {
    res.status(404).json({ success: false, message: "Not found" });
    return;
  }

  const branchMap = await getBranchIdsForItems([id]);
  res.json(withBranches(item, branchMap));
});

// POST /menu/items
router.post("/items", async (req, res) => {
  const {
    categoryId,
    name,
    nameAr,
    nameKu,
    description,
    descriptionAr,
    price,
    cost,
    majorUnit,
    subunitQty,
    imageUrl,
    isAvailable,
    isFavorite,
    preparationTime,
    calories,
    sortOrder,
    allBranches,
    branchIds,
  } = req.body;

  const applyAll =
    allBranches === true ||
    (allBranches !== false && (!Array.isArray(branchIds) || branchIds.length === 0));
  if (allBranches === false && (!Array.isArray(branchIds) || branchIds.length === 0)) {
    res.status(400).json({ success: false, message: "اختر فرعاً واحداً على الأقل أو جميع الفروع" });
    return;
  }

  const duplicate = await findDuplicateMenuItemName(nameAr, name);
  if (duplicate) {
    res.status(400).json({
      success: false,
      message: `اسم الصنف مكرر («${duplicate.nameAr}» / ${duplicate.name}) — اختر اسماً آخر`,
    });
    return;
  }

  const unitFields = normalizeCostUnitFields({ cost, majorUnit, subunitQty });
  if ("error" in unitFields) {
    res.status(400).json({ success: false, message: unitFields.error });
    return;
  }

  let savedImage: string | null = null;
  try {
    savedImage = persistMenuItemImageDataUrl(imageUrl);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || "تعذر حفظ صورة الصنف" });
    return;
  }

  const [item] = await db
    .insert(menuItemsTable)
    .values({
      categoryId,
      name,
      nameAr,
      nameKu,
      description,
      descriptionAr,
      price: price.toString(),
      cost: unitFields.cost,
      majorUnit: unitFields.majorUnit,
      minorUnit: unitFields.minorUnit,
      subunitQty: unitFields.subunitQty,
      imageUrl: savedImage,
      isAvailable: isAvailable ?? true,
      isFavorite: isFavorite ?? false,
      allBranches: applyAll,
      preparationTime,
      calories,
      sortOrder,
    })
    .returning();

  await setItemBranches(item.id, applyAll, applyAll ? [] : branchIds);
  const branchMap = await getBranchIdsForItems([item.id]);
  res.status(201).json(withBranches(item, branchMap));
});

// PUT /menu/items/:id
router.put("/items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    categoryId,
    name,
    nameAr,
    nameKu,
    description,
    descriptionAr,
    price,
    cost,
    majorUnit,
    subunitQty,
    imageUrl,
    isAvailable,
    isFavorite,
    preparationTime,
    calories,
    sortOrder,
    allBranches,
    branchIds,
  } = req.body;

  const applyAll =
    allBranches === undefined && branchIds === undefined
      ? undefined
      : allBranches === true ||
        (allBranches !== false && (!Array.isArray(branchIds) || branchIds.length === 0));

  if (allBranches === false && (!Array.isArray(branchIds) || branchIds.length === 0)) {
    res.status(400).json({ success: false, message: "اختر فرعاً واحداً على الأقل أو جميع الفروع" });
    return;
  }

  const [existing] = await db
    .select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "Not found" });
    return;
  }

  const nextNameAr = nameAr != null ? String(nameAr) : existing.nameAr;
  const nextName = name != null ? String(name) : existing.name;
  const duplicate = await findDuplicateMenuItemName(nextNameAr, nextName, id);
  if (duplicate) {
    res.status(400).json({
      success: false,
      message: `اسم الصنف مكرر («${duplicate.nameAr}» / ${duplicate.name}) — اختر اسماً آخر`,
    });
    return;
  }

  const costTouched =
    cost !== undefined || majorUnit !== undefined || subunitQty !== undefined;
  let unitPatch: Record<string, unknown> = {};
  if (costTouched) {
    const unitFields = normalizeCostUnitFields({
      cost: cost === undefined ? existing.cost : cost,
      majorUnit: majorUnit === undefined ? existing.majorUnit : majorUnit,
      subunitQty: subunitQty === undefined ? existing.subunitQty : subunitQty,
    });
    if ("error" in unitFields) {
      res.status(400).json({ success: false, message: unitFields.error });
      return;
    }
    unitPatch = {
      cost: unitFields.cost,
      majorUnit: unitFields.majorUnit,
      minorUnit: unitFields.minorUnit,
      subunitQty: unitFields.subunitQty,
    };
  }

  let nextImage = existing.imageUrl;
  if (imageUrl !== undefined) {
    try {
      if (imageUrl === null || imageUrl === "") {
        nextImage = null;
      } else {
        nextImage = persistMenuItemImageDataUrl(imageUrl);
      }
    } catch (err: any) {
      res.status(400).json({ success: false, message: err?.message || "تعذر حفظ صورة الصنف" });
      return;
    }
  }

  const [item] = await db
    .update(menuItemsTable)
    .set({
      categoryId,
      name,
      nameAr,
      nameKu,
      description,
      descriptionAr,
      price: price?.toString(),
      ...unitPatch,
      imageUrl: nextImage,
      isAvailable,
      ...(isFavorite !== undefined ? { isFavorite: Boolean(isFavorite) } : {}),
      ...(applyAll !== undefined ? { allBranches: applyAll } : {}),
      preparationTime,
      calories,
      sortOrder,
    })
    .where(eq(menuItemsTable.id, id))
    .returning();

  if (!item) {
    res.status(404).json({ success: false, message: "Not found" });
    return;
  }

  if (allBranches !== undefined || branchIds !== undefined) {
    const finalAll = applyAll ?? item.allBranches;
    await setItemBranches(id, finalAll, finalAll ? [] : branchIds ?? []);
  }

  const branchMap = await getBranchIdsForItems([id]);
  res.json(withBranches(item, branchMap));
});

// DELETE /menu/items/:id
router.delete("/items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(menuItemBranchesTable).where(eq(menuItemBranchesTable.menuItemId, id));
  await db.delete(menuItemsTable).where(eq(menuItemsTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
