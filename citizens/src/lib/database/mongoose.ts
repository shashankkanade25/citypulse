import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

export const connectToDatabase = async () => {
  const mongodbUrl = process.env.MONGODB_URL;
  if (!mongodbUrl) {
    throw new Error('Please define the MONGODB_URL environment variable inside .env.local');
  }

  if (cached.conn) {
    console.log('Using existing database connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    console.log('Creating new database connection...');
    cached.promise = mongoose.connect(mongodbUrl, opts);
  }

  try {
    cached.conn = await cached.promise;
    console.log('✅ MongoDB connected successfully');
  } catch (e) {
    cached.promise = null;
    console.error('❌ MongoDB connection error:', e);
    throw new Error(
      'MongoDB connection failed. Verify MONGODB_URL and that MongoDB is reachable.'
    );
  }

  return cached.conn;
};

export default mongoose;
