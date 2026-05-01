import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface ICertificate {
  student: Types.ObjectId;
  course: Types.ObjectId;
  score: number; // Average score across all quizzes (0–100)
  completedAt: Date;
  uuid: string; // Unique verification code
}

export interface ICertificateDocument extends ICertificate, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const certificateSchema = new Schema<ICertificateDocument>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required"],
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course reference is required"],
    },
    score: {
      type: Number,
      required: [true, "Score is required"],
      min: 0,
      max: 100,
    },
    completedAt: {
      type: Date,
      required: [true, "Completion date is required"],
      default: Date.now,
    },
    uuid: {
      type: String,
      required: true,
      unique: true,
      default: () => {
        // Generate a UUID-like string using crypto
        const bytes = require("crypto").randomBytes(16);
        const hex = bytes.toString("hex");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      },
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

// Each student can only have one certificate per course
certificateSchema.index({ student: 1, course: 1 }, { unique: true });
certificateSchema.index({ uuid: 1 }, { unique: true });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const Certificate: Model<ICertificateDocument> = mongoose.model<ICertificateDocument>(
  "Certificate",
  certificateSchema
);

export default Certificate;
