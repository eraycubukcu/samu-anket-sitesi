import User from "../models/User.js";

// clerk token'ı doğru ve kullanıcı bul/oluştur
export const requireAuth = async (req, res, next) => {
  try {
    const clerkId = req.headers["x-clerk-user-id"];
    const email = req.headers["x-clerk-user-email"];
    const firstName = req.headers["x-clerk-user-firstname"] || "";
    const lastName = req.headers["x-clerk-user-lastname"] || "";

    if (!clerkId || !email) {
      return res.status(401).json({ mesaj: "Giriş yapmanız gerekiyor" });
    }

    let user = await User.findOne({ clerkId });

    if (!user) {
      user = await User.create({
        clerkId,
        email,
        firstName,
        lastName,
      });
      console.log(`Yeni kullanıcı oluşturuldu: ${email}`);
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ mesaj: "Yetkilendirme hatası", hata: error.message });
  }
};

// sadece admin için
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin")
    return res
      .status(403)
      .json({ mesaj: "Bu işlem için admin yetkisi gerekli" });

  next();
};
