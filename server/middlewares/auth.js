import jwt from "jsonwebtoken";
import User from "../models/User.js";

// admin için
export const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ mesaj: "Admin girişi gerekli" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);

    if (!user || user.role !== "admin") {
      return res.status(403).json({ mesaj: "Admin yetkisi gerekli" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ mesaj: "Geçersiz token" });
  }
};

// student için
export const requireAuth = async (req, res, next) => {
  try {
    const clerkId = req.headers["x-clerk-user-id"];
    const email = req.headers["x-clerk-user-email"];
    const firstName = req.headers["x-clerk-user-firstname"] || "";
    const lastName = req.headers["x-clerk-user-lastname"] || "";

    if (!clerkId || !email) {
      return res.status(401).json({ mesaj: "Giriş yapmanız gerekiyor" });
    }

    let user = await User.findOne({ $or: [{ clerkId }, { email }] });

    if (!user) {
      user = await User.create({
        clerkId,
        email,
        firstName,
        lastName,
        role: "student",
      });
      console.log(`Yeni öğrenci oluşturuldu: ${email}`);
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ mesaj: "Yetkilendirme hatası", hata: error.message });
  }
};