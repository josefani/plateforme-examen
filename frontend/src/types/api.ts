export type Role = 'admin' | 'student'

export interface User {
  id: number
  full_name: string
  email: string
  role: Role
  is_active: boolean
  groups?: Array<{ id: number; name: string }>
}

export interface Group {
  id: number
  name: string
  description: string | null
  members: User[]
}

export interface QuestionChoice {
  id: number
  label: string
  sort_order: number
  is_correct?: boolean
}

export interface Question {
  id: number
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_text'
  title: string
  statement: string
  points: number
  correct_boolean?: boolean | null
  explanation?: string | null
  tags: string[]
  difficulty: string | null
  is_active: boolean
  choices: QuestionChoice[]
}

export interface ExamQuestionItem {
  id: number
  question_id: number
  sort_order: number
  points: number
  question: Question
}

export interface ExamAssignment {
  id: number
  target_type: 'student' | 'group'
  student: User | null
  group: Group | null
  assigned_at: string
}

export interface Exam {
  id: number
  title: string
  description: string | null
  instructions: string | null
  duration_minutes: number
  shuffle_questions: boolean
  shuffle_choices: boolean
  mode: 'scheduled' | 'rolling'
  available_from: string | null
  available_until: string | null
  auto_publish_results: boolean
  status: 'draft' | 'published' | 'archived'
  total_points: number
  questions?: ExamQuestionItem[]
  assignments?: ExamAssignment[]
}

export interface Result {
  id: number
  attempt_id: number
  total_points: number
  max_points: number
  percentage: number
  is_published: boolean
  published_at: string | null
}

export interface Answer {
  id: number
  attempt_id: number
  question_id: number
  text_answer: string | null
  boolean_answer: boolean | null
  selected_choice_ids: number[]
  awarded_points: number | null
  is_correct: boolean | null
  is_final: boolean
  updated_at: string
}

export interface Attempt {
  id: number
  exam_id: number
  student_id: number
  status: 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted' | 'terminated' | 'graded'
  started_at: string
  deadline_at: string
  submitted_at: string | null
  last_saved_at: string | null
  last_heartbeat_at: string | null
  auto_submit_reason: string | null
  suspicion_count: number
  focus_loss_count: number
  score: number | null
  max_score: number
  result?: Result | null
}

export interface StudentExamItem extends Exam {
  availability: string
  attempt: Attempt | null
}

export interface AttemptQuestionItem {
  position: number
  exam_question_id: number
  points: number
  question: Question
  answer: Answer
}

export interface AttemptPayload {
  attempt: Attempt
  exam: Exam
  questions: AttemptQuestionItem[]
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: User
}

export interface DashboardSummary {
  students: number
  groups: number
  questions: number
  published_exams: number
  attempts_in_progress: number
  pending_manual_grading: number
  published_results: number
}

export interface AssignmentListItem extends ExamAssignment {
  exam: Exam
}

export interface PendingManualGradingItem {
  answer: Answer & { question: Question }
  attempt: Attempt
  student: User
  exam: Exam
}

export interface ResultsListItem {
  attempt: Attempt
  student: User
  exam: Exam
}
