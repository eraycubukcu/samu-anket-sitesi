import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useStudentApi } from "@/hooks/useStudentApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import type { Answer, StudentResponse, Survey } from "@/types";

type AnswerValue = string | string[] | number;

export function SurveyAnswerPage() {
  const { id } = useParams<{ id: string }>();
  const studentApi = useStudentApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});

  const surveyQuery = useQuery({
    queryKey: ["surveys", "student", id],
    queryFn: async () => (await studentApi.get<Survey>(`/surveys/student/${id}`)).data,
    enabled: Boolean(id),
  });

  const myResponsesQuery = useQuery({
    queryKey: ["responses", "my"],
    queryFn: async () => (await studentApi.get<StudentResponse[]>("/responses/my")).data,
  });

  const existingResponse = myResponsesQuery.data?.find((r) => r.survey._id === id);

  useEffect(() => {
    if (!existingResponse) return;
    const prefilled: Record<string, AnswerValue> = {};
    existingResponse.answers.forEach((a) => {
      prefilled[a.questionId] = a.answer as AnswerValue;
    });
    setAnswers(prefilled);
  }, [existingResponse]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload: Answer[] = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));

      if (existingResponse) {
        return studentApi.put(`/responses/${existingResponse._id}`, { answers: payload });
      }
      return studentApi.post("/responses", { surveyId: id, answers: payload });
    },
    onSuccess: () => {
      toast.success(existingResponse ? "Cevaplarınız güncellendi." : "Cevaplarınız kaydedildi.");
      queryClient.invalidateQueries({ queryKey: ["responses", "my"] });
      queryClient.invalidateQueries({ queryKey: ["surveys", "active"] });
      navigate("/");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Cevaplar gönderilemedi."));
    },
  });

  if (surveyQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (surveyQuery.isError || !surveyQuery.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">
          Anket bulunamadı veya şu anda aktif değil.
        </p>
        <Button variant="outline" render={<Link to="/" />}>
          Anket listesine dön
        </Button>
      </div>
    );
  }

  const survey = surveyQuery.data;

  const setAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const toggleCheckboxOption = (questionId: string, option: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const next = checked
        ? [...current, option]
        : current.filter((o) => o !== option);
      return { ...prev, [questionId]: next };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const missingRequired = survey.questions.find((q) => {
      if (!q.required || !q._id) return false;
      const value = answers[q._id];
      if (value === undefined) return true;
      if (Array.isArray(value)) return value.length === 0;
      return value === "";
    });

    if (missingRequired) {
      toast.error(`"${missingRequired.questionText}" sorusu zorunludur.`);
      return;
    }

    submitMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{survey.title}</h1>
        {survey.description && (
          <p className="text-sm text-muted-foreground">{survey.description}</p>
        )}
        {existingResponse && (
          <p className="mt-1 text-sm text-muted-foreground">
            Bu anketi daha önce doldurdunuz. Anket süresi bitene kadar cevaplarınızı güncelleyebilirsiniz.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {survey.questions.map((question, index) => {
          if (!question._id) return null;
          const qId = question._id;

          return (
            <Card key={qId}>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  {index + 1}. {question.questionText}
                  {question.required && <span className="text-destructive"> *</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {question.questionType === "text" && (
                  <Textarea
                    value={(answers[qId] as string) ?? ""}
                    onChange={(e) => setAnswer(qId, e.target.value)}
                    placeholder="Cevabınızı yazın"
                  />
                )}

                {question.questionType === "rating" && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setAnswer(qId, star)}
                        className={cn(
                          "flex size-10 items-center justify-center rounded-md border text-sm font-medium transition-colors",
                          answers[qId] === star
                            ? "border-primary bg-primary text-primary-foreground"
                            : "hover:bg-accent",
                        )}
                      >
                        {star}
                      </button>
                    ))}
                  </div>
                )}

                {question.questionType === "radio" && (
                  <RadioGroup
                    value={(answers[qId] as string) ?? ""}
                    onValueChange={(value) => setAnswer(qId, value)}
                  >
                    {question.options.map((option) => (
                      <div key={option} className="flex items-center gap-2">
                        <RadioGroupItem value={option} id={`${qId}-${option}`} />
                        <Label htmlFor={`${qId}-${option}`} className="font-normal">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {question.questionType === "checkbox" && (
                  <div className="space-y-2">
                    {question.options.map((option) => {
                      const current = (answers[qId] as string[]) ?? [];
                      return (
                        <div key={option} className="flex items-center gap-2">
                          <Checkbox
                            id={`${qId}-${option}`}
                            checked={current.includes(option)}
                            onCheckedChange={(checked) =>
                              toggleCheckboxOption(qId, option, checked === true)
                            }
                          />
                          <Label htmlFor={`${qId}-${option}`} className="font-normal">
                            {option}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Button type="submit" disabled={submitMutation.isPending} className="w-full">
          {submitMutation.isPending
            ? "Gönderiliyor..."
            : existingResponse
              ? "Cevapları Güncelle"
              : "Cevapları Gönder"}
        </Button>
      </form>
    </div>
  );
}
