import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

let ensurePromise: Promise<void> | null = null;

/** Idempotent column adds for per-device sales routing (runs once). */
export async function ensureSalesDeviceColumns() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
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
        await db.execute(sql`
          ALTER TABLE app_settings
          ADD COLUMN IF NOT EXISTS delivery_fee numeric(12, 2) NOT NULL DEFAULT 0
        `);
        await db.execute(sql`
          ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS delivery_fee numeric(12, 2) NOT NULL DEFAULT 0
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS drivers (
            id serial PRIMARY KEY,
            name text NOT NULL,
            phone text,
            vehicle_info text,
            branch_id integer REFERENCES branches(id) ON DELETE SET NULL,
            is_active boolean NOT NULL DEFAULT true,
            notes text,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now()
          )
        `);
        await db.execute(sql`
          ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS driver_id integer REFERENCES drivers(id) ON DELETE SET NULL
        `);
      } catch (err) {
        ensurePromise = null;
        logger.error({ err }, "Failed ensuring sales device columns");
        throw err;
      }
    })();
  }
  return ensurePromise;
}
