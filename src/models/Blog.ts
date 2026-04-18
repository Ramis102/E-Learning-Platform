import mongoose, { Document, Schema, Model, Types } from "mongoose";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
export interface IBlogComment {
  _id?: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBlog {
  author: Types.ObjectId;     // Instructor or Admin only
  title: string;
  content: string;            // Rich HTML from React-Quill
  tags: string[];
  comments: IBlogComment[];
  thumbnail: string;
  isPublished: boolean;
  publishedAt: Date | null;
}

export interface IBlogDocument extends IBlog, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Sub-schema
// ---------------------------------------------------------------------------
const blogCommentSchema = new Schema<IBlogComment>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Comment author is required"],
    },
    content: {
      type: String,
      required: [true, "Comment content is required"],
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
      trim: true,
    },
  },
  {
    timestamps: true,
    _id: true,
  }
);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const blogSchema = new Schema<IBlogDocument>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author is required"],
    },
    title: {
      type: String,
      required: [true, "Blog title is required"],
      trim: true,
      maxlength: [300, "Title cannot exceed 300 characters"],
    },
    content: {
      type: String,
      required: [true, "Blog content is required"],
    },
    tags: {
      type: [String],
      default: [],
    },
    comments: {
      type: [blogCommentSchema],
      default: [],
    },
    thumbnail: {
      type: String,
      default: "",
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Pre-save hook — stamp publishedAt on first publish
// ---------------------------------------------------------------------------
blogSchema.pre<IBlogDocument>("save", function (next) {
  if (this.isModified("isPublished") && this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
blogSchema.index({ author: 1 });
blogSchema.index({ isPublished: 1, publishedAt: -1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ title: "text", content: "text", tags: "text" }); // Full-text search

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
const Blog: Model<IBlogDocument> = mongoose.model<IBlogDocument>(
  "Blog",
  blogSchema
);

export default Blog;
