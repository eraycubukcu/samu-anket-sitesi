import { adminLogin } from "../controllers/authController.js"
import express from "express";

const router = express.Router();

router.post("/admin/login", adminLogin);

export default router;