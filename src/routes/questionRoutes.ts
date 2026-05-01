import { Router } from "express";
import {
  createQuestion,
  deleteQuestion,
  getQuestionById,
  getQuestions,
  updateQuestion,
} from "../controllers/questionController";
import { authorizeRoles, protect } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

const router = Router();

/**
 * @swagger
 * /api/questions:
 *   get:
 *     tags: [Questions]
 *     summary: List questions
 *     description: Returns questions with optional quiz filter.
 *     parameters:
 *       - in: query
 *         name: quiz
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Questions fetched successfully
 */
router.get("/", getQuestions);

/**
 * @swagger
 * /api/questions/{id}:
 *   get:
 *     tags: [Questions]
 *     summary: Get a question by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Question fetched successfully
 *       400:
 *         description: Invalid question ID
 *       404:
 *         description: Question not found
 */
router.get("/:id", getQuestionById);

/**
 * @swagger
 * /api/questions:
 *   post:
 *     tags: [Questions]
 *     summary: Create a question
 *     security:
 *       - BearerAuth: []
 *     description: Teacher or admin only.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quiz, text, options, correctIndex, order]
 *             properties:
 *               quiz:
 *                 type: string
 *                 description: Quiz ID (same as module ID in the module-based flow)
 *               text:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [mcq, true_false]
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               correctIndex:
 *                 type: number
 *               explanation:
 *                 type: string
 *               order:
 *                 type: number
 *     responses:
 *       201:
 *         description: Question created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Quiz not found
 */
router.post(
  "/",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  createQuestion
);

/**
 * @swagger
 * /api/questions/{id}:
 *   put:
 *     tags: [Questions]
 *     summary: Update a question
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
 *         description: Question updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question not found
 */
router.put(
  "/:id",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  updateQuestion
);

/**
 * @swagger
 * /api/questions/{id}:
 *   delete:
 *     tags: [Questions]
 *     summary: Delete a question
 *     security:
 *       - BearerAuth: []
 *     description: Course owner teacher or admin only.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Question deleted successfully
 *       400:
 *         description: Invalid question ID
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question not found
 */
router.delete(
  "/:id",
  protect,
  authorizeRoles(UserRole.TEACHER, UserRole.ADMIN),
  deleteQuestion
);

export default router;
