/**
 * Notifications API Routes
 * Handles user notification operations
 */

import { Router, type Router as RouterType } from "express";
import * as notificationService from "../services/notifications.service";

// Protected routes (auth required)
export const notificationsRouter: RouterType = Router();

/**
 * GET /api/notifications
 * Get user's notifications
 */
notificationsRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { unread_only, limit = "50", offset = "0" } = req.query;

    const result = await notificationService.getNotifications(userId, {
      unreadOnly: unread_only === "true",
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    res.json({
      notifications: result.notifications,
      total: result.total,
      unread_count: result.unreadCount,
    });
  } catch (error: any) {
    console.error("Error getting notifications:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
notificationsRouter.get("/unread-count", async (req, res) => {
  try {
    const userId = req.user!.id;
    const count = await notificationService.getUnreadCount(userId);
    res.json({ count });
  } catch (error: any) {
    console.error("Error getting unread count:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /api/notifications/:id/read
 * Mark a notification as read
 */
notificationsRouter.post("/:id/read", async (req, res) => {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    const notification = await notificationService.markAsRead(
      notificationId,
      userId,
    );
    res.json({ notification });
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: error.message || "Failed to mark as read" });
  }
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
notificationsRouter.post("/read-all", async (req, res) => {
  try {
    const userId = req.user!.id;
    const count = await notificationService.markAllAsRead(userId);
    res.json({ count, message: `Marked ${count} notifications as read` });
  } catch (error: any) {
    console.error("Error marking all as read:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to mark all as read" });
  }
});

/**
 * DELETE /api/notifications/old
 * Delete old read notifications (cleanup)
 */
notificationsRouter.delete("/old", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { days = "30" } = req.query;

    const count = await notificationService.deleteOldNotifications(
      userId,
      parseInt(days as string, 10),
    );

    res.json({ count, message: `Deleted ${count} old notifications` });
  } catch (error: any) {
    console.error("Error deleting old notifications:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to delete notifications" });
  }
});
