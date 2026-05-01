import mongoose, { Document, Schema, Model, Types } from "mongoose";
import Module from "./Module";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
export interface ILecture {
  course: Types.ObjectId;
  module: Types.ObjectId;     // References Module document
  title: string;
  content: string;           // Rich HTML from React-Quill
  videoUrl: string;
  order: number;
  isPreview: boolean;        // Free preview before enrolment
  duration: number;          // Estimated read/watch time in minutes
}

export interface ILectureDocument extends ILecture, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const lectureSchema = new Schema<ILectureDocument>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course reference is required"],
    },
    module: {
      type: Schema.Types.ObjectId,
      ref: "Module",
      required: [true, "Module reference is required"],
      validate: {
        validator: async function (this: ILectureDocument, moduleId: Types.ObjectId) {
          const linkedModule = await Module.findOne({
            _id: moduleId,
            course: this.course,
          })
            .select("_id")
            .lean();

          return Boolean(linkedModule);
        },
        message: "Module must belong to the same course as this lecture",
      },
    },
    title: {
      type: String,
      required: [true, "Lecture title is required"],
      trim: true,
      maxlength: [300, "Title cannot exceed 300 characters"],
    },
    content: {
      type: String,
      required: [true, "Lecture content is required"],
    },
    videoUrl: {
      type: String,
      default: "",
    },
    order: {
      type: Number,
      required: [true, "Lecture order is required"],
      min: [0, "Order must be a non-negative number"],
    },
    isPreview: {
      type: Boolean,
      default: false,
    },
    duration: {
      type: Number,
      default: 0,
      min: [0, "Duration cannot be negative"],
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
lectureSchema.index({ course: 1, order: 1 });
lectureSchema.index({ course: 1, module: 1 });
lectureSchema.index({ title: "text" }); // Full-text search

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
const Lecture: Model<ILectureDocument> = mongoose.model<ILectureDocument>(
  "Lecture",
  lectureSchema
);

export default Lecture;
