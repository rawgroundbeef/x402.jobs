import { Router } from "express";
import type { Router as RouterType } from "express";
import { isAdminUser, config } from "../config";

export const authRouter: RouterType = Router();

// GET /api/auth/me - Get current user info including admin status
authRouter.get("/me", (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const admin = isAdminUser(userId);
  console.log(
    `[Auth] /me check - userId: ${userId}, isAdmin: ${admin}, adminIds: ${config.adminUserIds.join(",")}`,
  );

  return res.json({
    id: userId,
    isAdmin: admin,
  });
});
