export type QuestionType = "radio" | "text" | "checkbox" | "rating";

export interface Question {
  _id?: string;
  questionText: string;
  questionType: QuestionType;
  options: string[];
  required: boolean;
}

export interface Survey {
  _id: string;
  title: string;
  description: string;
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
  survey: Pick<Survey, "_id" | "title" | "description">;
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
