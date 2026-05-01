import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
export enum CourseCategory {
  DEVELOPMENT = "development",
  DESIGN = "design",
  BUSINESS = "business",
  MARKETING = "marketing",
  SCIENCE = "science",
  MATHEMATICS = "mathematics",
  LANGUAGE = "language",
  PERSONAL_DEVELOPMENT = "personal_development",
  OTHER = "other",
}

export enum CourseDifficulty {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
}

export interface ICourseRating {
  average: number;
  count: number;
}

export interface ICourse {
  title: string;
  description: string;
  instructor: Types.ObjectId;
  price: number;
  thumbnail: string;
  category: CourseCategory;
  difficulty: CourseDifficulty;
  tags: string[];
  rating: ICourseRating;
  totalEnrolments: number;
  isPublished: boolean;
}

export interface ICourseDocument extends ICourse, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const courseSchema = new Schema<ICourseDocument>(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Course description is required"],
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },
    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Instructor is required"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
      default: 0,
    },
    thumbnail: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      enum: {
        values: Object.values(CourseCategory),
        message: "Invalid course category",
      },
      required: [true, "Category is required"],
    },
    difficulty: {
      type: String,
      enum: {
        values: Object.values(CourseDifficulty),
        message: "Difficulty must be one of: beginner, intermediate, advanced",
      },
      default: CourseDifficulty.BEGINNER,
    },
    tags: {
      type: [String],
      default: [],
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: [0, "Rating cannot be below 0"],
        max: [5, "Rating cannot exceed 5"],
      },
      count: {
        type: Number,
        default: 0,
        min: [0, "Rating count cannot be negative"],
      },
    },
    totalEnrolments: {
      type: Number,
      default: 0,
      min: [0, "Enrolment count cannot be negative"],
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual relation to modules for convenient population
courseSchema.virtual("modules", {
  ref: "Module",
  localField: "_id",
  foreignField: "course",
});

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
courseSchema.index({ instructor: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ isPublished: 1 });
courseSchema.index({ tags: 1 });
courseSchema.index({ title: "text", description: "text", tags: "text" }); // Full-text search

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
const Course: Model<ICourseDocument> = mongoose.model<ICourseDocument>(
  "Course",
  courseSchema
);

export default Course;
