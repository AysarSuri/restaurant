import { pgTable, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantTablesTable } from "./tables";
import { customersTable } from "./customers";
import { employeesTable } from "./employees";
import { branchesTable } from "./branches";
import { driversTable } from "./drivers";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  type: text("type", { enum: ["dine_in", "takeaway", "delivery"] }).notNull(),
  status: text("status", { enum: ["pending", "confirmed", "preparing", "ready", "served", "paid", "cancelled"] }).default("pending").notNull(),
  branchId: integer("branch_id").references(() => branchesTable.id),
  tableId: integer("table_id").references(() => restaurantTablesTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  /** Assigned delivery driver */
  driverId: integer("driver_id").references(() => driversTable.id, {
    onDelete: "set null",
  }),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  /** Delivery fee snapshot (from settings at order time). */
  deliveryFee: numeric("delivery_fee", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method", { enum: ["cash", "card", "transfer"] }),
  /** Saved from POS without payment — awaiting cashier collection */
  collectAtCashier: boolean("collect_at_cashier").default(false).notNull(),
  notes: text("notes"),
  deliveryAddress: text("delivery_address"),
  deliveryPhone: text("delivery_phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
