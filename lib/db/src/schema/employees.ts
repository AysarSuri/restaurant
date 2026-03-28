import { pgTable, serial, text, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "manager", "cashier", "waiter", "kitchen", "delivery"] }).notNull(),
  phone: text("phone"),
  email: text("email"),
  salary: numeric("salary", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  hireDate: timestamp("hire_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
