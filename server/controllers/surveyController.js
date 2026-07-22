import Survey from "../models/Survey.js";

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

export const deleteSurvey = async (req, res) => {
  try {
    const survey = await Survey.findByIdAndDelete(req.params.id);
    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });
    res.json(survey);
  } catch (error) {
    res.status(400).json({ message: "Geçersiz anket kimliği." });
  }
};

export const updateSurvey = async (req, res) => {
  try {
    const survey = await Survey.findByIdAndUpdate(
      req.params.id,
      pickSurveyFields(req.body),
      {
        new: true, // güncellenmiş halini gönderir
        runValidators: true, // güncelleme sırasında şemasını kurallarını kontrol eder
      },
    );

    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });
    res.json(survey);
  } catch (error) {
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
