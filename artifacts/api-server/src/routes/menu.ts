import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  menuCategoriesTable,
  menuItemsTable,
  menuItemBranchesTable,
} from "@workspace/db/schema";
import { eq, asc, inArray, ne, and, or, sql } from "drizzle-orm";
import { parseBranchScope } from "../lib/branch-scope";
import {
  persistCategoryImageDataUrl,
  persistMenuItemImageDataUrl,
} from "../lib/category-image";

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
      cost: cost?.toString(),
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
      cost: cost?.toString(),
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
