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
import { employeesTable } from "./employees";
import { branchesTable } from "./branches";
import { expenseTypesTable } from "./expenseTypes";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  /** رقم القائمة */
  invoiceNo: text("invoice_no").notNull().default("1"),
  description: text("description").notNull().default(""),
  descriptionAr: text("description_ar"),
  notes: text("notes"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  /** Denormalized type name (compat + display) */
  category: text("category").notNull().default(""),
  expenseTypeId: integer("expense_type_id").references(() => expenseTypesTable.id, {
    onDelete: "restrict",
  }),
  /** Calendar day yyyy-mm-dd for filters */
  expenseDate: text("expense_date"),
  date: timestamp("date").notNull().defaultNow(),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
