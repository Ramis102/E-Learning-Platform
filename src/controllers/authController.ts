import { Request, Response } from "express";
import User, { UserRole } from "../models/User";
import StudentProfile from "../models/StudentProfile";
import TeacherProfile from "../models/TeacherProfile";
import { generateToken } from "../utils/generateToken";

// ---------------------------------------------------------------------------
// POST /api/auth/register — Create account immediately
// ---------------------------------------------------------------------------

export const registerUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
    };

    // ── Validate required fields ──────────────────────────────────────
    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
      return;
    }

    // ── Prevent self-registration as admin ────────────────────────────
    if (role === UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: "Admin accounts cannot be created via registration",
      });
      return;
    }

    // ── Check if user already exists ──────────────────────────────────
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
      return;
    }

    const assignedRole = role || UserRole.STUDENT;

    const user = new User({
      name,
      email,
      password,
      role: assignedRole,
    });

    await user.save();

    try {
      if (user.role === UserRole.STUDENT) {
        await StudentProfile.create({
          userId: user._id,
          enrolledCourses: [],
          wishlist: [],
          certificates: [],
        });
      } else if (user.role === UserRole.TEACHER) {
        await TeacherProfile.create({
          userId: user._id,
          headline: "",
          bio: "",
          socialLinks: { linkedin: "", twitter: "", website: "" },
          publishedCourses: [],
        });
      }
    } catch (profileError) {
      console.error("Profile creation failed, rolling back user:", profileError);
      await User.deleteOne({ _id: user._id });

      res.status(500).json({
        success: false,
        message: "Failed to create user profile. Please try again.",
      });
      return;
    }

    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: "Registration successful. You can now log in.",
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during registration",
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

export const loginUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    // ── Validate required fields ──────────────────────────────────────
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
      return;
    }

    // ── Find user and explicitly select password ──────────────────────
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // ── Verify password ───────────────────────────────────────────────
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // ── Generate JWT & respond (password excluded) ────────────────────
    const token = generateToken(user._id.toString());

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during login",
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/auth/me  (protected — returns current user)
// ---------------------------------------------------------------------------

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("GetMe Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

