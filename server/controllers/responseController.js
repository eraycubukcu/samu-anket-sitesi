import Response from "../models/Response.js";
import Survey from "../models/Survey.js";

export const submitResponse = async (req, res) => {
  try {
    const { surveyId, answers } = req.body;

    // anket var mı ve aktif mi
    const survey = await Survey.findById(surveyId);

    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });

    const now = new Date();

    if (!survey.isActive || now < survey.startDate || now > survey.endDate)
      return res.status(400).json({ message: "Bu anket şuan aktif değil." });

    // daha önce cevap vermiş mi
    const existingResponse = await Response.findOne({
      survey: surveyId,
      user: req.user._id,
    });

    if (existingResponse)
      return res.status(400).json({ message: "Bu anketi zaten doldurdunuz." });

    // Zorunlu soruları kontrol et
    const requiredQuestions = survey.questions.filter((q) => q.required);

    for (const question of requiredQuestions) {
      const answer = answers.find(
        (a) => a.questionId === question._id.toString(),
      );

      if (!answer || !answer.answer) {
        return res.status(400).json({
          mesaj: `"${question.questionText}" sorusu zorunludur`,
        });
      }
    }

    const response = await Response.create({
      survey: surveyId,
      user: req.user._id,
      answers,
    });

    res.status(201).json({ message: "Cevaplarınız kaydedildi." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Cevaplar gönderilemedi", hata: error.message });
  }
};

export const getSurveyResults = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const survey = await Survey.findById(surveyId);
    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });

    const responses = await Response.find({ survey: surveyId })
      .populate("user", "email firstName lastName")
      .sort({ createdAt: -1 });

    // anketi toplam cevaplayan sayısı
    const totalResponses = responses.length;

    // Her soru için özet istatistik
    const summary = survey.questions.map((question) => {
      const questionAnswers = responses
        .map((r) =>
          r.answers.find(
            (a) => a.questionId.toString() === question._id.toString(),
          ),
        )
        .filter(Boolean);

      if (question.questionType === "text") {
        return {
          questionText: question.questionText,
          questionType: question.questionType,
          answers: questionAnswers.map((a) => a.answer),
        };
      }

      if (question.questionType === "rating") {
        const ratings = questionAnswers.map((a) => Number(a.answer));
        const average = ratings.length
          ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(2)
          : 0;

        return {
          questionText: question.questionText,
          questionType: question.questionType,
          average: Number(average),
          distribution: [1, 2, 3, 4, 5].map((star) => ({
            star,
            count: ratings.filter((r) => r === star).length,
          })),
        };
      }

      if (
        question.questionType === "radio" ||
        question.questionType === "checkbox"
      ) {
        const optionCounts = {};
        question.options.forEach((opt) => (optionCounts[opt] = 0));

        questionAnswers.forEach((a) => {
          if (Array.isArray(a.answer)) {
            a.answer.forEach((val) => {
              if (optionCounts[val] !== undefined) optionCounts[val]++;
            });
          } else {
            if (optionCounts[a.answer] !== undefined) optionCounts[a.answer]++;
          }
        });

        return {
          questionText: question.questionText,
          questionType: question.questionType,
          optionCounts,
        };
      }
    });

    res.json({
      survey: survey.title,
      totalResponses,
      summary,
      responses,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Anket sonuçları getirelemedi.", hata: error.message });
  }
};

export const getMyResponses = async (req, res) => {
  try {
    const responses = await Response.find({ user: req.user._id })
      .populate("survey", "title description")
      .sort({ createdAt: -1 });

    res.json(responses);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Cevaplar getirilemedi.", hata: error.message });
  }
};
