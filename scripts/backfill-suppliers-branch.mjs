import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pg = require(join(root, "node_modules/.pnpm/pg@8.20.0/node_modules/pg"));

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:restaurant123@localhost:5432/restaurant",
});

const client = await pool.connect();
try {
  const { rows } = await client.query(
    "SELECT id FROM branches ORDER BY id LIMIT 1"
  );
  if (!rows[0]) {
    console.log("NO_BRANCHES");
    process.exit(0);
  }
  const id = rows[0].id;
  const r = await client.query(
    "UPDATE suppliers SET branch_id = $1 WHERE branch_id IS NULL",
    [id]
  );
  console.log("suppliers_backfilled", r.rowCount, "branch", id);
} finally {
  client.release();
  await pool.end();
}
