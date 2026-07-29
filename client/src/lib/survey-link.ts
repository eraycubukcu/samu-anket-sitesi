import { toast } from "sonner";

export const getSurveyLink = (surveySlug: string) =>
  `${window.location.origin}/anketler/${surveySlug}`;

export const copySurveyLink = async (surveySlug: string) => {
  try {
    await navigator.clipboard.writeText(getSurveyLink(surveySlug));
    toast.success("Anket linki kopyalandı.");
  } catch {
    toast.error("Link kopyalanamadı.");
  }
};
