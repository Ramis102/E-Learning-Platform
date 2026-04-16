import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from "bcrypt";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export enum UserRole {
  STUDENT = "student",
  TEACHER = "teacher",
  ADMIN = "admin",
}

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar: string;
  isActive: boolean;
}

export interface IUserDocument extends IUser, Document {
  createdAt: Date;
  updatedAt: Date;
  skipPasswordHash?: boolean;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const userSchema = new Schema<IUserDocument>(
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
      select: false, // Exclude password from queries by default
    },
    role: {
      type: String,
      enum: {
        values: Object.values(UserRole),
        message: "Role must be one of: student, teacher, admin",
      },
      default: UserRole.STUDENT,
    },
    avatar: {
      type: String,
      default: "",
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
// Pre-save hook — hash password before persisting
// ---------------------------------------------------------------------------

userSchema.pre<IUserDocument>("save", async function (next) {
  // Skip hashing if the password is already hashed (e.g. transferred from PendingUser)
  if (this.skipPasswordHash) {
    this.skipPasswordHash = undefined;
    return next();
  }

  // Only hash if the password field has been modified (or is new)
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
// Instance method — compare candidate password against hash
// ---------------------------------------------------------------------------

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const User: Model<IUserDocument> = mongoose.model<IUserDocument>(
  "User",
  userSchema
);

export default User;
