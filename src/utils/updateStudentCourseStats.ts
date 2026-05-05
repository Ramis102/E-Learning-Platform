import { Types } from "mongoose";
import Attempt from "../models/Attempt";
import Lecture from "../models/Lecture";
import LectureProgress from "../models/LectureProgress";
import Quiz from "../models/Quiz";
import StudentCourseStats from "../models/StudentCourseStats";

const toObjectId = (id: string | Types.ObjectId): Types.ObjectId => {
  return typeof id === "string" ? new Types.ObjectId(id) : id;
};

export const updateStudentCourseStats = async (
  studentId: string | Types.ObjectId,
  courseId: string | Types.ObjectId
): Promise<void> => {
  const studentOid = toObjectId(studentId);
  const courseOid = toObjectId(courseId);

  const [
    totalLectures,
    completedLectures,
    totalQuizzes,
    latestProgress,
    attempts,
  ] = await Promise.all([
    Lecture.countDocuments({ course: courseOid }),
    LectureProgress.countDocuments({ student: studentOid, course: courseOid }),
    Quiz.countDocuments({ course: courseOid, isActive: true }),
    LectureProgress.findOne({ student: studentOid, course: courseOid })
      .sort({ completedAt: -1 })
      .select("completedAt")
      .lean(),
    Attempt.find({ student: studentOid, course: courseOid })
      .select("score passed quiz completedAt")
      .lean(),
  ]);

  const totalAttempts = attempts.length;
  const uniqueAttemptedQuizzes = new Set(attempts.map((a) => String(a.quiz)));
  const uniquePassedQuizzes = new Set(
    attempts.filter((a) => a.passed).map((a) => String(a.quiz))
  );
  const scores = attempts.map((a) => a.score);

  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : 0;

  const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

  const latestAttemptAt = attempts.reduce<Date | null>((latest, attempt) => {
    if (!attempt.completedAt) {
      return latest;
    }
    if (!latest || attempt.completedAt > latest) {
      return attempt.completedAt;
    }
    return latest;
  }, null);

  let lastActivityAt = latestProgress?.completedAt || null;
  if (latestAttemptAt && (!lastActivityAt || latestAttemptAt > lastActivityAt)) {
    lastActivityAt = latestAttemptAt;
  }

  await StudentCourseStats.updateOne(
    { student: studentOid, course: courseOid },
    {
      $set: {
        lecturesCompleted: completedLectures,
        totalLectures,
        quizzesAttempted: uniqueAttemptedQuizzes.size,
        quizzesPassed: uniquePassedQuizzes.size,
        totalQuizzes,
        bestScore,
        averageScore,
        totalAttempts,
        lastActivityAt: lastActivityAt || new Date(),
      },
    },
    { upsert: true }
  );
};
