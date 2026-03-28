import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db/schema";
import { eq, ilike, or, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const { search } = req.query;
  let customers;
  if (search) {
    customers = await db
      .select()
      .from(customersTable)
      .where(or(ilike(customersTable.name, `%${search}%`), ilike(customersTable.phone, `%${search}%`)))
      .orderBy(desc(customersTable.createdAt));
  } else {
    customers = await db.select().from(customersTable).orderBy(desc(customersTable.createdAt));
  }
  res.json(customers);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) return res.status(404).json({ error: "Not found" });
  res.json(customer);
});

router.post("/", async (req, res) => {
  const { name, phone, email, address, notes } = req.body;
  const [customer] = await db.insert(customersTable).values({ name, phone, email, address, notes }).returning();
  res.status(201).json(customer);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, phone, email, address, notes } = req.body;
  const [customer] = await db
    .update(customersTable)
    .set({ name, phone, email, address, notes })
    .where(eq(customersTable.id, id))
    .returning();
  res.json(customer);
});

export default router;
