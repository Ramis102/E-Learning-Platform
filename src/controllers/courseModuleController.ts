import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Course from "../models/Course";
import Module from "../models/Module";
import Lecture from "../models/Lecture";
import Quiz from "../models/Quiz";
import Question from "../models/Question";
import Attempt from "../models/Attempt";
import { AuthRequest } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

interface CreateLectureModuleBody {
  title?: string;
  order?: number;
  lecture?: {
    title?: string;
    content?: string;
    order?: number;
    videoUrl?: string;
    isPreview?: boolean;
    duration?: number;
  };
}

interface UpdateModuleBody {
  title?: string;
  order?: number;
  lecture?: {
    title?: string;
    content?: string;
    order?: number;
    videoUrl?: string;
    isPreview?: boolean;
    duration?: number;
  };
  quiz?: {
    passMark?: number;
    timeLimit?: number;
    isActive?: boolean;
  };
}

interface CreateOrUpdateQuizBody {
  passMark?: number;
  timeLimit?: number;
  isActive?: boolean;
}

const isValidObjectId = (id: string): boolean => mongoose.isValidObjectId(id);

const normalizeParamId = (id: string | string[] | undefined): string | undefined => {
  return Array.isArray(id) ? id[0] : id;
};

const canManageCourse = async (
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

const getModuleGraph = async (courseId: Types.ObjectId, moduleId: Types.ObjectId) => {
  const moduleDoc = await Module.findOne({ _id: moduleId, course: courseId });

  if (!moduleDoc) {
    return null;
  }

  const lecture = await Lecture.findOne({ course: courseId, module: moduleId }).lean();
  const quiz = await Quiz.findOne({ module: moduleId, course: courseId }).populate({
    path: "questions",
    options: { sort: { order: 1 } },
  });

  return {
    module: moduleDoc,
    lecture,
    quiz,
  };
};

// ---------------------------------------------------------------------------
// GET /api/courses/:courseId/modules
// ---------------------------------------------------------------------------
export const listCourseModules = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const courseId = normalizeParamId(req.params.courseId);

    if (!courseId || !isValidObjectId(courseId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const courseObjectId = new Types.ObjectId(courseId);
    const courseExists = await Course.exists({ _id: courseObjectId });

    if (!courseExists) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    const modules = await Module.find({ course: courseObjectId })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    const moduleIds = modules.map((moduleDoc) => moduleDoc._id);

    const lectures = await Lecture.find({
      course: courseObjectId,
      module: { $in: moduleIds },
    })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    const lectureMap = new Map(lectures.map((lecture) => [lecture.module.toString(), lecture]));

    // Find quizzes by module IDs (not lecture IDs)
    const quizzes = await Quiz.find({ module: { $in: moduleIds } })
      .populate({ path: "questions", options: { sort: { order: 1 } } })
      .lean();

    const quizMap = new Map(quizzes.map((quiz) => [quiz.module.toString(), quiz]));

    const data = modules.map((moduleDoc) => {
      const lecture = lectureMap.get(moduleDoc._id.toString()) ?? null;
      const quiz = quizMap.get(moduleDoc._id.toString()) ?? null;

      return {
        module: moduleDoc,
        lecture,
        quiz,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("ListCourseModules Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching course modules",
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/courses/:courseId/modules/:moduleId
// ---------------------------------------------------------------------------
export const getCourseModuleById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const courseId = normalizeParamId(req.params.courseId);
    const moduleId = normalizeParamId(req.params.moduleId);

    if (!courseId || !moduleId || !isValidObjectId(courseId) || !isValidObjectId(moduleId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course or module ID",
      });
      return;
    }

    const graph = await getModuleGraph(
      new Types.ObjectId(courseId),
      new Types.ObjectId(moduleId)
    );

    if (!graph) {
      res.status(404).json({
        success: false,
        message: "Module not found for this course",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: graph,
    });
  } catch (error) {
    console.error("GetCourseModuleById Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching course module",
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/courses/:courseId/modules/lectures
// ---------------------------------------------------------------------------
export const createLectureModule = async (
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

    const courseId = normalizeParamId(req.params.courseId);

    if (!courseId || !isValidObjectId(courseId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const courseObjectId = new Types.ObjectId(courseId);
    const hasPermission = await canManageCourse(user, courseObjectId);

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot add modules to this course",
      });
      return;
    }

    const { title, order, lecture } = req.body as CreateLectureModuleBody;

    if (!title || order === undefined || !lecture?.title || !lecture.content || lecture.order === undefined) {
      res.status(400).json({
        success: false,
        message:
          "Please provide module title/order and lecture title/content/order",
      });
      return;
    }

    const moduleDoc = await Module.create({
      course: courseObjectId,
      title,
      order,
    });

    const lectureDoc = await Lecture.create({
      course: courseObjectId,
      module: moduleDoc._id,
      title: lecture.title,
      content: lecture.content,
      order: lecture.order,
      videoUrl: lecture.videoUrl,
      isPreview: lecture.isPreview,
      duration: lecture.duration,
    });

    res.status(201).json({
      success: true,
      message: "Lecture module created successfully",
      data: {
        module: moduleDoc,
        lecture: lectureDoc,
        quiz: null,
      },
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({
        success: false,
        message: "A module with this order already exists in the course",
      });
      return;
    }

    console.error("CreateLectureModule Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating lecture module",
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/courses/:courseId/modules/:moduleId
// ---------------------------------------------------------------------------
export const updateCourseModule = async (
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

    const courseId = normalizeParamId(req.params.courseId);
    const moduleId = normalizeParamId(req.params.moduleId);

    if (!courseId || !moduleId || !isValidObjectId(courseId) || !isValidObjectId(moduleId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course or module ID",
      });
      return;
    }

    const courseObjectId = new Types.ObjectId(courseId);
    const moduleObjectId = new Types.ObjectId(moduleId);

    const hasPermission = await canManageCourse(user, courseObjectId);

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot update modules for this course",
      });
      return;
    }

    const graph = await getModuleGraph(courseObjectId, moduleObjectId);

    if (!graph) {
      res.status(404).json({
        success: false,
        message: "Module not found for this course",
      });
      return;
    }

    const { title, order, lecture, quiz } = req.body as UpdateModuleBody;

    if (title !== undefined) {
      graph.module.title = title;
    }

    if (order !== undefined) {
      graph.module.order = order;
    }

    await graph.module.save();

    if (lecture && graph.lecture) {
      const lectureUpdate: Record<string, unknown> = {};

      if (lecture.title !== undefined) {
        lectureUpdate.title = lecture.title;
      }

      if (lecture.content !== undefined) {
        lectureUpdate.content = lecture.content;
      }

      if (lecture.order !== undefined) {
        lectureUpdate.order = lecture.order;
      }

      if (lecture.videoUrl !== undefined) {
        lectureUpdate.videoUrl = lecture.videoUrl;
      }

      if (lecture.isPreview !== undefined) {
        lectureUpdate.isPreview = lecture.isPreview;
      }

      if (lecture.duration !== undefined) {
        lectureUpdate.duration = lecture.duration;
      }

      if (Object.keys(lectureUpdate).length > 0) {
        await Lecture.updateOne({ _id: graph.lecture._id }, lectureUpdate, {
          runValidators: true,
        });
      }
    }

    if (quiz && graph.lecture) {
      if (graph.quiz) {
        const quizUpdate: Record<string, unknown> = {};

        if (quiz.passMark !== undefined) {
          quizUpdate.passMark = quiz.passMark;
        }

        if (quiz.timeLimit !== undefined) {
          quizUpdate.timeLimit = quiz.timeLimit;
        }

        if (quiz.isActive !== undefined) {
          quizUpdate.isActive = quiz.isActive;
        }

        if (Object.keys(quizUpdate).length > 0) {
          await Quiz.updateOne({ _id: graph.quiz._id }, quizUpdate, {
            runValidators: true,
          });
        }
      } else {
        await Quiz.create({
          title: "Module Quiz",
          module: moduleObjectId,
          course: courseObjectId,
          lecture: graph.lecture?._id || null,
          passMark: quiz.passMark,
          timeLimit: quiz.timeLimit,
          isActive: quiz.isActive,
          questions: [],
        });
      }
    }

    const updatedGraph = await getModuleGraph(courseObjectId, moduleObjectId);

    res.status(200).json({
      success: true,
      message: "Course module updated successfully",
      data: updatedGraph,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({
        success: false,
        message: "A module with this order already exists in the course",
      });
      return;
    }

    console.error("UpdateCourseModule Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating course module",
    });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/courses/:courseId/modules/:moduleId
// ---------------------------------------------------------------------------
export const deleteCourseModule = async (
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

    const courseId = normalizeParamId(req.params.courseId);
    const moduleId = normalizeParamId(req.params.moduleId);

    if (!courseId || !moduleId || !isValidObjectId(courseId) || !isValidObjectId(moduleId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course or module ID",
      });
      return;
    }

    const courseObjectId = new Types.ObjectId(courseId);
    const moduleObjectId = new Types.ObjectId(moduleId);

    const hasPermission = await canManageCourse(user, courseObjectId);

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot delete modules from this course",
      });
      return;
    }

    const graph = await getModuleGraph(courseObjectId, moduleObjectId);

    if (!graph) {
      res.status(404).json({
        success: false,
        message: "Module not found for this course",
      });
      return;
    }

    if (graph.quiz) {
      await Promise.all([
        Question.deleteMany({ quiz: graph.quiz._id }),
        Attempt.deleteMany({ quiz: graph.quiz._id }),
        Quiz.deleteOne({ _id: graph.quiz._id }),
      ]);
    }

    if (graph.lecture) {
      await Lecture.deleteOne({ _id: graph.lecture._id });
    }

    await Module.deleteOne({ _id: moduleObjectId, course: courseObjectId });

    res.status(200).json({
      success: true,
      message: "Course module deleted successfully",
    });
  } catch (error) {
    console.error("DeleteCourseModule Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting course module",
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/courses/:courseId/modules/:moduleId/quiz
// ---------------------------------------------------------------------------
export const createModuleQuiz = async (
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

    const courseId = normalizeParamId(req.params.courseId);
    const moduleId = normalizeParamId(req.params.moduleId);

    if (!courseId || !moduleId || !isValidObjectId(courseId) || !isValidObjectId(moduleId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course or module ID",
      });
      return;
    }

    const courseObjectId = new Types.ObjectId(courseId);
    const moduleObjectId = new Types.ObjectId(moduleId);

    const hasPermission = await canManageCourse(user, courseObjectId);

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot add quizzes to this course",
      });
      return;
    }

    const graph = await getModuleGraph(courseObjectId, moduleObjectId);

    if (!graph) {
      res.status(404).json({
        success: false,
        message: "Module not found for this course",
      });
      return;
    }

    // Lecture is optional — quiz can exist without one

    if (graph.quiz) {
      res.status(409).json({
        success: false,
        message: "Quiz already exists for this module",
      });
      return;
    }

    const { passMark, timeLimit, isActive } = req.body as CreateOrUpdateQuizBody;
    const title = (req.body as any).title || "Module Quiz";

    const quiz = await Quiz.create({
      title,
      module: moduleObjectId,
      course: courseObjectId,
      lecture: graph.lecture?._id || null,
      passMark,
      timeLimit,
      isActive,
      questions: [],
    });

    res.status(201).json({
      success: true,
      message: "Quiz created for module successfully",
      data: quiz,
    });
  } catch (error) {
    console.error("CreateModuleQuiz Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating module quiz",
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/courses/:courseId/modules/:moduleId/quiz
// ---------------------------------------------------------------------------
export const getModuleQuiz = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const courseId = normalizeParamId(req.params.courseId);
    const moduleId = normalizeParamId(req.params.moduleId);

    if (!courseId || !moduleId || !isValidObjectId(courseId) || !isValidObjectId(moduleId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course or module ID",
      });
      return;
    }

    const graph = await getModuleGraph(
      new Types.ObjectId(courseId),
      new Types.ObjectId(moduleId)
    );

    if (!graph) {
      res.status(404).json({
        success: false,
        message: "Module not found for this course",
      });
      return;
    }

    if (!graph.quiz) {
      res.status(404).json({
        success: false,
        message: "Quiz not found for this module",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: graph.quiz,
    });
  } catch (error) {
    console.error("GetModuleQuiz Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching module quiz",
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/courses/:courseId/modules/:moduleId/quiz
// ---------------------------------------------------------------------------
export const updateModuleQuiz = async (
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

    const courseId = normalizeParamId(req.params.courseId);
    const moduleId = normalizeParamId(req.params.moduleId);

    if (!courseId || !moduleId || !isValidObjectId(courseId) || !isValidObjectId(moduleId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course or module ID",
      });
      return;
    }

    const courseObjectId = new Types.ObjectId(courseId);
    const moduleObjectId = new Types.ObjectId(moduleId);

    const hasPermission = await canManageCourse(user, courseObjectId);

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot update quizzes in this course",
      });
      return;
    }

    const graph = await getModuleGraph(courseObjectId, moduleObjectId);

    if (!graph) {
      res.status(404).json({
        success: false,
        message: "Module not found for this course",
      });
      return;
    }

    if (!graph.quiz) {
      res.status(404).json({
        success: false,
        message: "Quiz not found for this module",
      });
      return;
    }

    const { passMark, timeLimit, isActive } = req.body as CreateOrUpdateQuizBody;

    if (passMark !== undefined) {
      graph.quiz.passMark = passMark;
    }

    if (timeLimit !== undefined) {
      graph.quiz.timeLimit = timeLimit;
    }

    if (isActive !== undefined) {
      graph.quiz.isActive = isActive;
    }

    await graph.quiz.save();

    res.status(200).json({
      success: true,
      message: "Module quiz updated successfully",
      data: graph.quiz,
    });
  } catch (error) {
    console.error("UpdateModuleQuiz Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating module quiz",
    });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/courses/:courseId/modules/:moduleId/quiz
