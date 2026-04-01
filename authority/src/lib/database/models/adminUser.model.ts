import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const AdminUserSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },

    role: {
      type: String,
      enum: ["Admin", "Auditor"],
      required: true,
      default: "Admin",
      index: true,
    },
    department: { type: String, required: true, default: "All" },

    active: { type: Boolean, required: true, default: true, index: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false }
);

AdminUserSchema.pre("save", function updateTimestamp() {
  (this as unknown as { updatedAt: Date }).updatedAt = new Date();
});

export type AdminUserDoc = InferSchemaType<typeof AdminUserSchema>;

export const AdminUserModel: Model<AdminUserDoc> =
  (mongoose.models.AdminUser as Model<AdminUserDoc>) ||
  mongoose.model<AdminUserDoc>("AdminUser", AdminUserSchema);
