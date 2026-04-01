import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * 🔥 DB Connection Entry Point
 * Establishes connection to MongoDB with caching
 */
export async function connectDB() {
  const mongodbUrl = process.env.MONGODB_URL;
  if (!mongodbUrl) {
    throw new Error('Please define the MONGODB_URL environment variable inside .env.local');
  }

  if (cached.conn) {
    console.log('📦 Using cached database connection');
    console.log(`📊 Database: ${cached.conn.connection.db?.databaseName}`);
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    console.log('🔌 Connecting to MongoDB...');
    cached.promise = mongoose.connect(mongodbUrl, opts);
  }

  try {
    cached.conn = await cached.promise;
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${cached.conn.connection.db?.databaseName}`);
  } catch (error) {
    cached.promise = null;
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }

  return cached.conn;
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDB() {
  if (cached.conn) {
    await cached.conn.disconnect();
    cached.conn = null;
    cached.promise = null;
    console.log('🔌 Disconnected from MongoDB');
  }
}

/**
 * Get connection status
 */
export function getConnectionStatus() {
  return {
    isConnected: cached.conn?.connection.readyState === 1,
    readyState: cached.conn?.connection.readyState,
    database: cached.conn?.connection.db?.databaseName,
  };
}

export default mongoose;
