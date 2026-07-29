import mongoose from "mongoose";
import Survey from "../models/Survey.js";
import Response from "../models/Response.js";

// Admin isteğinden sadece izin verilen alanlar alınır (mass-assignment koruması).
// Body'de bulunmayan alanlar sonuca dahil edilmez ki kısmi update (ör. sadece
// isActive) diğer alanları undefined ile ezmesin.
// startDate/endDate bilinçli olarak listede yok: bunlar examDate'ten
// otomatik hesaplanır (bkz. models/Survey.js), admin doğrudan set edemez.
const ALLOWED_SURVEY_FIELDS = [
  "title",
  "description",
  "questions",
  "isActive",
  "examDate",
];

const pickSurveyFields = (body = {}) => {
  const result = {};
  for (const field of ALLOWED_SURVEY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }
  return result;
};

export const createSurvey = async (req, res) => {
  try {
    const survey = await Survey.create({
      ...pickSurveyFields(req.body),
      createdBy: req.user._id,
    });
    res.status(201).json(survey);
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "Bu başlıkta bir anket zaten var, farklı bir başlık seçin." });
    }
    res.status(400).json({ message: "Anket oluşturulamadı.", hata: error.message });
  }
};

export const getAllSurveys = async (req, res) => {
  try {
    const surveys = await Survey.find().sort({ createdAt: -1 });
    res.json(surveys);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Anket getirilemedi." });
  }
};

export const getSurveyById = async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });
    res.json(survey);
  } catch (error) {
    res.status(400).json({ message: "Geçersiz anket kimliği." });
  }
};

// Öğrenci tarafı: anket sadece aktif ve zaman penceresi içindeyse görünür.
// Bu sayede henüz açılmamış/süresi dolmuş bir anketin soruları ID bilinerek
// önceden görüntülenemez.
export const getSurveyForStudent = async (req, res) => {
  try {
    const now = new Date();
    const survey = await Survey.findOne({
      slug: req.params.slug,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    if (!survey)
      return res
        .status(404)
        .json({ message: "Anket bulunamadı veya şu anda aktif değil." });

    res.json(survey);
  } catch (error) {
    res.status(400).json({ message: "Anket getirilemedi." });
  }
};

export const deleteSurvey = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let survey;
    await session.withTransaction(async () => {
      survey = await Survey.findByIdAndDelete(req.params.id).session(session);
      if (!survey) return;
      // Anket silinince ona ait cevaplar da silinir, yetim kayıt kalmaz
      await Response.deleteMany({ survey: survey._id }).session(session);
    });

    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });
    res.json(survey);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Anket silinemedi." });
  } finally {
    session.endSession();
  }
};

export const updateSurvey = async (req, res) => {
  try {
    const existingSurvey = await Survey.findById(req.params.id);
    if (!existingSurvey) {
      return res.status(404).json({ message: "Anket bulunamadı." });
    }

    // Anket, bitiş tarihine kadar güncellenebilir; bitiş tarihi geçtiyse
    // artık tarihsel bir kayıt olduğu için düzenlemeye kapatılır.
    if (existingSurvey.endDate && new Date() > existingSurvey.endDate) {
      return res.status(400).json({
        message: "Anketin bitiş tarihi geçtiği için artık güncellenemez.",
      });
    }

    const fields = pickSurveyFields(req.body);

    const survey = await Survey.findByIdAndUpdate(req.params.id, fields, {
      new: true, // güncellenmiş halini gönderir
      runValidators: true, // güncelleme sırasında şemasını kurallarını kontrol eder
    });

    res.json(survey);
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "Bu başlıkta bir anket zaten var, farklı bir başlık seçin." });
    }
    res.status(400).json({ message: "Anket güncellenemedi.", hata: error.message });
  }
};

export const getActiveSurveys = async (req, res) => {
  try {
    const now = new Date();

    const surveys = await Survey.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    res.json(surveys);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mesaj: "Anketler getirilemedi" });
  }
};
