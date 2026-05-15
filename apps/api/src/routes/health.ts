import { Router } from "express";
import type { Router as RouterType } from "express";

export const healthRouter: RouterType = Router();

healthRouter.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "x402-jobs-api",
    timestamp: new Date().toISOString(),
  });
});
