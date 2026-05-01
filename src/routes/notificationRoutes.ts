import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

// All notification routes require authentication
router.use(protect);

router.get("/", getNotifications);
router.put("/read-all", markAllAsRead);
router.put("/:id/read", markAsRead);

export default router;
