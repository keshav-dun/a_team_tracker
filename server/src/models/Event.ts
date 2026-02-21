import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  eventType?: string; // e.g. 'team-party', 'mandatory-office', 'offsite', 'town-hall', 'deadline', 'office-closed', 'other'
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    eventType: {
      type: String,
      trim: true,
      maxlength: [50, 'Event type cannot exceed 50 characters'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient date-range queries
eventSchema.index({ date: 1 });
// Prevent duplicate events on the same date with the same title
eventSchema.index({ date: 1, title: 1 }, { unique: true });

const Event = mongoose.model<IEvent>('Event', eventSchema);
export default Event;