// ---------------------------------------------------------------------------
export const deleteModuleQuiz = async (
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

    const courseId = normalizeParamId(req.params.courseId);
    const moduleId = normalizeParamId(req.params.moduleId);

    if (!courseId || !moduleId || !isValidObjectId(courseId) || !isValidObjectId(moduleId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course or module ID",
      });
      return;
    }

    const courseObjectId = new Types.ObjectId(courseId);
    const moduleObjectId = new Types.ObjectId(moduleId);

    const hasPermission = await canManageCourse(user, courseObjectId);

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot delete quizzes in this course",
      });
      return;
    }

    const graph = await getModuleGraph(courseObjectId, moduleObjectId);

    if (!graph) {
      res.status(404).json({
        success: false,
        message: "Module not found for this course",
      });
      return;
    }

    if (!graph.quiz) {
      res.status(404).json({
        success: false,
        message: "Quiz not found for this module",
      });
      return;
    }

    await Promise.all([
      Question.deleteMany({ quiz: graph.quiz._id }),
      Attempt.deleteMany({ quiz: graph.quiz._id }),
      Quiz.deleteOne({ _id: graph.quiz._id }),
    ]);

    res.status(200).json({
      success: true,
      message: "Module quiz deleted successfully",
    });
  } catch (error) {
    console.error("DeleteModuleQuiz Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting module quiz",
    });
  }
};
