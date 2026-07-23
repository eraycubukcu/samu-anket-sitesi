import { adminLogin, changeAdminPassword } from "../controllers/authController.js";
import express from "express";
import { getDashboardStats } from "../controllers/adminController.js";
import { requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.post("/login", adminLogin);
router.get("/stats", requireAdmin, getDashboardStats);
router.put("/password", requireAdmin, changeAdminPassword);

export default router;
