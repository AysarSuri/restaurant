import { pgTable, serial, text, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";

export const inventoryTable = pgTable("inventory", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  unit: text("unit").notNull(),
  currentQuantity: numeric("current_quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  minimumQuantity: numeric("minimum_quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  costPerUnit: numeric("cost_per_unit", { precision: 12, scale: 2 }),
  category: text("category"),
  supplier: text("supplier"),
  branchId: integer("branch_id").references(() => branchesTable.id),
  lastRestockedAt: timestamp("last_restocked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true, createdAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventoryTable.$inferSelect;
