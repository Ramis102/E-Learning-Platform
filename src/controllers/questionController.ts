import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Question from "../models/Question";
import { QuestionType } from "../models/Question";
import Quiz from "../models/Quiz";
import Lecture from "../models/Lecture";
import Course from "../models/Course";
import { AuthRequest } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

interface CreateQuestionBody {
  quiz?: string;
  text?: string;
  type?: QuestionType;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  order?: number;
}

interface UpdateQuestionBody extends CreateQuestionBody {}

const isValidObjectId = (id: string): boolean => mongoose.isValidObjectId(id);

const canManageQuestion = async (
  user: NonNullable<AuthRequest["user"]>,
  quizId: Types.ObjectId
): Promise<boolean> => {
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  const quiz = await Quiz.findById(quizId).select("lecture").lean();

  if (!quiz) {
    return false;
  }

  const lecture = await Lecture.findById(quiz.lecture).select("course").lean();

  if (!lecture) {
    return false;
  }

  const course = await Course.findById(lecture.course).select("instructor").lean();

  if (!course) {
    return false;
  }

  return course.instructor.toString() === user._id.toString();
};

const validateQuestionPayload = (
  options: string[],
  correctIndex: number
): string | null => {
  if (options.length < 2 || options.length > 5) {
    return "A question must have between 2 and 5 options";
  }

  if (correctIndex < 0 || correctIndex >= options.length) {
    return "Correct index must point to an existing option";
  }

  return null;
};

// ---------------------------------------------------------------------------
// GET /api/questions
// ---------------------------------------------------------------------------
export const getQuestions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { quiz } = req.query as Record<string, string | undefined>;
    const query: Record<string, unknown> = {};

    if (quiz && isValidObjectId(quiz)) {
      query.quiz = quiz;
    }

    const questions = await Question.find(query)
      .populate("quiz", "lecture")
      .sort({ order: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (error) {
    console.error("GetQuestions Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching questions",
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/questions/:id
// ---------------------------------------------------------------------------
export const getQuestionById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid question ID",
      });
      return;
    }

    const question = await Question.findById(id).populate("quiz", "lecture");

    if (!question) {
      res.status(404).json({
        success: false,
        message: "Question not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error("GetQuestionById Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching question",
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/questions
// ---------------------------------------------------------------------------
export const createQuestion = async (
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

    const { quiz, text, type, options, correctIndex, explanation, order } =
      req.body as CreateQuestionBody;

    if (
      !quiz ||
      !text ||
      !Array.isArray(options) ||
      correctIndex === undefined ||
      order === undefined
    ) {
      res.status(400).json({
        success: false,
        message:
          "Please provide quiz, text, options, correctIndex, and order",
      });
      return;
    }

    if (!isValidObjectId(quiz)) {
      res.status(400).json({
        success: false,
        message: "Invalid quiz ID",
      });
      return;
    }

    const validationError = validateQuestionPayload(options, correctIndex);

    if (validationError) {
      res.status(400).json({
        success: false,
        message: validationError,
      });
      return;
    }

    const quizDoc = await Quiz.findById(quiz).select("_id");

    if (!quizDoc) {
      res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
      return;
    }

    const canManage = await canManageQuestion(user, quizDoc._id as Types.ObjectId);

    if (!canManage) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot create questions for this quiz",
      });
      return;
    }

    const question = await Question.create({
      quiz,
      text,
      type,
      options,
      correctIndex,
      explanation,
      order,
    });

    await Quiz.updateOne(
      { _id: quizDoc._id },
      { $addToSet: { questions: question._id } }
    );

    const freshQuestion = await Question.findById(question._id).populate(
      "quiz",
      "lecture"
    );

    res.status(201).json({
      success: true,
      message: "Question created successfully",
      data: freshQuestion,
    });
  } catch (error) {
    console.error("CreateQuestion Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating question",
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/questions/:id
// ---------------------------------------------------------------------------
export const updateQuestion = async (
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
        message: "Invalid question ID",
      });
      return;
    }

    const question = await Question.findById(id);

    if (!question) {
      res.status(404).json({
        success: false,
        message: "Question not found",
      });
      return;
    }

    const canManage = await canManageQuestion(user, question.quiz as Types.ObjectId);

    if (!canManage) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot update this question",
      });
      return;
    }

    const { quiz, text, type, options, correctIndex, explanation, order } =
      req.body as UpdateQuestionBody;

    if (quiz !== undefined && quiz !== question.quiz.toString()) {
      res.status(400).json({
        success: false,
        message: "Moving a question to a different quiz is not supported",
      });
      return;
    }

    const nextOptions = options ?? question.options;
    const nextCorrectIndex =
      correctIndex !== undefined ? correctIndex : question.correctIndex;

    const validationError = validateQuestionPayload(nextOptions, nextCorrectIndex);

    if (validationError) {
      res.status(400).json({
        success: false,
        message: validationError,
      });
      return;
    }

    if (text !== undefined) {
      question.text = text;
    }

    if (type !== undefined) {
      question.type = type;
    }

    if (options !== undefined) {
      question.options = options;
    }

    if (correctIndex !== undefined) {
      question.correctIndex = correctIndex;
    }

    if (explanation !== undefined) {
      question.explanation = explanation;
    }

    if (order !== undefined) {
      question.order = order;
    }

    await question.save();

    const updatedQuestion = await Question.findById(question._id).populate(
      "quiz",
      "lecture"
    );

    res.status(200).json({
      success: true,
      message: "Question updated successfully",
      data: updatedQuestion,
    });
  } catch (error) {
    console.error("UpdateQuestion Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating question",
    });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/questions/:id
// ---------------------------------------------------------------------------
export const deleteQuestion = async (
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
        message: "Invalid question ID",
      });
      return;
    }

    const question = await Question.findById(id);

    if (!question) {
      res.status(404).json({
        success: false,
        message: "Question not found",
      });
      return;
    }

    const canManage = await canManageQuestion(user, question.quiz as Types.ObjectId);

    if (!canManage) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot delete this question",
      });
      return;
    }

    await Promise.all([
      Question.deleteOne({ _id: question._id }),
      Quiz.updateOne(
        { _id: question.quiz },
        { $pull: { questions: question._id } }
      ),
    ]);

    res.status(200).json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    console.error("DeleteQuestion Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting question",
    });
  }
};
