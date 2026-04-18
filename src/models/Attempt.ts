import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
export interface IAnswerRecord {
  questionId: Types.ObjectId;
  selectedIndex: number;      // The option index chosen by the student
  isCorrect: boolean;
}

export interface IAttempt {
  student: Types.ObjectId;
  quiz: Types.ObjectId;
  course: Types.ObjectId;     // Denormalised for efficient certificate & progress queries
  answers: IAnswerRecord[];
  score: number;              // Percentage (0–100)
  passed: boolean;
  certificateUrl: string;     // Populated after certificate generation (if applicable)
  completedAt: Date;
}

export interface IAttemptDocument extends IAttempt, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Sub-schema
// ---------------------------------------------------------------------------
const answerRecordSchema = new Schema<IAnswerRecord>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    selectedIndex: {
      type: Number,
      required: true,
      min: [0, "Selected index must be non-negative"],
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const attemptSchema = new Schema<IAttemptDocument>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required"],
    },
    quiz: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
      required: [true, "Quiz reference is required"],
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course reference is required"],
    },
    answers: {
      type: [answerRecordSchema],
      default: [],
    },
    score: {
      type: Number,
      required: [true, "Score is required"],
      min: [0, "Score cannot be below 0"],
      max: [100, "Score cannot exceed 100"],
    },
    passed: {
      type: Boolean,
      required: true,
    },
    certificateUrl: {
      type: String,
      default: "",
    },
    completedAt: {
      type: Date,
      required: [true, "Completion timestamp is required"],
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
attemptSchema.index({ student: 1, quiz: 1 });
attemptSchema.index({ student: 1, course: 1 });
attemptSchema.index({ quiz: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
const Attempt: Model<IAttemptDocument> = mongoose.model<IAttemptDocument>(
  "Attempt",
  attemptSchema
);

export default Attempt;
