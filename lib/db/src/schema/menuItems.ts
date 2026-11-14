import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { menuCategoriesTable } from "./menuCategories";
import { branchesTable } from "./branches";

export const menuItemsTable = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => menuCategoriesTable.id),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  nameKu: text("name_ku"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  cost: numeric("cost", { precision: 12, scale: 2 }),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").default(true).notNull(),
  /** Favorite items appear first in POS */
  isFavorite: boolean("is_favorite").default(false).notNull(),
  /** When true, item is available in every branch */
  allBranches: boolean("all_branches").default(true).notNull(),
  preparationTime: integer("preparation_time"),
  calories: integer("calories"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Specific branches for a menu item (used when allBranches is false) */
export const menuItemBranchesTable = pgTable(
  "menu_item_branches",
  {
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItemsTable.id, { onDelete: "cascade" }),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branchesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.menuItemId, t.branchId] })]
);

export const insertMenuItemSchema = createInsertSchema(menuItemsTable).omit({ id: true, createdAt: true });
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItemsTable.$inferSelect;
