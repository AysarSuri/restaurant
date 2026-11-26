import {
  pgTable,
  serial,
  text,
  boolean,
  numeric,
  timestamp,
  integer,
  primaryKey,
  jsonb,
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
  /** Menu (قائمة الطعام) permissions — legacy flags kept for migration */
  menuCanAccess: boolean("menu_can_access").default(false).notNull(),
  menuCanCreate: boolean("menu_can_create").default(false).notNull(),
  menuCanEditNew: boolean("menu_can_edit_new").default(false).notNull(),
  menuCanEditOld: boolean("menu_can_edit_old").default(false).notNull(),
  menuCanDeleteNew: boolean("menu_can_delete_new").default(false).notNull(),
  menuCanDeleteOld: boolean("menu_can_delete_old").default(false).notNull(),
  /** Per-list permissions: access/create + edit/delete age scope (1d|2d|all) */
  listPermissions: jsonb("list_permissions").$type<Record<string, unknown>>().default({}).notNull(),
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
