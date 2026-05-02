import { Router } from "express";
import {
  createCourse,
  deleteCourse,
  enrollCourse,
  getCourseById,
  getCourses,
  updateCourse,
} from "../controllers/courseController";
import { authorizeRoles, protect } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";
import courseModuleRoutes from "./courseModuleRoutes";
import {
  getCourseComments,
  addCourseComment,
  deleteCourseComment,
} from "../controllers/courseCommentController";

const router = Router();

router.use("/:courseId/modules", courseModuleRoutes);

/**
 * @swagger
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: List courses
 *     description: Returns all courses. Supports optional filters via query params.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search on title/description/tags
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *       - in: query
 *         name: instructor
 *         schema:
 *           type: string
 *       - in: query
 *         name: isPublished
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Courses fetched successfully
 */
router.get("/", getCourses);

/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a course by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course fetched successfully
 *       400:
 *         description: Invalid course ID
 *       404:
 *         description: Course not found
 */
router.get("/:id", getCourseById);

/**
 * @swagger
 * /api/courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a course
 *     security:
 *       - BearerAuth: []
 *     description: Teacher or admin only. Instructor is always the authenticated user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, category]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *               price:
 *                 type: number
 *               thumbnail:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               isPublished:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Course created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  createCourse
);

/**
 * @swagger
 * /api/courses/{id}:
 *   put:
 *     tags: [Courses]
 *     summary: Update a course
 *     security:
 *       - BearerAuth: []
 *     description: Course owner teacher or admin only.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Course updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Course not found
 */
router.put(
  "/:id",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  updateCourse
);

/**
 * @swagger
 * /api/courses/{id}:
 *   delete:
 *     tags: [Courses]
 *     summary: Delete a course
 *     security:
 *       - BearerAuth: []
 *     description: Course owner teacher or admin only. Cascades related data cleanup.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course deleted successfully
 *       400:
 *         description: Invalid course ID
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Course not found
 */
router.delete(
  "/:id",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  deleteCourse
);

/**
 * @swagger
 * /api/courses/{id}/enroll:
 *   post:
 *     tags: [Courses]
 *     summary: Enroll a student in a course
 *     security:
 *       - BearerAuth: []
 *     description: Student only. Adds the authenticated student to the course's enrolled students.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Successfully enrolled in course
 *       400:
 *         description: Invalid course ID or already enrolled
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - student role required
 *       404:
 *         description: Course not found
 */
router.post(
  "/:id/enroll",
  protect,
  authorizeRoles(UserRole.STUDENT),
  enrollCourse
);

// ---------------------------------------------------------------------------
// Course Comments / Reviews
// ---------------------------------------------------------------------------

router.get("/:id/comments", getCourseComments);

router.post(
  "/:id/comments",
  protect,
  authorizeRoles(UserRole.STUDENT),
  addCourseComment
);

router.delete(
  "/:id/comments/:commentId",
  protect,
  authorizeRoles(UserRole.STUDENT, UserRole.ADMIN),
  deleteCourseComment
);

export default router;
