import Course from "../models/Course.js";
import AnalysisReport from "../models/AnalysisReport.js";
import { analyzeWithMl, MlServiceError } from "../services/mlClient.js";
import {
  buildAnalysisPayload,
  computeFingerprint,
  MIN_RESPONSES,
} from "../services/analysisPayload.js";

const findCourse = async (id, res) => {
  try {
    const course = await Course.findById(id).lean();
    if (!course) res.status(404).json({ message: "Ders bulunamadı." });
    return course;
  } catch {
    res.status(400).json({ message: "Geçersiz ders kimliği." });
    return null;
  }
};

const formatReport = (report, currentFingerprint) => ({
  report: {
    result: report.result,
    modelVersion: report.modelVersion,
    nResponses: report.nResponses,
    createdAt: report.updatedAt,
    stale: report.fingerprint !== currentFingerprint,
  },
});

export const getCourseAnalysis = async (req, res) => {
  const course = await findCourse(req.params.courseId, res);
  if (!course) return;

  try {
    const [report, fingerprint] = await Promise.all([
      AnalysisReport.findOne({ course: course._id }).lean(),
      computeFingerprint(course._id),
    ]);
    if (!report) return res.json({ report: null });
    res.json(formatReport(report, fingerprint));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Analiz getirilemedi." });
  }
};

export const runCourseAnalysis = async (req, res) => {
  const course = await findCourse(req.params.courseId, res);
  if (!course) return;

  try {
    const [payload, fingerprint] = await Promise.all([
      buildAnalysisPayload(course),
      computeFingerprint(course._id),
    ]);

    // Yetersiz veride ML servisi hiç çağrılmaz (KVKK + gereksiz istek)
    const result =
      payload.responses.length < MIN_RESPONSES
        ? {
            insufficient_data: true,
            n_responses: payload.responses.length,
            min_responses: MIN_RESPONSES,
          }
        : await analyzeWithMl(payload);

    const report = await AnalysisReport.findOneAndUpdate(
      { course: course._id },
      {
        result,
        modelVersion: result.model?.version ?? "",
        nResponses: payload.responses.length,
        fingerprint,
        createdBy: req.user._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    res.json(formatReport(report, fingerprint));
  } catch (error) {
    if (error instanceof MlServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: "Analiz çalıştırılamadı." });
  }
};

// Dersler listesinde her dersin son kararını göstermek için
export const getAnalysisSummary = async (req, res) => {
  try {
    const reports = await AnalysisReport.find()
      .select("course result.overall result.insufficient_data updatedAt")
      .lean();
    res.json(
      reports.map((r) => ({
        course: r.course,
        decision: r.result?.insufficient_data ? null : (r.result?.overall?.decision ?? null),
        flaggedTopics: r.result?.overall?.flagged_topics ?? [],
        insufficientData: Boolean(r.result?.insufficient_data),
        createdAt: r.updatedAt,
      })),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Analiz özeti getirilemedi." });
  }
};
