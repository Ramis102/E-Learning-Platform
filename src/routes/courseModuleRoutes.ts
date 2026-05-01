import { Router } from "express";
import {
  createLectureModule,
  createModuleQuiz,
  deleteCourseModule,
  deleteModuleQuiz,
  getCourseModuleById,
  getModuleQuiz,
  listCourseModules,
  updateCourseModule,
  updateModuleQuiz,
} from "../controllers/courseModuleController";
import { authorizeRoles, protect } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

const router = Router({ mergeParams: true });

/**
 * @swagger
 * /api/courses/{courseId}/modules:
 *   get:
 *     tags: [Course Modules]
 *     summary: List all modules for a course
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Modules fetched successfully
 */
router.get("/", listCourseModules);

/**
 * @swagger
 * /api/courses/{courseId}/modules/{moduleId}:
 *   get:
 *     tags: [Course Modules]
 *     summary: Get a single course module with lecture and quiz (if exists)
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Module fetched successfully
 */
router.get("/:moduleId", getCourseModuleById);

/**
 * @swagger
 * /api/courses/{courseId}/modules/lectures:
 *   post:
 *     tags: [Course Modules]
 *     summary: Create a lecture module for a course
 *     security:
 *       - BearerAuth: []
 *     description: Teacher owner or admin only.
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, order, lecture]
 *             properties:
 *               title:
 *                 type: string
 *               order:
 *                 type: number
 *               lecture:
 *                 type: object
 *                 required: [title, content, order]
 *                 properties:
 *                   title:
 *                     type: string
 *                   content:
 *                     type: string
 *                   order:
 *                     type: number
 *                   videoUrl:
 *                     type: string
 *                   isPreview:
 *                     type: boolean
 *                   duration:
 *                     type: number
 *     responses:
 *       201:
 *         description: Lecture module created successfully
 */
router.post(
  "/lectures",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  createLectureModule
);

/**
 * @swagger
 * /api/courses/{courseId}/modules/{moduleId}:
 *   put:
 *     tags: [Course Modules]
 *     summary: Update module metadata and optionally lecture/quiz payload
 *     security:
 *       - BearerAuth: []
 *     description: Teacher owner or admin only.
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
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
 *         description: Module updated successfully
 */
router.put(
  "/:moduleId",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  updateCourseModule
);

/**
 * @swagger
 * /api/courses/{courseId}/modules/{moduleId}:
 *   delete:
 *     tags: [Course Modules]
 *     summary: Delete a module and all linked resources
 *     security:
 *       - BearerAuth: []
 *     description: Teacher owner or admin only.
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Module deleted successfully
 */
router.delete(
  "/:moduleId",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  deleteCourseModule
);

/**
 * @swagger
 * /api/courses/{courseId}/modules/{moduleId}/quiz:
 *   post:
 *     tags: [Course Modules]
 *     summary: Create quiz for an existing lecture module
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Quiz created successfully
 */
router.post(
  "/:moduleId/quiz",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  createModuleQuiz
);

/**
 * @swagger
 * /api/courses/{courseId}/modules/{moduleId}/quiz:
 *   get:
 *     tags: [Course Modules]
 *     summary: Get quiz for a module
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz fetched successfully
 */
router.get("/:moduleId/quiz", getModuleQuiz);

/**
 * @swagger
 * /api/courses/{courseId}/modules/{moduleId}/quiz:
 *   put:
 *     tags: [Course Modules]
 *     summary: Update quiz for a module
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz updated successfully
 */
router.put(
  "/:moduleId/quiz",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  updateModuleQuiz
);

/**
 * @swagger
 * /api/courses/{courseId}/modules/{moduleId}/quiz:
 *   delete:
 *     tags: [Course Modules]
 *     summary: Delete quiz for a module
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz deleted successfully
 */
router.delete(
  "/:moduleId/quiz",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  deleteModuleQuiz
);

export default router;
