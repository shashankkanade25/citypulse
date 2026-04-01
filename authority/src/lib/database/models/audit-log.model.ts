import { Schema, model, models, Document, Types } from 'mongoose';

export type AuditAction = 
  | 'USER_CREATED' 
  | 'USER_UPDATED' 
  | 'USER_DELETED'
  | 'INCIDENT_CREATED'
  | 'INCIDENT_UPDATED'
  | 'INCIDENT_STATUS_CHANGED'
  | 'IMAGE_UPLOADED'
  | 'DEPARTMENT_CREATED'
  | 'DEPARTMENT_UPDATED'
  | 'ROLE_CHANGED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED';

export interface IAuditLog extends Document {
  userId: Types.ObjectId;
  action: AuditAction;
  tableName: string;
  recordId?: Types.ObjectId;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    tableName: {
      type: String,
      required: true,
      index: true,
    },
    recordId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    oldValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for audit queries
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ tableName: 1, recordId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

const AuditLog = models.AuditLog || model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
