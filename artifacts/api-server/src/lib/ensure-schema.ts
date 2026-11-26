import { execFile } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db/schema";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

const DEFAULT_ADMIN = {
  name: "Aisar",
  role: "admin" as const,
  pin: "judi2014rudi2020",
  allBranches: true,
  isActive: true,
};

function firstRow(result: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(result)) return result[0] as Record<string, unknown> | undefined;
  const rows = (result as { rows?: Record<string, unknown>[] })?.rows;
  if (Array.isArray(rows)) return rows[0];
  return undefined;
}

async function coreTablesMissing(): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT to_regclass('public.employees') AS employees_reg`
  );
  const row = firstRow(result);
  return !row?.employees_reg;
}

function resolveDrizzleKitBin() {
  try {
    const requireFromDb = createRequire(
      path.resolve(process.cwd(), "lib/db/package.json")
    );
    const pkgJson = requireFromDb.resolve("drizzle-kit/package.json");
    const bin = path.join(path.dirname(pkgJson), "bin.cjs");
    if (fs.existsSync(bin)) return bin;
  } catch {
    /* fall through */
  }
  const candidates = [
    path.resolve(process.cwd(), "node_modules/drizzle-kit/bin.cjs"),
    path.resolve(process.cwd(), "lib/db/node_modules/drizzle-kit/bin.cjs"),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

/** Create schema on empty Railway/Postgres via drizzle-kit push. */
export async function ensureDatabaseSchema() {
  try {
    if (!(await coreTablesMissing())) {
      logger.info("Database schema already present");
      return;
    }
  } catch (err) {
    logger.warn({ err }, "Could not probe schema — attempting push");
  }

  const dbDir = path.resolve(process.cwd(), "lib/db");
  const configPath = path.join(dbDir, "drizzle.config.ts");
  const kitBin = resolveDrizzleKitBin();
  if (!kitBin || !fs.existsSync(configPath)) {
    throw new Error(
      "drizzle-kit / drizzle.config.ts missing. Set DATABASE_URL and run: pnpm --filter @workspace/db push-force"
    );
  }

  logger.warn({ configPath }, "Empty database detected — pushing Drizzle schema");
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [kitBin, "push", "--force", `--config=${configPath}`],
      {
        cwd: dbDir,
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    if (stdout?.trim()) logger.info({ stdout }, "drizzle-kit push stdout");
    if (stderr?.trim()) logger.info({ stderr }, "drizzle-kit push stderr");
  } catch (err) {
    logger.error({ err }, "drizzle-kit push failed");
    throw err;
  }

  try {
    const existing = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .limit(1);
    if (existing.length === 0) {
      await db.insert(employeesTable).values({
        name: DEFAULT_ADMIN.name,
        role: DEFAULT_ADMIN.role,
        pin: DEFAULT_ADMIN.pin,
        allBranches: DEFAULT_ADMIN.allBranches,
        isActive: DEFAULT_ADMIN.isActive,
        menuCanAccess: true,
        menuCanCreate: true,
        menuCanEditNew: true,
        menuCanEditOld: true,
        menuCanDeleteNew: true,
        menuCanDeleteOld: true,
        listPermissions: {},
      });
      logger.info(
        { name: DEFAULT_ADMIN.name },
        "Seeded default system admin for empty database"
      );
    }
  } catch (err) {
    logger.warn({ err }, "Could not seed default admin");
  }
}
