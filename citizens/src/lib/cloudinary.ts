import { v2 as cloudinary } from 'cloudinary';

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Validate configuration
if (
  !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.warn('⚠️ Cloudinary environment variables are not properly configured');
}

/**
 * Upload an image to Cloudinary
 * @param file - File path or buffer
 * @param folder - Folder name in Cloudinary (default: 'citizens_portal')
 * @returns Upload result with secure_url
 */
export const uploadToCloudinary = async (
  file: string | Buffer,
  folder: string = 'citizens_portal'
): Promise<{
  secure_url: string;
  public_id: string;
  url: string;
  format: string;
  width: number;
  height: number;
}> => {
  try {
    const result = await cloudinary.uploader.upload(file as string, {
      folder,
      resource_type: 'auto',
      transformation: [
        { quality: 'auto' },
        { fetch_format: 'auto' },
      ],
    });

    console.log('✅ Image uploaded to Cloudinary:', result.public_id);
    
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
      url: result.url,
      format: result.format,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

/**
 * Delete an image from Cloudinary
 * @param publicId - Public ID of the image
 */
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
    console.log('✅ Image deleted from Cloudinary:', publicId);
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    throw new Error('Failed to delete image from Cloudinary');
  }
};

/**
 * Get optimized image URL
 * @param publicId - Public ID of the image
 * @param transformations - Optional transformations
 */
export const getOptimizedImageUrl = (
  publicId: string,
  transformations?: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string | number;
  }
): string => {
  return cloudinary.url(publicId, {
    ...transformations,
    fetch_format: 'auto',
    quality: transformations?.quality || 'auto',
  });
};

export default cloudinary;
