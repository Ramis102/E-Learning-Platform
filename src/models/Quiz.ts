import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
export interface IQuiz {
  lecture: Types.ObjectId;
  questions: Types.ObjectId[];    // Refs to Question documents
  passMark: number;               // Minimum passing percentage (0–100)
  timeLimit: number;              // Time limit in minutes; 0 = unlimited
  isActive: boolean;              // Instructor can disable a quiz without deleting it
}

export interface IQuizDocument extends IQuiz, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const quizSchema = new Schema<IQuizDocument>(
  {
    lecture: {
      type: Schema.Types.ObjectId,
      ref: "Lecture",
      required: [true, "Lecture reference is required"],
      unique: true,   // One quiz per lecture
    },
    questions: [
      {
        type: Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    passMark: {
      type: Number,
      required: [true, "Pass mark is required"],
      min: [0, "Pass mark cannot be below 0"],
      max: [100, "Pass mark cannot exceed 100"],
      default: 60,
    },
    timeLimit: {
      type: Number,
      default: 0,
      min: [0, "Time limit cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
quizSchema.index({ lecture: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
const Quiz: Model<IQuizDocument> = mongoose.model<IQuizDocument>(
  "Quiz",
  quizSchema
);

export default Quiz;
