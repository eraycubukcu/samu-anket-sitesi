import { Navigate, Route, Routes } from "react-router-dom";
import { StudentLayout } from "@/components/layout/StudentLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { RequireStudent } from "@/routes/RequireStudent";
import { RequireAdmin } from "@/routes/RequireAdmin";
import { SignInPage } from "@/pages/student/SignInPage";
import { SsoCallbackPage } from "@/pages/student/SsoCallbackPage";
import { SurveyListPage } from "@/pages/student/SurveyListPage";
import { SurveyAnswerPage } from "@/pages/student/SurveyAnswerPage";
import { MyResponsesPage } from "@/pages/student/MyResponsesPage";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminSurveysPage } from "@/pages/admin/AdminSurveysPage";
import { AdminSurveyFormPage } from "@/pages/admin/AdminSurveyFormPage";
import { AdminSurveyResultsPage } from "@/pages/admin/AdminSurveyResultsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function App() {
  return (
    <Routes>
      {/* Öğrenci girişi */}
      <Route path="/giris" element={<SignInPage />} />
      <Route path="/giris/sso-callback" element={<SsoCallbackPage />} />

      {/* Öğrenci alanı */}
      <Route element={<RequireStudent />}>
        <Route element={<StudentLayout />}>
          <Route path="/" element={<SurveyListPage />} />
          <Route path="/anketler/:id" element={<SurveyAnswerPage />} />
          <Route path="/cevaplarim" element={<MyResponsesPage />} />
        </Route>
      </Route>

      {/* Admin girişi */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* Admin alanı */}
      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="anketler" element={<AdminSurveysPage />} />
          <Route path="anketler/yeni" element={<AdminSurveyFormPage />} />
          <Route path="anketler/:id/duzenle" element={<AdminSurveyFormPage />} />
          <Route path="anketler/:id/sonuclar" element={<AdminSurveyResultsPage />} />
        </Route>
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

export default App;
