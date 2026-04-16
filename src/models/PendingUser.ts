import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { UserRole } from "./User";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface IPendingUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  verificationToken: string;
  expiresAt: Date;
}

export interface IPendingUserDocument extends IPendingUser, Document {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const pendingUserSchema = new Schema<IPendingUserDocument>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    role: {
      type: String,
      enum: {
        values: Object.values(UserRole),
        message: "Role must be one of: student, teacher, admin",
      },
      default: UserRole.STUDENT,
    },
    verificationToken: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL: auto-deletes when expiresAt is reached
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Pre-save hook — hash password before persisting
// ---------------------------------------------------------------------------

pendingUserSchema.pre<IPendingUserDocument>("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// ---------------------------------------------------------------------------
// Static method — generate a secure random token
// ---------------------------------------------------------------------------

pendingUserSchema.statics.generateToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

interface IPendingUserModel extends Model<IPendingUserDocument> {
  generateToken(): string;
}

const PendingUser: IPendingUserModel = mongoose.model<
  IPendingUserDocument,
  IPendingUserModel
>("PendingUser", pendingUserSchema);

export default PendingUser;
