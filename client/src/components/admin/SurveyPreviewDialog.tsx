import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Question } from "@/types";

interface SurveyPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  questions: Question[];
}

export function SurveyPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  questions,
}: SurveyPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || "(Başlıksız Anket)"}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          {questions.length === 0 && (
            <p className="text-sm text-muted-foreground">Henüz soru eklenmedi.</p>
          )}

          {questions.map((question, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  {index + 1}. {question.questionText || "(Soru metni boş)"}
                  {question.required && <span className="text-destructive"> *</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {question.questionType === "text" && (
                  <Textarea placeholder="Cevabınızı yazın" disabled />
                )}

                {question.questionType === "rating" && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className="flex size-10 items-center justify-center rounded-md border text-sm font-medium text-muted-foreground"
                      >
                        {star}
                      </div>
                    ))}
                  </div>
                )}

                {question.questionType === "radio" && (
                  <RadioGroup disabled>
                    {question.options.map((option, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={option || `opt-${i}`}
                          id={`preview-${index}-${i}`}
                        />
                        <Label htmlFor={`preview-${index}-${i}`} className="font-normal">
                          {option || `Seçenek ${i + 1}`}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {question.questionType === "checkbox" && (
                  <div className="space-y-2">
                    {question.options.map((option, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Checkbox id={`preview-${index}-${i}`} disabled />
                        <Label htmlFor={`preview-${index}-${i}`} className="font-normal">
                          {option || `Seçenek ${i + 1}`}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
