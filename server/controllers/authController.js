import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Kullanıcı bulunamadığında da bcrypt.compare çalıştırılır ki
// yanıt süresinden kullanıcı adının var olup olmadığı anlaşılmasın.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", 10);

export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Tip kontrolü: obje/array gönderilerek NoSQL injection denemesini engeller
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res
        .status(400)
        .json({ message: "Kullanıcı adı ve şifre gerekli" });
    }

    const admin = await User.findOne({
      username: username.trim(),
      role: "admin",
    }).select("+password");

    const isMatch = await bcrypt.compare(
      password,
      admin?.password || DUMMY_HASH,
    );

    if (!admin || !isMatch) {
      return res
        .status(401)
        .json({ message: "Geçersiz kullanıcı adı veya şifre." });
    }

    const token = jwt.sign({ userId: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Giriş başarılı",
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Giriş hatası" });
  }
};

export const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      !currentPassword ||
      newPassword.length < 8
    ) {
      return res.status(400).json({
        message: "Mevcut şifre ve en az 8 karakterli yeni şifre gerekli.",
      });
    }

    const admin = await User.findById(req.user._id).select("+password");
    const isMatch = await bcrypt.compare(currentPassword, admin.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Mevcut şifre yanlış." });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    res.json({ message: "Şifre güncellendi." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Şifre güncellenemedi." });
  }
};
