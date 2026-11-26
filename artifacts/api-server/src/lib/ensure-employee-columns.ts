import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

const ENSURE_VERSION = 2;
let ensuredVersion = 0;
let ensurePromise: Promise<void> | null = null;

/** Idempotent menu-permission columns on employees. */
export async function ensureEmployeeColumns() {
  if (ensuredVersion >= ENSURE_VERSION && ensurePromise) {
    return ensurePromise;
  }
  ensuredVersion = ENSURE_VERSION;
  ensurePromise = (async () => {
    try {
      await db.execute(sql`
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS menu_can_access boolean NOT NULL DEFAULT false
      `);
      await db.execute(sql`
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS menu_can_create boolean NOT NULL DEFAULT false
      `);
      await db.execute(sql`
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS menu_can_edit_new boolean NOT NULL DEFAULT false
      `);
      await db.execute(sql`
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS menu_can_edit_old boolean NOT NULL DEFAULT false
      `);
      await db.execute(sql`
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS menu_can_delete_new boolean NOT NULL DEFAULT false
      `);
      await db.execute(sql`
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS menu_can_delete_old boolean NOT NULL DEFAULT false
      `);
      await db.execute(sql`
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS list_permissions jsonb NOT NULL DEFAULT '{}'::jsonb
      `);
    } catch (err) {
      ensurePromise = null;
      ensuredVersion = 0;
      // Empty DB / missing tables: schema push handles create; don't crash the process.
      logger.warn({ err }, "Failed ensuring employee columns (will retry after schema is ready)");
    }
  })();
  return ensurePromise;
}
