const { Client } = require("D:/Restaurant/Restaurant-Manager/lib/db/node_modules/pg");

const url =
  process.env.DATABASE_URL ||
  "postgresql://postgres:restaurant123@localhost:5432/restaurant";

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(`
    ALTER TABLE device_printers
    ADD COLUMN IF NOT EXISTS sales_payment_at text NOT NULL DEFAULT 'pos'
  `);
  await client.query(`
    ALTER TABLE device_printers
    ADD COLUMN IF NOT EXISTS sales_send_to_kitchen boolean NOT NULL DEFAULT true
  `);
  await client.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS collect_at_cashier boolean NOT NULL DEFAULT false
  `);
  const { rows } = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'device_printers'
      AND column_name LIKE 'sales%'
    ORDER BY column_name
  `);
  console.log("sales columns:", rows);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
