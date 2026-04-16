import { Request, Response } from "express";
import User, { UserRole } from "../models/User";
import PendingUser from "../models/PendingUser";
import StudentProfile from "../models/StudentProfile";
import TeacherProfile from "../models/TeacherProfile";
import { generateToken } from "../utils/generateToken";
import { sendVerificationEmail } from "../config/mailer";

// ---------------------------------------------------------------------------
// POST /api/auth/register — Send verification email
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

    // ── Check if user already exists (confirmed) ──────────────────────
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
      return;
    }

    // ── Remove any previous pending registration for this email ───────
    await PendingUser.deleteMany({ email });

    // ── Create pending user with verification token ───────────────────
    const verificationToken = PendingUser.generateToken();
    const assignedRole = role || UserRole.STUDENT;

    await PendingUser.create({
      name,
      email,
      password, // hashed by pre-save hook
      role: assignedRole,
      verificationToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // ── Send verification email ───────────────────────────────────────
    try {
      await sendVerificationEmail(email, name, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Clean up the pending user if email fails
      await PendingUser.deleteMany({ email });

      res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message:
        "Registration initiated! Please check your email to verify your account. The link expires in 24 hours.",
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
// GET /api/auth/verify-email/:token — Confirm email & create account
// ---------------------------------------------------------------------------

export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
      return;
    }

    // ── Find the pending registration ─────────────────────────────────
    const pendingUser = await PendingUser.findOne({
      verificationToken: token,
    });

    if (!pendingUser) {
      res.status(400).json({
        success: false,
        message:
          "Invalid or expired verification link. Please register again.",
      });
      return;
    }

    // ── Check if a confirmed user was created in the meantime ─────────
    const existingUser = await User.findOne({ email: pendingUser.email });

    if (existingUser) {
      await PendingUser.deleteOne({ _id: pendingUser._id });
      res.status(409).json({
        success: false,
        message: "This email has already been verified.",
      });
      return;
    }

    // ── Create the real user (password is already hashed) ─────────────
    const user = new User({
      name: pendingUser.name,
      email: pendingUser.email,
      role: pendingUser.role,
    });

    // Transfer the already-hashed password and skip re-hashing
    user.password = pendingUser.password;
    user.skipPasswordHash = true;
    await user.save();

    // ── Create role-specific profile ──────────────────────────────────
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

    // ── Clean up pending record ───────────────────────────────────────
    await PendingUser.deleteOne({ _id: pendingUser._id });

    // ── Generate JWT & respond ────────────────────────────────────────
    const jwtToken = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: "Email verified successfully! Your account is now active.",
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
        token: jwtToken,
      },
    });
  } catch (error) {
    console.error("Verify Email Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during email verification",
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/resend-verification — Resend verification email
// ---------------------------------------------------------------------------

export const resendVerification = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      res.status(400).json({
        success: false,
        message: "Please provide your email address",
      });
      return;
    }

    // ── Check if already verified ─────────────────────────────────────
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "This email is already verified. Please login.",
      });
      return;
    }

    // ── Find pending registration ─────────────────────────────────────
    const pendingUser = await PendingUser.findOne({ email });

    if (!pendingUser) {
      res.status(404).json({
        success: false,
        message:
          "No pending registration found for this email. Please register first.",
      });
      return;
    }

    // ── Generate new token & extend expiry ────────────────────────────
    pendingUser.verificationToken = PendingUser.generateToken();
    pendingUser.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pendingUser.save();

    // ── Resend the email ──────────────────────────────────────────────
    await sendVerificationEmail(
      pendingUser.email,
      pendingUser.name,
      pendingUser.verificationToken
    );

    res.status(200).json({
      success: true,
      message:
        "Verification email resent! Please check your inbox. The link expires in 24 hours.",
    });
  } catch (error) {
    console.error("Resend Verification Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while resending verification email",
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

// ---------------------------------------------------------------------------
// POST /api/auth/check-verification — Check if an email is verified
// ---------------------------------------------------------------------------

export const checkVerificationStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      res.status(400).json({
        success: false,
        message: "Please provide an email address",
      });
      return;
    }

    // ── Check if account exists (verified) ────────────────────────────
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(200).json({
        success: true,
        data: {
          email,
          status: "verified",
          message: "This email is verified. You can login.",
        },
      });
      return;
    }

    // ── Check if pending verification ─────────────────────────────────
    const pendingUser = await PendingUser.findOne({ email });

    if (pendingUser) {
      res.status(200).json({
        success: true,
        data: {
          email,
          status: "pending",
          message:
            "Verification email has been sent. Please check your inbox.",
          expiresAt: pendingUser.expiresAt,
        },
      });
      return;
    }

    // ── Not found at all ──────────────────────────────────────────────
    res.status(200).json({
      success: true,
      data: {
        email,
        status: "not_found",
        message: "No account found with this email. Please register.",
      },
    });
  } catch (error) {
    console.error("Check Verification Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
