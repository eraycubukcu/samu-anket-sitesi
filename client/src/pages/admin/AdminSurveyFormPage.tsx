import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Eye, Plus, QrCode, Trash2 } from "lucide-react";
import { adminApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SurveyPreviewDialog } from "@/components/admin/SurveyPreviewDialog";
import { SurveyQrDialog } from "@/components/admin/SurveyQrDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { copySurveyLink, getSurveyLink } from "@/lib/survey-link";
import { DIMENSION_LABELS } from "@/lib/course";
import type { Course, Question, QuestionDimension, QuestionType, Survey } from "@/types";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Metin",
  rating: "1-5 Puanlama",
  radio: "Tek Seçim",
  checkbox: "Çoklu Seçim",
};

const emptyQuestion = (): Question => ({
  questionText: "",
  questionType: "radio",
  options: ["", ""],
  required: true,
  topic: "",
  dimension: "",
});

// Select bileşeni boş string değeri desteklemediği için "seçilmedi" durumu
// bu sabitle temsil edilir.
const NONE = "__none";

const getCourseId = (course: Survey["course"]) =>
  !course ? "" : typeof course === "string" ? course : course._id;

// datetime-local input değeri (ör. "2026-07-25T13:00") tarayıcının saat dilimi
// ne olursa olsun her zaman Türkiye saati (UTC+3) olarak yorumlanır.
const toTurkeyIso = (localValue: string) => `${localValue}:00+03:00`;

const fromIsoToLocalInput = (iso: string | undefined | null) => {
  if (!iso) return "";
  // ISO'daki tarihi UTC+3'e çevirip datetime-local formatına indirger
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const trDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return trDate.toISOString().slice(0, 16);
};

