import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const sql = readFileSync(join(__dirname, '..', 'prisma', 'migrate.sql'), 'utf-8');
    await client.query(sql);
    console.log('[migrate] Schema ready');
  } finally {
    await client.end();
  }
}

run().catch((e: Error) => {
  console.error('[migrate] Failed:', e.message);
  process.exit(1);
});
