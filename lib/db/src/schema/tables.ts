import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";

export const restaurantTablesTable = pgTable("restaurant_tables", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  capacity: integer("capacity").notNull(),
  type: text("type", { enum: ["table", "room", "person"] }).default("table").notNull(),
  status: text("status", { enum: ["available", "occupied", "reserved", "cleaning"] }).default("available").notNull(),
  location: text("location"),
  branchId: integer("branch_id").references(() => branchesTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRestaurantTableSchema = createInsertSchema(restaurantTablesTable).omit({ id: true, createdAt: true });
export type InsertRestaurantTable = z.infer<typeof insertRestaurantTableSchema>;
export type RestaurantTable = typeof restaurantTablesTable.$inferSelect;
