import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { getAuth, clerkMiddleware } from "@clerk/express";
import dotenv from "dotenv";

// clerk global middleware
export const clerkAuth = clerkMiddleware();

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

// Öğrenci için — Clerk doğrula + samsun.edu.tr kontrolü
export const requireAuth = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ mesaj: "Giriş yapmanız gerekiyor" });
    }

    let user = await User.findOne({ clerkId: userId });

    if (!user) {
      // Clerk API'den kullanıcı bilgilerini al
      const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      });

      const clerkUser = await response.json();
      const email = clerkUser.email_addresses[0].email_address;

      // samsun.edu.tr kontrolü
      if (!email.endsWith("@samsun.edu.tr")) {
        return res.status(403).json({
          mesaj:
            "Sadece @samsun.edu.tr uzantılı hesaplarla giriş yapabilirsiniz",
        });
      }

      user = await User.create({
        clerkId: userId,
        email,
        firstName: clerkUser.first_name || "",
        lastName: clerkUser.last_name || "",
        role: "student",
      });
      console.log(`Yeni öğrenci oluşturuldu: ${email}`);
    }

    req.user = user;
    next();
  } catch (error) {
    res
      .status(500)
      .json({ mesaj: "Yetkilendirme hatası", hata: error.message });
  }
};
