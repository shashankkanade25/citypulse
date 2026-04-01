import { Schema, model, models, type InferSchemaType } from 'mongoose';

const AddressSchema = new Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false }
);

const CitizenSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    username: { type: String, trim: true },
    photo: { type: String, trim: true },

    phone: { type: String, trim: true },
    address: { type: AddressSchema },
    dateOfBirth: { type: Date },

    citizenId: { type: String, trim: true, index: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending', 'suspended'],
      default: 'active',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['citizen', 'admin'],
      default: 'citizen',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export type CitizenDoc = InferSchemaType<typeof CitizenSchema>;

const Citizen = models.Citizen || model<CitizenDoc>('Citizen', CitizenSchema);

export default Citizen;
