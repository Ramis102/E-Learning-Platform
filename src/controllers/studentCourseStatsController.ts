import { Response } from "express";
import { Types } from "mongoose";
import Course from "../models/Course";
import Module from "../models/Module";
import Lecture from "../models/Lecture";
import LectureProgress from "../models/LectureProgress";
import Quiz from "../models/Quiz";
import Attempt from "../models/Attempt";
import StudentCourseStats from "../models/StudentCourseStats";
import { AuthRequest } from "../middleware/authMiddleware";

// ---------------------------------------------------------------------------
// GET /api/progress/:courseId/stats — Detailed per-course stats for a student
// ---------------------------------------------------------------------------
export const getCourseStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const userId = String(req.user._id);
    const rawCourseId = req.params.courseId;
    const courseId = Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId;

    if (!courseId || !Types.ObjectId.isValid(courseId)) {
      res.status(400).json({ success: false, message: "Invalid course ID" });
      return;
    }

    const courseOid = new Types.ObjectId(courseId);
    const studentOid = new Types.ObjectId(userId);

    // Fetch all data in parallel
    const [course, modules, allLectures, progress, quizzes, attempts] =
      await Promise.all([
        Course.findById(courseOid)
          .select("title category difficulty instructor")
          .populate("instructor", "name")
          .lean(),
        Module.find({ course: courseOid }).sort({ order: 1 }).lean(),
        Lecture.find({ course: courseOid }).select("_id module title order").lean(),
        LectureProgress.find({ student: studentOid, course: courseOid }).lean(),
        Quiz.find({ course: courseOid, isActive: true }).lean(),
        Attempt.find({ student: studentOid, course: courseOid })
          .sort({ completedAt: 1 })
          .lean(),
      ]);

    if (!course) {
      res.status(404).json({ success: false, message: "Course not found" });
      return;
    }

    const completedLectureIds = new Set(
      progress.map((p) => String(p.lecture))
    );

    // Module-by-module breakdown
    const moduleBreakdown = modules.map((mod) => {
      const modId = String(mod._id);
      const moduleLectures = allLectures.filter(
        (l) => String(l.module) === modId
      );
      const completedCount = moduleLectures.filter((l) =>
        completedLectureIds.has(String(l._id))
      ).length;

      const moduleQuizzes = quizzes.filter(
        (q) => String((q as any).module) === modId
      );
      const moduleAttempts = attempts.filter((a) =>
        moduleQuizzes.some((q) => String(q._id) === String(a.quiz))
      );
      const bestAttempt = moduleAttempts.length
        ? Math.max(...moduleAttempts.map((a) => a.score))
        : null;
      const passed = moduleAttempts.some((a) => a.passed);

      return {
        moduleId: modId,
        title: mod.title,
        order: mod.order,
        totalLectures: moduleLectures.length,
        completedLectures: completedCount,
        lectureProgress:
          moduleLectures.length > 0
            ? Math.round((completedCount / moduleLectures.length) * 100)
            : 0,
        hasQuiz: moduleQuizzes.length > 0,
        quizPassed: passed,
        bestScore: bestAttempt,
        attempts: moduleAttempts.length,
      };
    });

    // Quiz score history (for line chart)
    const quizHistory = attempts.map((a) => ({
      quizId: String(a.quiz),
      score: a.score,
      passed: a.passed,
      date: a.completedAt,
    }));

    // Aggregate stats
    const totalLectures = allLectures.length;
    const totalCompleted = completedLectureIds.size;
    const totalQuizzes = quizzes.length;
    const uniquePassedQuizzes = new Set(
      attempts.filter((a) => a.passed).map((a) => String(a.quiz))
    ).size;
    const scores = attempts.map((a) => a.score);
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
        : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const overallProgress =
      totalLectures > 0
        ? Math.round((totalCompleted / totalLectures) * 100)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        course: {
          _id: courseId,
          title: course.title,
          category: (course as any).category,
          difficulty: (course as any).difficulty,
          instructor: (course as any).instructor,
        },
        overallProgress,
        totalLectures,
        completedLectures: totalCompleted,
        totalQuizzes,
        quizzesPassed: uniquePassedQuizzes,
        avgScore,
        bestScore,
        totalAttempts: attempts.length,
        moduleBreakdown,
        quizHistory,
      },
    });
  } catch (error) {
    console.error("GetCourseStats Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
