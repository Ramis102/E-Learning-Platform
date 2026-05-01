import { Response } from "express";
import mongoose, { Types } from "mongoose";
import PDFDocument from "pdfkit";
import Certificate from "../models/Certificate";
import Course from "../models/Course";
import Module from "../models/Module";
import Quiz from "../models/Quiz";
import Attempt from "../models/Attempt";
import Notification from "../models/Notification";
import StudentProfile from "../models/StudentProfile";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";

const isValidObjectId = (id: string): boolean => mongoose.isValidObjectId(id);

// ---------------------------------------------------------------------------
// POST /api/certificates/:courseId/generate — Generate certificate
// ---------------------------------------------------------------------------

export const generateCertificate = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const courseId = req.params.courseId as string;

    if (!isValidObjectId(courseId)) {
      res.status(400).json({ success: false, message: "Invalid course ID" });
      return;
    }

    // Check if certificate already exists
    const existing = await Certificate.findOne({
      student: req.user._id,
      course: new Types.ObjectId(courseId),
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: "Certificate already generated for this course",
        data: existing,
      });
      return;
    }

    // Check enrollment
    const studentProfile = await StudentProfile.findOne({ userId: req.user._id });
    if (!studentProfile) {
      res.status(404).json({ success: false, message: "Student profile not found" });
      return;
    }

    const isEnrolled = studentProfile.enrolledCourses.some(
      (id: any) => id.toString() === courseId
    );
    if (!isEnrolled) {
      res.status(403).json({ success: false, message: "You are not enrolled in this course" });
      return;
    }

    // Find all quizzes for this course directly
    const quizzes = await Quiz.find({
      course: new Types.ObjectId(courseId),
      isActive: true,
    }).lean();

    if (quizzes.length === 0) {
      res.status(400).json({
        success: false,
        message: "This course has no quizzes — certificate cannot be generated",
      });
      return;
    }

    // Check that student has a passing attempt for every quiz
    const quizIds = quizzes.map((q) => q._id);
    const passingAttempts = await Attempt.find({
      student: req.user._id,
      quiz: { $in: quizIds },
      passed: true,
    }).lean();

    const passedQuizIds = new Set(passingAttempts.map((a) => a.quiz.toString()));
    const allPassed = quizIds.every((qId) => passedQuizIds.has(qId.toString()));

    if (!allPassed) {
      const remaining = quizIds.filter((qId) => !passedQuizIds.has(qId.toString()));
      res.status(400).json({
        success: false,
        message: `You must pass all quizzes first. ${remaining.length} quiz(es) remaining.`,
      });
      return;
    }

    // Compute average score
    const avgScore = Math.round(
      passingAttempts.reduce((sum, a) => sum + a.score, 0) / passingAttempts.length
    );

    // Create certificate
    const certificate = await Certificate.create({
      student: req.user._id,
      course: new Types.ObjectId(courseId),
      score: avgScore,
      completedAt: new Date(),
    });

    // Create notification
    await Notification.create({
      recipient: req.user._id,
      type: "certificate_ready",
      message: `Congratulations! You've earned a certificate for completing the course.`,
      link: `/certificates`,
    });

    res.status(201).json({
      success: true,
      message: "Certificate generated successfully",
      data: certificate,
    });
  } catch (error) {
    console.error("GenerateCertificate Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while generating certificate",
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/certificates/my — List student's certificates
// ---------------------------------------------------------------------------

export const getMyCertificates = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const certificates = await Certificate.find({ student: req.user._id })
      .populate("course", "title thumbnail instructor category")
      .populate({
        path: "course",
        populate: { path: "instructor", select: "name email" },
      })
      .sort({ completedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: certificates,
    });
  } catch (error) {
    console.error("GetMyCertificates Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching certificates",
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/certificates/:courseId/download — Stream PDF certificate
// ---------------------------------------------------------------------------

export const downloadCertificate = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const courseId = req.params.courseId as string;

    const certificate = await Certificate.findOne({
      student: req.user._id,
      course: new Types.ObjectId(courseId),
    })
      .populate("course", "title category")
      .populate({
        path: "course",
        populate: { path: "instructor", select: "name" },
      });

    if (!certificate) {
      res.status(404).json({ success: false, message: "Certificate not found" });
      return;
    }

    const course = certificate.course as any;
    const studentName = req.user.name;
    const courseTitle = course.title || "Unknown Course";
    const instructorName = course.instructor?.name || "Unknown Instructor";
    const completionDate = certificate.completedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Generate PDF
    const doc = new PDFDocument({
      layout: "landscape",
      size: "A4",
      margin: 50,
    });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificate-${certificate.uuid}.pdf"`
    );

    doc.pipe(res);

    // ── Background color
    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#fafbfc");

    // ── Border
    doc
      .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
      .lineWidth(3)
      .strokeColor("#6366f1")
      .stroke();

    // ── Inner border
    doc
      .rect(30, 30, doc.page.width - 60, doc.page.height - 60)
      .lineWidth(1)
      .strokeColor("#c7d2fe")
      .stroke();

    // ── Header
    doc
      .fillColor("#6366f1")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("EDULEARN", 0, 60, { align: "center" });

    doc
      .fillColor("#1a1a2e")
      .fontSize(36)
      .font("Helvetica-Bold")
      .text("Certificate of Completion", 0, 90, { align: "center" });

    // ── Decorative line
    const lineY = 140;
    doc
      .moveTo(doc.page.width / 2 - 100, lineY)
      .lineTo(doc.page.width / 2 + 100, lineY)
      .lineWidth(2)
      .strokeColor("#6366f1")
      .stroke();

    // ── Body text
    doc
      .fillColor("#4a4a68")
      .fontSize(14)
      .font("Helvetica")
      .text("This is to certify that", 0, 170, { align: "center" });

    doc
      .fillColor("#1a1a2e")
      .fontSize(28)
      .font("Helvetica-Bold")
      .text(studentName, 0, 200, { align: "center" });

    doc
      .fillColor("#4a4a68")
      .fontSize(14)
      .font("Helvetica")
      .text("has successfully completed the course", 0, 245, { align: "center" });

    doc
      .fillColor("#6366f1")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(courseTitle, 0, 275, { align: "center" });

    doc
      .fillColor("#4a4a68")
      .fontSize(12)
      .font("Helvetica")
      .text(`with an average score of ${certificate.score}%`, 0, 310, {
        align: "center",
      });

    doc
      .fillColor("#4a4a68")
      .fontSize(12)
      .font("Helvetica")
      .text(`Completed on ${completionDate}`, 0, 330, { align: "center" });

    // ── Instructor
    doc
      .fillColor("#1a1a2e")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(instructorName, 0, 380, { align: "center" });

    doc
      .fillColor("#8888a4")
      .fontSize(10)
      .font("Helvetica")
      .text("Course Instructor", 0, 400, { align: "center" });

    // ── Verification
    doc
      .fillColor("#8888a4")
      .fontSize(9)
      .font("Helvetica")
      .text(`Verification ID: ${certificate.uuid}`, 0, 450, {
        align: "center",
      });

    doc.end();
  } catch (error) {
    console.error("DownloadCertificate Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while generating certificate PDF",
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/certificates/verify/:uuid — Public verification
// ---------------------------------------------------------------------------

export const verifyCertificate = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const uuid = req.params.uuid as string;

    const certificate = await Certificate.findOne({ uuid })
      .populate("student", "name email")
      .populate("course", "title category")
      .populate({
        path: "course",
        populate: { path: "instructor", select: "name" },
      })
      .lean();

    if (!certificate) {
      res.status(404).json({
        success: false,
        message: "Invalid certificate — no certificate found with this verification ID",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        student: (certificate.student as any).name,
        course: (certificate.course as any).title,
        instructor: (certificate.course as any).instructor?.name,
        score: certificate.score,
        completedAt: certificate.completedAt,
        uuid: certificate.uuid,
      },
    });
  } catch (error) {
    console.error("VerifyCertificate Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while verifying certificate",
    });
  }
};
