import Survey from "../models/Survey.js";

export const createSurvey = async (req, res) => {
  try {
    const survey = await Survey.crete({
      ...req.body,
      createdBy: req.user._id,
    });
    res.status(201).json(survey);
  } catch (err) {
    res
      .status(400)
      .json({ message: "Anket oluşturulamadı.", hata: error.message });
  }
};

export const getAllSurveys = async (req, res) => {
  try {
    const surveys = await Survey.find().sort({ createdAt: -1 });
    res.json(surveys);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Anket getirilemedi.", hata: error.message });
  }
};

export const getSurveyById = async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });
    res.json(survey);
  } catch (error) {
    res.status(500).json({ message: "Anketler getirilemedi." });
  }
};

export const deleteSurvey = async (req, res) => {
  try {
    const survey = await Survey.findByIdAndDelete(req.params.id);
    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });
    res.json(survey);
  } catch (error) {
    res.status(500).json({ message: "Anket silinemedi.", hata: error.message });
  }
};
export const updateSurvey = async (req, res) => {
  try {
    const survey = await Survey.findByIdAndUpdate(req.params.id, req.body, {
      new: true, // güncellenmiş halini gönderir
      runValidators: true, // güncelleme sırasında şemasını kurallarını kontrol eder
    });

    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });
    res.json(survey);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Anket güncellenemedi.", hata: error.message });
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
    res
      .status(500)
      .json({ mesaj: "Anketler getirilemedi", hata: error.message });
  }
};
