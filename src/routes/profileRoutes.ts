import { Router } from "express";
import {
  getMyProfile,
  updateMyProfile,
} from "../controllers/profileController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

// All profile routes require authentication
router.use(protect);

// ---------------------------------------------------------------------------
// Profile routes
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/profile/me:
 *   get:
 *     tags: [Profile]
 *     summary: Get my full profile
 *     description: |
 *       Returns the authenticated user's base info **plus** their role-specific profile.
 *       - **Students** receive: enrolledCourses, wishlist, certificates
 *       - **Teachers** receive: headline, bio, socialLinks, publishedCourses
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     profile:
 *                       oneOf:
 *                         - $ref: '#/components/schemas/StudentProfile'
 *                         - $ref: '#/components/schemas/TeacherProfile'
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me", getMyProfile);

/**
 * @swagger
 * /api/profile/me:
 *   put:
 *     tags: [Profile]
 *     summary: Update my profile
 *     description: |
 *       Updates the authenticated user's profile. You can send **base fields** and **role-specific fields** in the same request.
 *
 *       **Base fields** (all roles): `name`, `avatar`
 *
 *       **Student-specific fields**: `wishlist`
 *
 *       **Teacher-specific fields**: `headline`, `bio`, `socialLinks`
 *
 *       Fields that don't belong to your role are silently ignored.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProfileUpdateRequest'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     profile:
 *                       oneOf:
 *                         - $ref: '#/components/schemas/StudentProfile'
 *                         - $ref: '#/components/schemas/TeacherProfile'
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/me", updateMyProfile);

export default router;
