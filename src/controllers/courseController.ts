import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Course, {
  CourseCategory,
  CourseDifficulty,
} from "../models/Course";
import Module from "../models/Module";
import Lecture from "../models/Lecture";
import Quiz from "../models/Quiz";
import Question from "../models/Question";
import Attempt from "../models/Attempt";
import StudentProfile from "../models/StudentProfile";
import TeacherProfile from "../models/TeacherProfile";
import { AuthRequest } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

interface CreateCourseBody {
  title?: string;
  description?: string;
  price?: number;
  thumbnail?: string;
  category?: CourseCategory;
  difficulty?: CourseDifficulty;
  tags?: string[];
  isPublished?: boolean;
}

interface UpdateCourseBody extends CreateCourseBody {}

const isValidObjectId = (id: string): boolean => mongoose.isValidObjectId(id);

const deleteLectureGraph = async (lectureIds: Types.ObjectId[]): Promise<void> => {
  if (lectureIds.length === 0) {
    return;
  }

  const quizzes = await Quiz.find({ lecture: { $in: lectureIds } })
    .select("_id")
    .lean();
  const quizIds = quizzes.map((quiz) => quiz._id);

  if (quizIds.length > 0) {
    await Promise.all([
      Question.deleteMany({ quiz: { $in: quizIds } }),
      Attempt.deleteMany({ quiz: { $in: quizIds } }),
      Quiz.deleteMany({ _id: { $in: quizIds } }),
    ]);
  }

  await Lecture.deleteMany({ _id: { $in: lectureIds } });
};

const canManageCourse = (user: NonNullable<AuthRequest["user"]>, course: any): boolean => {
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  return course.instructor.toString() === user._id.toString();
};

// ---------------------------------------------------------------------------
// GET /api/courses
// ---------------------------------------------------------------------------
export const getCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      category,
      difficulty,
      instructor,
      isPublished,
    } = req.query as Record<string, string | undefined>;

    const query: Record<string, unknown> = {};

    if (search) {
      query.$text = { $search: search };
    }

    if (category) {
      query.category = category;
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    if (instructor && isValidObjectId(instructor)) {
      query.instructor = instructor;
    }

    if (isPublished === "true" || isPublished === "false") {
      query.isPublished = isPublished === "true";
    }

    const courses = await Course.find(query)
      .populate("instructor", "name email avatar")
      .populate({ path: "modules", options: { sort: { order: 1 } } })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error("GetCourses Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching courses",
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/courses/:id
// ---------------------------------------------------------------------------
export const getCourseById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const course = await Course.findById(id)
      .populate("instructor", "name email avatar")
      .populate({ path: "modules", options: { sort: { order: 1 } } });

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error("GetCourseById Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching course",
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/courses
// ---------------------------------------------------------------------------
export const createCourse = async (
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

    const {
      title,
      description,
      price,
      thumbnail,
      category,
      difficulty,
      tags,
      isPublished,
    } = req.body as CreateCourseBody;

    if (!title || !description || category === undefined) {
      res.status(400).json({
        success: false,
        message: "Please provide title, description, and category",
      });
      return;
    }

    const instructorId = user._id;

    const course = await Course.create({
      title,
      description,
      instructor: instructorId,
      price,
      thumbnail,
      category,
      difficulty,
      tags,
      isPublished,
    });

    if (!course) {
      throw new Error("Course creation failed");
    }

    try {
      await TeacherProfile.updateOne(
        { userId: instructorId },
        { $addToSet: { publishedCourses: course._id } }
      );
    } catch (profileError) {
      // Roll back the course if profile linking fails to avoid dangling records.
      await Course.deleteOne({ _id: course._id });
      throw profileError;
    }

    const freshCourse = await Course.findById(course._id)
      .populate("instructor", "name email avatar")
      .populate({ path: "modules", options: { sort: { order: 1 } } });

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: freshCourse,
    });
  } catch (error) {
    console.error("CreateCourse Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating course",
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/courses/:id
// ---------------------------------------------------------------------------
export const updateCourse = async (
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
        message: "Invalid course ID",
      });
      return;
    }

    const course = await Course.findById(id);

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (!canManageCourse(user, course)) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot update this course",
      });
      return;
    }

    const {
      title,
      description,
      price,
      thumbnail,
      category,
      difficulty,
      tags,
      isPublished,
    } = req.body as UpdateCourseBody;

    if (title !== undefined) {
      course.title = title;
    }

    if (description !== undefined) {
      course.description = description;
    }

    if (price !== undefined) {
      course.price = price;
    }

    if (thumbnail !== undefined) {
      course.thumbnail = thumbnail;
    }

    if (category !== undefined) {
      course.category = category;
    }

    if (difficulty !== undefined) {
      course.difficulty = difficulty;
    }

    if (tags !== undefined) {
      course.tags = tags;
    }

    if (isPublished !== undefined) {
      course.isPublished = isPublished;
    }

    await course.save();

    const updatedCourse = await Course.findById(course._id)
      .populate("instructor", "name email avatar")
      .populate({ path: "modules", options: { sort: { order: 1 } } });

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse,
    });
  } catch (error) {
    console.error("UpdateCourse Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating course",
    });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/courses/:id
// ---------------------------------------------------------------------------
export const deleteCourse = async (
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
        message: "Invalid course ID",
      });
      return;
    }

    const course = await Course.findById(id);

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (!canManageCourse(user, course)) {
      res.status(403).json({
        success: false,
        message: "Forbidden — you cannot delete this course",
      });
      return;
    }

    const lectures = await Lecture.find({ course: course._id })
      .select("_id")
      .lean();
    const lectureIds = lectures.map((lecture) => lecture._id as Types.ObjectId);

    const quizzes = await Quiz.find({ lecture: { $in: lectureIds } })
      .select("_id")
      .lean();
    const quizIds = quizzes.map((quiz) => quiz._id);

    await Promise.all([
      Question.deleteMany({ quiz: { $in: quizIds } }),
      Attempt.deleteMany({
        $or: [{ course: course._id }, { quiz: { $in: quizIds } }],
      }),
      Quiz.deleteMany({ _id: { $in: quizIds } }),
      Lecture.deleteMany({ course: course._id }),
      Module.deleteMany({ course: course._id }),
      StudentProfile.updateMany({}, {
        $pull: {
          enrolledCourses: course._id,
          wishlist: course._id,
        },
      }),
      TeacherProfile.updateMany({}, { $pull: { publishedCourses: course._id } }),
      Course.deleteOne({ _id: course._id }),
    ]);

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("DeleteCourse Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting course",
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/courses/:id/enroll
// ---------------------------------------------------------------------------
export const enrollCourse = async (
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
        message: "Invalid course ID",
      });
      return;
    }

    const course = await Course.findById(id);

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    const studentProfile = await StudentProfile.findOne({ userId: user._id });

    if (!studentProfile) {
      res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
      return;
    }

    // Check if already enrolled
    if (studentProfile.enrolledCourses.some((id: any) => id.toString() === course._id.toString())) {
      res.status(400).json({
        success: false,
        message: "Already enrolled in this course",
      });
      return;
    }

    // Add course to student's enrolled courses and increment enrollments
    studentProfile.enrolledCourses.push(course._id);
    course.totalEnrolments += 1;

    // Save both documents
    await Promise.all([studentProfile.save(), course.save()]);

    res.status(200).json({
      success: true,
      message: "Successfully enrolled in course",
      data: studentProfile,
    });
  } catch (error) {
    console.error("EnrollCourse Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while enrolling in course",
    });
  }
};
