import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { LoadingScreen } from '../../components/common/loading-screen'
import { PageHeader } from '../../components/common/page-header'
import { api } from '../../lib/api'
import { toApiDate, toDateTimeLocalInput } from '../../lib/format'
import type { Exam, Question } from '../../types/api'

const examFormSchema = z.object({
  title: z.string().min(2, 'Titre trop court'),
  description: z.string(),
  instructions: z.string(),
  duration_minutes: z.number().min(1, 'Duree invalide').max(480),
  shuffle_questions: z.boolean(),
  shuffle_choices: z.boolean(),
  mode: z.enum(['scheduled', 'rolling']),
  available_from: z.string(),
  available_until: z.string(),
  auto_publish_results: z.boolean(),
  status: z.enum(['draft', 'published', 'archived']),
  questions: z
    .array(
      z.object({
        question_id: z.number(),
        sort_order: z.number().min(1),
        points: z.number().min(0),
      }),
    )
    .min(1, 'Ajoutez au moins une question'),
})

type ExamFormValues = z.infer<typeof examFormSchema>

const emptyExamValues: ExamFormValues = {
  title: '',
  description: '',
  instructions: '',
  duration_minutes: 60,
  shuffle_questions: false,
  shuffle_choices: false,
  mode: 'scheduled',
  available_from: '',
  available_until: '',
  auto_publish_results: false,
  status: 'draft',
  questions: [],
}

function examToFormValues(exam: Exam): ExamFormValues {
  return {
    title: exam.title,
    description: exam.description ?? '',
    instructions: exam.instructions ?? '',
    duration_minutes: exam.duration_minutes,
    shuffle_questions: exam.shuffle_questions,
    shuffle_choices: exam.shuffle_choices,
    mode: exam.mode,
    available_from: toDateTimeLocalInput(exam.available_from),
    available_until: toDateTimeLocalInput(exam.available_until),
    auto_publish_results: exam.auto_publish_results,
    status: exam.status,
    questions: (exam.questions ?? []).map((item) => ({
      question_id: item.question_id,
      sort_order: item.sort_order,
      points: item.points,
    })),
  }
}

