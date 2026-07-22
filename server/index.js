import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import connectDB from "./config/db.js";
import surveyRoute from "./routes/surveyRoute.js";
import responseRoute from "./routes/responseRoute.js";
import adminRoute from "./routes/adminRoute.js";
import { clerkAuth } from "./middlewares/auth.js";

dotenv.config();

// Kritik env değişkenleri eksikse uygulama güvensiz durumda ayağa kalkmasın
const requiredEnvVars = [
  "MONGO_URI",
  "JWT_SECRET",
  "CLERK_SECRET_KEY",
  "CLERK_PUBLISHABLE_KEY",
];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(
    `Eksik ortam değişkenleri, sunucu başlatılamıyor: ${missingEnvVars.join(", ")}`,
  );
  process.exit(1);
}

connectDB();

const app = express();

// Sadece gerçekten bir reverse proxy (Render/Railway/nginx vb.) arkasındaysa
// açılmalı; aksi halde X-Forwarded-For sahteciliğiyle rate limit atlatılabilir.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", process.env.TRUST_PROXY);
}

app.use(helmet());

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((o) => o.trim())
  : undefined;

app.use(
  cors({
    origin: allowedOrigins ?? true,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(clerkAuth);

// Genel istek sınırlaması
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", generalLimiter);

// Admin login için daha sıkı sınır (brute-force koruması)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Çok fazla deneme yapıldı, lütfen daha sonra tekrar deneyin." },
});
app.use("/api/admin/login", adminLoginLimiter);

app.get("/", (req, res) => {
  res.json({ mesaj: "Samsun Üniversitesi Anket API çalışıyor." });
});

app.use("/api/surveys", surveyRoute);
app.use("/api/responses", responseRoute);
app.use("/api/admin", adminRoute);

// Bilinmeyen route
app.use((req, res) => {
  res.status(404).json({ mesaj: "Bulunamadı." });
});

// Merkezi hata yönetimi (ör. bozuk JSON gövdesi) - detay istemciye sızmasın
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ mesaj: "Geçersiz istek gövdesi." });
  }
  res.status(err.status || 500).json({ mesaj: "Sunucu hatası." });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
