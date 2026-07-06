import express from "express";
import {
  createSurvey,
  deleteSurvey,
  getActiveSurveys,
  getAllSurveys,
  getSurveyById,
  updateSurvey,
} from "../controllers/surveyController.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

// student routes
router.get("/active", requireAuth, getActiveSurveys);
router.get("/:id", requireAuth, getSurveyById);

// admin routes
router.get("/", requireAdmin, requireAuth, getAllSurveys);
router.post("/", requireAdmin, requireAuth, createSurvey);
router.put("/:id", requireAdmin, requireAuth, updateSurvey);
router.delete("/:id", requireAdmin, requireAuth, deleteSurvey);

export default router;
