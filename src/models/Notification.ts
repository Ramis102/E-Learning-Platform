import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
export enum NotificationType {
  NEW_QUIZ = "new_quiz",
  GRADE_RELEASED = "grade_released",
  COMMENT_REPLY = "comment_reply",
  CERTIFICATE_READY = "certificate_ready",
  NEW_ENROLMENT = "new_enrolment",       // Emitted to instructor when a student enrols
  ADMIN_BROADCAST = "admin_broadcast",
}

export interface INotification {
  recipient: Types.ObjectId;
  type: NotificationType;
  message: string;
  isRead: boolean;
  link: string;           // Client-side route the bell-icon click should navigate to
}

export interface INotificationDocument extends INotification, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const notificationSchema = new Schema<INotificationDocument>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
    },
    type: {
      type: String,
      enum: {
        values: Object.values(NotificationType),
        message: "Invalid notification type",
      },
      required: [true, "Notification type is required"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      maxlength: [500, "Message cannot exceed 500 characters"],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    link: {
      type: String,
      default: "",
      maxlength: [500, "Link cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
const Notification: Model<INotificationDocument> =
  mongoose.model<INotificationDocument>("Notification", notificationSchema);

export default Notification;
