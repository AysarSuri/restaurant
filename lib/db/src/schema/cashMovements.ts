import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";
import { cardsTable } from "./cards";

/**
 * Cash desk withdrawals & returns (سحوبات ومرجوعات).
 * kind: withdrawal (سحب) | return (مرجوع)
 */
export const cashMovementsTable = pgTable("cash_movements", {
  id: serial("id").primaryKey(),
  invoiceNo: text("invoice_no").notNull(),
  movementDate: text("movement_date").notNull(),
  movementTime: text("movement_time").notNull(),
  /** withdrawal | return */
  kind: text("kind").notNull().default("withdrawal"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  branchId: integer("branch_id").references(() => branchesTable.id),
  /** cash = بدون بطاقة | card = بطاقة */
  paymentMethod: text("payment_method").notNull().default("cash"),
  cardId: integer("card_id").references(() => cardsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCashMovementSchema = createInsertSchema(cashMovementsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCashMovement = z.infer<typeof insertCashMovementSchema>;
export type CashMovement = typeof cashMovementsTable.$inferSelect;
