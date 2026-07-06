import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import surveyRoute from "./routes/surveyRoute.js";
import responseRoute from "./routes/responseRoute.js";
import adminRoute from "./routes/adminRoute.js";
import authRoutes from "./routes/adminRoute.js"

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ mesaj: "Samsun Üniversitesi Anket API çalışıyor." });
});

app.use("/api/auth", authRoutes);
app.use("/api/surveys", surveyRoute);
app.use("/api/responses", responseRoute);
app.use("/api/admin", adminRoute);

const PORT = 5000 | process.env.PORT;

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
