import {
  pgTable,
  serial,
  text,
  boolean,
  numeric,
  timestamp,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", {
    enum: ["admin", "manager", "cashier", "waiter", "kitchen", "delivery"],
  }).notNull(),
  phone: text("phone"),
  email: text("email"),
  /** Login PIN / password for this employee */
  pin: text("pin"),
  salary: numeric("salary", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  /** admin/manager always all branches; others may be scoped */
  allBranches: boolean("all_branches").default(false).notNull(),
  hireDate: timestamp("hire_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const employeeBranchesTable = pgTable(
  "employee_branches",
  {
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "cascade" }),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branchesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.employeeId, t.branchId] })]
);

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
