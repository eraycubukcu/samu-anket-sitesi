import mongoose from "mongoose";
import { computeSurveyWindow } from "../utils/surveySchedule.js";
import { slugify, ensureUniqueSlug } from "../utils/slug.js";

export const QUESTION_DIMENSIONS = [
  "icerik",
  "ogretim",
  "materyal",
  "sinav",
  "is_yuku",
];

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
  // Sorunun ilgili olduğu müfredat konusu (anketin dersinin topics listesinden).
  // Eski anketler ve dersi olmayan anketler için boş kalabilir.
  topic: {
    type: String,
    default: "",
  },
  // Sorunun ölçtüğü değerlendirme boyutu; analizde konu × boyut kırılımı için.
  dimension: {
    type: String,
    enum: ["", ...QUESTION_DIMENSIONS],
    default: "",
  },
});

const surveySchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
    },
    // Öğrenciyle paylaşılan anket linkinde kullanılır (/anketler/:slug).
    // Sadece oluşturulurken üretilir; başlık sonradan değişse bile link
    // kırılmasın diye slug bir daha güncellenmez.
    slug: {
      type: String,
      unique: true,
      sparse: true,
    },
    description: {
      type: String,
      default: "",
    },
    // Opsiyonel: eski anketlerde ders bilgisi yok.
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
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
surveySchema.pre("validate", async function () {
  if (this.examDate && this.isModified("examDate")) {
    const { startDate, endDate } = computeSurveyWindow(this.examDate);
    this.startDate = startDate;
    this.endDate = endDate;
  }

  if (this.isNew && !this.slug) {
    const base = slugify(this.title);
    this.slug = await ensureUniqueSlug(this.constructor, base);
  }
});

// findByIdAndUpdate/findOneAndUpdate "save" hook'larını tetiklemediği için
// aynı hesaplama update yolunda da ayrıca uygulanır.
surveySchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate() || {};
  const examDate = update.examDate ?? update.$set?.examDate;

  if (examDate) {
    const { startDate, endDate } = computeSurveyWindow(examDate);
    if (!update.$set) update.$set = {};
    update.$set.startDate = startDate;
    update.$set.endDate = endDate;
  }
});

export default mongoose.model("Survey", surveySchema);

/* 
Survey Modeli
 - Title
 - slug (öğrenci linki için, oluşturulurken bir kere üretilir)
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