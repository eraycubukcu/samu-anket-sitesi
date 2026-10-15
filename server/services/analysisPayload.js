import crypto from "node:crypto";
import mongoose from "mongoose";
import Course from "../models/Course.js";
import Survey from "../models/Survey.js";
import Response from "../models/Response.js";

// KVKK: bu sayının altında cevabı olan derslerin analizi yapılmaz (ML servisiyle aynı)
export const MIN_RESPONSES = 5;

// Öğrenci kimliği ML servisine hiç gitmez; aynı öğrenciyi ayırt etmeye yetecek
// kadar tek yönlü bir özet gönderilir.
const hashRespondent = (userId) =>
  crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(userId.toString())
    .digest("hex")
    .slice(0, 16);

const toQuestion = (q) => ({
  id: q._id.toString(),
  type: q.questionType,
  topic: q.topic || "",
  dimension: q.dimension || "",
  options: q.options || [],
});

// İlgili tüm derslerin anket ve cevaplarını tek seferde yükler (3 sorgu).
// Ders başına ayrı sorgu atmak, uzak veritabanında her sorgu gecikmesi
// eklendiği için analizi onlarca saniyeye çıkarıyordu.
const loadTermDataBulk = async (courseIds) => {
  const surveys = await Survey.find({ course: { $in: courseIds } })
    .select("course examDate questions._id questions.questionType questions.topic questions.dimension questions.options")
    .lean();
  // Sadece gereken alanlar çekilir (cevap başına _id vb. aktarılmaz)
  const responses = await Response.find({ survey: { $in: surveys.map((s) => s._id) } })
    .select("survey user answers.questionId answers.answer -_id")
    .lean();

  const courseOfSurvey = new Map(surveys.map((s) => [s._id.toString(), s.course.toString()]));
  const byCourse = new Map(
    courseIds.map((id) => [id.toString(), { surveys: [], questions: [], responses: [] }]),
  );

  for (const survey of surveys) {
    const data = byCourse.get(survey.course.toString());
    data.surveys.push(survey);
    data.questions.push(...survey.questions.map(toQuestion));
  }
  for (const r of responses) {
    byCourse.get(courseOfSurvey.get(r.survey.toString())).responses.push({
      respondent: hashRespondent(r.user),
      answers: Object.fromEntries(r.answers.map((a) => [a.questionId.toString(), a.answer])),
    });
  }
  return byCourse;
};

const earliestExamDate = (surveys) =>
  surveys.reduce((min, s) => (s.examDate && s.examDate < min ? s.examDate : min), new Date(8.64e15));

// Aynı dönemdeki diğer derslerin boyut bazında ortalama puanları (benchmark).
// Toplama MongoDB'de yapılır: tüm cevapları Node'a çekmek yerine soru başına
// tek bir {toplam, adet} satırı gelir; ders sayısı artınca da ölçeklenir.
const computeBenchmarks = async (courseIds) => {
  if (courseIds.length === 0) return {};

  const surveys = await Survey.find({ course: { $in: courseIds } })
    .select("course questions._id questions.questionType questions.dimension")
    .lean();
  const ratingQuestions = new Map();
  for (const survey of surveys) {
    for (const q of survey.questions) {
      if (q.questionType === "rating" && q.dimension) {
        ratingQuestions.set(q._id.toString(), { course: survey.course.toString(), dim: q.dimension });
      }
    }
  }
  if (ratingQuestions.size === 0) return {};

  // Puan sayı veya "4" gibi metin olarak kaydedilmiş olabilir
  const asNumber = {
    $convert: { input: "$answers.answer", to: "double", onError: null, onNull: null },
  };
  const rows = await Response.aggregate([
    { $match: { survey: { $in: surveys.map((s) => s._id) } } },
    { $unwind: "$answers" },
    {
      $match: {
        "answers.questionId": {
          $in: [...ratingQuestions.keys()].map((id) => new mongoose.Types.ObjectId(id)),
        },
      },
    },
    { $project: { questionId: "$answers.questionId", value: asNumber } },
    { $match: { value: { $ne: null } } },
    { $group: { _id: "$questionId", total: { $sum: "$value" }, count: { $sum: 1 } } },
  ]);

  // Soru toplamlarını ders × boyut ortalamasına çevir
  const sums = new Map();
  for (const row of rows) {
    const { course, dim } = ratingQuestions.get(row._id.toString());
    const key = `${course}|${dim}`;
    const acc = sums.get(key) ?? { dim, total: 0, count: 0 };
    acc.total += row.total;
    acc.count += row.count;
    sums.set(key, acc);
  }

  const benchmarks = {};
  for (const { dim, total, count } of sums.values()) {
    (benchmarks[dim] ??= []).push(Number((total / count).toFixed(3)));
  }
  return benchmarks;
};

// Ders verisinin özeti: cevap eklenir/güncellenirse değişir
export const computeFingerprint = async (courseId) => {
  const surveyIds = await Survey.find({ course: courseId }).distinct("_id");
  const [stats] = await Response.aggregate([
    { $match: { survey: { $in: surveyIds } } },
    { $group: { _id: null, count: { $sum: 1 }, last: { $max: "$updatedAt" } } },
  ]);
  return `${surveyIds.length}:${stats?.count ?? 0}:${stats?.last?.toISOString() ?? "-"}`;
};

// ML servisinin /analyze isteğini hazırlar. Sözleşme: docs/specs/faz-3-ml-servisi.md
export const buildAnalysisPayload = async (course) => {
  // Önceki dönemler (aynı ders kodu) ve benchmark (aynı dönem) için gereken dersler
  const related = await Course.find({
    _id: { $ne: course._id },
    $or: [{ code: course.code }, { term: course.term }],
  }).lean();

  const sameCode = related.filter((c) => c.code === course.code);
  const sameTerm = related.filter((c) => c.term === course.term && c.code !== course.code);

  const [termData, benchmarks] = await Promise.all([
    loadTermDataBulk([course._id, ...sameCode.map((c) => c._id)]),
    computeBenchmarks(sameTerm.map((c) => c._id)),
  ]);
  const current = termData.get(course._id.toString());
  const currentStart = earliestExamDate(current.surveys);

  // Önceki dönemler: aynı ders kodu, anketleri bu dönemden önce yapılmış olanlar
  const previous = sameCode
    .map((c) => ({ term: c.term, ...termData.get(c._id.toString()) }))
    .map((p) => ({ ...p, start: earliestExamDate(p.surveys) }))
    .filter((p) => p.responses.length > 0 && p.start < currentStart)
    .sort((a, b) => a.start - b.start);

  return {
    course: { code: course.code, name: course.name, term: course.term, topics: course.topics },
    questions: current.questions,
    responses: current.responses,
    previous_terms: previous.map(({ term, questions, responses }) => ({ term, questions, responses })),
    benchmarks,
  };
};
