import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const c = await pool.connect();
try {
  const tables = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('=== TABLE ROW COUNTS ===');
  for (const t of tables.rows) {
    const cnt = await c.query(`SELECT count(*)::int AS n FROM "${t.table_name}"`);
    console.log(`  ${t.table_name}: ${cnt.rows[0].n}`);
  }
  console.log('\n=== LATEST 5 INCIDENTS ===');
  const latest = await c.query('SELECT id, incident_code, title, status, department_name, created_at FROM incidents ORDER BY created_at DESC LIMIT 5');
  for (const r of latest.rows) {
    console.log(`  ${r.incident_code} | ${(r.title||'').slice(0,40)} | ${r.status} | ${r.department_name} | ${r.created_at}`);
  }
} finally {
  c.release();
  await pool.end();
}
