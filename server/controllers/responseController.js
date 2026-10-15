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

// Cevap listesinin formatını ve ankete uygunluğunu kontrol eder.
// submitResponse ve updateResponse arasında ortak kullanılır.
export const validateAnswersAgainstSurvey = (survey, answers) => {
  if (!Array.isArray(answers) || answers.length === 0) {
    return "Cevaplar gerekli.";
  }

  const validFormat = answers.every(
    (a) =>
      a &&
      typeof a === "object" &&
      typeof a.questionId === "string" &&
      a.answer !== undefined,
  );

  if (!validFormat) {
    return "Cevap formatı geçersiz.";
  }

  const questionIds = new Set(survey.questions.map((q) => q._id.toString()));
  const hasUnknownQuestion = answers.some((a) => !questionIds.has(a.questionId));
  if (hasUnknownQuestion) {
    return "Geçersiz soru içeren cevap gönderildi.";
  }

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
        return `"${question.questionText}" sorusu zorunludur`;
      }
      continue;
    }

    const validationError = validateAnswer(question, answerEntry.answer);
    if (validationError) {
      return validationError;
    }
  }

  return null;
};

const isSurveyWindowOpen = (survey) => {
  const now = new Date();
  return survey.isActive && now >= survey.startDate && now <= survey.endDate;
};

export const submitResponse = async (req, res) => {
  try {
    const { surveyId, answers } = req.body;

    if (typeof surveyId !== "string" || !surveyId.trim()) {
      return res.status(400).json({ message: "Geçersiz anket kimliği." });
    }

    // anket var mı ve aktif mi
    let survey;
    try {
      survey = await Survey.findById(surveyId);
    } catch {
      return res.status(400).json({ message: "Geçersiz anket kimliği." });
    }

    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });

    if (!isSurveyWindowOpen(survey))
      return res.status(400).json({ message: "Bu anket şuan aktif değil." });

    // daha önce cevap vermiş mi
    const existingResponse = await Response.findOne({
      survey: surveyId,
      user: req.user._id,
    });

    if (existingResponse)
      return res.status(400).json({ message: "Bu anketi zaten doldurdunuz." });

    const validationError = validateAnswersAgainstSurvey(survey, answers);
    if (validationError) {
      return res.status(400).json({ message: validationError });
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

// Öğrenci, anket süresi bitmeden önce kendi cevabını güncelleyebilir.
export const updateResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;

    let response;
    try {
      response = await Response.findById(id);
    } catch {
      return res.status(400).json({ message: "Geçersiz cevap kimliği." });
    }

    if (!response) return res.status(404).json({ message: "Cevap bulunamadı." });

    if (response.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Bu cevabı düzenleme yetkiniz yok." });
    }

    const survey = await Survey.findById(response.survey);
    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });

    if (!isSurveyWindowOpen(survey))
      return res
        .status(400)
        .json({ message: "Bu anketin süresi doldu, cevaplar artık düzenlenemez." });

    const validationError = validateAnswersAgainstSurvey(survey, answers);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    response.answers = answers;
    await response.save();

    res.json({ message: "Cevaplarınız güncellendi." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Cevaplar güncellenemedi." });
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
      .populate("survey", "title slug description isActive startDate endDate")
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

    // Serbest metin sorular (açık uçlu yorumlar) Excel çıktısına dahil
    // edilmez - sadece puanlama ve çoktan seçmeli sorular raporlanır.
    const exportableQuestions = survey.questions.filter(
      (q) => q.questionType !== "text",
    );

    // Cevaplar sayfası: her satır bir cevap. Anonimlik için öğrenci kimliği
    // (ad soyad, e-posta) maskelenir - kimin ne yazdığı belli olmasın.
    const responsesSheet = workbook.addWorksheet("Cevaplar");
    responsesSheet.columns = [
      { header: "Ad Soyad", key: "name", width: 25 },
      { header: "E-posta", key: "email", width: 30 },
      { header: "Gönderim Tarihi", key: "date", width: 20 },
      ...exportableQuestions.map((q) => ({
        header: q.questionText,
        key: q._id.toString(),
        width: 30,
      })),
    ];

    responses.forEach((r) => {
      const row = {
        name: "**",
        email: "**",
        date: r.createdAt.toLocaleString("tr-TR"),
      };

      exportableQuestions.forEach((q) => {
        const answerEntry = r.answers.find(
          (a) => a.questionId.toString() === q._id.toString(),
        );
        let value = answerEntry?.answer ?? "";
        if (Array.isArray(value)) value = value.join(", ");
        row[q._id.toString()] = value;
      });

      responsesSheet.addRow(row);
    });

    // Özet sayfası: her seçenek/değer için ayrı satır + Excel'in yerleşik
    // "data bar" koşullu biçimlendirmesiyle görsel çubuk grafik.
    const summary = buildSurveySummary(survey, responses).filter(
      (s) => s.questionType !== "text",
    );
    const summarySheet = workbook.addWorksheet("Özet");
    summarySheet.columns = [
      { header: "Soru", key: "question", width: 40 },
      { header: "Seçenek / Değer", key: "option", width: 25 },
      { header: "Cevap Sayısı", key: "count", width: 15 },
      { header: "Oran", key: "percent", width: 12 },
    ];

    const total = responses.length;

    summary.forEach((s) => {
      if (s.questionType === "rating") {
        [1, 2, 3, 4, 5].forEach((star) => {
          const found = s.distribution.find((d) => d.star === star);
          const count = found ? found.count : 0;
          const row = summarySheet.addRow({
            question: s.questionText,
            option: `${star} Yıldız`,
            count,
            percent: total ? count / total : 0,
          });
          row.getCell("percent").numFmt = "0%";
        });
      } else if (s.questionType === "radio" || s.questionType === "checkbox") {
        Object.entries(s.optionCounts).forEach(([option, count]) => {
          const row = summarySheet.addRow({
            question: s.questionText,
            option,
            count,
            percent: total ? count / total : 0,
          });
          row.getCell("percent").numFmt = "0%";
        });
      }
    });

    if (summarySheet.rowCount > 1) {
      summarySheet.addConditionalFormatting({
        ref: `C2:C${summarySheet.rowCount}`,
        rules: [
          {
            type: "dataBar",
            cfvo: [{ type: "min" }, { type: "max" }],
            color: { argb: "FF638EC6" },
          },
        ],
      });
    }

    const filenameBase = `${survey.title} sonuçları`
      .replace(/[\r\n\\/:*?"<>|]/g, "")
      .trim();
    const asciiFallback = filenameBase.replace(/[^\x20-\x7E]/g, "_");

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiFallback}.xlsx"; filename*=UTF-8''${encodeURIComponent(filenameBase)}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Excel dosyası oluşturulamadı." });
  }
};
