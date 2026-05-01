import { Router } from "express";
import {
  getOverview,
  getRegistrations,
  getTopCourses,
  getQuizPassRates,
  getUsers,
  updateUser,
  deleteUser,
} from "../controllers/adminController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

const router = Router();

// All admin routes require authentication + admin role
router.use(protect);
router.use(authorizeRoles(UserRole.ADMIN));

// Analytics
router.get("/analytics/overview", getOverview);
router.get("/analytics/registrations", getRegistrations);
router.get("/analytics/top-courses", getTopCourses);
router.get("/analytics/quiz-pass-rates", getQuizPassRates);

// User management
router.get("/users", getUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

export default router;
