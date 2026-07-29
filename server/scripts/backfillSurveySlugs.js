// Slug alanı sonradan eklendiği için mevcut anketlerde slug boş olabilir.
// Bu script slug'ı olmayan anketleri bulup başlıktan bir kereye mahsus üretir.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Survey from "../models/Survey.js";
import { slugify, ensureUniqueSlug } from "../utils/slug.js";

dotenv.config();

const backfillSurveySlugs = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDb bağlantısı başarılı.");

    const surveys = await Survey.find({
      $or: [{ slug: { $exists: false } }, { slug: null }],
    });

    if (surveys.length === 0) {
      console.log("Slug eksik anket yok.");
      process.exit(0);
    }

    for (const survey of surveys) {
      const base = slugify(survey.title);
      survey.slug = await ensureUniqueSlug(Survey, base, survey._id);
      await survey.save({ validateModifiedOnly: true });
      console.log(`"${survey.title}" -> ${survey.slug}`);
    }

    console.log(`${surveys.length} anket güncellendi.`);
    process.exit(0);
  } catch (error) {
    console.error("Hata : " + error.message);
    process.exit(1);
  }
};

backfillSurveySlugs();
