import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";
import { employeesTable } from "./employees";

export const shiftsTable = pgTable("shifts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  code: text("code"),
  branchId: integer("branch_id")
    .notNull()
    .references(() => branchesTable.id),
  /** HH:mm local time */
  startTime: text("start_time").notNull(),
  /** HH:mm local time — may be earlier than start for overnight shifts */
  endTime: text("end_time").notNull(),
  breakMinutes: integer("break_minutes").default(0).notNull(),
  graceMinutes: integer("grace_minutes").default(0).notNull(),
  /** JSON array of weekday numbers 0=Sun … 6=Sat */
  daysOfWeek: text("days_of_week").default("[0,1,2,3,4,5,6]").notNull(),
  color: text("color").default("#0ea5e9").notNull(),
  supervisorEmployeeId: integer("supervisor_employee_id").references(
    () => employeesTable.id
  ),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shiftEmployeesTable = pgTable(
  "shift_employees",
  {
    shiftId: integer("shift_id")
      .notNull()
      .references(() => shiftsTable.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.shiftId, t.employeeId] })]
);

export const insertShiftSchema = createInsertSchema(shiftsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shiftsTable.$inferSelect;
