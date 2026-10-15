// ml/data/generate_synthetic.py'nin ürettiği demo veri setini MongoDB'ye yükler.
// Tüm kayıtlar isDemo: true ile işaretlenir; script her çalıştığında önce eski
// demo kayıtlarını siler, gerçek kayıtlara dokunmaz.
//
//   npm run seed-demo            -> demo verisini sil + yeniden yükle
//   npm run seed-demo -- --clean -> sadece demo verisini sil
import dotenv from "dotenv";
import mongoose from "mongoose";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Survey from "../models/Survey.js";
import Response from "../models/Response.js";
import { computeSurveyWindow } from "../utils/surveySchedule.js";
import { slugify, ensureUniqueSlug } from "../utils/slug.js";
import { validateAnswersAgainstSurvey } from "../controllers/responseController.js";

dotenv.config();

const DATASET_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../ml/data/generated/demo_dataset.json",
);

const DEMO_FILTER = { isDemo: true };

// Mongoose şemalarında isDemo alanı yok (strict mode onu atar); bu yüzden
// kayıtlar doğrudan koleksiyonlara yazılır. Survey hook'larının yaptığı
// startDate/endDate ve slug hesabı burada elle yapılır.
const cleanDemoData = async () => {
  const [responses, surveys, courses, users] = await Promise.all([
    Response.collection.deleteMany(DEMO_FILTER),
    Survey.collection.deleteMany(DEMO_FILTER),
    Course.collection.deleteMany(DEMO_FILTER),
    User.collection.deleteMany(DEMO_FILTER),
  ]);
  console.log(
    `Silinen demo kayıtları: ${users.deletedCount} öğrenci, ${courses.deletedCount} ders, ` +
      `${surveys.deletedCount} anket, ${responses.deletedCount} cevap`,
  );
};

const loadDataset = async () => {
  try {
    return JSON.parse(await readFile(DATASET_PATH, "utf-8"));
  } catch {
    throw new Error(
      `Demo veri seti bulunamadı: ${DATASET_PATH}\n` +
        "Önce ml/ klasöründe çalıştırın: .venv\\Scripts\\python data/generate_synthetic.py",
    );
  }
};

// Tüm dokümanları hazırlar ve doğrular; DB'ye yazmaz. Hata olursa mevcut demo
// verisi silinmeden işlem durur.
const buildDemoDocs = (dataset, admin) => {
  const now = new Date();
  const stamp = (date = now) => ({ createdAt: date, updatedAt: date });

  // Öğrenciler
  const studentIds = new Map();
  const userDocs = dataset.students.map((s, i) => {
    const _id = new mongoose.Types.ObjectId();
    studentIds.set(s.key, _id);
    const no = String(i + 1).padStart(3, "0");
    return {
      _id,
      clerkId: `demo_${no}`,
      email: `demo.ogrenci${no}@samsun.edu.tr`,
      firstName: s.firstName,
      lastName: s.lastName,
      role: "student",
      isDemo: true,
      ...stamp(),
      __v: 0,
    };
  });

  // Dersler
  const courseIds = new Map();
  const courseDocs = dataset.courses.map(({ key, ...c }) => {
    const _id = new mongoose.Types.ObjectId();
    courseIds.set(key, _id);
    return { _id, ...c, createdBy: admin._id, isDemo: true, ...stamp(), __v: 0 };
  });

  // Anketler (soru key -> ObjectId eşlemesi cevaplar için saklanır)
  const surveyMeta = new Map();
  const surveyDocs = [];
  for (const s of dataset.surveys) {
    const _id = new mongoose.Types.ObjectId();
    const questionIds = new Map();
    const questions = s.questions.map(({ key, ...q }) => {
      const qid = new mongoose.Types.ObjectId();
      questionIds.set(key, qid);
      return { _id: qid, ...q };
    });
    const examDate = new Date(s.examDate);
    const { startDate, endDate } = computeSurveyWindow(examDate);
    const doc = {
      _id,
      title: s.title,
      description: s.description,
      course: courseIds.get(s.courseKey),
      questions,
      createdBy: admin._id,
      isActive: true,
      examDate,
      startDate,
      endDate,
      isDemo: true,
      ...stamp(new Date(examDate.getTime() - 7 * 24 * 60 * 60 * 1000)),
      __v: 0,
    };
    surveyDocs.push(doc);
    surveyMeta.set(s.key, { doc, questionIds });
  }

  // Cevaplar: gerçek API ile aynı doğrulamadan geçirilir
  const responseDocs = dataset.responses.map((r, i) => {
    const { doc: survey, questionIds } = surveyMeta.get(r.surveyKey);
    const answers = r.answers.map((a) => ({
      questionId: questionIds.get(a.questionKey).toString(),
      answer: a.answer,
    }));

    const validationError = validateAnswersAgainstSurvey(survey, answers);
    if (validationError) {
      throw new Error(`Geçersiz demo cevabı (#${i}, ${survey.title}): ${validationError}`);
    }

    const createdAt = new Date(r.createdAt);
    return {
      survey: survey._id,
      user: studentIds.get(r.studentKey),
      answers: answers.map((a) => ({
        _id: new mongoose.Types.ObjectId(),
        questionId: new mongoose.Types.ObjectId(a.questionId),
        answer: a.answer,
      })),
      isDemo: true,
      ...stamp(createdAt),
      __v: 0,
    };
  });

  return { userDocs, courseDocs, surveyDocs, responseDocs };
};

const insertDemoDocs = async ({ userDocs, courseDocs, surveyDocs, responseDocs }) => {
  // Slug, eski demo anketleri silindikten sonra hesaplanır ki gereksiz -2 eki almasın
  for (const doc of surveyDocs) {
    doc.slug = await ensureUniqueSlug(Survey, slugify(doc.title));
  }

  await User.collection.insertMany(userDocs);
  await Course.collection.insertMany(courseDocs);
  await Survey.collection.insertMany(surveyDocs);
  await Response.collection.insertMany(responseDocs);

  console.log(
    `Yüklenen demo verisi: ${userDocs.length} öğrenci, ${courseDocs.length} ders, ` +
      `${surveyDocs.length} anket, ${responseDocs.length} cevap`,
  );
};

const main = async () => {
  const cleanOnly = process.argv.includes("--clean");
  try {
    // Veri seti bağlantıdan önce okunur ki dosya yoksa DB'ye hiç dokunulmasın
    const dataset = cleanOnly ? null : await loadDataset();

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDb bağlantısı başarılı.");

    const admin = await User.findOne({ role: "admin" });
    if (!cleanOnly && !admin) {
      throw new Error("Admin kullanıcısı yok. Önce `npm run seed` çalıştırın.");
    }

    const docs = cleanOnly ? null : buildDemoDocs(dataset, admin);

    await cleanDemoData();
    if (docs) await insertDemoDocs(docs);

    process.exit(0);
  } catch (error) {
    console.error("Hata : " + error.message);
    process.exit(1);
  }
};

main();
