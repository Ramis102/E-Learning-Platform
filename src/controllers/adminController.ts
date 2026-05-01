import { Response } from "express";
import User, { UserRole } from "../models/User";
import Course from "../models/Course";
import Attempt from "../models/Attempt";
import StudentProfile from "../models/StudentProfile";
import TeacherProfile from "../models/TeacherProfile";
import { AuthRequest } from "../middleware/authMiddleware";

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/overview — Platform-wide stats
// ---------------------------------------------------------------------------

export const getOverview = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const [totalStudents, totalTeachers, totalAdmins, totalCourses, totalAttempts] =
      await Promise.all([
        User.countDocuments({ role: UserRole.STUDENT }),
        User.countDocuments({ role: UserRole.TEACHER }),
        User.countDocuments({ role: UserRole.ADMIN }),
        Course.countDocuments(),
        Attempt.countDocuments(),
      ]);

    // Sum total enrollments from all courses
    const enrollmentAgg = await Course.aggregate([
      { $group: { _id: null, totalEnrollments: { $sum: "$totalEnrolments" } } },
    ]);
    const totalEnrollments = enrollmentAgg[0]?.totalEnrollments || 0;

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalTeachers,
        totalAdmins,
        totalCourses,
        totalEnrollments,
        totalAttempts,
      },
    });
  } catch (error) {
    console.error("GetOverview Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/registrations?period=daily|weekly|monthly
// ---------------------------------------------------------------------------

export const getRegistrations = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const period = (req.query.period as string) || "daily";

    let dateFormat: string;
    let daysBack: number;

    switch (period) {
      case "weekly":
        dateFormat = "%Y-W%V";
        daysBack = 90; // Last ~3 months
        break;
      case "monthly":
        dateFormat = "%Y-%m";
        daysBack = 365; // Last year
        break;
      default: // daily
        dateFormat = "%Y-%m-%d";
        daysBack = 30; // Last 30 days
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const registrations = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          count: { $sum: 1 },
          students: {
            $sum: { $cond: [{ $eq: ["$role", "student"] }, 1, 0] },
          },
          teachers: {
            $sum: { $cond: [{ $eq: ["$role", "teacher"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: registrations.map((r) => ({
        period: r._id,
        total: r.count,
        students: r.students,
        teachers: r.teachers,
      })),
    });
  } catch (error) {
    console.error("GetRegistrations Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/top-courses — Top 10 by enrollment
// ---------------------------------------------------------------------------

export const getTopCourses = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const topCourses = await Course.find()
      .sort({ totalEnrolments: -1 })
      .limit(10)
      .select("title category totalEnrolments instructor thumbnail")
      .populate("instructor", "name")
      .lean();

    res.status(200).json({
      success: true,
      data: topCourses,
    });
  } catch (error) {
    console.error("GetTopCourses Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/quiz-pass-rates — Per-course pass rate
// ---------------------------------------------------------------------------

export const getQuizPassRates = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const passRates = await Attempt.aggregate([
      {
        $group: {
          _id: "$course",
          totalAttempts: { $sum: 1 },
          passedAttempts: {
            $sum: { $cond: [{ $eq: ["$passed", true] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "courses",
          localField: "_id",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },
      {
        $project: {
          courseTitle: "$course.title",
          totalAttempts: 1,
          passedAttempts: 1,
          passRate: {
            $round: [
              { $multiply: [{ $divide: ["$passedAttempts", "$totalAttempts"] }, 100] },
              1,
            ],
          },
        },
      },
      { $sort: { passRate: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: passRates,
    });
  } catch (error) {
    console.error("GetQuizPassRates Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/users — Paginated user list
// ---------------------------------------------------------------------------

export const getUsers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const role = req.query.role as string;
    const search = req.query.search as string;

    const filter: any = {};
    if (role && ["student", "teacher", "admin"].includes(role)) {
      filter.role = role;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("GetUsers Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/admin/users/:id — Update user role/status
// ---------------------------------------------------------------------------

export const updateUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (role && ["student", "teacher", "admin"].includes(role)) {
      user.role = role as UserRole;
    }
    if (typeof isActive === "boolean") {
      user.isActive = isActive;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: { _id: user._id, name: user.name, email: user.email, role: user.role, isActive: (user as any).isActive },
    });
  } catch (error) {
    console.error("UpdateUser Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id — Delete user + associated data
// ---------------------------------------------------------------------------

export const deleteUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // Don't allow deleting yourself
    if (req.user && user._id.toString() === req.user._id.toString()) {
      res.status(400).json({ success: false, message: "Cannot delete yourself" });
      return;
    }

    // Delete associated profile
    if (user.role === UserRole.STUDENT) {
      await StudentProfile.deleteOne({ userId: user._id });
    } else if (user.role === UserRole.TEACHER) {
      await TeacherProfile.deleteOne({ userId: user._id });
    }

    await User.deleteOne({ _id: user._id });

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("DeleteUser Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
