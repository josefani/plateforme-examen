import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, ArrowLeft, ArrowRight, Save, Send } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { ExamTimer } from '../../components/exam/exam-timer'
import { QuestionNavigation } from '../../components/exam/question-navigation'
import { QuestionRenderer, type AnswerDraft } from '../../components/exam/question-renderer'
import { ConfirmModal } from '../../components/common/modal'
import { LoadingScreen } from '../../components/common/loading-screen'
import { api } from '../../lib/api'
import type { AttemptPayload } from '../../types/api'

function buildDraftMap(payload: AttemptPayload) {
  return Object.fromEntries(
    payload.questions.map((item) => [
      item.question.id,
      {
        question_id: item.question.id,
        text_answer: item.answer.text_answer,
        boolean_answer: item.answer.boolean_answer,
        selected_choice_ids: item.answer.selected_choice_ids,
      } satisfies AnswerDraft,
    ]),
  )
}

function isAnswerCompleted(answer: AnswerDraft) {
  if (answer.text_answer && answer.text_answer.trim()) {
    return true
  }
  if (typeof answer.boolean_answer === 'boolean') {
    return true
  }
  return answer.selected_choice_ids.length > 0
}

export function ExamSessionPage() {
  const { attemptId } = useParams()
  const numericAttemptId = Number(attemptId)

  const attemptQuery = useQuery({
    queryKey: ['student', 'attempt', numericAttemptId],
    queryFn: () => api.attempt(numericAttemptId),
    refetchOnWindowFocus: false,
  })

  const payload = attemptQuery.data?.item
  const currentQuestion = payload?.questions[0]

  if (attemptQuery.isLoading || !payload || !currentQuestion) {
    return <LoadingScreen label="Chargement de la session..." />
  }

  return <ExamSessionContent key={payload.attempt.id} payload={payload} numericAttemptId={numericAttemptId} />
}

interface ExamSessionContentProps {
  payload: AttemptPayload
  numericAttemptId: number
}

