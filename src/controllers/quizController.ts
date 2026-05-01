import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Course from "../models/Course";
import Lecture from "../models/Lecture";
import Quiz from "../models/Quiz";
import Question from "../models/Question";
import Attempt from "../models/Attempt";
import { AuthRequest } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

interface CreateQuizBody {
  lecture?: string;
  passMark?: number;
  timeLimit?: number;
  isActive?: boolean;
}

interface UpdateQuizBody {
  lecture?: string;
  passMark?: number;
  timeLimit?: number;
  isActive?: boolean;
}

const isValidObjectId = (id: string): boolean => mongoose.isValidObjectId(id);

const getLectureCourse = async (
  lectureId: Types.ObjectId
): Promise<Types.ObjectId | null> => {
  const lecture = await Lecture.findById(lectureId).select("course").lean();
  return lecture ? (lecture.course as Types.ObjectId) : null;
};

const canManageQuiz = async (
  user: NonNullable<AuthRequest["user"]>,
  lectureId: Types.ObjectId
): Promise<boolean> => {
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  const courseId = await getLectureCourse(lectureId);

  if (!courseId) {
    return false;
  }

  const course = await Course.findById(courseId).select("instructor").lean();

  if (!course) {
    return false;
  }

  return course.instructor.toString() === user._id.toString();
};

// ---------------------------------------------------------------------------
// GET /api/quizzes
// ---------------------------------------------------------------------------
export const getQuizzes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lecture } = req.query as Record<string, string | undefined>;
    const query: Record<string, unknown> = {};

    if (lecture && isValidObjectId(lecture)) {
      query.lecture = lecture;
    }

    const quizzes = await Quiz.find(query)
      .populate("lecture", "title course")
      .populate({ path: "questions", options: { sort: { order: 1 } } })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: quizzes.length,
      data: quizzes,
    });
  } catch (error) {
    console.error("GetQuizzes Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching quizzes",
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/quizzes/:id
// ---------------------------------------------------------------------------
export const getQuizById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid quiz ID",
      });
      return;
    }

    const quiz = await Quiz.findById(id)
      .populate("lecture", "title course")
      .populate({ path: "questions", options: { sort: { order: 1 } } });

    if (!quiz) {
      res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    console.error("GetQuizById Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching quiz",
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/quizzes
// ---------------------------------------------------------------------------
export const createQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });
      return;
    }

    const { lecture, passMark, timeLimit, isActive } = req.body as CreateQuizBody;

    if (!lecture) {
      res.status(400).json({
        success: false,
        message: "Please provide lecture ID",
      });
      return;
    }

    if (!isValidObjectId(lecture)) {
      res.status(400).json({
        success: false,
        message: "Invalid lecture ID",
      });
      return;
    }

    const lectureDoc = await Lecture.findById(lecture).select("_id").lean();

    if (!lectureDoc) {
      res.status(404).json({
        success: false,
        message: "Lecture not found",
      });
      return;
    }

    const canManage = await canManageQuiz(user, lectureDoc._id as Types.ObjectId);

    if (!canManage) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot create a quiz for this lecture",
      });
      return;
    }

    const existingQuiz = await Quiz.findOne({ lecture: lectureDoc._id }).select("_id");

    if (existingQuiz) {
      res.status(409).json({
        success: false,
        message: "A quiz already exists for this lecture",
      });
      return;
    }

    const quiz = await Quiz.create({
      lecture: lectureDoc._id,
      passMark,
      timeLimit,
      isActive,
      questions: [],
    });

    const freshQuiz = await Quiz.findById(quiz._id)
      .populate("lecture", "title course")
      .populate({ path: "questions", options: { sort: { order: 1 } } });

    res.status(201).json({
      success: true,
      message: "Quiz created successfully",
      data: freshQuiz,
    });
  } catch (error) {
    console.error("CreateQuiz Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating quiz",
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/quizzes/:id
// ---------------------------------------------------------------------------
export const updateQuiz = async (req: Request, res: Response): Promise<void> => {
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
        message: "Invalid quiz ID",
      });
      return;
    }

    const quiz = await Quiz.findById(id);

    if (!quiz) {
      res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
      return;
    }

    const canManage = await canManageQuiz(user, quiz.lecture as Types.ObjectId);

    if (!canManage) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot update this quiz",
      });
      return;
    }

    const { lecture, passMark, timeLimit, isActive } = req.body as UpdateQuizBody;

    if (lecture !== undefined) {
      if (!isValidObjectId(lecture)) {
        res.status(400).json({
          success: false,
          message: "Invalid lecture ID",
        });
        return;
      }

      const canManageNewLecture = await canManageQuiz(
        user,
        new Types.ObjectId(lecture)
      );

      if (!canManageNewLecture) {
        res.status(403).json({
          success: false,
          message: "Forbidden — you cannot move this quiz to that lecture",
        });
        return;
      }

      const existingQuiz = await Quiz.findOne({ lecture, _id: { $ne: quiz._id } })
        .select("_id")
        .lean();

      if (existingQuiz) {
        res.status(409).json({
          success: false,
          message: "Target lecture already has a quiz",
        });
        return;
      }

      quiz.lecture = new Types.ObjectId(lecture);
    }

    if (passMark !== undefined) {
      quiz.passMark = passMark;
    }

    if (timeLimit !== undefined) {
      quiz.timeLimit = timeLimit;
    }

    if (isActive !== undefined) {
      quiz.isActive = isActive;
    }

    await quiz.save();

    const updatedQuiz = await Quiz.findById(quiz._id)
      .populate("lecture", "title course")
      .populate({ path: "questions", options: { sort: { order: 1 } } });

    res.status(200).json({
      success: true,
      message: "Quiz updated successfully",
      data: updatedQuiz,
    });
  } catch (error) {
    console.error("UpdateQuiz Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating quiz",
    });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/quizzes/:id
// ---------------------------------------------------------------------------
export const deleteQuiz = async (req: Request, res: Response): Promise<void> => {
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
        message: "Invalid quiz ID",
      });
      return;
    }

    const quiz = await Quiz.findById(id);

    if (!quiz) {
      res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
      return;
    }

    const canManage = await canManageQuiz(user, quiz.lecture as Types.ObjectId);

    if (!canManage) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot delete this quiz",
      });
      return;
    }

    await Promise.all([
      Question.deleteMany({ quiz: quiz._id }),
      Attempt.deleteMany({ quiz: quiz._id }),
      Quiz.deleteOne({ _id: quiz._id }),
    ]);

    res.status(200).json({
      success: true,
      message: "Quiz deleted successfully",
    });
  } catch (error) {
    console.error("DeleteQuiz Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting quiz",
    });
  }
};
