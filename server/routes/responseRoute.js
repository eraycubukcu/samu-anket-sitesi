import express from "express";
import { requireAdmin, requireAuth } from "../middlewares/auth.js";
import {
  submitResponse,
  getSurveyResults,
  getMyResponses,
} from "../controllers/responseController.js";

const router = express.Router();

// student routes
router.post("/", requireAuth, submitResponse);
router.get("/my", requireAuth, getMyResponses);

// admin routes
router.get("/survey/:surveyId", requireAdmin, getSurveyResults);

export default router;
