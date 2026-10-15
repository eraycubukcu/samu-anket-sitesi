import mongoose from "mongoose";

const courseSchema = mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      default: "",
      trim: true,
    },
    // Ör. "2026-Güz". Aynı ders farklı dönemlerde ayrı kayıt olarak tutulur ki
    // dönemler arası karşılaştırma (trend analizi) yapılabilsin.
    term: {
      type: String,
      required: true,
      trim: true,
    },
    instructor: {
      type: String,
      default: "",
      trim: true,
    },
    // Müfredat konuları. Anket soruları bu listeden bir konuya bağlanır.
    topics: {
      type: [String],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "En az bir müfredat konusu girilmelidir.",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Aynı ders aynı dönemde iki kez açılamaz
courseSchema.index({ code: 1, term: 1 }, { unique: true });

export default mongoose.model("Course", courseSchema);

/*
Course Modeli
 - code (BIL301), name, department, term (2026-Güz), instructor
 - topics -> müfredat konuları, soruların "topic" alanı buradan seçilir
*/
