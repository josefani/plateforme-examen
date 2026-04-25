import { useAuthStore } from '../store/auth-store'
import type {
  AssignmentListItem,
  AttemptPayload,
  DashboardSummary,
  Group,
  LoginResponse,
  PendingManualGradingItem,
  Question,
  ResultsListItem,
  StudentExamItem,
  User,
  Exam,
} from '../types/api'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'

type RequestOptions = RequestInit & {
  skipAuth?: boolean
  retryOnAuthFailure?: boolean
}

class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function parseJson<T>(response: Response): Promise<T | null> {
  if (response.status === 204) {
    return null
  }
  return (await response.json()) as T
}

async function refreshAccessToken() {
  const { refreshToken, updateAccessToken, clearSession } = useAuthStore.getState()

  if (!refreshToken) {
    clearSession()
    throw new ApiError('Session expiree', 401)
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${refreshToken}`,
    },
  })

  if (!response.ok) {
    clearSession()
    throw new ApiError('Session expiree', response.status)
  }

  const payload = (await response.json()) as { access_token: string }
  updateAccessToken(payload.access_token)
  return payload.access_token
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken, clearSession } = useAuthStore.getState()
  const headers = new Headers(options.headers)

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (!options.skipAuth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401 && !options.skipAuth && options.retryOnAuthFailure !== false) {
    try {
      const newAccessToken = await refreshAccessToken()
      return apiRequest<T>(path, {
        ...options,
        headers: {
          ...Object.fromEntries(headers.entries()),
          Authorization: `Bearer ${newAccessToken}`,
        },
        retryOnAuthFailure: false,
      })
    } catch (error) {
      clearSession()
      throw error
    }
  }

  const payload = await parseJson<{ message?: string; details?: unknown } | T>(response)
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? payload.message || 'Une erreur est survenue'
        : 'Une erreur est survenue'
    const details =
      payload && typeof payload === 'object' && 'details' in payload
        ? payload.details
        : undefined
    throw new ApiError(message, response.status, details)
  }

  return payload as T
}

export const api = {
  login: (payload: { email: string; password: string }) =>
    apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    }),
  registerStudent: (payload: { full_name: string; email: string; password: string }) =>
    apiRequest<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    }),
  me: () => apiRequest<{ user: User }>('/auth/me'),
  adminDashboard: () => apiRequest<DashboardSummary>('/admin/dashboard'),
  adminStudents: () => apiRequest<{ items: User[] }>('/admin/students'),
  createStudent: (payload: unknown) =>
    apiRequest<{ item: User }>('/admin/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStudent: (studentId: number, payload: unknown) =>
    apiRequest<{ item: User }>(`/admin/students/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteStudent: (studentId: number) =>
    apiRequest<void>(`/admin/students/${studentId}`, {
      method: 'DELETE',
    }),
  adminGroups: () => apiRequest<{ items: Group[] }>('/admin/groups'),
  createGroup: (payload: unknown) =>
    apiRequest<{ item: Group }>('/admin/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateGroup: (groupId: number, payload: unknown) =>
    apiRequest<{ item: Group }>(`/admin/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteGroup: (groupId: number) =>
    apiRequest<void>(`/admin/groups/${groupId}`, {
      method: 'DELETE',
    }),
  adminQuestions: () => apiRequest<{ items: Question[] }>('/admin/questions'),
  createQuestion: (payload: unknown) =>
    apiRequest<{ item: Question }>('/admin/questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateQuestion: (questionId: number, payload: unknown) =>
    apiRequest<{ item: Question }>(`/admin/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  adminExams: () => apiRequest<{ items: Exam[] }>('/admin/exams'),
  adminExam: (examId: number) => apiRequest<{ item: Exam }>(`/admin/exams/${examId}`),
  createExam: (payload: unknown) =>
    apiRequest<{ item: Exam }>('/admin/exams', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateExam: (examId: number, payload: unknown) =>
    apiRequest<{ item: Exam }>(`/admin/exams/${examId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  adminAssignments: () => apiRequest<{ items: AssignmentListItem[] }>('/admin/assignments'),
  assignExam: (examId: number, payload: unknown) =>
    apiRequest<{ item: Exam }>(`/admin/exams/${examId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  pendingManualGrading: () =>
    apiRequest<{ items: PendingManualGradingItem[] }>('/admin/grading/pending'),
  gradeAnswer: (answerId: number, payload: unknown) =>
    apiRequest<{ item: unknown }>(`/admin/answers/${answerId}/grade`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminResults: () => apiRequest<{ items: ResultsListItem[] }>('/admin/results'),
  publishResults: (payload: unknown) =>
    apiRequest<{ published_attempt_ids: number[] }>('/admin/results/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  studentExams: () => apiRequest<{ items: StudentExamItem[] }>('/student/exams'),
  studentExam: (examId: number) => apiRequest<{ item: StudentExamItem }>(`/student/exams/${examId}`),
  startExam: (examId: number) =>
    apiRequest<{ item: AttemptPayload }>(`/student/exams/${examId}/start`, {
      method: 'POST',
    }),
  attempt: (attemptId: number) =>
    apiRequest<{ item: AttemptPayload }>(`/student/attempts/${attemptId}`),
  saveAttempt: (attemptId: number, payload: unknown) =>
    apiRequest<{ item: unknown; message: string }>(`/student/attempts/${attemptId}/save`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  attemptHeartbeat: (attemptId: number) =>
    apiRequest<{ item: unknown }>(`/student/attempts/${attemptId}/heartbeat`, {
      method: 'POST',
    }),
  recordAttemptEvent: (attemptId: number, payload: unknown) =>
    apiRequest<{ item: unknown }>(`/student/attempts/${attemptId}/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submitAttempt: (attemptId: number) =>
    apiRequest<{ item: unknown }>(`/student/attempts/${attemptId}/submit`, {
      method: 'POST',
    }),
  studentResults: () =>
    apiRequest<{ items: StudentExamItem[]; heartbeat_grace_seconds: number }>('/student/results'),
}

export { ApiError }
