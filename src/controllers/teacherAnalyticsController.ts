import { Response } from "express";
import { Types } from "mongoose";
import Course from "../models/Course";
import StudentProfile from "../models/StudentProfile";
import StudentCourseStats from "../models/StudentCourseStats";
import User from "../models/User";
import Certificate from "../models/Certificate";
import { AuthRequest } from "../middleware/authMiddleware";

// ---------------------------------------------------------------------------
// GET /api/courses/teacher/my-students — All students across teacher's courses
// ---------------------------------------------------------------------------
export const getTeacherStudents = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const teacherId = String(req.user._id);

    // Get all courses by this teacher
    const courses = await Course.find({ instructor: new Types.ObjectId(teacherId) })
      .select("title category difficulty totalEnrolments")
      .lean();

    if (courses.length === 0) {
      res.status(200).json({
        success: true,
        data: {
          courses: [],
          students: [],
          summary: {
            totalStudents: 0,
            totalCourses: 0,
            avgCompletionRate: 0,
            avgQuizScore: 0,
            certificatesIssued: 0,
          },
        },
      });
      return;
    }

    const courseIds = courses.map((c) => c._id as Types.ObjectId);

    // Find all students enrolled in any of these courses
    const profiles = await StudentProfile.find({
      enrolledCourses: { $in: courseIds },
    })
      .populate("userId", "name email avatar createdAt")
      .lean();

    // Get pre-computed stats for all these students across teacher's courses
    const studentIds = profiles
      .map((p: any) => p.userId?._id)
      .filter(Boolean);

    const [allStats, certificates] = await Promise.all([
      StudentCourseStats.find({
        student: { $in: studentIds },
        course: { $in: courseIds },
      }).lean(),
      Certificate.find({
        student: { $in: studentIds },
        course: { $in: courseIds },
      }).lean(),
    ]);

    // Build per-student aggregated data
    const studentMap = new Map<
      string,
      {
        _id: string;
        name: string;
        email: string;
        avatar?: string;
        joinedAt: Date;
        coursesEnrolled: number;
        courseDetails: Array<{
          courseId: string;
          courseTitle: string;
          lecturesCompleted: number;
          totalLectures: number;
          progressPercent: number;
          quizzesPassed: number;
          totalQuizzes: number;
          avgScore: number;
          bestScore: number;
          lastActivityAt: Date | null;
        }>;
        overallProgress: number;
        avgScore: number;
        totalQuizzesPassed: number;
        certificatesEarned: number;
        lastActivity: Date | null;
      }
    >();

    for (const profile of profiles) {
      const user = (profile as any).userId;
      if (!user?._id) continue;
      const uid = String(user._id);

      if (!studentMap.has(uid)) {
        const enrolledInTeacherCourses = ((profile as any).enrolledCourses || [])
          .map((id: any) => String(id))
          .filter((id: string) =>
            courseIds.some((cid) => String(cid) === id)
          );

        studentMap.set(uid, {
          _id: uid,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          joinedAt: user.createdAt,
          coursesEnrolled: enrolledInTeacherCourses.length,
          courseDetails: [],
          overallProgress: 0,
          avgScore: 0,
          totalQuizzesPassed: 0,
          certificatesEarned: 0,
          lastActivity: null,
        });
      }
    }

    // Attach per-course stats
    for (const stat of allStats) {
      const uid = String(stat.student);
      const cid = String(stat.course);
      const student = studentMap.get(uid);
      if (!student) continue;

      const course = courses.find((c) => String(c._id) === cid);
      if (!course) continue;

      const progressPercent =
        stat.totalLectures > 0
          ? Math.round((stat.lecturesCompleted / stat.totalLectures) * 100)
          : 0;

      student.courseDetails.push({
        courseId: cid,
        courseTitle: course.title,
        lecturesCompleted: stat.lecturesCompleted,
        totalLectures: stat.totalLectures,
        progressPercent,
        quizzesPassed: stat.quizzesPassed,
        totalQuizzes: stat.totalQuizzes,
        avgScore: stat.averageScore,
        bestScore: stat.bestScore,
        lastActivityAt: stat.lastActivityAt,
      });

      student.totalQuizzesPassed += stat.quizzesPassed;
      if (
        stat.lastActivityAt &&
        (!student.lastActivity || stat.lastActivityAt > student.lastActivity)
      ) {
        student.lastActivity = stat.lastActivityAt;
      }
    }

    // Compute aggregated stats per student
    for (const student of studentMap.values()) {
      const details = student.courseDetails;
      if (details.length > 0) {
        student.overallProgress = Math.round(
          details.reduce((sum, d) => sum + d.progressPercent, 0) /
            details.length
        );
        const scoresWithAttempts = details.filter((d) => d.avgScore > 0);
        student.avgScore =
          scoresWithAttempts.length > 0
            ? Math.round(
                scoresWithAttempts.reduce((sum, d) => sum + d.avgScore, 0) /
                  scoresWithAttempts.length
              )
            : 0;
      }
      student.certificatesEarned = certificates.filter(
        (c) => String(c.student) === student._id
      ).length;
    }

    const studentsArray = Array.from(studentMap.values()).sort(
      (a, b) => b.overallProgress - a.overallProgress
    );

    // Summary stats
    const totalStudents = studentsArray.length;
    const avgCompletionRate =
      totalStudents > 0
        ? Math.round(
            studentsArray.reduce((s, st) => s + st.overallProgress, 0) /
              totalStudents
          )
        : 0;
    const studentsWithScores = studentsArray.filter((s) => s.avgScore > 0);
    const avgQuizScore =
      studentsWithScores.length > 0
        ? Math.round(
            studentsWithScores.reduce((s, st) => s + st.avgScore, 0) /
              studentsWithScores.length
          )
        : 0;

    // Students per course for chart
    const studentsPerCourse = courses.map((c) => ({
      courseTitle: c.title,
      students: c.totalEnrolments || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        courses: studentsPerCourse,
        students: studentsArray,
        summary: {
          totalStudents,
          totalCourses: courses.length,
          avgCompletionRate,
          avgQuizScore,
          certificatesIssued: certificates.length,
        },
      },
    });
  } catch (error) {
    console.error("GetTeacherStudents Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
