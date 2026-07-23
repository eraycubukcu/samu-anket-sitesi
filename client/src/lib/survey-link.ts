import { toast } from "sonner";

export const getSurveyLink = (surveyId: string) =>
  `${window.location.origin}/anketler/${surveyId}`;

export const copySurveyLink = async (surveyId: string) => {
  try {
    await navigator.clipboard.writeText(getSurveyLink(surveyId));
    toast.success("Anket linki kopyalandı.");
  } catch {
    toast.error("Link kopyalanamadı.");
  }
};
