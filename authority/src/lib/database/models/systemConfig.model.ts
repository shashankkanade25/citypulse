import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const SystemConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false }
);

SystemConfigSchema.pre("save", function updateTimestamp() {
  (this as unknown as { updatedAt: Date }).updatedAt = new Date();
});

export type SystemConfigDoc = InferSchemaType<typeof SystemConfigSchema>;

export const SystemConfigModel: Model<SystemConfigDoc> =
  (mongoose.models.SystemConfig as Model<SystemConfigDoc>) ||
  mongoose.model<SystemConfigDoc>("SystemConfig", SystemConfigSchema);
