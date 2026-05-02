import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface IStudentCourseStats {
  student: Types.ObjectId;
  course: Types.ObjectId;
  lecturesCompleted: number;
  totalLectures: number;
  quizzesAttempted: number;
  quizzesPassed: number;
  totalQuizzes: number;
  bestScore: number;
  averageScore: number;
  totalAttempts: number;
  lastActivityAt: Date;
}

export interface IStudentCourseStatsDocument
  extends IStudentCourseStats,
    Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const studentCourseStatsSchema = new Schema<IStudentCourseStatsDocument>(
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
    lecturesCompleted: { type: Number, default: 0 },
    totalLectures: { type: Number, default: 0 },
    quizzesAttempted: { type: Number, default: 0 },
    quizzesPassed: { type: Number, default: 0 },
    totalQuizzes: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    totalAttempts: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

// One stats record per student per course
studentCourseStatsSchema.index({ student: 1, course: 1 }, { unique: true });
studentCourseStatsSchema.index({ course: 1 });
studentCourseStatsSchema.index({ student: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const StudentCourseStats: Model<IStudentCourseStatsDocument> =
  mongoose.model<IStudentCourseStatsDocument>(
    "StudentCourseStats",
    studentCourseStatsSchema
  );

export default StudentCourseStats;
