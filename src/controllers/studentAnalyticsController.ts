import { Response } from "express";
import { Types } from "mongoose";
import Course from "../models/Course";
import Lecture from "../models/Lecture";
import LectureProgress from "../models/LectureProgress";
import Quiz from "../models/Quiz";
import Attempt from "../models/Attempt";
import Certificate from "../models/Certificate";
import StudentProfile from "../models/StudentProfile";
import { AuthRequest } from "../middleware/authMiddleware";

// ---------------------------------------------------------------------------
// GET /api/progress/dashboard — Student learning dashboard analytics
// ---------------------------------------------------------------------------
export const getDashboard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const userId = req.user._id;

    // Get student profile (handle string vs ObjectId)
    let profile: any = await StudentProfile.findOne({ userId }).lean();
    if (!profile) {
      // Try with explicit ObjectId conversion
      profile = await StudentProfile.findOne({
        userId: new Types.ObjectId(String(userId)),
      }).lean();
    }
    if (!profile) {
      // Auto-create empty profile for first-time users
      const newProfile = await StudentProfile.create({
        userId: new Types.ObjectId(String(userId)),
        enrolledCourses: [],
        wishlist: [],
        certificates: [],
      });
      profile = newProfile.toObject();
    }

    const enrolledCourseIds = (profile.enrolledCourses || []).map(
      (id: any) => new Types.ObjectId(String(id))
    );

    if (enrolledCourseIds.length === 0) {
      res.status(200).json({
        success: true,
        data: {
          totalEnrolled: 0,
          totalCompleted: 0,
          totalLecturesCompleted: 0,
          quizzesPassed: 0,
          quizzesAttempted: 0,
          certificatesEarned: 0,
          recentActivity: [],
          courses: [],
        },
      });
      return;
    }

    // Fetch all data in parallel
    const [
      courses,
      allLectures,
      allProgress,
      allQuizzes,
      allAttempts,
      certificates,
    ] = await Promise.all([
      Course.find({ _id: { $in: enrolledCourseIds } })
        .select("title thumbnail category difficulty")
        .lean(),
      Lecture.find({ course: { $in: enrolledCourseIds } })
        .select("_id course")
        .lean(),
      LectureProgress.find({
        student: userId,
        course: { $in: enrolledCourseIds },
      })
        .sort({ createdAt: -1 })
        .lean(),
      Quiz.find({ course: { $in: enrolledCourseIds }, isActive: true })
        .select("_id course")
        .lean(),
      Attempt.find({
        student: userId,
        course: { $in: enrolledCourseIds },
      })
        .sort({ completedAt: -1 })
        .lean(),
      Certificate.find({ student: userId }).lean(),
    ]);

    // Group lectures and quizzes by course
    const lecturesByCourse = new Map<string, number>();
    for (const lec of allLectures) {
      const key = lec.course.toString();
      lecturesByCourse.set(key, (lecturesByCourse.get(key) || 0) + 1);
    }

    const progressByCourse = new Map<string, number>();
    for (const prog of allProgress) {
      const key = prog.course.toString();
      progressByCourse.set(key, (progressByCourse.get(key) || 0) + 1);
    }

    const quizzesByCourse = new Map<string, number>();
    for (const quiz of allQuizzes) {
      const key = quiz.course.toString();
      quizzesByCourse.set(key, (quizzesByCourse.get(key) || 0) + 1);
    }

    // Per-course breakdown
    const coursesData = courses.map((course) => {
      const cid = (course._id as Types.ObjectId).toString();
      const totalLecs = lecturesByCourse.get(cid) || 0;
      const completedLecs = progressByCourse.get(cid) || 0;
      const totalQuizzes = quizzesByCourse.get(cid) || 0;

      // Count unique passed quizzes
      const courseAttempts = allAttempts.filter(
        (a) => a.course.toString() === cid
      );
      const passedQuizIds = new Set(
        courseAttempts.filter((a) => a.passed).map((a) => a.quiz.toString())
      );

      const lecturePercent =
        totalLecs > 0 ? Math.round((completedLecs / totalLecs) * 100) : 0;
      const isCompleted =
        totalLecs > 0 &&
        completedLecs >= totalLecs &&
        (totalQuizzes === 0 || passedQuizIds.size >= totalQuizzes);

      return {
        courseId: cid,
        title: course.title,
        thumbnail: (course as any).thumbnail,
        category: (course as any).category,
        difficulty: (course as any).difficulty,
        lectureProgress: lecturePercent,
        completedLectures: completedLecs,
        totalLectures: totalLecs,
        quizzesPassed: passedQuizIds.size,
        totalQuizzes,
        isCompleted,
      };
    });

    // Aggregated stats
    const totalCompleted = coursesData.filter((c) => c.isCompleted).length;
    const totalLecturesCompleted = allProgress.length;

    const allPassedQuizIds = new Set(
      allAttempts.filter((a) => a.passed).map((a) => a.quiz.toString())
    );
    const uniqueAttemptedQuizIds = new Set(
      allAttempts.map((a) => a.quiz.toString())
    );

    // Recent activity: combine last 5 lecture completions + last 5 quiz attempts
    const recentLectures = allProgress.slice(0, 5).map((p) => ({
      type: "lecture_completed" as const,
      courseId: p.course.toString(),
      lectureId: p.lecture.toString(),
      timestamp: (p as any).createdAt || (p as any).completedAt,
    }));

    const recentQuizzes = allAttempts.slice(0, 5).map((a) => ({
      type: "quiz_attempt" as const,
      courseId: a.course.toString(),
      quizId: a.quiz.toString(),
      score: a.score,
      passed: a.passed,
      timestamp: a.completedAt,
    }));

    // Merge and sort by time
    const recentActivity = [...recentLectures, ...recentQuizzes]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
        totalEnrolled: enrolledCourseIds.length,
        totalCompleted,
        totalLecturesCompleted,
        quizzesPassed: allPassedQuizIds.size,
        quizzesAttempted: uniqueAttemptedQuizIds.size,
        certificatesEarned: certificates.length,
        recentActivity,
        courses: coursesData,
      },
    });
  } catch (error) {
    console.error("GetDashboard Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching dashboard",
    });
  }
};
