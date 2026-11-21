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

/** Saved delivery phone numbers + addresses (+ optional GPS). */
export const deliveryContactsTable = pgTable("delivery_contacts", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  address: text("address").notNull().default(""),
  name: text("name"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  /** Pasted maps link or free-form GPS text */
  gpsLabel: text("gps_label"),
  note: text("note"),
  branchId: integer("branch_id").references(() => branchesTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDeliveryContactSchema = createInsertSchema(
  deliveryContactsTable
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDeliveryContact = z.infer<typeof insertDeliveryContactSchema>;
export type DeliveryContact = typeof deliveryContactsTable.$inferSelect;
