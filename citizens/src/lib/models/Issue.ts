import { Schema, model, models, Document, Types } from 'mongoose';

export type IssueStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';

export interface IIssue extends Document {
  reportedBy: Types.ObjectId;
  reporterEmail: string;
  reporterName: string;
  reporterRole: string;

  incidentCode?: string | null;
  citizenImageUrl?: string | null;
  citizenImageUrls?: string[];

  // Deduplication / grouping
  dedupeKey?: string;
  dedupeGeoCell?: string;
  dedupeText?: string;
  dedupeTextHash?: string;

  reporterUserIds?: string[];
  reportCount?: number;
  lastReportedAt?: Date;

  title: string;
  description: string;
  category: string;
  priority: string;
  status: IssueStatus;

  severityLevel?: string;
  department?: string;
  aiConfidence?: number;

  location?: {
    address?: string;
    lat?: number;
    lng?: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const IssueSchema = new Schema<IIssue>(
  {
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reporterEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    reporterName: {
      type: String,
      required: true,
      trim: true,
    },
    reporterRole: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    incidentCode: {
      type: String,
      trim: true,
      index: true,
      default: null,
    },
    citizenImageUrl: {
      type: String,
      trim: true,
      default: null,
    },
    citizenImageUrls: {
      type: [String],
      default: [],
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    priority: {
      type: String,
      required: true,
      trim: true,
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },

    severityLevel: {
      type: String,
      trim: true,
      default: 'MEDIUM',
    },
    department: {
      type: String,
      trim: true,
      default: 'General',
      index: true,
    },
    aiConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    location: {
      address: { type: String, trim: true, default: '' },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    dedupeKey: { type: String, trim: true, index: true, default: null },
    dedupeGeoCell: { type: String, trim: true, index: true, default: null },
    dedupeText: { type: String, trim: true, default: null },
    dedupeTextHash: { type: String, trim: true, default: null },

    reporterUserIds: [{ type: String, trim: true }],
    reportCount: { type: Number, default: 1, min: 1 },
    lastReportedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

IssueSchema.index({ reportedBy: 1, createdAt: -1 });
IssueSchema.index({ status: 1, createdAt: -1 });
IssueSchema.index({ dedupeGeoCell: 1, status: 1, createdAt: -1 });

const Issue = models.Issue || model<IIssue>('Issue', IssueSchema);

export default Issue;
