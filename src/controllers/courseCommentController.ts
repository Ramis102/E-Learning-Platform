import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import CourseComment from "../models/CourseComment";
import StudentProfile from "../models/StudentProfile";
import { AuthRequest } from "../middleware/authMiddleware";

const isValidObjectId = (id: string): boolean => mongoose.isValidObjectId(id);

// ---------------------------------------------------------------------------
// GET /api/courses/:id/comments — List comments for a course
// ---------------------------------------------------------------------------

export const getCourseComments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const courseId = req.params.id as string;

    if (!isValidObjectId(courseId)) {
      res.status(400).json({ success: false, message: "Invalid course ID" });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [comments, total] = await Promise.all([
      CourseComment.find({ course: new Types.ObjectId(courseId) })
        .populate("student", "name avatar")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CourseComment.countDocuments({ course: new Types.ObjectId(courseId) }),
    ]);

    // Compute average rating
    const ratingAgg = await CourseComment.aggregate([
      { $match: { course: new Types.ObjectId(courseId) } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    const avgRating = ratingAgg[0]?.avgRating
      ? Math.round(ratingAgg[0].avgRating * 10) / 10
      : 0;
    const reviewCount = ratingAgg[0]?.count || 0;

    res.status(200).json({
      success: true,
      data: {
        comments,
        avgRating,
        reviewCount,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("GetCourseComments Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/courses/:id/comments — Add a comment + rating
// ---------------------------------------------------------------------------

export const addCourseComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const courseId = req.params.id as string;
    if (!isValidObjectId(courseId)) {
      res.status(400).json({ success: false, message: "Invalid course ID" });
      return;
    }

    const { content, rating } = req.body;

    if (!content || !rating) {
      res.status(400).json({
        success: false,
        message: "Content and rating are required",
      });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
      return;
    }

    // Check enrollment
    const profile = await StudentProfile.findOne({ userId: user._id });
    if (!profile) {
      res
        .status(403)
        .json({ success: false, message: "Student profile not found" });
      return;
    }

    const isEnrolled = profile.enrolledCourses.some(
      (id: any) => id.toString() === courseId
    );
    if (!isEnrolled) {
      res.status(403).json({
        success: false,
        message: "You must be enrolled to leave a review",
      });
      return;
    }

    const comment = await CourseComment.create({
      student: user._id,
      course: new Types.ObjectId(courseId),
      content,
      rating,
    });

    const populated = await CourseComment.findById(comment._id)
      .populate("student", "name avatar")
      .lean();

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: populated,
    });
  } catch (error) {
    console.error("AddCourseComment Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/courses/:id/comments/:commentId — Delete own comment
// ---------------------------------------------------------------------------

export const deleteCourseComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const commentId = Array.isArray(req.params.commentId) ? req.params.commentId[0] : req.params.commentId;

    if (!commentId || !isValidObjectId(commentId)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid comment ID" });
      return;
    }

    const comment = await CourseComment.findById(commentId);
    if (!comment) {
      res
        .status(404)
        .json({ success: false, message: "Comment not found" });
      return;
    }

    if (comment.student.toString() !== user._id.toString()) {
      res.status(403).json({
        success: false,
        message: "You can only delete your own comments",
      });
      return;
    }

    await CourseComment.deleteOne({ _id: commentId });

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("DeleteCourseComment Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
