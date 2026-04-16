import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface ISocialLinks {
  linkedin?: string;
  twitter?: string;
  website?: string;
}

export interface ITeacherProfile {
  userId: Types.ObjectId;
  headline: string;
  bio: string;
  socialLinks: ISocialLinks;
  publishedCourses: Types.ObjectId[];
}

export interface ITeacherProfileDocument extends ITeacherProfile, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const teacherProfileSchema = new Schema<ITeacherProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
    },
    headline: {
      type: String,
      default: "",
      maxlength: [200, "Headline cannot exceed 200 characters"],
    },
    bio: {
      type: String,
      default: "",
      maxlength: [2000, "Bio cannot exceed 2000 characters"],
    },
    socialLinks: {
      linkedin: {
        type: String,
        default: "",
      },
      twitter: {
        type: String,
        default: "",
      },
      website: {
        type: String,
        default: "",
      },
    },
    publishedCourses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

teacherProfileSchema.index({ userId: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const TeacherProfile: Model<ITeacherProfileDocument> =
  mongoose.model<ITeacherProfileDocument>(
    "TeacherProfile",
    teacherProfileSchema
  );

export default TeacherProfile;
