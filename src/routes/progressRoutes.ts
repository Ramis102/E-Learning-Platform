import { Router } from "express";
import {
  markLectureComplete,
  getCourseProgress,
} from "../controllers/progressController";
import { getDashboard } from "../controllers/studentAnalyticsController";
import { getCourseStats } from "../controllers/studentCourseStatsController";
import { authorizeRoles, protect } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

const router = Router();

// ── Dashboard (MUST be before /:courseId to avoid param collision) ────
router.get(
  "/dashboard",
  protect,
  authorizeRoles(UserRole.STUDENT),
  getDashboard
);

// ── Mark lecture complete ────────────────────────────────────────────
router.post(
  "/complete",
  protect,
  authorizeRoles(UserRole.STUDENT),
  markLectureComplete
);

// ── Per-course stats ─────────────────────────────────────────────────
router.get(
  "/:courseId/stats",
  protect,
  authorizeRoles(UserRole.STUDENT),
  getCourseStats
);

// ── Course progress ──────────────────────────────────────────────────
router.get(
  "/:courseId",
  protect,
  authorizeRoles(UserRole.STUDENT),
  getCourseProgress
);

export default router;
