import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ModerationSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true,
    },
    lastActionAt: { type: Date },
    lastRemark: { type: String },
    citizenFlagged: { type: Boolean, default: false, required: true },
  },
  { _id: false }
);

const IncidentSchema = new Schema(
  {
    incidentId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    speechToText: { type: String, required: true },

    zone: { type: String, required: true, index: true },
    department: { type: String, required: true, index: true },

    severity: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["Active", "Resolved", "On Hold"],
      required: true,
      index: true,
    },

    confidence: { type: Number, required: true, min: 0, max: 1, index: true },
    reasons: { type: [String], default: [], required: true },

    citizenId: { type: String, required: true, index: true },
    citizenReportCount30d: { type: Number, required: true },
    duplicateClusterId: { type: String },

    images: { type: [String], default: [], required: true },

    assignedTo: { type: [String], default: [] },

    moderation: { type: ModerationSchema, required: true, default: () => ({}) },

    createdAt: { type: Date, required: true, default: () => new Date(), index: true },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false }
);

IncidentSchema.pre("save", function updateTimestamp() {
  (this as unknown as { updatedAt: Date }).updatedAt = new Date();
});

export type IncidentDoc = InferSchemaType<typeof IncidentSchema>;

export const IncidentModel: Model<IncidentDoc> =
  (mongoose.models.Incident as Model<IncidentDoc>) || mongoose.model<IncidentDoc>("Incident", IncidentSchema);

export default IncidentModel;
