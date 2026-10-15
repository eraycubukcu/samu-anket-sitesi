import mongoose from "mongoose";

// ML servisinin bir ders için ürettiği son analiz. Her analiz isteğinde
// yeniden hesaplanmasın diye saklanır (ders başına tek kayıt).
const analysisReportSchema = mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      unique: true,
    },
    // ML servisinin /analyze cevabı (yapısı: docs/specs/faz-3-ml-servisi.md)
    result: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    modelVersion: {
      type: String,
      default: "",
    },
    nResponses: {
      type: Number,
      default: 0,
    },
    // Analiz anındaki veri özeti; değişmişse rapor "eskimiş" sayılır
    fingerprint: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

export default mongoose.model("AnalysisReport", analysisReportSchema);
