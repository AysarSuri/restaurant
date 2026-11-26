import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

const ENSURE_VERSION = 2;
let ensuredVersion = 0;
let ensurePromise: Promise<void> | null = null;

/** Idempotent payment/card columns for expenses, cash movements, orders, and vault opening. */
export async function ensureVaultColumns() {
  if (ensuredVersion >= ENSURE_VERSION && ensurePromise) {
    return ensurePromise;
  }
  ensuredVersion = ENSURE_VERSION;
  ensurePromise = (async () => {
    try {
      await db.execute(sql`
        ALTER TABLE expenses
        ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash'
      `);
      await db.execute(sql`
        ALTER TABLE expenses
        ADD COLUMN IF NOT EXISTS card_id integer
      `);
      await db.execute(sql`
        ALTER TABLE cash_movements
        ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash'
      `);
      await db.execute(sql`
        ALTER TABLE cash_movements
        ADD COLUMN IF NOT EXISTS card_id integer
      `);
      await db.execute(sql`
        ALTER TABLE app_settings
        ADD COLUMN IF NOT EXISTS cash_opening_balance numeric(14, 2) NOT NULL DEFAULT 0
      `);
      await db.execute(sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS card_id integer
      `);
    } catch (err) {
      ensurePromise = null;
      ensuredVersion = 0;
      logger.error({ err }, "Failed ensuring vault/payment columns");
      throw err;
    }
  })();
  return ensurePromise;
}
