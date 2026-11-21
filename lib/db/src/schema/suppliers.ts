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
import { menuItemsTable } from "./menuItems";
import { branchesTable } from "./branches";
import { cardsTable } from "./cards";

/** Supplier master data */
export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  /** Opening balance: + we owe them, − they owe us */
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 })
    .default("0")
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Purchase invoice header */
export const supplierPurchasesTable = pgTable("supplier_purchases", {
  id: serial("id").primaryKey(),
  invoiceNo: text("invoice_no").notNull(),
  invoiceDate: text("invoice_date").notNull(),
  invoiceTime: text("invoice_time").notNull(),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliersTable.id, { onDelete: "restrict" }),
  notes: text("notes"),
  totalQty: numeric("total_qty", { precision: 14, scale: 3 }).default("0").notNull(),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 })
    .default("0")
    .notNull(),
  /** Amount paid on this invoice */
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).default("0").notNull(),
  /** Discount on this invoice */
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 })
    .default("0")
    .notNull(),
  /** Remaining = total - discount - paid */
  remainingAmount: numeric("remaining_amount", { precision: 14, scale: 2 })
    .default("0")
    .notNull(),
  /** Branch for this purchase (used for card filtering) */
  branchId: integer("branch_id").references(() => branchesTable.id),
  /** cash = بدون بطاقة | card = بطاقة */
  paymentMethod: text("payment_method").notNull().default("cash"),
  cardId: integer("card_id").references(() => cardsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Purchase invoice lines */
export const supplierPurchaseItemsTable = pgTable("supplier_purchase_items", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id")
    .notNull()
    .references(() => supplierPurchasesTable.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id")
    .notNull()
    .references(() => menuItemsTable.id, { onDelete: "restrict" }),
  qty: numeric("qty", { precision: 14, scale: 3 }).notNull(),
  /** major | minor */
  unitKind: text("unit_kind").notNull(),
  unitLabel: text("unit_label").notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
});

/** Purchase return invoice header (مرجوع شراء) — same shape as purchases */
export const supplierReturnsTable = pgTable("supplier_returns", {
  id: serial("id").primaryKey(),
  invoiceNo: text("invoice_no").notNull(),
  invoiceDate: text("invoice_date").notNull(),
  invoiceTime: text("invoice_time").notNull(),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliersTable.id, { onDelete: "restrict" }),
  notes: text("notes"),
  totalQty: numeric("total_qty", { precision: 14, scale: 3 }).default("0").notNull(),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 })
    .default("0")
    .notNull(),
  /** Amount refunded / settled on this return */
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).default("0").notNull(),
  /** Discount on this return */
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 })
    .default("0")
    .notNull(),
  /** Remaining = total - discount - paid (reduces supplier balance) */
  remainingAmount: numeric("remaining_amount", { precision: 14, scale: 2 })
    .default("0")
    .notNull(),
  /** Branch for this return (used for card filtering) */
  branchId: integer("branch_id").references(() => branchesTable.id),
  /** cash = بدون بطاقة | card = بطاقة */
  paymentMethod: text("payment_method").notNull().default("cash"),
  cardId: integer("card_id").references(() => cardsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Purchase return invoice lines */
export const supplierReturnItemsTable = pgTable("supplier_return_items", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id")
    .notNull()
    .references(() => supplierReturnsTable.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id")
    .notNull()
    .references(() => menuItemsTable.id, { onDelete: "restrict" }),
  qty: numeric("qty", { precision: 14, scale: 3 }).notNull(),
  /** major | minor */
  unitKind: text("unit_kind").notNull(),
  unitLabel: text("unit_label").notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
});

/**
 * Supplier cash / adjustment movement.
 * amountType: paid (مدفوع) | received (واصل) | discount (خصم)
 */
export const supplierMovementsTable = pgTable("supplier_movements", {
  id: serial("id").primaryKey(),
  invoiceNo: text("invoice_no").notNull(),
  movementDate: text("movement_date").notNull(),
  movementTime: text("movement_time").notNull(),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliersTable.id, { onDelete: "restrict" }),
  amountType: text("amount_type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  /** Branch for this movement (used for card filtering) */
  branchId: integer("branch_id").references(() => branchesTable.id),
  /** cash = بدون بطاقة | card = بطاقة — only for paid/received */
  paymentMethod: text("payment_method").notNull().default("cash"),
  cardId: integer("card_id").references(() => cardsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
