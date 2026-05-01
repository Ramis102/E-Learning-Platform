import { Response } from "express";
import Notification from "../models/Notification";
import { AuthRequest } from "../middleware/authMiddleware";

// ---------------------------------------------------------------------------
// GET /api/notifications — Fetch user's notifications
// ---------------------------------------------------------------------------

export const getNotifications = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: { notifications, unreadCount },
    });
  } catch (error) {
    console.error("GetNotifications Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching notifications",
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/notifications/:id/read — Mark a single notification as read
// ---------------------------------------------------------------------------

export const markAsRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        message: "Notification not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error("MarkAsRead Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while marking notification as read",
    });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/notifications/read-all — Mark all user's notifications as read
// ---------------------------------------------------------------------------

export const markAllAsRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("MarkAllAsRead Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while marking all notifications as read",
    });
  }
};