function ExamSessionContent({ payload, numericAttemptId }: ExamSessionContentProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, AnswerDraft>>(() => buildDraftMap(payload))
  const [saveStatus, setSaveStatus] = useState('Session chargée')
  const [isDirty, setIsDirty] = useState(false)
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)

  const saveMutation = useMutation({
    mutationFn: async (saveMode: 'autosave' | 'manual') =>
      api.saveAttempt(numericAttemptId, {
        save_mode: saveMode,
        answers: Object.values(answers),
      }),
    onSuccess: (_payload, saveMode) => {
      setSaveStatus(saveMode === 'autosave' ? 'Autosauvegarde effectuée' : 'Sauvegarde manuelle effectuée')
      setIsDirty(false)
      void queryClient.invalidateQueries({ queryKey: ['student', 'exams'] })
    },
  })

  const heartbeatMutation = useMutation({
    mutationFn: () => api.attemptHeartbeat(numericAttemptId),
    onSuccess: (payload) => {
      const response = payload.item as { status?: string }
      if (response.status && response.status !== 'in_progress') {
        toast.error('La tentative a été finalisée automatiquement.')
        navigate('/student/results')
      }
    },
  })

  const eventMutation = useMutation({
    mutationFn: (payload: { event_type: string; details?: Record<string, unknown> }) =>
      api.recordAttemptEvent(numericAttemptId, payload),
  })

  const submitMutation = useMutation({
    mutationFn: () => api.submitAttempt(numericAttemptId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student', 'exams'] })
      await queryClient.invalidateQueries({ queryKey: ['student', 'results'] })
      toast.success('Tentative soumise')
      navigate('/student/results')
    },
  })

  const performEvent = (eventType: string, details?: Record<string, unknown>) => {
    eventMutation.mutate({
      event_type: eventType,
      details,
    })
  }

  const performSave = (saveMode: 'autosave' | 'manual') => {
    if (!Object.keys(answers).length) {
      return
    }
    setSaveStatus(saveMode === 'autosave' ? 'Autosauvegarde en cours...' : 'Sauvegarde en cours...')
    saveMutation.mutate(saveMode)
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (isDirty && payload.attempt.status === 'in_progress') {
        performSave('autosave')
      }
    }, 15_000)

    return () => window.clearInterval(interval)
  }, [isDirty, payload.attempt.status, answers])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (payload.attempt.status === 'in_progress') {
        heartbeatMutation.mutate()
      }
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [payload.attempt.status, heartbeatMutation])

  useEffect(() => {
    const onVisibilityChange = async () => {
      if (document.hidden && payload.attempt.status === 'in_progress') {
        performEvent('visibility_hidden', { at: new Date().toISOString() })
        toast.error("Changement d'onglet détecté — examen terminé automatiquement.", { duration: 6000 })
        try {
          if (isDirty) {
            await saveMutation.mutateAsync('autosave')
          }
          await submitMutation.mutateAsync()
        } catch {
          // submission already handles navigation on success
          navigate('/student/results')
        }
      } else if (!document.hidden) {
        performEvent('visibility_visible', { at: new Date().toISOString() })
      }
    }

    const onBlur = () => {
      performEvent('focus_lost', { at: new Date().toISOString() })
    }

    const onFocus = () => {
      performEvent('focus_returned', { at: new Date().toISOString() })
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const preventCopy = (event: ClipboardEvent) => {
      event.preventDefault()
      toast.error("La copie est désactivée pendant l'examen")
      performEvent('copy_blocked', { at: new Date().toISOString() })
    }

    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      performEvent('context_menu_blocked', { at: new Date().toISOString() })
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('copy', preventCopy)
    document.addEventListener('contextmenu', preventContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('copy', preventCopy)
      document.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [payload.attempt.status, isDirty, saveMutation, submitMutation, navigate, answers])

  const handleSubmit = async () => {
    if (isDirty) {
      await saveMutation.mutateAsync('manual')
    }
    await submitMutation.mutateAsync()
  }

  const handleAnswerChange = (next: AnswerDraft) => {
    setAnswers((current) => ({
      ...current,
      [next.question_id]: next,
    }))
    setSaveStatus('Modifications non sauvegardées')
    setIsDirty(true)
  }

  const questions = payload?.questions ?? []
  const currentQuestion = questions[currentIndex]

  const answeredCount = useMemo(
    () => questions.filter((item) => isAnswerCompleted(answers[item.question.id] ?? item.answer)).length,
    [answers, questions],
  )

  return (
    <div className="space-y-6">
      <section className="app-surface p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">
              Session d’examen
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{payload.exam.title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {saveStatus} · Tentative #{payload.attempt.id}
            </p>
          </div>
          <ExamTimer deadlineAt={payload.attempt.deadline_at} />
        </div>

        <div className="mt-5 flex flex-wrap gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <AlertTriangle size={16} />
          <span>
            Les pertes de focus, la copie et l'absence de signal de présence sont journalisées pendant la session.
          </span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <QuestionNavigation
          total={questions.length}
          currentIndex={currentIndex}
          answeredCount={answeredCount}
          isAnswered={(index) => isAnswerCompleted(answers[questions[index].question.id] ?? questions[index].answer)}
          onSelect={setCurrentIndex}
        />

        <section className="app-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">
                Question {currentQuestion.position}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">{currentQuestion.question.title}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {currentQuestion.question.statement}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              {currentQuestion.points} pts
            </div>
          </div>

          <div className="mt-8">
            <QuestionRenderer
              question={currentQuestion.question}
              answer={answers[currentQuestion.question.id] ?? currentQuestion.answer}
              onChange={handleAnswerChange}
            />
          </div>

          <div className="soft-divider mt-8 pt-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
                >
                  <ArrowLeft size={16} />
                  Précédent
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => setCurrentIndex((value) => Math.min(questions.length - 1, value + 1))}
                >
                  Suivant
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={saveMutation.isPending}
                  onClick={() => performSave('manual')}
                >
                  <Save size={16} />
                  Sauvegarder
                </button>
                <button
                  type="button"
                  className="btn btn-neutral"
                  disabled={submitMutation.isPending}
                  onClick={() => setSubmitConfirmOpen(true)}
                >
                  <Send size={16} />
                  Soumettre
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <ConfirmModal
        open={submitConfirmOpen}
        title="Soumettre la tentative"
        description="Après la soumission, vous ne pourrez plus modifier vos réponses."
        confirmLabel="Soumettre"
        isPending={submitMutation.isPending || saveMutation.isPending}
        onCancel={() => setSubmitConfirmOpen(false)}
        onConfirm={() => {
          setSubmitConfirmOpen(false)
          void handleSubmit()
        }}
      />
    </div>
  )
}
