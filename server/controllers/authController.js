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
