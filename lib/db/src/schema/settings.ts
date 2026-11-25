import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";

/** Singleton app settings (restaurant name + brand theme + currency). */
export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  restaurantName: text("restaurant_name").default("المطعم الذكي").notNull(),
  /** Restaurant logo as data URL or http(s) URL */
  logoUrl: text("logo_url"),
  /** Restaurant contact mobile number */
  mobile: text("mobile"),
  /** HSL components without hsl(), e.g. "38 92% 50%" */
  themePrimary: text("theme_primary").default("38 92% 50%").notNull(),
  /** iqd | usd | eur | custom */
  currencyCode: text("currency_code").default("iqd").notNull(),
  currencySymbol: text("currency_symbol").default("د.ع").notNull(),
  currencyName: text("currency_name").default("دينار عراقي").notNull(),
  /** 0–4 */
  decimalPlaces: integer("decimal_places").default(0).notNull(),
  /**
   * Where new sales (POS / table) go on save:
   * - kitchen → status preparing (شاشة المطبخ)
   * - none → status paid (حفظ مباشر بدون مطبخ)
   */
  posSaveTarget: text("pos_save_target").default("kitchen").notNull(),
  /** When cashier confirms payment, forward order to kitchen (preparing). */
  cashierSendToKitchen: boolean("cashier_send_to_kitchen").default(true).notNull(),
  /** Flat delivery fee applied to delivery orders (currency units). */
  deliveryFee: numeric("delivery_fee", { precision: 12, scale: 2 }).default("0").notNull(),
  /** When true, POS delivery orders require a driver */
  deliveryRequireDriver: boolean("delivery_require_driver").default(true).notNull(),
  /** When true, POS delivery orders require a mobile phone */
  deliveryRequirePhone: boolean("delivery_require_phone").default(true).notNull(),
  /** When true, POS delivery orders require a delivery address */
  deliveryRequireAddress: boolean("delivery_require_address").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Per-device thermal printer assignment (80×80), scoped by branch. */
export const devicePrintersTable = pgTable("device_printers", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branchesTable.id, {
    onDelete: "set null",
  }),
  /** Stable browser/machine fingerprint stored in localStorage */
  deviceKey: text("device_key").notNull().unique(),
  deviceName: text("device_name").notNull(),
  printerName: text("printer_name").notNull().default(""),
  /** Fixed receipt paper format */
  paperSize: text("paper_size").default("80x80").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  note: text("note"),
  /**
   * Legacy / fallback where payment is collected:
   * - pos → pay on POS (choose payment method)
   * - cashier → save invoice only; collect payment on cashier screen
   * Prefer per-order-type columns below.
   */
  salesPaymentAt: text("sales_payment_at").default("pos").notNull(),
  /** Payment source for dine-in (table) orders: pos | cashier */
  salesPaymentAtDineIn: text("sales_payment_at_dine_in").default("pos").notNull(),
  /** Payment source for takeaway orders: pos | cashier */
  salesPaymentAtTakeaway: text("sales_payment_at_takeaway").default("pos").notNull(),
  /** Payment source for delivery orders: pos | cashier */
  salesPaymentAtDelivery: text("sales_payment_at_delivery").default("pos").notNull(),
  /** Independent kitchen routing for this device */
  salesSendToKitchen: boolean("sales_send_to_kitchen").default(true).notNull(),
  /** When true, all app forms run in browser fullscreen on this device */
  formsFullscreen: boolean("forms_fullscreen").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;

export const insertDevicePrinterSchema = createInsertSchema(devicePrintersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDevicePrinter = z.infer<typeof insertDevicePrinterSchema>;
export type DevicePrinter = typeof devicePrintersTable.$inferSelect;
