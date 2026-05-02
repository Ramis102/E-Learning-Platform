import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface ILectureProgress {
  student: Types.ObjectId;
  lecture: Types.ObjectId;
  module: Types.ObjectId;
  course: Types.ObjectId;
  completedAt: Date;
}

export interface ILectureProgressDocument extends ILectureProgress, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const lectureProgressSchema = new Schema<ILectureProgressDocument>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required"],
    },
    lecture: {
      type: Schema.Types.ObjectId,
      ref: "Lecture",
      required: [true, "Lecture reference is required"],
    },
    module: {
      type: Schema.Types.ObjectId,
      ref: "Module",
      required: [true, "Module reference is required"],
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course reference is required"],
    },
    completedAt: {
      type: Date,
      required: [true, "Completion date is required"],
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Indexes — unique compound to prevent duplicate completions
// ---------------------------------------------------------------------------

lectureProgressSchema.index({ student: 1, lecture: 1 }, { unique: true });
lectureProgressSchema.index({ student: 1, course: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const LectureProgress: Model<ILectureProgressDocument> =
  mongoose.model<ILectureProgressDocument>(
    "LectureProgress",
    lectureProgressSchema
  );

export default LectureProgress;
