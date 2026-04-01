import pg from 'pg';

// Simulate exactly what the app does
const DATABASE_URL = process.env.DATABASE_URL;
const DUAL_WRITE = process.env.DUAL_WRITE_POSTGRES;
const PG_INSECURE = process.env.PG_INSECURE_SSL;

console.log('ENV CHECK:');
console.log('  DATABASE_URL:', DATABASE_URL ? '(set, length=' + DATABASE_URL.length + ')' : '(NOT SET)');
console.log('  DUAL_WRITE_POSTGRES:', JSON.stringify(DUAL_WRITE));
console.log('  DUAL_WRITE_POSTGRES === "true":', DUAL_WRITE === 'true');
console.log('  PG_INSECURE_SSL:', JSON.stringify(PG_INSECURE));

if (!DATABASE_URL) {
  console.log('\nFATAL: DATABASE_URL not set — dual write will skip PG entirely');
  process.exit(1);
}

// Test connection the same way postgres.ts does (NO ssl option)
console.log('\n--- Test 1: Pool WITHOUT ssl option (same as current code) ---');
try {
  const pool1 = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
  const c1 = await pool1.connect();
  const r1 = await c1.query('SELECT 1 AS ok');
  console.log('  SUCCESS:', r1.rows[0]);
  c1.release();
  await pool1.end();
} catch (e) {
  console.log('  FAILED:', e.message);
}

// Test connection WITH ssl option
console.log('\n--- Test 2: Pool WITH ssl: { rejectUnauthorized: false } ---');
try {
  const pool2 = new pg.Pool({ connectionString: DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
  const c2 = await pool2.connect();
  const r2 = await c2.query('SELECT 1 AS ok');
  console.log('  SUCCESS:', r2.rows[0]);
  c2.release();
  await pool2.end();
} catch (e) {
  console.log('  FAILED:', e.message);
}
