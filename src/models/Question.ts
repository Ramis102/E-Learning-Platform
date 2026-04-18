import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
export enum QuestionType {
  MCQ = "mcq",
  TRUE_FALSE = "true_false",
}

export interface IQuestion {
  quiz: Types.ObjectId;
  text: string;
  type: QuestionType;
  options: string[];         // For MCQ: 2–5 choices; for True/False: ["True", "False"]
  correctIndex: number;      // Zero-based index into options[]
  explanation: string;       // Shown to student after submission
  order: number;
}

export interface IQuestionDocument extends IQuestion, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const questionSchema = new Schema<IQuestionDocument>(
  {
    quiz: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
      required: [true, "Quiz reference is required"],
    },
    text: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
      maxlength: [1000, "Question text cannot exceed 1000 characters"],
    },
    type: {
      type: String,
      enum: {
        values: Object.values(QuestionType),
        message: "Type must be one of: mcq, true_false",
      },
      default: QuestionType.MCQ,
    },
    options: {
      type: [String],
      required: [true, "Options are required"],
      validate: {
        validator: function (opts: string[]) {
          return opts.length >= 2 && opts.length <= 5;
        },
        message: "A question must have between 2 and 5 options",
      },
    },
    correctIndex: {
      type: Number,
      required: [true, "Correct option index is required"],
      min: [0, "Index must be non-negative"],
    },
    explanation: {
      type: String,
      default: "",
      maxlength: [1000, "Explanation cannot exceed 1000 characters"],
    },
    order: {
      type: Number,
      required: [true, "Question order is required"],
      min: [0, "Order must be a non-negative number"],
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
questionSchema.index({ quiz: 1, order: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
const Question: Model<IQuestionDocument> = mongoose.model<IQuestionDocument>(
  "Question",
  questionSchema
);

export default Question;
