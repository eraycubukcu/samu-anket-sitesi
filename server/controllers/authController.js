import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status({ message: "Kullanıcı adı ve şifre gerekli" });

    const admin = await User.findOne({ username, role: "admin" });

    if (!admin)
      return res
        .status(400)
        .json({ message: "Geçersiz kullanıcı adı veya şifre." });

    // Şifreyi karşılaştır
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch)
      return res
        .status(401)
        .json({ message: "Geçersiz kullanıcı adı veya şifre" });

    // JWT Token oluştur.
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
    res.status(500).json({ message: "Giriş hatası", hata: error.message });
  }
};
