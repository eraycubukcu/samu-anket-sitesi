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
router.get("/", requireAuth, requireAdmin, getAllSurveys);
router.post("/", requireAuth, requireAdmin, createSurvey);
router.put("/:id", requireAuth, requireAdmin, updateSurvey);
router.delete("/:id", requireAuth, requireAdmin, deleteSurvey);

export default router;
