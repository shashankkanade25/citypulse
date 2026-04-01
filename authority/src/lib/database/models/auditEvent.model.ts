import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const AuditEventSchema = new Schema(
  {
    ts: { type: Date, required: true, default: () => new Date(), index: true },
    actor: { type: String, required: true, default: "admin-demo" },

    type: {
      type: String,
      required: true,
      enum: [
        "MODERATION_APPROVED",
        "MODERATION_REJECTED",
        "CITIZEN_FLAGGED",
        "USER_UPDATED",
        "ABUSE_ACTION",
        "CONFIG_UPDATED",
      ],
      index: true,
    },

    entityType: { type: String, required: true, default: "incident" },
    entityId: { type: String, required: true, index: true },

    remark: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: false }
);

export type AuditEventDoc = InferSchemaType<typeof AuditEventSchema>;

export const AuditEventModel: Model<AuditEventDoc> =
  (mongoose.models.AuditEvent as Model<AuditEventDoc>) ||
  mongoose.model<AuditEventDoc>("AuditEvent", AuditEventSchema);
