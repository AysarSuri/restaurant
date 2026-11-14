import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { branchesTable } from "./branches";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category").notNull(),
  date: timestamp("date").notNull(),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
