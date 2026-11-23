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

/** Operational branch shift sessions (صباحية / مسائية). */
export const shiftsTable = pgTable("shifts", {
  id: serial("id").primaryKey(),
  /** Display name — صباحية | مسائية */
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  code: text("code"),
  /** morning | evening */
  kind: text("kind", { enum: ["morning", "evening"] })
    .default("morning")
    .notNull(),
  branchId: integer("branch_id")
    .notNull()
    .references(() => branchesTable.id),
  /** Kept for legacy rows / drivers filter fallback (HH:mm) */
  startTime: text("start_time").notNull().default("00:00"),
  endTime: text("end_time").notNull().default("23:59"),
  breakMinutes: integer("break_minutes").default(0).notNull(),
  graceMinutes: integer("grace_minutes").default(0).notNull(),
  daysOfWeek: text("days_of_week").default("[0,1,2,3,4,5,6]").notNull(),
  /** Auto: sky for morning, slate for evening */
  color: text("color").default("#0ea5e9").notNull(),
  supervisorEmployeeId: integer("supervisor_employee_id").references(
    () => employeesTable.id
  ),
  /** When the shift was opened (date + time) */
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  /** When the shift was closed; null = still open */
  closedAt: timestamp("closed_at"),
  notes: text("notes"),
  /** true while shift is open */
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
export type ShiftKind = "morning" | "evening";
