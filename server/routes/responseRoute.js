import express from "express";
import { requireAdmin, requireAuth } from "../middlewares/auth.js";
import {
  submitForm,
  getSurveyResults,
  getMyResponses,
} from "../controllers/responseController.js";

const router = express.Router();

// student routes
router.post("/", requireAuth, submitForm);
router.get("/my", requireAuth, getMyResponses);

// admin routes
router.get("/survey/:surveyId", requireAuth, requireAdmin, getSurveyResults);

export default router;
