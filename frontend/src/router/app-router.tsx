import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { LoadingScreen } from '../components/common/loading-screen'
import { AppShell } from '../components/layout/app-shell'
import { ProtectedRoute } from '../components/layout/protected-route'
import { useAuthStore } from '../store/auth-store'
import { LoginPage } from '../pages/auth/login-page'
import { AdminAssignmentsPage } from '../pages/admin/assignments-page'
import { AdminDashboardPage } from '../pages/admin/dashboard-page'
import { AdminExamsPage } from '../pages/admin/exams-page'
import { AdminGroupsPage } from '../pages/admin/groups-page'
import { AdminManualGradingPage } from '../pages/admin/manual-grading-page'
import { AdminQuestionBankPage } from '../pages/admin/question-bank-page'
import { AdminResultsPage } from '../pages/admin/results-page'
import { AdminStudentsPage } from '../pages/admin/students-page'
import { ExamEditorPage } from '../pages/admin/exam-editor-page'
import { ExamInstructionsPage } from '../pages/student/exam-instructions-page'
import { ExamSessionPage } from '../pages/student/exam-session-page'
import { StudentExamsPage } from '../pages/student/student-exams-page'
import { StudentResultsPage } from '../pages/student/student-results-page'

function AuthBootstrap() {
  const { accessToken, setUser, clearSession } = useAuthStore()
  const location = useLocation()

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.me,
    enabled: Boolean(accessToken),
    retry: false,
  })

  useEffect(() => {
    if (meQuery.data?.user) {
      setUser(meQuery.data.user)
    }
  }, [meQuery.data, setUser])

  useEffect(() => {
    if (meQuery.error) {
      clearSession()
    }
  }, [clearSession, meQuery.error])

  if (Boolean(accessToken) && meQuery.isLoading && location.pathname !== '/login') {
    return <LoadingScreen label="Récupération de la session..." />
  }

  return <Outlet />
}

function RootRedirect() {
  const { user } = useAuthStore()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/student/exams'} replace />
}

function AdminLayout() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AppShell role="admin">
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  )
}

function StudentLayout() {
  return (
    <ProtectedRoute allowedRoles={['student']}>
      <AppShell role="student">
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AuthBootstrap />}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/students" element={<AdminStudentsPage />} />
          <Route path="/admin/groups" element={<AdminGroupsPage />} />
          <Route path="/admin/questions" element={<AdminQuestionBankPage />} />
          <Route path="/admin/exams" element={<AdminExamsPage />} />
          <Route path="/admin/exams/new" element={<ExamEditorPage />} />
          <Route path="/admin/exams/:examId/edit" element={<ExamEditorPage />} />
          <Route path="/admin/assignments" element={<AdminAssignmentsPage />} />
          <Route path="/admin/grading" element={<AdminManualGradingPage />} />
          <Route path="/admin/results" element={<AdminResultsPage />} />
        </Route>

        <Route element={<StudentLayout />}>
          <Route path="/student/exams" element={<StudentExamsPage />} />
          <Route path="/student/exams/:examId" element={<ExamInstructionsPage />} />
          <Route path="/student/attempts/:attemptId/session" element={<ExamSessionPage />} />
          <Route path="/student/results" element={<StudentResultsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
