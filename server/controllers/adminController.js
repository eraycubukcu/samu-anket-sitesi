import Survey from "../models/Survey.js";
import Response from "../models/Response.js";
import User from "../models/User.js";

export const getDashboardStats = async (req, res) => {
  try {
    const totalSurveys = await Survey.countDocuments();
    const activeSurveys = await Survey.countDocuments({ isActive: true });
    const totalResponses = await Response.countDocuments();
    const totalStudents = await User.countDocuments({ role: "student" });

    const recentSurveys = await Survey.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title isActive createdAt");

    const surveysWithCounts = await Promise.all(
      recentSurveys.map(async (survey) => {
        const count = await Response.countDocuments({ survey: survey._id });
        return {
          _id: survey._id,
          title: survey.title,
          isActive: survey.isActive,
          createdAt: survey.createdAt,
          responseCount: count,
        };
      })
    );

    res.json({
      totalSurveys,
      activeSurveys,
      totalResponses,
      totalStudents,
      recentSurveys: surveysWithCounts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mesaj: "İstatistikler getirilemedi" });
  }
};