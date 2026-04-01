import { Schema, model, models, Document } from 'mongoose';

export interface IDepartment extends Document {
  departmentName: string;
  createdAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    departmentName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 50,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups
DepartmentSchema.index({ departmentName: 1 });

const Department = models.Department || model<IDepartment>('Department', DepartmentSchema);

export default Department;
