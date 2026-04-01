import mongoose from 'mongoose';

const MONGODB_URL = 'mongodb+srv://Parth-K-15:Parth15032005@visualdiary.zfk1fk5.mongodb.net/carepulse?retryWrites=true&w=majority';

await mongoose.connect(MONGODB_URL);
const db = mongoose.connection.db;

const collections = await db.listCollections().toArray();
console.log('=== MONGODB COLLECTION COUNTS ===');
for (const col of collections.sort((a, b) => a.name.localeCompare(b.name))) {
  const count = await db.collection(col.name).countDocuments();
  console.log(`  ${col.name}: ${count}`);
}

console.log('\n=== LATEST 5 INCIDENTS ===');
const incidents = await db.collection('incidents').find().sort({ _id: -1 }).limit(5).toArray();
for (const r of incidents) {
  console.log(`  ${r._id} | ${(r.title || '').slice(0, 40)} | ${r.status} | dept=${r.department || 'N/A'} | ${r.createdAt}`);
}

console.log('\n=== LATEST 5 ISSUES ===');
const issues = await db.collection('issues').find().sort({ _id: -1 }).limit(5).toArray();
for (const r of issues) {
  console.log(`  ${r._id} | ${(r.title || '').slice(0, 40)} | ${r.status} | ${r.createdAt}`);
}

await mongoose.disconnect();
