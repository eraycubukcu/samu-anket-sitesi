import mongoose from "mongoose";
import { computeSurveyWindow } from "../utils/surveySchedule.js";

const questionSchema = mongoose.Schema({
  questionText: {
    type: String,
    required: true,
  },
  questionType: {
    type: String,
    enum: ["radio", "text", "checkbox", "rating"],
    required: true,
  },
  options: {
    type: [String],
    default: [],
    validate: {
      validator: function (opts) {
        if (this.questionType === "radio" || this.questionType === "checkbox") {
          return (
            Array.isArray(opts) &&
            opts.filter((o) => typeof o === "string" && o.trim()).length >= 2
          );
        }
        return true;
      },
      message:
        "Radio/checkbox soruları için en az 2 dolu seçenek girilmelidir.",
    },
  },
  required: {
    type: Boolean,
    default: true,
  },
});

const surveySchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      default: "",
    },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "En az bir soru olmalı.",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      required: true,
    },
    // Sınavın yapılacağı tarih/saat. startDate ve endDate bundan otomatik
    // hesaplanır, dışarıdan doğrudan set edilmemelidir.
    examDate: {
      type: Date,
      required: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
  },
  { timestamps: true },
);

// examDate her set edildiğinde/değiştiğinde açılış-kapanış otomatik hesaplanır:
// sınavdan 10 dk önce açılır, sınav gününün (TR saatiyle) 23:59'unda kapanır.
surveySchema.pre("validate", function (next) {
  if (this.examDate && this.isModified("examDate")) {
    const { startDate, endDate } = computeSurveyWindow(this.examDate);
    this.startDate = startDate;
    this.endDate = endDate;
  }
  next();
});

// findByIdAndUpdate/findOneAndUpdate "save" hook'larını tetiklemediği için
// aynı hesaplama update yolunda da ayrıca uygulanır.
surveySchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const examDate = update.examDate ?? update.$set?.examDate;

  if (examDate) {
    const { startDate, endDate } = computeSurveyWindow(examDate);
    if (!update.$set) update.$set = {};
    update.$set.startDate = startDate;
    update.$set.endDate = endDate;
  }

  next();
});

export default mongoose.model("Survey", surveySchema);

/* 
Survey Modeli
 - Title
 - Description
 - Questions
 - createdBy 
 - isActive
 - startDate
 - endDate
 - createdAt, updatedAt (timestamps)
*/

/* 
Question Schema
 - questionText
 - questionType
 - options -> örneğin type radio seçildi radio'nun seçeneklerini tutuyor.
 - required -> alanın doldurulup doldurulmaması ( bu aslında hepsi true olcak )
*/ 