import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";

/** Singleton app settings (restaurant name + brand theme + currency). */
export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  restaurantName: text("restaurant_name").default("المطعم الذكي").notNull(),
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
   * - cashier → status pending (شاشة الكاشير)
   * - kitchen → status preparing (شاشة المطبخ)
   * - none → status paid (حفظ مباشر بدون كاشير/مطبخ)
   */
  posSaveTarget: text("pos_save_target").default("cashier").notNull(),
  /** When cashier confirms payment, forward order to kitchen (preparing). */
  cashierSendToKitchen: boolean("cashier_send_to_kitchen").default(true).notNull(),
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
