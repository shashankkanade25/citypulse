import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const AbuseCaseSchema = new Schema(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    citizenId: { type: String, required: true, index: true },

    reason: {
      type: String,
      required: true,
      enum: ["Spam", "Manipulated media", "Repeated low-confidence", "Harassment"],
      index: true,
    },
    risk: {
      type: String,
      required: true,
      enum: ["Low", "Medium", "High"],
      index: true,
    },

    status: {
      type: String,
      required: true,
      enum: ["Monitoring", "Warned", "Temporarily blocked"],
      index: true,
    },

    lastSeen: { type: Date, required: true, default: () => new Date(), index: true },
    blockedUntil: { type: Date },

    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false }
);

AbuseCaseSchema.pre("save", function updateTimestamp() {
  (this as unknown as { updatedAt: Date }).updatedAt = new Date();
});

export type AbuseCaseDoc = InferSchemaType<typeof AbuseCaseSchema>;

export const AbuseCaseModel: Model<AbuseCaseDoc> =
  (mongoose.models.AbuseCase as Model<AbuseCaseDoc>) || mongoose.model<AbuseCaseDoc>("AbuseCase", AbuseCaseSchema);
