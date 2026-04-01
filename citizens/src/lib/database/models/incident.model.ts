import { Schema, model, models, Document, Types } from 'mongoose';

export type IncidentCategory = 'POWER' | 'WATER' | 'ROAD';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface IIncident extends Document {
  reportedBy: Types.ObjectId;
  category: IncidentCategory;
  description: string;
  latitude: number;
  longitude: number;
  zone: string;
  confidenceScore?: number;
  severity: IncidentSeverity;
  groupedIncidentId?: Types.ObjectId;
  createdAt: Date;
}

const IncidentSchema = new Schema<IIncident>(
  {
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['POWER', 'WATER', 'ROAD'],
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    zone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      index: true,
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      required: true,
      default: 'MEDIUM',
      index: true,
    },
    groupedIncidentId: {
      type: Schema.Types.ObjectId,
      ref: 'Incident',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial index for location-based queries
IncidentSchema.index({ latitude: 1, longitude: 1 });

// Compound indexes for common queries
IncidentSchema.index({ category: 1, severity: 1, createdAt: -1 });
IncidentSchema.index({ reportedBy: 1, createdAt: -1 });
IncidentSchema.index({ zone: 1, category: 1 });

const Incident = models.Incident || model<IIncident>('Incident', IncidentSchema);

export default Incident;
