import express from "express";
import {
  createSurvey,
  deleteSurvey,
  getActiveSurveys,
  getAllSurveys,
  getSurveyById,
  getSurveyForStudent,
  updateSurvey,
} from "../controllers/surveyController.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

// student routes
router.get("/active", requireAuth, getActiveSurveys);
router.get("/student/:id", requireAuth, getSurveyForStudent);

// admin routes
router.get("/", requireAdmin, getAllSurveys);
router.get("/:id", requireAdmin, getSurveyById);
router.post("/",  requireAdmin, createSurvey);
router.put("/:id", requireAdmin, updateSurvey);
router.delete("/:id", requireAdmin, deleteSurvey);

export default router;
