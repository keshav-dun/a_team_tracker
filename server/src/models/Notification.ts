import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: 'favorite_schedule_update';
  sourceUserId: mongoose.Types.ObjectId;
  affectedDates: string[]; // YYYY-MM-DD
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },
    type: {
      type: String,
      enum: ['favorite_schedule_update'],
      required: [true, 'type is required'],
    },
    sourceUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'sourceUserId is required'],
    },
    affectedDates: [{
      type: String,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    }],
    message: {
      type: String,
      required: [true, 'message is required'],
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast queries: user's unread notifications
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model<INotification>('Notification', notificationSchema);
export default Notification;
