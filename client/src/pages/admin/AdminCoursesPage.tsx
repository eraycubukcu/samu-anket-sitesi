import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { adminApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Course, CourseListItem } from "@/types";

interface CourseFormState {
  code: string;
  name: string;
  department: string;
  term: string;
  instructor: string;
  // Konular textarea'da satır satır girilir
  topicsText: string;
}

const emptyForm: CourseFormState = {
  code: "",
  name: "",
  department: "",
  term: "",
  instructor: "",
  topicsText: "",
};

const toFormState = (course: Course): CourseFormState => ({
  code: course.code,
  name: course.name,
  department: course.department,
  term: course.term,
  instructor: course.instructor,
  topicsText: course.topics.join("\n"),
});

const parseTopics = (text: string) =>
  [...new Set(text.split("\n").map((t) => t.trim()).filter(Boolean))];

export function AdminCoursesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseFormState>(emptyForm);

  const coursesQuery = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: async () => (await adminApi.get<CourseListItem[]>("/courses")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { topicsText, ...rest } = form;
      const payload = { ...rest, topics: parseTopics(topicsText) };
      return editingId
        ? adminApi.put(`/courses/${editingId}`, payload)
        : adminApi.post("/courses", payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Ders güncellendi." : "Ders oluşturuldu.");
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Ders kaydedilemedi."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => adminApi.delete(`/courses/${id}`),
    onSuccess: () => {
      toast.success("Ders silindi.");
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Ders silinemedi."));
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditingId(course._id);
    setForm(toFormState(course));
    setDialogOpen(true);
  };

  const handleDelete = (course: CourseListItem) => {
    const confirmed = window.confirm(
      `"${course.code} - ${course.name}" (${course.term}) dersini silmek istediğinize emin misiniz?`,
    );
    if (confirmed) deleteMutation.mutate(course._id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseTopics(form.topicsText).length === 0) {
      toast.error("En az bir müfredat konusu girilmelidir.");
      return;
    }
    saveMutation.mutate();
  };

  const updateField = (field: keyof CourseFormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dersler</h1>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Yeni Ders
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Dersi Düzenle" : "Yeni Ders"}</DialogTitle>
            <DialogDescription>
              Anket soruları, burada girilen müfredat konularına bağlanır.
            </DialogDescription>
          </DialogHeader>
          <form id="course-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Ders Kodu</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  placeholder="BIL301"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="term">Dönem</Label>
                <Input
                  id="term"
                  value={form.term}
                  onChange={(e) => updateField("term", e.target.value)}
                  placeholder="2026-Güz"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Ders Adı</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="department">Bölüm</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={(e) => updateField("department", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructor">Öğretim Üyesi</Label>
                <Input
                  id="instructor"
                  value={form.instructor}
                  onChange={(e) => updateField("instructor", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="topics">Müfredat Konuları</Label>
              <Textarea
                id="topics"
                rows={6}
                value={form.topicsText}
                onChange={(e) => updateField("topicsText", e.target.value)}
                placeholder={"Her satıra bir konu\nÖrn: Veri yapıları\nGraf algoritmaları"}
              />
              <p className="text-xs text-muted-foreground">
                Anketlerde kullanılan bir konu sonradan kaldırılamaz.
              </p>
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="course-form" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {coursesQuery.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {coursesQuery.isError && (
        <p className="text-sm text-destructive">Dersler yüklenemedi.</p>
      )}

      {coursesQuery.data && coursesQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ders</TableHead>
              <TableHead>Dönem</TableHead>
              <TableHead className="hidden md:table-cell">Öğretim Üyesi</TableHead>
              <TableHead className="hidden sm:table-cell">Konu</TableHead>
              <TableHead className="hidden sm:table-cell">Anket</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {coursesQuery.data.map((course) => (
              <TableRow key={course._id}>
                <TableCell>
                  <div className="font-medium">{course.code}</div>
                  <div className="text-xs text-muted-foreground">{course.name}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{course.term}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {course.instructor || "—"}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{course.topics.length}</TableCell>
                <TableCell className="hidden sm:table-cell">{course.surveyCount}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                      <MoreVertical className="size-4" />
                      <span className="sr-only">İşlemler</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(course)}>
                        <Pencil className="size-4" />
                        Düzenle
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => handleDelete(course)}>
                        <Trash2 className="size-4" />
                        Sil
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {coursesQuery.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Henüz ders eklenmedi. Anketleri derslere bağlamak için önce ders oluşturun.
        </p>
      )}
    </div>
  );
}