export function ExamEditorPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { examId } = useParams()
  const isEditing = Boolean(examId)

  const questionsQuery = useQuery({
    queryKey: ['admin', 'questions'],
    queryFn: api.adminQuestions,
  })
  const examQuery = useQuery({
    queryKey: ['admin', 'exam', examId],
    queryFn: () => api.adminExam(Number(examId)),
    enabled: isEditing,
  })

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues: emptyExamValues,
  })

  const questionsFieldArray = useFieldArray({
    control: form.control,
    name: 'questions',
  })

  useEffect(() => {
    if (examQuery.data?.item) {
      form.reset(examToFormValues(examQuery.data.item))
    }
  }, [examQuery.data, form])

  const saveMutation = useMutation({
    mutationFn: (values: ExamFormValues) => {
      const payload = {
        ...values,
        description: values.description || null,
        instructions: values.instructions || null,
        available_from: toApiDate(values.available_from),
        available_until: toApiDate(values.available_until),
      }

      if (isEditing && examId) {
        return api.updateExam(Number(examId), payload)
      }

      return api.createExam(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
      navigate('/admin/exams')
    },
  })

  if (questionsQuery.isLoading || (isEditing && examQuery.isLoading)) {
    return <LoadingScreen label="Chargement de l’editeur..." />
  }

  const questions = questionsQuery.data?.items ?? []
  const selectedIds = form.watch('questions').map((item) => item.question_id)
  const questionsById = new Map<number, Question>(questions.map((question) => [question.id, question]))

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? 'Exam Editor' : 'Creer un examen'}
        description="Composez un examen depuis la banque de questions, parametrage et bareme inclus."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="app-surface p-6">
          <form className="space-y-5" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Titre</span>
              <input className="input input-bordered" {...form.register('title')} />
              <span className="mt-2 text-xs text-error">{form.formState.errors.title?.message}</span>
            </label>

            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Description</span>
              <textarea className="textarea textarea-bordered min-h-24" {...form.register('description')} />
            </label>

            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Instructions</span>
              <textarea className="textarea textarea-bordered min-h-32" {...form.register('instructions')} />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-2 text-sm font-medium text-slate-700">Duree (minutes)</span>
                <input
                  type="number"
                  className="input input-bordered"
                  {...form.register('duration_minutes', { valueAsNumber: true })}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2 text-sm font-medium text-slate-700">Mode</span>
                <select className="select select-bordered" {...form.register('mode')}>
                  <option value="scheduled">scheduled</option>
                  <option value="rolling">rolling</option>
                </select>
              </label>

              <label className="form-control">
                <span className="label-text mb-2 text-sm font-medium text-slate-700">Disponible du</span>
                <input type="datetime-local" className="input input-bordered" {...form.register('available_from')} />
              </label>

              <label className="form-control">
                <span className="label-text mb-2 text-sm font-medium text-slate-700">Jusqu’au</span>
                <input type="datetime-local" className="input input-bordered" {...form.register('available_until')} />
              </label>

              <label className="form-control">
                <span className="label-text mb-2 text-sm font-medium text-slate-700">Statut</span>
                <select className="select select-bordered" {...form.register('status')}>
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3">
              <label className="label cursor-pointer justify-start gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <input type="checkbox" className="checkbox checkbox-sm" {...form.register('shuffle_questions')} />
                <span className="label-text text-slate-700">Melanger les questions</span>
              </label>
              <label className="label cursor-pointer justify-start gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <input type="checkbox" className="checkbox checkbox-sm" {...form.register('shuffle_choices')} />
                <span className="label-text text-slate-700">Melanger les propositions</span>
              </label>
              <label className="label cursor-pointer justify-start gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <input type="checkbox" className="checkbox checkbox-sm" {...form.register('auto_publish_results')} />
                <span className="label-text text-slate-700">Publier automatiquement si correction 100% auto</span>
              </label>
            </div>

            <button type="submit" className="btn btn-neutral w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Enregistrement...' : isEditing ? 'Mettre a jour' : 'Creer l’examen'}
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="app-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Questions selectionnees</h2>
                <p className="text-sm text-slate-500">Ordre et bareme de l’examen.</p>
              </div>
              <span className="badge badge-neutral">{questionsFieldArray.fields.length}</span>
            </div>

            <div className="mt-5 space-y-3">
              {questionsFieldArray.fields.map((field, index) => {
                const question = questionsById.get(field.question_id)
                return (
                  <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">{question?.title ?? `Question #${field.question_id}`}</p>
                        <p className="text-sm text-slate-500">{question?.type}</p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => questionsFieldArray.remove(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="form-control">
                        <span className="label-text mb-2 text-sm text-slate-700">Ordre</span>
                        <input
                          type="number"
                          className="input input-bordered"
                          {...form.register(`questions.${index}.sort_order`, { valueAsNumber: true })}
                        />
                      </label>
                      <label className="form-control">
                        <span className="label-text mb-2 text-sm text-slate-700">Points</span>
                        <input
                          type="number"
                          step="0.5"
                          className="input input-bordered"
                          {...form.register(`questions.${index}.points`, { valueAsNumber: true })}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}
              <span className="text-xs text-error">{form.formState.errors.questions?.message}</span>
            </div>
          </div>

          <div className="app-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Banque de questions</h2>
                <p className="text-sm text-slate-500">Ajoutez des questions a l’examen en un clic.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {questions.map((question) => (
                <div key={question.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{question.title}</p>
                      <p className="text-sm text-slate-500">{question.type} · {question.points} pts</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      disabled={selectedIds.includes(question.id)}
                      onClick={() =>
                        questionsFieldArray.append({
                          question_id: question.id,
                          sort_order: questionsFieldArray.fields.length + 1,
                          points: question.points,
                        })
                      }
                    >
                      <Plus size={14} />
                      Ajouter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
