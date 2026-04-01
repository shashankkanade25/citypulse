import { Schema, model, models, Document, Types } from 'mongoose';

export type DepartmentCategory = 'POWER' | 'WATER' | 'ROAD';

export interface IDepartment extends Document {
  name: string;
  category: DepartmentCategory;
  headId?: Types.ObjectId;
  workers: Types.ObjectId[];
  createdAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    category: {
      type: String,
      enum: ['POWER', 'WATER', 'ROAD'],
      required: true,
    },
    headId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    workers: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups
DepartmentSchema.index({ name: 1 });
DepartmentSchema.index({ category: 1 });

const Department = models.Department || model<IDepartment>('Department', DepartmentSchema);

export default Department;
