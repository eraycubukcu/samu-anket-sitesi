import mongoose from "mongoose";
import Survey from "../models/Survey.js";
import Response from "../models/Response.js";
import Course from "../models/Course.js";

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
  "course",
];

const pickSurveyFields = (body = {}) => {
  const result = {};
  for (const field of ALLOWED_SURVEY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }
  // "Ders yok" seçimi boş string olarak gelebilir
  if (result.course === "") result.course = null;
  return result;
};

// Anketin dersi ve soruların müfredat konuları birbiriyle tutarlı mı kontrol
// eder. Update'te body'de olmayan alan için mevcut anketteki değer kullanılır.
// Hata varsa mesajını döner.
const validateCourseAndTopics = async (fields, existingSurvey) => {
  const has = (key) => Object.prototype.hasOwnProperty.call(fields, key);
  const courseId = has("course") ? fields.course : existingSurvey?.course ?? null;
  const questions = has("questions") ? fields.questions : existingSurvey?.questions ?? [];

  if (has("course") && fields.course !== null && typeof fields.course !== "string") {
    return "Geçersiz ders kimliği.";
  }

  if (!Array.isArray(questions)) return null; // şema doğrulaması yakalar

  const topics = questions.map((q) => q?.topic).filter((t) => t !== undefined && t !== "");
  if (topics.some((t) => typeof t !== "string")) return "Soru konusu metin olmalıdır.";

  if (!courseId) {
    return topics.length > 0 ? "Müfredat konusu seçmek için önce anketin dersi seçilmelidir." : null;
  }

  let course;
  try {
    course = await Course.findById(courseId);
  } catch {
    return "Geçersiz ders kimliği.";
  }
  if (!course) return "Seçilen ders bulunamadı.";

  const invalid = topics.filter((t) => !course.topics.includes(t));
  if (invalid.length > 0) {
    return `Şu konular seçilen dersin müfredatında yok: ${[...new Set(invalid)].join(", ")}`;
  }
  return null;
};

export const createSurvey = async (req, res) => {
  try {
    const fields = pickSurveyFields(req.body);
    const courseError = await validateCourseAndTopics(fields);
    if (courseError) return res.status(400).json({ message: courseError });

    const survey = await Survey.create({
      ...fields,
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
    const surveys = await Survey.find()
      .populate("course", "code name term")
      .sort({ createdAt: -1 });
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
    const courseError = await validateCourseAndTopics(fields, existingSurvey);
    if (courseError) return res.status(400).json({ message: courseError });

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
