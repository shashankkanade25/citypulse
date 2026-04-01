import mongoose from 'mongoose';
import pg from 'pg';

const MONGODB_URL = 'mongodb+srv://Parth-K-15:Parth15032005@visualdiary.zfk1fk5.mongodb.net/carepulse?retryWrites=true&w=majority';
const DATABASE_URL = 'postgresql://postgres.xzlmkvansmgzovdrvhvk:Digvijay%401283@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require';

await mongoose.connect(MONGODB_URL);
const db = mongoose.connection.db;

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
const client = await pool.connect();

try {
  // Latest Mongo issues
  console.log('=== MONGO: Latest 5 issues ===');
  const issues = await db.collection('issues').find().sort({ _id: -1 }).limit(5).toArray();
  for (const r of issues) {
    console.log(`  ${r._id} | ${(r.title || '').slice(0, 50)} | ${r.status} | ${r.createdAt}`);
  }

  // Latest Mongo incidents
  console.log('\n=== MONGO: Latest 5 incidents ===');
  const incidents = await db.collection('incidents').find().sort({ _id: -1 }).limit(5).toArray();
  for (const r of incidents) {
    console.log(`  ${r._id} | ${(r.title || '').slice(0, 50)} | ${r.status} | ${r.createdAt}`);
  }

  // Mongo counts
  const issueCount = await db.collection('issues').countDocuments();
  const incidentCount = await db.collection('incidents').countDocuments();
  console.log(`\nMONGO totals: issues=${issueCount}, incidents=${incidentCount}`);

  // Latest Postgres incidents
  console.log('\n=== POSTGRES: Latest 5 incidents ===');
  const pgLatest = await client.query(
    "SELECT incident_code, title, status, metadata->>'source' AS source, created_at FROM incidents ORDER BY created_at DESC LIMIT 5"
  );
  for (const r of pgLatest.rows) {
    console.log(`  ${r.incident_code} | ${(r.title || '').slice(0, 50)} | ${r.status} | src=${r.source} | ${r.created_at}`);
  }

  // Postgres count
  const pgCount = await client.query('SELECT count(*)::int AS n FROM incidents');
  console.log(`\nPOSTGRES total: incidents=${pgCount.rows[0].n}`);
} finally {
  client.release();
  await pool.end();
  await mongoose.disconnect();
}
