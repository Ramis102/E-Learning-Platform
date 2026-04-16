import { Request, Response } from "express";
import User, { UserRole } from "../models/User";
import StudentProfile from "../models/StudentProfile";
import TeacherProfile from "../models/TeacherProfile";
import { AuthRequest } from "../middleware/authMiddleware";

// ---------------------------------------------------------------------------
// GET /api/profile/me — Get the authenticated user's full profile
// ---------------------------------------------------------------------------

export const getMyProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });
      return;
    }

    // ── Build base user data ──────────────────────────────────────────
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };

    // ── Fetch role-specific profile ───────────────────────────────────
    let profile = null;

    if (user.role === UserRole.STUDENT) {
      profile = await StudentProfile.findOne({ userId: user._id })
        .populate("enrolledCourses", "title thumbnail")
        .populate("wishlist", "title thumbnail")
        .populate("certificates");
    } else if (user.role === UserRole.TEACHER) {
      profile = await TeacherProfile.findOne({ userId: user._id })
        .populate("publishedCourses", "title thumbnail");
    }

    res.status(200).json({
      success: true,
      data: {
        user: userData,
        profile,
      },
    });
  } catch (error) {
    console.error("GetMyProfile Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching profile",
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/profile/me — Update the authenticated user's profile
// ---------------------------------------------------------------------------

export const updateMyProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });
      return;
    }

    const body = req.body as Record<string, unknown>;

    // ── Update base user fields (name, avatar) ────────────────────────
    const allowedUserFields = ["name", "avatar"];
    const userUpdates: Record<string, unknown> = {};

    for (const field of allowedUserFields) {
      if (body[field] !== undefined) {
        userUpdates[field] = body[field];
      }
    }

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(user._id, userUpdates, {
        new: true,
        runValidators: true,
      });
    }

    // ── Update role-specific profile fields ───────────────────────────
    let updatedProfile = null;

    if (user.role === UserRole.STUDENT) {
      // Students can update their wishlist (enrolledCourses/certificates
      // are managed by business logic, not direct user input)
      const allowedStudentFields = ["wishlist"];
      const studentUpdates: Record<string, unknown> = {};

      for (const field of allowedStudentFields) {
        if (body[field] !== undefined) {
          studentUpdates[field] = body[field];
        }
      }

      if (Object.keys(studentUpdates).length > 0) {
        updatedProfile = await StudentProfile.findOneAndUpdate(
          { userId: user._id },
          studentUpdates,
          { new: true, runValidators: true }
        );
      } else {
        updatedProfile = await StudentProfile.findOne({ userId: user._id });
      }
    } else if (user.role === UserRole.TEACHER) {
      // Teachers can update their headline, bio, and social links
      const allowedTeacherFields = ["headline", "bio", "socialLinks"];
      const teacherUpdates: Record<string, unknown> = {};

      for (const field of allowedTeacherFields) {
        if (body[field] !== undefined) {
          teacherUpdates[field] = body[field];
        }
      }

      if (Object.keys(teacherUpdates).length > 0) {
        updatedProfile = await TeacherProfile.findOneAndUpdate(
          { userId: user._id },
          teacherUpdates,
          { new: true, runValidators: true }
        );
      } else {
        updatedProfile = await TeacherProfile.findOne({ userId: user._id });
      }
    }

    // ── Fetch fresh user data for the response ────────────────────────
    const freshUser = await User.findById(user._id);

    res.status(200).json({
      success: true,
      data: {
        user: freshUser
          ? {
              _id: freshUser._id,
              name: freshUser.name,
              email: freshUser.email,
              role: freshUser.role,
              avatar: freshUser.avatar,
              isActive: freshUser.isActive,
              createdAt: freshUser.createdAt,
            }
          : null,
        profile: updatedProfile,
      },
    });
  } catch (error) {
    console.error("UpdateMyProfile Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating profile",
    });
  }
};
