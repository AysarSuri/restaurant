import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { menuCategoriesTable, menuItemsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

// GET /menu/categories
router.get("/categories", async (req, res) => {
  const cats = await db
    .select()
    .from(menuCategoriesTable)
    .orderBy(asc(menuCategoriesTable.sortOrder), asc(menuCategoriesTable.id));
  res.json(cats);
});

// POST /menu/categories
router.post("/categories", async (req, res) => {
  const { name, nameAr, nameKu, icon, sortOrder } = req.body;
  const [cat] = await db.insert(menuCategoriesTable).values({ name, nameAr, nameKu, icon, sortOrder }).returning();
  res.status(201).json(cat);
});

// PUT /menu/categories/:id
router.put("/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, nameAr, nameKu, icon, sortOrder } = req.body;
  const [cat] = await db
    .update(menuCategoriesTable)
    .set({ name, nameAr, nameKu, icon, sortOrder })
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
  let query = db
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
      preparationTime: menuItemsTable.preparationTime,
      calories: menuItemsTable.calories,
      sortOrder: menuItemsTable.sortOrder,
      createdAt: menuItemsTable.createdAt,
      category: menuCategoriesTable,
    })
    .from(menuItemsTable)
    .leftJoin(menuCategoriesTable, eq(menuItemsTable.categoryId, menuCategoriesTable.id));

  const conditions = [];
  if (categoryId) conditions.push(eq(menuItemsTable.categoryId, parseInt(categoryId as string)));
  if (available !== undefined) conditions.push(eq(menuItemsTable.isAvailable, available === "true"));

  const items = conditions.length > 0
    ? await query.where(conditions.length === 1 ? conditions[0] : conditions[0]).orderBy(asc(menuItemsTable.sortOrder), asc(menuItemsTable.id))
    : await query.orderBy(asc(menuItemsTable.sortOrder), asc(menuItemsTable.id));

  res.json(items);
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
      preparationTime: menuItemsTable.preparationTime,
      calories: menuItemsTable.calories,
      sortOrder: menuItemsTable.sortOrder,
      createdAt: menuItemsTable.createdAt,
      category: menuCategoriesTable,
    })
    .from(menuItemsTable)
    .leftJoin(menuCategoriesTable, eq(menuItemsTable.categoryId, menuCategoriesTable.id))
    .where(eq(menuItemsTable.id, id));
  res.json(item);
});

// POST /menu/items
router.post("/items", async (req, res) => {
  const { categoryId, name, nameAr, nameKu, description, descriptionAr, price, cost, imageUrl, isAvailable, preparationTime, calories, sortOrder } = req.body;
  const [item] = await db
    .insert(menuItemsTable)
    .values({ categoryId, name, nameAr, nameKu, description, descriptionAr, price: price.toString(), cost: cost?.toString(), imageUrl, isAvailable: isAvailable ?? true, preparationTime, calories, sortOrder })
    .returning();
  res.status(201).json(item);
});

// PUT /menu/items/:id
router.put("/items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { categoryId, name, nameAr, nameKu, description, descriptionAr, price, cost, imageUrl, isAvailable, preparationTime, calories, sortOrder } = req.body;
  const [item] = await db
    .update(menuItemsTable)
    .set({ categoryId, name, nameAr, nameKu, description, descriptionAr, price: price?.toString(), cost: cost?.toString(), imageUrl, isAvailable, preparationTime, calories, sortOrder })
    .where(eq(menuItemsTable.id, id))
    .returning();
  res.json(item);
});

// DELETE /menu/items/:id
router.delete("/items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(menuItemsTable).where(eq(menuItemsTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