export function AdminSurveyFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const duplicateFromId = searchParams.get("kopyala");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [examDateLocal, setExamDateLocal] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [courseId, setCourseId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createdSurveySlug, setCreatedSurveySlug] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const surveyQuery = useQuery({
    queryKey: ["admin", "survey", id],
    queryFn: async () => (await adminApi.get<Survey>(`/surveys/${id}`)).data,
    enabled: isEdit,
  });

  const coursesQuery = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: async () => (await adminApi.get<Course[]>("/courses")).data,
  });

  const selectedCourse = coursesQuery.data?.find((c) => c._id === courseId);

  const duplicateSourceQuery = useQuery({
    queryKey: ["admin", "survey", "duplicate-source", duplicateFromId],
    queryFn: async () =>
      (await adminApi.get<Survey>(`/surveys/${duplicateFromId}`)).data,
    enabled: !isEdit && Boolean(duplicateFromId),
  });

  useEffect(() => {
    if (!surveyQuery.data) return;
    const survey = surveyQuery.data;
    setTitle(survey.title);
    setDescription(survey.description ?? "");
    setExamDateLocal(fromIsoToLocalInput(survey.examDate));
    setIsActive(survey.isActive);
    setCourseId(getCourseId(survey.course));
    setQuestions(
      survey.questions.length > 0 ? survey.questions : [emptyQuestion()],
    );
  }, [surveyQuery.data]);

  useEffect(() => {
    if (!duplicateSourceQuery.data) return;
    const survey = duplicateSourceQuery.data;
    setTitle(`${survey.title} (Kopya)`);
    setDescription(survey.description ?? "");
    // Sınav tarihi bilinçli olarak boş bırakılıyor, admin yeni tarihi girmeli.
    setExamDateLocal("");
    setIsActive(false);
    setCourseId(getCourseId(survey.course));
    setQuestions(
      survey.questions.length > 0
        ? survey.questions.map(({ _id, ...q }) => q)
        : [emptyQuestion()],
    );
  }, [duplicateSourceQuery.data]);

  const isEnded = Boolean(
    isEdit && surveyQuery.data?.endDate && new Date(surveyQuery.data.endDate) < new Date(),
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description,
        isActive,
        examDate: toTurkeyIso(examDateLocal),
        course: courseId || null,
        questions: questions.map((q) => ({
          ...q,
          topic: courseId ? q.topic ?? "" : "",
          dimension: q.dimension ?? "",
          options: q.questionType === "radio" || q.questionType === "checkbox"
            ? q.options.map((o) => o.trim()).filter(Boolean)
            : [],
        })),
      };

      if (isEdit) {
        return adminApi.put(`/surveys/${id}`, payload);
      }
      return adminApi.post("/surveys", payload);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "surveys"] });

      if (isEdit) {
        toast.success("Anket güncellendi.");
        navigate("/admin/anketler");
        return;
      }

      toast.success("Anket oluşturuldu.");
      setCreatedSurveySlug(response.data.slug);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Anket kaydedilemedi."));
    },
  });

  const updateQuestion = (index: number, patch: Partial<Question>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  };

  // Ders değişince, yeni dersin müfredatında olmayan soru konuları temizlenir.
  const handleCourseChange = (value: string | null) => {
    const nextId = !value || value === NONE ? "" : value;
    const nextTopics = coursesQuery.data?.find((c) => c._id === nextId)?.topics ?? [];
    setCourseId(nextId);
    setQuestions((prev) =>
      prev.map((q) => (q.topic && !nextTopics.includes(q.topic) ? { ...q, topic: "" } : q)),
    );
  };

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);

  const removeQuestion = (index: number) =>
    setQuestions((prev) => prev.filter((_, i) => i !== index));

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) }
          : q,
      ),
    );
  };

  const addOption = (qIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ""] } : q)),
    );
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.filter((_, j) => j !== oIndex) }
          : q,
      ),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!examDateLocal) {
      toast.error("Sınav tarihi ve saati gerekli.");
      return;
    }

    for (const q of questions) {
      if (!q.questionText.trim()) {
        toast.error("Tüm sorular için metin girilmeli.");
        return;
      }
      if (q.questionType === "radio" || q.questionType === "checkbox") {
        const validOptions = q.options.map((o) => o.trim()).filter(Boolean);
        if (validOptions.length < 2) {
          toast.error(`"${q.questionText}" için en az 2 seçenek girilmeli.`);
          return;
        }
      }
    }

    saveMutation.mutate();
  };

  if (isEdit && surveyQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Yükleniyor...</p>;
  }

  if (duplicateFromId && duplicateSourceQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Anket kopyalanıyor...</p>;
  }

  if (duplicateFromId && duplicateSourceQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Anket kopyalanamadı</AlertTitle>
        <AlertDescription>
          Kopyalanmak istenen anket bulunamadı, silinmiş olabilir.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {isEdit ? "Anketi Düzenle" : duplicateFromId ? "Anketi Kopyala" : "Yeni Anket"}
        </h1>
        <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye className="size-4" />
          Önizle
        </Button>
      </div>

      <SurveyPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={title}
        description={description}
        questions={questions}
      />

      <Dialog
        open={Boolean(createdSurveySlug)}
        onOpenChange={(open) => {
          if (!open) navigate("/admin/anketler");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anket oluşturuldu</DialogTitle>
            <DialogDescription>
              Öğrencilerle paylaşmak için aşağıdaki linki kopyalayabilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={createdSurveySlug ? getSurveyLink(createdSurveySlug) : ""} />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => createdSurveySlug && copySurveyLink(createdSurveySlug)}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setQrOpen(true)}>
              <QrCode className="size-4" />
              QR Kod Oluştur
            </Button>
            <Button type="button" onClick={() => navigate("/admin/anketler")}>
              Tamam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SurveyQrDialog
        survey={qrOpen && createdSurveySlug ? { slug: createdSurveySlug, title } : null}
        onOpenChange={setQrOpen}
      />

      {isEnded && (
        <Alert variant="destructive">
          <AlertTitle>Anketin süresi doldu</AlertTitle>
          <AlertDescription>
            Bu anketin bitiş tarihi geçtiği için artık düzenlenemez, sadece görüntülenebilir.
          </AlertDescription>
        </Alert>
      )}

      {duplicateFromId && duplicateSourceQuery.data && (
        <Alert>
          <AlertTitle>Sorular kopyalandı</AlertTitle>
          <AlertDescription>
            "{duplicateSourceQuery.data.title}" anketinin soruları buraya kopyalandı.
            Başlığı düzenleyip yeni bir sınav tarihi seçmeyi unutmayın.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={isEnded} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Genel Bilgiler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Başlık</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="examDate">Sınav Tarihi ve Saati</Label>
              <Input
                id="examDate"
                type="datetime-local"
                value={examDateLocal}
                onChange={(e) => setExamDateLocal(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Anket, sınavdan 10 dakika önce otomatik açılır ve sınav gününün
                (Türkiye saatiyle) 23:59'unda kapanır.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Ders</Label>
              <Select value={courseId || NONE} onValueChange={handleCourseChange}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) => {
                      if (!value || value === NONE) return "Ders yok";
                      const course = coursesQuery.data?.find((c) => c._id === value);
                      return course
                        ? `${course.code} - ${course.name} (${course.term})`
                        : "Yükleniyor...";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Ders yok</SelectItem>
                  {coursesQuery.data?.map((course) => (
                    <SelectItem key={course._id} value={course._id}>
                      {course.code} - {course.name} ({course.term})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ders seçilirse sorular dersin müfredat konularına bağlanabilir ve
                sonuçlar ders bazında analiz edilir.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
              <Label htmlFor="isActive" className="font-normal">
                Anket yayında
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {questions.map((question, qIndex) => (
            <Card key={qIndex}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Soru {qIndex + 1}</CardTitle>
                {questions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestion(qIndex)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Soru Metni</Label>
                  <Input
                    value={question.questionText}
                    onChange={(e) =>
                      updateQuestion(qIndex, { questionText: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Soru Tipi</Label>
                  <Select
                    value={question.questionType}
                    onValueChange={(value: QuestionType | null) => {
                      if (!value) return;
                      updateQuestion(qIndex, {
                        questionType: value,
                        options:
                          value === "radio" || value === "checkbox"
                            ? question.options.length >= 2
                              ? question.options
                              : ["", ""]
                            : [],
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value: QuestionType | null) =>
                          value ? QUESTION_TYPE_LABELS[value] : "Soru tipi seçin"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {selectedCourse && (
                    <div className="space-y-2">
                      <Label>Müfredat Konusu</Label>
                      <Select
                        value={question.topic || NONE}
                        onValueChange={(value: string | null) =>
                          updateQuestion(qIndex, { topic: !value || value === NONE ? "" : value })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string | null) =>
                              !value || value === NONE ? "Konu seçilmedi" : value
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Konu seçilmedi</SelectItem>
                          {selectedCourse.topics.map((topic) => (
                            <SelectItem key={topic} value={topic}>
                              {topic}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Değerlendirme Boyutu</Label>
                    <Select
                      value={question.dimension || NONE}
                      onValueChange={(value: string | null) =>
                        updateQuestion(qIndex, {
                          dimension:
                            !value || value === NONE ? "" : (value as QuestionDimension),
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string | null) =>
                            !value || value === NONE
                              ? "Boyut seçilmedi"
                              : DIMENSION_LABELS[value as QuestionDimension]
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Boyut seçilmedi</SelectItem>
                        {Object.entries(DIMENSION_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(question.questionType === "radio" ||
                  question.questionType === "checkbox") && (
                  <div className="space-y-2">
                    <Label>Seçenekler</Label>
                    {question.options.map((option, oIndex) => (
                      <div key={oIndex} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                          placeholder={`Seçenek ${oIndex + 1}`}
                        />
                        {question.options.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(qIndex, oIndex)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addOption(qIndex)}
                    >
                      <Plus className="size-4" />
                      Seçenek Ekle
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`required-${qIndex}`}
                    checked={question.required}
                    onCheckedChange={(checked) =>
                      updateQuestion(qIndex, { required: checked === true })
                    }
                  />
                  <Label htmlFor={`required-${qIndex}`} className="font-normal">
                    Zorunlu soru
                  </Label>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button type="button" variant="outline" onClick={addQuestion}>
            <Plus className="size-4" />
            Soru Ekle
          </Button>
        </div>

        <Button type="submit" disabled={saveMutation.isPending} className="w-full">
          {saveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        </fieldset>
      </form>
    </div>
  );
}
