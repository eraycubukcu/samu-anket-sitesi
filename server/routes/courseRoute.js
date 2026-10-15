import express from "express";
import {
  createCourse,
  deleteCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
} from "../controllers/courseController.js";
import { requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

// admin routes
router.get("/", requireAdmin, getAllCourses);
router.get("/:id", requireAdmin, getCourseById);
router.post("/", requireAdmin, createCourse);
router.put("/:id", requireAdmin, updateCourse);
router.delete("/:id", requireAdmin, deleteCourse);

export default router;
