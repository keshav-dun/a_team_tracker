import mongoose, { Document, Schema } from 'mongoose';

export interface IHoliday extends Document {
  _id: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const holidaySchema = new Schema<IHoliday>(
  {
    date: {
      type: String,
      required: [true, 'Date is required'],
      unique: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    name: {
      type: String,
      required: [true, 'Holiday name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
  },
  {
    timestamps: true,
  }
);

const Holiday = mongoose.model<IHoliday>('Holiday', holidaySchema);
export default Holiday;
