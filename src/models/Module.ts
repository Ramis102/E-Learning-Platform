import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
export interface IModule {
  course: Types.ObjectId;
  title: string;
  order: number;
}

export interface IModuleDocument extends IModule, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const moduleSchema = new Schema<IModuleDocument>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course reference is required"],
    },
    title: {
      type: String,
      required: [true, "Module title is required"],
      trim: true,
      maxlength: [200, "Module title cannot exceed 200 characters"],
    },
    order: {
      type: Number,
      required: [true, "Module order is required"],
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
moduleSchema.index({ course: 1, order: 1 }, { unique: true });
moduleSchema.index({ course: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
const Module: Model<IModuleDocument> = mongoose.model<IModuleDocument>(
  "Module",
  moduleSchema
);

export default Module;