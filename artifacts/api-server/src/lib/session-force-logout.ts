import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

export async function ensureSessionForceLogoutTable() {
  if (ensured && ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS session_force_logout (
          id integer PRIMARY KEY DEFAULT 1,
          force_logout_at timestamp,
          keep_device_key text NOT NULL DEFAULT '',
          opened_shift_id integer,
          updated_at timestamp NOT NULL DEFAULT now(),
          CONSTRAINT session_force_logout_singleton CHECK (id = 1)
        )
      `);
      await db.execute(sql`
        INSERT INTO session_force_logout (id, keep_device_key)
        VALUES (1, '')
        ON CONFLICT (id) DO NOTHING
      `);
      ensured = true;
    } catch (err) {
      ensurePromise = null;
      ensured = false;
      logger.warn({ err }, "Failed ensuring session_force_logout table");
    }
  })();
  return ensurePromise;
}

export type SessionGate = {
  forceLogoutAt: Date | null;
  keepDeviceKey: string;
  openedShiftId: number | null;
};

export async function getSessionForceLogoutGate(): Promise<SessionGate> {
  await ensureSessionForceLogoutTable();
  const result = await db.execute(sql`
    SELECT force_logout_at AS "forceLogoutAt",
           keep_device_key AS "keepDeviceKey",
           opened_shift_id AS "openedShiftId"
    FROM session_force_logout
    WHERE id = 1
    LIMIT 1
  `);
  const rows =
    (result as { rows?: SessionGate[] }).rows ??
    (Array.isArray(result) ? (result as SessionGate[]) : []);
  const row = rows[0];
  if (!row) {
    return { forceLogoutAt: null, keepDeviceKey: "", openedShiftId: null };
  }
  return {
    forceLogoutAt: row.forceLogoutAt ? new Date(row.forceLogoutAt as unknown as string) : null,
    keepDeviceKey: String(row.keepDeviceKey ?? ""),
    openedShiftId:
      row.openedShiftId != null && Number.isFinite(Number(row.openedShiftId))
        ? Number(row.openedShiftId)
        : null,
  };
}

/** Bump global force-logout; keepDeviceKey stays logged in, all other devices must re-login. */
export async function bumpSessionForceLogout(opts: {
  keepDeviceKey: string;
  openedShiftId?: number | null;
}) {
  await ensureSessionForceLogoutTable();
  const keep = String(opts.keepDeviceKey ?? "").trim();
  const shiftId =
    opts.openedShiftId != null && Number.isFinite(Number(opts.openedShiftId))
      ? Number(opts.openedShiftId)
      : null;
  await db.execute(sql`
    INSERT INTO session_force_logout (id, force_logout_at, keep_device_key, opened_shift_id, updated_at)
    VALUES (1, now(), ${keep}, ${shiftId}, now())
    ON CONFLICT (id) DO UPDATE SET
      force_logout_at = now(),
      keep_device_key = EXCLUDED.keep_device_key,
      opened_shift_id = EXCLUDED.opened_shift_id,
      updated_at = now()
  `);
}

/**
 * Should this device be forced to log out?
 * - JWT issued before force_logout_at → logout
 * - except the device that opened the new shift (keepDeviceKey)
 */
export function shouldForceLogoutSession(opts: {
  tokenIatSec: number | null | undefined;
  deviceKey: string | null | undefined;
  gate: SessionGate;
}): boolean {
  const at = opts.gate.forceLogoutAt;
  if (!at || Number.isNaN(at.getTime())) return false;
  const keep = opts.gate.keepDeviceKey.trim();
  const device = String(opts.deviceKey ?? "").trim();
  if (keep && device && keep === device) return false;
  const iatMs =
    opts.tokenIatSec != null && Number.isFinite(opts.tokenIatSec)
      ? opts.tokenIatSec * 1000
      : 0;
  // Session started before the shift-open gate → kick
  return iatMs < at.getTime();
}
