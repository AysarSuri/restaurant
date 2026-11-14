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

export const cardsTable = pgTable("cards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 })
    .default("0")
    .notNull(),
  balance: numeric("balance", { precision: 14, scale: 2 }).default("0").notNull(),
  qrToken: text("qr_token").notNull().unique(),
  note: text("note"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cardBranchesTable = pgTable(
  "card_branches",
  {
    cardId: integer("card_id")
      .notNull()
      .references(() => cardsTable.id, { onDelete: "cascade" }),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branchesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.branchId] })]
);

export const insertCardSchema = createInsertSchema(cardsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cardsTable.$inferSelect;
