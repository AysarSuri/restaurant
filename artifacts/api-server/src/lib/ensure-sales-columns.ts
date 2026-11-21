import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

/** Idempotent column adds for per-device sales routing. */
export async function ensureSalesDeviceColumns() {
  try {
    await db.execute(sql`
      ALTER TABLE device_printers
      ADD COLUMN IF NOT EXISTS sales_payment_at text NOT NULL DEFAULT 'pos'
    `);
    await db.execute(sql`
      ALTER TABLE device_printers
      ADD COLUMN IF NOT EXISTS sales_send_to_kitchen boolean NOT NULL DEFAULT true
    `);
    await db.execute(sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS collect_at_cashier boolean NOT NULL DEFAULT false
    `);
  } catch (err) {
    logger.error({ err }, "Failed ensuring sales device columns");
  }
}
