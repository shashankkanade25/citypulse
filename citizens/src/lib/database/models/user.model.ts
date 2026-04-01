import { Schema, model, models, Document, Types } from 'mongoose';

export type UserRole = 'CITIZEN' | 'AUTHORITY_HEAD' | 'WORKER' | 'ADMIN';

export interface IUser extends Document {
  username: string;
  password: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  departmentId?: Types.ObjectId;
  zone?: string;
  isActive: boolean;
  photo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['CITIZEN', 'AUTHORITY_HEAD', 'WORKER', 'ADMIN'],
      required: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    zone: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    photo: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index for role-based queries
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ department: 1, role: 1 });
UserSchema.index({ zone: 1, role: 1 });

const User = models.User || model<IUser>('User', UserSchema);

export default User;
