import { Router } from "express";
import {
  createBlog,
  getBlogs,
  addComment,
} from "../controllers/blogController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

const router = Router();

/**
 * @swagger
 * /api/blogs:
 *   get:
 *     tags: [Blogs]
 *     summary: Get all published blogs
 *     description: Retrieve all published blogs safely populated.
 *     responses:
 *       200:
 *         description: Successfully fetched blogs
 */
router.get("/", getBlogs);

/**
 * @swagger
 * /api/blogs:
 *   post:
 *     tags: [Blogs]
 *     summary: Create a blog
 *     security:
 *       - BearerAuth: []
 *     description: Authenticated users can create blogs.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               thumbnail:
 *                 type: string
 *               isPublished:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Successfully created blog
 */
router.post("/", protect, authorizeRoles(UserRole.TEACHER, UserRole.ADMIN), createBlog);

/**
 * @swagger
 * /api/blogs/{id}/comments:
 *   post:
 *     tags: [Blogs]
 *     summary: Add a comment to a blog
 *     security:
 *       - BearerAuth: []
 *     description: Authenticated users can add comments to published blogs.
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
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Successfully added comment
 */
router.post("/:id/comments", protect, addComment);

export default router;
