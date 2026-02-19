import mongoose, { Document, Schema } from 'mongoose';

export type StatusType = 'office' | 'leave';

export interface IEntry extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format
  status: StatusType;
  note?: string;
  startTime?: string; // HH:mm (24h, IST)
  endTime?: string;   // HH:mm (24h, IST)
  createdAt: Date;
  updatedAt: Date;
}

const entrySchema = new Schema<IEntry>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    status: {
      type: String,
      enum: ['office', 'leave'],
      required: [true, 'Status is required'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
    },
    startTime: {
      type: String,
      trim: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be in HH:mm 24-hour format'],
    },
    endTime: {
      type: String,
      trim: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be in HH:mm 24-hour format'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one entry per user per date
entrySchema.index({ userId: 1, date: 1 }, { unique: true });

const Entry = mongoose.model<IEntry>('Entry', entrySchema);
export default Entry;
