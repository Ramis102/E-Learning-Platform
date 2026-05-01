import { Response } from "express";
import mongoose, { Types } from "mongoose";
import Quiz from "../models/Quiz";
import Question from "../models/Question";
import Attempt from "../models/Attempt";
import Lecture from "../models/Lecture";
import { AuthRequest } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

interface SubmitAttemptBody {
  quizId: string;
  answers: Array<{
    questionId: string;
    selectedIndex: number;
  }>;
}

const isValidObjectId = (id: string): boolean => mongoose.isValidObjectId(id);

export const submitAttempt = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (req.user.role !== UserRole.STUDENT) {
      res.status(403).json({
        success: false,
        message: "Only students can submit quiz attempts",
      });
      return;
    }

    const { quizId, answers } = req.body as SubmitAttemptBody;

    if (!quizId || !isValidObjectId(quizId)) {
      res.status(400).json({
        success: false,
        message: "Invalid or missing quizId",
      });
      return;
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({
        success: false,
        message: "Answers must be a non-empty array",
      });
      return;
    }

    // Validate each answer structure
    for (const answer of answers) {
      if (!isValidObjectId(answer.questionId)) {
        res.status(400).json({
          success: false,
          message: `Invalid questionId: ${answer.questionId}`,
        });
        return;
      }
      if (typeof answer.selectedIndex !== "number" || answer.selectedIndex < 0) {
        res.status(400).json({
          success: false,
          message: "Invalid selectedIndex in answers",
        });
        return;
      }
    }

    const quiz = await Quiz.findById(quizId).lean();

    if (!quiz) {
      res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
      return;
    }

    if (!quiz.isActive) {
      res.status(400).json({
        success: false,
        message: "Quiz is not active",
      });
      return;
    }

    const questions = await Question.find({ _id: { $in: quiz.questions } }).lean();
    if (!questions || questions.length === 0) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch questions for grading",
      });
      return;
    }

    const questionsMap = new Map();
    for (const q of questions) {
      questionsMap.set(q._id.toString(), {
        correctIndex: q.correctIndex,
        optionsCount: q.options.length,
      });
    }

    let correctCount = 0;
    const gradedAnswers = answers.map((answer) => {
      const qData = questionsMap.get(answer.questionId);
      if (!qData) {
        throw new Error(`Question data not found for ${answer.questionId}`);
      }

      if (answer.selectedIndex >= qData.optionsCount) {
        throw new Error(`Selected index out of range for question ${answer.questionId}`);
      }

      const isCorrect = answer.selectedIndex === qData.correctIndex;
      if (isCorrect) correctCount++;

      return {
        questionId: new Types.ObjectId(answer.questionId),
        selectedIndex: answer.selectedIndex,
        isCorrect,
      };
    });

    const score = Math.round((correctCount / answers.length) * 100);
    const passed = score >= quiz.passMark;

    // Quiz now has direct course reference
    const courseRef = quiz.course;
    if (!courseRef) {
      res.status(500).json({
        success: false,
        message: "Quiz has no course reference",
      });
      return;
    }

    const attempt = await Attempt.create({
      student: req.user._id,
      quiz: new Types.ObjectId(quizId),
      course: courseRef,
      answers: gradedAnswers,
      score,
      passed,
      completedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Attempt submitted and graded successfully",
      data: attempt,
    });
  } catch (error: any) {
    console.error("submitAttempt Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error while submitting attempt",
    });
  }
};
