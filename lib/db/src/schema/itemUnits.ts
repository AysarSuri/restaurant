import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Reusable major units for menu items (carton, box, …). Minor unit is always «عدد». */
export const itemUnitsTable = pgTable("item_units", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  name: text("name"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertItemUnitSchema = createInsertSchema(itemUnitsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertItemUnit = z.infer<typeof insertItemUnitSchema>;
export type ItemUnit = typeof itemUnitsTable.$inferSelect;
