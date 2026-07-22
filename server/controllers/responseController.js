import ExcelJS from "exceljs";
import Response from "../models/Response.js";
import Survey from "../models/Survey.js";

// Bir cevabın, ait olduğu sorunun tipine uygun olup olmadığını kontrol eder.
const validateAnswer = (question, answerValue) => {
  switch (question.questionType) {
    case "text":
      if (typeof answerValue !== "string" || !answerValue.trim()) {
        return `"${question.questionText}" cevabı metin olmalıdır.`;
      }
      return null;

    case "rating": {
      const num = Number(answerValue);
      if (!Number.isInteger(num) || num < 1 || num > 5) {
        return `"${question.questionText}" cevabı 1-5 arasında bir sayı olmalıdır.`;
      }
      return null;
    }

    case "radio":
      if (typeof answerValue !== "string" || !question.options.includes(answerValue)) {
        return `"${question.questionText}" için geçersiz seçenek.`;
      }
      return null;

    case "checkbox":
      if (
        !Array.isArray(answerValue) ||
        answerValue.length === 0 ||
        !answerValue.every((val) => question.options.includes(val))
      ) {
        return `"${question.questionText}" için geçersiz seçenek(ler).`;
      }
      return null;

    default:
      return null;
  }
};

export const submitResponse = async (req, res) => {
  try {
    const { surveyId, answers } = req.body;

    if (typeof surveyId !== "string" || !surveyId.trim()) {
      return res.status(400).json({ message: "Geçersiz anket kimliği." });
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "Cevaplar gerekli." });
    }

    const validFormat = answers.every(
      (a) =>
        a &&
        typeof a === "object" &&
        typeof a.questionId === "string" &&
        a.answer !== undefined,
    );

    if (!validFormat) {
      return res.status(400).json({ message: "Cevap formatı geçersiz." });
    }

    // anket var mı ve aktif mi
    let survey;
    try {
      survey = await Survey.findById(surveyId);
    } catch {
      return res.status(400).json({ message: "Geçersiz anket kimliği." });
    }

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

    // Ankete ait olmayan bir soruya cevap gönderilmiş mi
    const questionIds = new Set(survey.questions.map((q) => q._id.toString()));
    const hasUnknownQuestion = answers.some((a) => !questionIds.has(a.questionId));
    if (hasUnknownQuestion) {
      return res.status(400).json({ message: "Geçersiz soru içeren cevap gönderildi." });
    }

    // Her soru için: zorunluysa dolu mu, doluysa tipine uygun mu
    for (const question of survey.questions) {
      const answerEntry = answers.find(
        (a) => a.questionId === question._id.toString(),
      );

      const isEmpty =
        !answerEntry ||
        answerEntry.answer === "" ||
        answerEntry.answer === null ||
        (Array.isArray(answerEntry.answer) && answerEntry.answer.length === 0);

      if (isEmpty) {
        if (question.required) {
          return res.status(400).json({
            mesaj: `"${question.questionText}" sorusu zorunludur`,
          });
        }
        continue;
      }

      const validationError = validateAnswer(question, answerEntry.answer);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }
    }

    await Response.create({
      survey: surveyId,
      user: req.user._id,
      answers,
    });

    res.status(201).json({ message: "Cevaplarınız kaydedildi." });
  } catch (error) {
    // Eşzamanlı çift gönderim, unique index tarafından yakalanır
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "Bu anketi zaten doldurdunuz." });
    }
    console.error(error);
    res.status(500).json({ message: "Cevaplar gönderilemedi" });
  }
};

// Anketteki her soru için özet istatistik üretir. getSurveyResults ve
// Excel export tarafından ortak kullanılır.
const buildSurveySummary = (survey, responses) => {
  return survey.questions.map((question) => {
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

    return {
      questionText: question.questionText,
      questionType: question.questionType,
    };
  });
};

export const getSurveyResults = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const survey = await Survey.findById(surveyId);
    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });

    const responses = await Response.find({ survey: surveyId })
      .populate("user", "email firstName lastName")
      .sort({ createdAt: -1 });

    res.json({
      survey: survey.title,
      totalResponses: responses.length,
      summary: buildSurveySummary(survey, responses),
      responses,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Anket sonuçları getirelemedi." });
  }
};

export const getMyResponses = async (req, res) => {
  try {
    const responses = await Response.find({ user: req.user._id })
      .populate("survey", "title description")
      .sort({ createdAt: -1 });

    res.json(responses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Cevaplar getirilemedi." });
  }
};

export const exportSurveyResults = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const survey = await Survey.findById(surveyId);
    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });

    const responses = await Response.find({ survey: surveyId })
      .populate("user", "email firstName lastName")
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();

    // Cevaplar sayfası: her satır bir öğrencinin cevapları
    const responsesSheet = workbook.addWorksheet("Cevaplar");
    responsesSheet.columns = [
      { header: "Ad Soyad", key: "name", width: 25 },
      { header: "E-posta", key: "email", width: 30 },
      { header: "Gönderim Tarihi", key: "date", width: 20 },
      ...survey.questions.map((q) => ({
        header: q.questionText,
        key: q._id.toString(),
        width: 30,
      })),
    ];

    responses.forEach((r) => {
      const row = {
        name: `${r.user?.firstName || ""} ${r.user?.lastName || ""}`.trim(),
        email: r.user?.email || "",
        date: r.createdAt.toLocaleString("tr-TR"),
      };

      survey.questions.forEach((q) => {
        const answerEntry = r.answers.find(
          (a) => a.questionId.toString() === q._id.toString(),
        );
        let value = answerEntry?.answer ?? "";
        if (Array.isArray(value)) value = value.join(", ");
        row[q._id.toString()] = value;
      });

      responsesSheet.addRow(row);
    });

    // Özet sayfası: soru bazlı istatistikler
    const summary = buildSurveySummary(survey, responses);
    const summarySheet = workbook.addWorksheet("Özet");
    summarySheet.columns = [
      { header: "Soru", key: "question", width: 40 },
      { header: "Tip", key: "type", width: 15 },
      { header: "Detay", key: "detail", width: 70 },
    ];

    summary.forEach((s) => {
      let detail = "";
      if (s.questionType === "rating") {
        detail = `Ortalama: ${s.average} | ${s.distribution
          .map((d) => `${d.star}★:${d.count}`)
          .join(", ")}`;
      } else if (s.questionType === "radio" || s.questionType === "checkbox") {
        detail = Object.entries(s.optionCounts)
          .map(([opt, count]) => `${opt}: ${count}`)
          .join(", ");
      } else if (s.questionType === "text") {
        detail = `${s.answers.length} cevap`;
      }
      summarySheet.addRow({ question: s.questionText, type: s.questionType, detail });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="anket-sonuclari-${survey._id}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Excel dosyası oluşturulamadı." });
  }
};
