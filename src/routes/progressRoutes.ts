import { Router } from "express";
import {
  markLectureComplete,
  getCourseProgress,
} from "../controllers/progressController";
import { authorizeRoles, protect } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

const router = Router();

/**
 * @swagger
 * /api/progress/complete:
 *   post:
 *     tags: [Progress]
 *     summary: Mark a lecture as completed
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lectureId, moduleId, courseId]
 *             properties:
 *               lectureId:
 *                 type: string
 *               moduleId:
 *                 type: string
 *               courseId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lecture marked as completed
 */
router.post(
  "/complete",
  protect,
  authorizeRoles(UserRole.STUDENT),
  markLectureComplete
);

/**
 * @swagger
 * /api/progress/{courseId}:
 *   get:
 *     tags: [Progress]
 *     summary: Get all lecture completions for a course
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Progress data fetched
 */
router.get(
  "/:courseId",
  protect,
  authorizeRoles(UserRole.STUDENT),
  getCourseProgress
);

export default router;
