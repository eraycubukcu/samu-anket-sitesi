export type QuestionType = "radio" | "text" | "checkbox" | "rating";

export type QuestionDimension = "icerik" | "ogretim" | "materyal" | "sinav" | "is_yuku";

export interface Question {
  _id?: string;
  questionText: string;
  questionType: QuestionType;
  options: string[];
  required: boolean;
  // Müfredat konusu ve değerlendirme boyutu; boş string = seçilmedi
  topic?: string;
  dimension?: QuestionDimension | "";
}

export interface Course {
  _id: string;
  code: string;
  name: string;
  department: string;
  term: string;
  instructor: string;
  topics: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CourseListItem extends Course {
  surveyCount: number;
}

export type CourseRef = Pick<Course, "_id" | "code" | "name" | "term">;

export interface Survey {
  _id: string;
  slug: string;
  title: string;
  description: string;
  // Tekil getirmede id, listede populate edilmiş ders bilgisi gelir
  course?: string | CourseRef | null;
  questions: Question[];
  isActive: boolean;
  examDate: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Answer {
  questionId: string;
  answer: string | string[] | number;
}

export interface StudentResponse {
  _id: string;
  survey: Pick<
    Survey,
    "_id" | "slug" | "title" | "description" | "isActive" | "startDate" | "endDate"
  >;
  answers: Answer[];
  createdAt: string;
}

export interface RatingSummary {
  questionText: string;
  questionType: "rating";
  average: number;
  distribution: { star: number; count: number }[];
}

export interface ChoiceSummary {
  questionText: string;
  questionType: "radio" | "checkbox";
  optionCounts: Record<string, number>;
}

export interface TextSummary {
  questionText: string;
  questionType: "text";
  answers: string[];
}

export type QuestionSummary = RatingSummary | ChoiceSummary | TextSummary;

export interface SurveyResults {
  survey: string;
  totalResponses: number;
  summary: QuestionSummary[];
  responses: Array<{
    _id: string;
    user: { email: string; firstName: string; lastName: string };
    answers: Answer[];
    createdAt: string;
  }>;
}

export interface AdminStats {
  totalSurveys: number;
  activeSurveys: number;
  totalResponses: number;
  totalStudents: number;
  recentSurveys: Array<{
    _id: string;
    title: string;
    isActive: boolean;
    createdAt: string;
    responseCount: number;
  }>;
}
