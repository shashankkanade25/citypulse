import { NextRequest } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { errorResponse, handleApiError, successResponse } from '@/lib/utils/response';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse('Unauthorized', 401);

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return errorResponse('Missing file', 400);
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mime = file.type || 'application/octet-stream';
    const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;

    const uploaded = await uploadToCloudinary(dataUri, 'citizens_reports');

    return successResponse(
      {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        format: uploaded.format,
        width: uploaded.width,
        height: uploaded.height,
      },
      'Uploaded',
    );
  } catch (error) {
    return handleApiError(error);
  }
}
