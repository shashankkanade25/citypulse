import { Schema, model, models, Document, Types } from 'mongoose';

export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED';

export interface IIncidentStatusHistory extends Document {
  incidentId: Types.ObjectId;
  status: IncidentStatus;
  changedBy: Types.ObjectId;
  remarks?: string;
  createdAt: Date;
}

const IncidentStatusHistorySchema = new Schema<IIncidentStatusHistory>(
  {
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: 'Incident',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED'],
      required: true,
      index: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for status timeline
IncidentStatusHistorySchema.index({ incidentId: 1, createdAt: -1 });

// Index for tracking who changed what
IncidentStatusHistorySchema.index({ changedBy: 1, createdAt: -1 });

// Index for status-based queries
IncidentStatusHistorySchema.index({ status: 1, createdAt: -1 });

const IncidentStatusHistory = models.IncidentStatusHistory || model<IIncidentStatusHistory>('IncidentStatusHistory', IncidentStatusHistorySchema);

export default IncidentStatusHistory;
