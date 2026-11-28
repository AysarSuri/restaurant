import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

/** Bump when new ALTER COLUMN blocks are added so they run after hot reload / redeploy. */
const ENSURE_VERSION = 7;
let ensuredVersion = 0;
let ensurePromise: Promise<void> | null = null;

/** Idempotent column adds for per-device sales routing. */
export async function ensureSalesDeviceColumns() {
  if (ensuredVersion >= ENSURE_VERSION && ensurePromise) {
    return ensurePromise;
  }
  ensuredVersion = ENSURE_VERSION;
  ensurePromise = (async () => {
      try {
        await db.execute(sql`
          ALTER TABLE device_printers
          ADD COLUMN IF NOT EXISTS sales_payment_at text NOT NULL DEFAULT 'pos'
        `);
        await db.execute(sql`
          ALTER TABLE device_printers
          ADD COLUMN IF NOT EXISTS sales_payment_at_dine_in text NOT NULL DEFAULT 'pos'
        `);
        await db.execute(sql`
          ALTER TABLE device_printers
          ADD COLUMN IF NOT EXISTS sales_payment_at_takeaway text NOT NULL DEFAULT 'pos'
        `);
        await db.execute(sql`
          ALTER TABLE device_printers
          ADD COLUMN IF NOT EXISTS sales_payment_at_delivery text NOT NULL DEFAULT 'pos'
        `);
        // One-time-ish backfill from legacy sales_payment_at when still at default
        await db.execute(sql`
          UPDATE device_printers
          SET
            sales_payment_at_dine_in = sales_payment_at,
            sales_payment_at_takeaway = sales_payment_at,
            sales_payment_at_delivery = sales_payment_at
          WHERE sales_payment_at = 'cashier'
            AND sales_payment_at_dine_in = 'pos'
            AND sales_payment_at_takeaway = 'pos'
            AND sales_payment_at_delivery = 'pos'
        `);
        await db.execute(sql`
          ALTER TABLE device_printers
          ADD COLUMN IF NOT EXISTS sales_send_to_kitchen boolean NOT NULL DEFAULT true
        `);
        await db.execute(sql`
          ALTER TABLE device_printers
          ADD COLUMN IF NOT EXISTS forms_fullscreen boolean NOT NULL DEFAULT false
        `);
        await db.execute(sql`
          ALTER TABLE device_printers
          ADD COLUMN IF NOT EXISTS virtual_numeric_keypad boolean NOT NULL DEFAULT false
        `);
        await db.execute(sql`
          ALTER TABLE device_printers
          ADD COLUMN IF NOT EXISTS virtual_keyboard boolean NOT NULL DEFAULT false
        `);
        await db.execute(sql`
          ALTER TABLE device_printers
          ADD COLUMN IF NOT EXISTS a4_printer_name text NOT NULL DEFAULT ''
        `);
        await db.execute(sql`
          ALTER TABLE device_printers
          ADD COLUMN IF NOT EXISTS click_sound boolean NOT NULL DEFAULT false
        `);
        await db.execute(sql`
          ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS collect_at_cashier boolean NOT NULL DEFAULT false
        `);
        await db.execute(sql`
          ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS pos_edited_at timestamp
        `);
        await db.execute(sql`
          ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS source text
        `);
        await db.execute(sql`
          ALTER TABLE app_settings
          ADD COLUMN IF NOT EXISTS delivery_fee numeric(12, 2) NOT NULL DEFAULT 0
        `);
        await db.execute(sql`
          ALTER TABLE app_settings
          ADD COLUMN IF NOT EXISTS delivery_require_driver boolean NOT NULL DEFAULT true
        `);
        await db.execute(sql`
          ALTER TABLE app_settings
          ADD COLUMN IF NOT EXISTS delivery_require_phone boolean NOT NULL DEFAULT true
        `);
        await db.execute(sql`
          ALTER TABLE app_settings
          ADD COLUMN IF NOT EXISTS delivery_require_address boolean NOT NULL DEFAULT true
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
        await db.execute(sql`
          ALTER TABLE shifts
          ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'morning'
        `);
        await db.execute(sql`
          ALTER TABLE shifts
          ADD COLUMN IF NOT EXISTS opened_at timestamp NOT NULL DEFAULT now()
        `);
        await db.execute(sql`
          ALTER TABLE shifts
          ADD COLUMN IF NOT EXISTS closed_at timestamp
        `);
        // Shift accounting: creation shift vs collection shift (غير واصل → وردية جديدة)
        await db.execute(sql`
          ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS opened_shift_id integer REFERENCES shifts(id) ON DELETE SET NULL
        `);
        await db.execute(sql`
          ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS paid_at timestamp
        `);
        await db.execute(sql`
          ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS paid_shift_id integer REFERENCES shifts(id) ON DELETE SET NULL
        `);
        // Backfill opened_shift_id from historical created_at window
        await db.execute(sql`
          UPDATE orders o
          SET opened_shift_id = (
            SELECT s.id
            FROM shifts s
            WHERE s.branch_id = o.branch_id
              AND o.created_at >= s.opened_at
              AND o.created_at < coalesce(s.closed_at, now())
            ORDER BY s.opened_at DESC
            LIMIT 1
          )
          WHERE o.opened_shift_id IS NULL
            AND o.branch_id IS NOT NULL
        `);
        // Backfill paid_* for already-received invoices (keep historical attribution by creation shift)
        await db.execute(sql`
          UPDATE orders
          SET
            paid_at = coalesce(paid_at, updated_at, created_at),
            paid_shift_id = coalesce(paid_shift_id, opened_shift_id)
          WHERE status <> 'cancelled'
            AND (
              payment_method IS NOT NULL
              OR status = 'paid'
            )
            AND (paid_shift_id IS NULL OR paid_at IS NULL)
        `);
      } catch (err) {
        ensurePromise = null;
        ensuredVersion = 0;
        // Empty DB / missing tables: schema push handles create; don't crash the process.
        logger.warn({ err }, "Failed ensuring sales device columns (will retry after schema is ready)");
      }
    })();
  return ensurePromise;
}
