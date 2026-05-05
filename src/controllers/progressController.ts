import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import LectureProgress from "../models/LectureProgress";
import StudentProfile from "../models/StudentProfile";
import { AuthRequest } from "../middleware/authMiddleware";
import { updateStudentCourseStats } from "../utils/updateStudentCourseStats";

const isValidObjectId = (id: string): boolean => mongoose.isValidObjectId(id);

// ---------------------------------------------------------------------------
// POST /api/progress/complete — Mark a lecture as completed
// ---------------------------------------------------------------------------

export const markLectureComplete = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const { lectureId, moduleId, courseId } = req.body;

    if (
      !lectureId ||
      !moduleId ||
      !courseId ||
      !isValidObjectId(lectureId) ||
      !isValidObjectId(moduleId) ||
      !isValidObjectId(courseId)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid lectureId, moduleId, and courseId are required",
      });
      return;
    }

    // Check enrollment
    const profile = await StudentProfile.findOne({ userId: user._id });
    if (!profile) {
      res
        .status(404)
        .json({ success: false, message: "Student profile not found" });
      return;
    }

    const isEnrolled = profile.enrolledCourses.some(
      (id: any) => id.toString() === courseId
    );
    if (!isEnrolled) {
      res.status(403).json({
        success: false,
        message: "You must be enrolled in this course",
      });
      return;
    }

    // Upsert — ignore duplicate
    const progress = await LectureProgress.findOneAndUpdate(
      {
        student: user._id,
        lecture: new Types.ObjectId(lectureId),
      },
      {
        student: user._id,
        lecture: new Types.ObjectId(lectureId),
        module: new Types.ObjectId(moduleId),
        course: new Types.ObjectId(courseId),
        completedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    updateStudentCourseStats(user._id, courseId).catch((statsError) => {
      console.error("UpdateStudentCourseStats Error:", statsError);
    });

    res.status(200).json({
      success: true,
      message: "Lecture marked as completed",
      data: progress,
    });
  } catch (error) {
    console.error("MarkLectureComplete Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/progress/:courseId — Get all lecture completions for a course
// ---------------------------------------------------------------------------

export const getCourseProgress = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const courseId = req.params.courseId as string;

    if (!isValidObjectId(courseId)) {
      res.status(400).json({ success: false, message: "Invalid course ID" });
      return;
    }

    const completions = await LectureProgress.find({
      student: user._id,
      course: new Types.ObjectId(courseId),
    })
      .select("lecture module completedAt")
      .lean();

    res.status(200).json({
      success: true,
      data: completions,
    });
  } catch (error) {
    console.error("GetCourseProgress Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
