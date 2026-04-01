import { Schema, model, models, Document, Types } from 'mongoose';

export interface IIncidentImage extends Document {
  incidentId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  imageUrl: string;
  isGeotagged: boolean;
  createdAt: Date;
}

const IncidentImageSchema = new Schema<IIncidentImage>(
  {
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: 'Incident',
      required: true,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    isGeotagged: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fetching images by incident
IncidentImageSchema.index({ incidentId: 1, createdAt: -1 });

// Index for user's uploaded images
IncidentImageSchema.index({ uploadedBy: 1, createdAt: -1 });

const IncidentImage = models.IncidentImage || model<IIncidentImage>('IncidentImage', IncidentImageSchema);

export default IncidentImage;
