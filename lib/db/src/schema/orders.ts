import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantTablesTable } from "./tables";
import { customersTable } from "./customers";
import { employeesTable } from "./employees";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  type: text("type", { enum: ["dine_in", "takeaway", "delivery"] }).notNull(),
  status: text("status", { enum: ["pending", "confirmed", "preparing", "ready", "served", "paid", "cancelled"] }).default("pending").notNull(),
  tableId: integer("table_id").references(() => restaurantTablesTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method", { enum: ["cash", "card", "transfer"] }),
  notes: text("notes"),
  deliveryAddress: text("delivery_address"),
  deliveryPhone: text("delivery_phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
