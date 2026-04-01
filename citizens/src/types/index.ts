// Database Types
export interface DatabaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Citizen Types
export interface CitizenProfile {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  photo?: string;
  phone?: string;
  address?: Address;
  dateOfBirth?: string;
  citizenId?: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  role: 'citizen' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

// Form Types
export interface CreateCitizenParams {
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  photo?: string;
}

export interface UpdateCitizenParams {
  clerkId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  photo?: string;
  phone?: string;
  address?: Address;
  dateOfBirth?: string;
}

// Cloudinary Upload Types
export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  url: string;
  format: string;
  width: number;
  height: number;
}

export interface UploadImageParams {
  file: File | string;
  folder?: string;
}
