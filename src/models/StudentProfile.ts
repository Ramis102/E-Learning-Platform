import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface IStudentProfile {
  userId: Types.ObjectId;
  enrolledCourses: Types.ObjectId[];
  wishlist: Types.ObjectId[];
  certificates: Types.ObjectId[];
}

export interface IStudentProfileDocument extends IStudentProfile, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const studentProfileSchema = new Schema<IStudentProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
    },
    enrolledCourses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    certificates: [
      {
        type: Schema.Types.ObjectId,
        ref: "Certificate",
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

studentProfileSchema.index({ userId: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const StudentProfile: Model<IStudentProfileDocument> =
  mongoose.model<IStudentProfileDocument>(
    "StudentProfile",
    studentProfileSchema
  );

export default StudentProfile;
