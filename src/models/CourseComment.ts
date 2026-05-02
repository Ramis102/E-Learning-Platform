import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface ICourseComment {
  student: Types.ObjectId;
  course: Types.ObjectId;
  content: string;
  rating: number; // 1-5 stars
}

export interface ICourseCommentDocument extends ICourseComment, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const courseCommentSchema = new Schema<ICourseCommentDocument>(
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
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

courseCommentSchema.index({ course: 1, createdAt: -1 });
courseCommentSchema.index({ student: 1, course: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const CourseComment: Model<ICourseCommentDocument> =
  mongoose.model<ICourseCommentDocument>("CourseComment", courseCommentSchema);

export default CourseComment;
