import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { restaurantTablesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  const tables = await db.select().from(restaurantTablesTable).orderBy(asc(restaurantTablesTable.number));
  res.json(tables);
});

router.post("/", async (req, res) => {
  const { number, capacity, location, status } = req.body;
  const [table] = await db.insert(restaurantTablesTable).values({ number, capacity, location, status: status ?? "available" }).returning();
  res.status(201).json(table);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { number, capacity, location, status } = req.body;
  const [table] = await db
    .update(restaurantTablesTable)
    .set({ number, capacity, location, status })
    .where(eq(restaurantTablesTable.id, id))
    .returning();
  res.json(table);
});

export default router;
