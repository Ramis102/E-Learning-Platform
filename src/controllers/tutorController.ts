import { Request, Response } from "express";
import mongoose from "mongoose";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AuthRequest } from "../middleware/authMiddleware";
import StudentProfile from "../models/StudentProfile";
import Lecture from "../models/Lecture";
import Course from "../models/Course";

const isValidObjectId = (id: string): boolean => mongoose.isValidObjectId(id);

const normalizeParamId = (id: string | string[] | undefined): string | undefined => {
  return Array.isArray(id) ? id[0] : id;
};

const stripHtml = (html: string): string => {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const clampText = (text: string, maxChars: number): string => {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}...`;
};

export const chatWithTutor = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;

    if (!user) {
      res.status(401).json({ success: false, message: "Not authorized" });
      return;
    }

    const courseId = normalizeParamId(req.params.courseId);
    const { lectureId, message } = req.body as { lectureId?: string; message?: string };

    if (!courseId || !isValidObjectId(courseId)) {
      res.status(400).json({ success: false, message: "Invalid course ID" });
      return;
    }

    if (!lectureId || !isValidObjectId(lectureId)) {
      res.status(400).json({ success: false, message: "Valid lectureId is required" });
      return;
    }

    if (!message || !message.trim()) {
      res.status(400).json({ success: false, message: "Message is required" });
      return;
    }

    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      res.status(500).json({ success: false, message: "GROQ_API_KEY is not configured" });
      return;
    }

    const profile = await StudentProfile.findOne({ userId: user._id })
      .select("enrolledCourses")
      .lean();

    if (!profile) {
      res.status(404).json({ success: false, message: "Student profile not found" });
      return;
    }

    const isEnrolled = profile.enrolledCourses.some((id) => id.toString() === courseId);

    if (!isEnrolled) {
      res.status(403).json({ success: false, message: "You must be enrolled in this course" });
      return;
    }

    const lecture = await Lecture.findOne({ _id: lectureId, course: courseId })
      .select("title content")
      .lean();

    if (!lecture) {
      res.status(404).json({ success: false, message: "Lecture not found for this course" });
      return;
    }

    const course = await Course.findById(courseId).select("title").lean();
    const lectureText = clampText(stripHtml(lecture.content || ""), 6000);

    const systemPrompt = [
      `You are a personal tutor for the course: ${course?.title || "this course"}.`,
      "You only answer using the lecture context provided below.",
      "If the question is not covered, say you can only answer based on this lecture and suggest reviewing it.",
      "Be concise, structured, and student-friendly.",
      "",
      `Lecture title: ${lecture.title}`,
      "Lecture context:",
      '"""',
      lectureText || "No lecture content was provided.",
      '"""',
    ].join("\n");

    const model = new ChatGroq({
      apiKey: groqApiKey,
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      maxTokens: 700,
    });

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(message.trim()),
    ]);

    const reply =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content.map((part) => (typeof part === "string" ? part : part.text || "")).join("")
          : "";

    res.status(200).json({
      success: true,
      data: {
        reply: reply.trim() || "I could not generate a response. Please try again.",
        lectureId,
        courseId,
      },
    });
  } catch (error) {
    console.error("Tutor Chat Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while generating tutor response",
    });
  }
};
