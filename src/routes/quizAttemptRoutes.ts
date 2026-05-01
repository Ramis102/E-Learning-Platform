import { Router } from "express";
import { submitAttempt } from "../controllers/quizAttemptController";
import { authorizeRoles, protect } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

const router = Router();

/**
 * @swagger
 * /api/attempts:
 *   post:
 *     tags: [Attempts]
 *     summary: Submit a quiz attempt
 *     security:
 *       - BearerAuth: []
 *     description: Students submit their quiz answers to be graded.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quizId
 *               - answers
 *             properties:
 *               quizId:
 *                 type: string
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionId
 *                     - selectedIndex
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     selectedIndex:
 *                       type: number
 *     responses:
 *       201:
 *         description: Attempt submitted and graded successfully
 */
router.post("/", protect, authorizeRoles(UserRole.STUDENT), submitAttempt);

export default router;
