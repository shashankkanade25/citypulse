import { Schema, model, models, Document, Types } from 'mongoose';

export type UpdateVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface IWorkerUpdate extends Document {
  incidentId: string;
  workerId: Types.ObjectId;
  workerName: string;
  description: string;
  images: string[];
  date: Date;
  submittedAt: Date;
  status: UpdateVerificationStatus;
  headRemarks?: string;
  publishedToTransparency: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkerUpdateSchema = new Schema<IWorkerUpdate>(
  {
    incidentId: { type: String, required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workerName: { type: String, required: true },
    description: { type: String, required: true, minlength: 10 },
    images: { type: [String], default: [] },
    date: { type: Date, required: true, index: true },
    submittedAt: { type: Date, required: true, default: () => new Date() },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },
    headRemarks: { type: String },
    publishedToTransparency: { type: Boolean, default: false },
  },
  { timestamps: true },
);

WorkerUpdateSchema.index({ workerId: 1, date: -1 });
WorkerUpdateSchema.index({ incidentId: 1, workerId: 1, date: 1 }, { unique: true });

const WorkerUpdate = models.WorkerUpdate || model<IWorkerUpdate>('WorkerUpdate', WorkerUpdateSchema);

export default WorkerUpdate;
