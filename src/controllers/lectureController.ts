import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Course from "../models/Course";
import Lecture from "../models/Lecture";
import Quiz from "../models/Quiz";
import Question from "../models/Question";
import Attempt from "../models/Attempt";
import { AuthRequest } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

interface CreateLectureBody {
  course?: string;
  module?: string;
  title?: string;
  content?: string;
  videoUrl?: string;
  order?: number;
  isPreview?: boolean;
  duration?: number;
}

interface UpdateLectureBody extends CreateLectureBody {}

const isValidObjectId = (id: string): boolean => mongoose.isValidObjectId(id);

const canManageLecture = async (
  user: NonNullable<AuthRequest["user"]>,
  courseId: Types.ObjectId
): Promise<boolean> => {
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  const course = await Course.findById(courseId).select("instructor").lean();

  if (!course) {
    return false;
  }

  return course.instructor.toString() === user._id.toString();
};

// ---------------------------------------------------------------------------
// GET /api/lectures
// ---------------------------------------------------------------------------
export const getLectures = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { course, module } = req.query as Record<string, string | undefined>;
    const query: Record<string, unknown> = {};

    if (course && isValidObjectId(course)) {
      query.course = course;
    }

    if (module && isValidObjectId(module)) {
      query.module = module;
    }

    const lectures = await Lecture.find(query)
      .populate("course", "title instructor")
      .populate("module", "title order")
      .sort({ order: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      count: lectures.length,
      data: lectures,
    });
  } catch (error) {
    console.error("GetLectures Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching lectures",
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/lectures/:id
// ---------------------------------------------------------------------------
export const getLectureById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid lecture ID",
      });
      return;
    }

    const lecture = await Lecture.findById(id)
      .populate("course", "title instructor")
      .populate("module", "title order");

    if (!lecture) {
      res.status(404).json({
        success: false,
        message: "Lecture not found",
      });
      return;
    }

    const quiz = await Quiz.findOne({ lecture: lecture._id }).select("_id");

    res.status(200).json({
      success: true,
      data: {
        lecture,
        quizId: quiz?._id ?? null,
      },
    });
  } catch (error) {
    console.error("GetLectureById Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching lecture",
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/lectures
// ---------------------------------------------------------------------------
export const createLecture = async (
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

    const { course, module, title, content, videoUrl, order, isPreview, duration } =
      req.body as CreateLectureBody;

    if (!course || !module || !title || !content || order === undefined) {
      res.status(400).json({
        success: false,
        message: "Please provide course, module, title, content, and order",
      });
      return;
    }

    if (!isValidObjectId(course) || !isValidObjectId(module)) {
      res.status(400).json({
        success: false,
        message: "Invalid course or module ID",
      });
      return;
    }

    const canManage = await canManageLecture(user, new Types.ObjectId(course));

    if (!canManage) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot create lectures for this course",
      });
      return;
    }

    const lecture = await Lecture.create({
      course,
      module,
      title,
      content,
      videoUrl,
      order,
      isPreview,
      duration,
    });

    const freshLecture = await Lecture.findById(lecture._id)
      .populate("course", "title instructor")
      .populate("module", "title order");

    res.status(201).json({
      success: true,
      message: "Lecture created successfully",
      data: freshLecture,
    });
  } catch (error) {
    console.error("CreateLecture Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating lecture",
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/lectures/:id
// ---------------------------------------------------------------------------
export const updateLecture = async (
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

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid lecture ID",
      });
      return;
    }

    const lecture = await Lecture.findById(id);

    if (!lecture) {
      res.status(404).json({
        success: false,
        message: "Lecture not found",
      });
      return;
    }

    const canManage = await canManageLecture(
      user,
      lecture.course as Types.ObjectId
    );

    if (!canManage) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot update this lecture",
      });
      return;
    }

    const { course, module, title, content, videoUrl, order, isPreview, duration } =
      req.body as UpdateLectureBody;

    if (course !== undefined) {
      if (!isValidObjectId(course)) {
        res.status(400).json({
          success: false,
          message: "Invalid course ID",
        });
        return;
      }
      lecture.course = new Types.ObjectId(course);
    }

    if (module !== undefined) {
      if (!isValidObjectId(module)) {
        res.status(400).json({
          success: false,
          message: "Invalid module ID",
        });
        return;
      }
      lecture.module = new Types.ObjectId(module);
    }

    if (title !== undefined) {
      lecture.title = title;
    }

    if (content !== undefined) {
      lecture.content = content;
    }

    if (videoUrl !== undefined) {
      lecture.videoUrl = videoUrl;
    }

    if (order !== undefined) {
      lecture.order = order;
    }

    if (isPreview !== undefined) {
      lecture.isPreview = isPreview;
    }

    if (duration !== undefined) {
      lecture.duration = duration;
    }

    await lecture.save();

    const updatedLecture = await Lecture.findById(lecture._id)
      .populate("course", "title instructor")
      .populate("module", "title order");

    res.status(200).json({
      success: true,
      message: "Lecture updated successfully",
      data: updatedLecture,
    });
  } catch (error) {
    console.error("UpdateLecture Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating lecture",
    });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/lectures/:id
// ---------------------------------------------------------------------------
export const deleteLecture = async (
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

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid lecture ID",
      });
      return;
    }

    const lecture = await Lecture.findById(id);

    if (!lecture) {
      res.status(404).json({
        success: false,
        message: "Lecture not found",
      });
      return;
    }

    const canManage = await canManageLecture(
      user,
      lecture.course as Types.ObjectId
    );

    if (!canManage) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot delete this lecture",
      });
      return;
    }

    const quiz = await Quiz.findOne({ lecture: lecture._id }).select("_id").lean();

    if (quiz) {
      await Promise.all([
        Question.deleteMany({ quiz: quiz._id }),
        Attempt.deleteMany({ quiz: quiz._id }),
        Quiz.deleteOne({ _id: quiz._id }),
      ]);
    }

    await Lecture.deleteOne({ _id: lecture._id });

    res.status(200).json({
      success: true,
      message: "Lecture deleted successfully",
    });
  } catch (error) {
    console.error("DeleteLecture Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting lecture",
    });
  }
};
