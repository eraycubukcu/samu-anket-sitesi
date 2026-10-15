import express from "express";
import {
  getAnalysisSummary,
  getCourseAnalysis,
  runCourseAnalysis,
} from "../controllers/analysisController.js";
import { requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

// admin routes
router.get("/summary", requireAdmin, getAnalysisSummary);
router.get("/courses/:courseId", requireAdmin, getCourseAnalysis);
router.post("/courses/:courseId", requireAdmin, runCourseAnalysis);

export default router;
