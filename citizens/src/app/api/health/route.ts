import { connectDB, getConnectionStatus } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';

export async function GET() {
  try {
    // Test MongoDB connection
    await connectDB();

    // Get connection status
    const dbStatus = getConnectionStatus();

    // Test environment variables
    const envChecks = {
      mongodb: !!process.env.MONGODB_URL,
      clerk: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      cloudinary: !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      webhook: !!process.env.CLERK_WEBHOOK_SECRET,
    };

    return successResponse(
      {
        timestamp: new Date().toISOString(),
        environment: {
          variables: envChecks,
          database: dbStatus,
        },
      },
      'Backend is working!'
    );
  } catch (error: any) {
    return errorResponse(error.message || 'Backend connection failed', 500);
  }
}
