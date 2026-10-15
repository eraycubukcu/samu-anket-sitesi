import Course from "../models/Course.js";
import Survey from "../models/Survey.js";
import AnalysisReport from "../models/AnalysisReport.js";

const ALLOWED_COURSE_FIELDS = [
  "code",
  "name",
  "department",
  "term",
  "instructor",
  "topics",
];

const STRING_FIELDS = ["code", "name", "department", "term", "instructor"];

// İzinli alanları alır ve tiplerini kontrol eder (mass-assignment ve NoSQL
// injection koruması). Hata varsa { error } döner.
const pickCourseFields = (body = {}) => {
  const result = {};

  for (const field of ALLOWED_COURSE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = body[field];

    if (STRING_FIELDS.includes(field)) {
      if (typeof value !== "string") return { error: `"${field}" metin olmalıdır.` };
      result[field] = value.trim();
    }

    if (field === "topics") {
      if (!Array.isArray(value) || !value.every((t) => typeof t === "string")) {
        return { error: "Konular metin listesi olmalıdır." };
      }
      // Boşları at, tekrar edenleri birleştir
      result.topics = [...new Set(value.map((t) => t.trim()).filter(Boolean))];
    }
  }

  return { fields: result };
};

const DUPLICATE_MESSAGE = "Bu ders kodu bu dönem için zaten kayıtlı.";

export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find().sort({ term: -1, code: 1 }).lean();

    const counts = await Survey.aggregate([
      { $match: { course: { $ne: null } } },
      { $group: { _id: "$course", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

    res.json(
      courses.map((course) => ({
        ...course,
        surveyCount: countMap.get(course._id.toString()) ?? 0,
      })),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Dersler getirilemedi." });
  }
};

export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Ders bulunamadı." });
    res.json(course);
  } catch {
    res.status(400).json({ message: "Geçersiz ders kimliği." });
  }
};

export const createCourse = async (req, res) => {
  const { fields, error } = pickCourseFields(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const course = await Course.create({ ...fields, createdBy: req.user._id });
    res.status(201).json(course);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: DUPLICATE_MESSAGE });
    res.status(400).json({ message: "Ders oluşturulamadı.", hata: err.message });
  }
};

export const updateCourse = async (req, res) => {
  const { fields, error } = pickCourseFields(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    let course;
    try {
      course = await Course.findById(req.params.id);
    } catch {
      return res.status(400).json({ message: "Geçersiz ders kimliği." });
    }
    if (!course) return res.status(404).json({ message: "Ders bulunamadı." });

    // Anket sorularında kullanılan bir konu listeden çıkarılırsa o sorular
    // analizde sahipsiz kalır; bu yüzden engellenir.
    if (fields.topics) {
      const removedTopics = course.topics.filter((t) => !fields.topics.includes(t));
      if (removedTopics.length > 0) {
        const usedTopics = await Survey.distinct("questions.topic", {
          course: course._id,
          "questions.topic": { $in: removedTopics },
        });
        const blocked = removedTopics.filter((t) => usedTopics.includes(t));
        if (blocked.length > 0) {
          return res.status(400).json({
            message: `Şu konular anketlerde kullanıldığı için kaldırılamaz: ${blocked.join(", ")}`,
          });
        }
      }
    }

    course.set(fields);
    await course.save();
    res.json(course);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: DUPLICATE_MESSAGE });
    res.status(400).json({ message: "Ders güncellenemedi.", hata: err.message });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    let course;
    try {
      course = await Course.findById(req.params.id);
    } catch {
      return res.status(400).json({ message: "Geçersiz ders kimliği." });
    }
    if (!course) return res.status(404).json({ message: "Ders bulunamadı." });

    const surveyCount = await Survey.countDocuments({ course: course._id });
    if (surveyCount > 0) {
      return res.status(400).json({
        message: `Bu derse bağlı ${surveyCount} anket var. Önce anketleri silin veya başka bir derse taşıyın.`,
      });
    }

    await course.deleteOne();
    await AnalysisReport.deleteOne({ course: course._id });
    res.json(course);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Ders silinemedi." });
  }
};
