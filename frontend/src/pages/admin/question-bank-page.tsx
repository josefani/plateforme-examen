import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { LoadingScreen } from '../../components/common/loading-screen'
import { Modal } from '../../components/common/modal'
import { PageHeader } from '../../components/common/page-header'
import { StatusBadge } from '../../components/common/status-badge'
import { api } from '../../lib/api'
import type { Question } from '../../types/api'

const choiceSchema = z.object({
  label: z.string().min(1, 'Proposition requise'),
  sort_order: z.number(),
  is_correct: z.boolean(),
})

const questionSchema = z
  .object({
    type: z.enum(['single_choice', 'multiple_choice', 'true_false', 'short_text']),
    title: z.string().min(2, 'Titre trop court'),
    statement: z.string().min(5, 'Énoncé trop court'),
    points: z.number().min(0, 'Points invalides'),
    correct_boolean: z.boolean().nullable(),
    explanation: z.string(),
    tags: z.string(),
    difficulty: z.string(),
    is_active: z.boolean(),
    choices: z.array(choiceSchema),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'single_choice' || values.type === 'multiple_choice') {
      if (values.choices.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Au moins deux choix sont requis', path: ['choices'] })
      }
      const correctCount = values.choices.filter((choice) => choice.is_correct).length
      if (values.type === 'single_choice' && correctCount !== 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Un QCU doit avoir exactement une bonne réponse', path: ['choices'] })
      }
      if (values.type === 'multiple_choice' && correctCount < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Un QCM doit avoir au moins une bonne réponse', path: ['choices'] })
      }
    }
    if (values.type === 'true_false' && values.correct_boolean === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Sélectionnez la bonne valeur vrai/faux', path: ['correct_boolean'] })
    }
  })

type QuestionFormValues = z.infer<typeof questionSchema>

const emptyQuestion: QuestionFormValues = {
  type: 'single_choice',
  title: '',
  statement: '',
  points: 1,
  correct_boolean: null,
  explanation: '',
  tags: '',
  difficulty: '',
  is_active: true,
  choices: [
    { label: '', sort_order: 1, is_correct: true },
    { label: '', sort_order: 2, is_correct: false },
  ],
}

function questionToFormValues(question: Question): QuestionFormValues {
  return {
    type: question.type,
    title: question.title,
    statement: question.statement,
    points: question.points,
    correct_boolean: question.correct_boolean ?? null,
    explanation: question.explanation ?? '',
    tags: question.tags.join(', '),
    difficulty: question.difficulty ?? '',
    is_active: question.is_active,
    choices: question.choices.map((choice) => ({
      label: choice.label,
      sort_order: choice.sort_order,
      is_correct: Boolean(choice.is_correct),
    })),
  }
}

export function AdminQuestionBankPage() {
  const queryClient = useQueryClient()
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const questionsQuery = useQuery({ queryKey: ['admin', 'questions'], queryFn: api.adminQuestions })

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: emptyQuestion,
  })

  const choicesFieldArray = useFieldArray({ control: form.control, name: 'choices' })
  const questionType = form.watch('type')

  const openCreateModal = () => {
    setSelectedQuestion(null)
    form.reset(emptyQuestion)
    setIsModalOpen(true)
  }

  const openEditModal = (question: Question) => {
    setSelectedQuestion(question)
    setIsModalOpen(true)
  }

  useEffect(() => {
    if (!selectedQuestion) {
      form.reset(emptyQuestion)
      return
    }
    form.reset(questionToFormValues(selectedQuestion))
  }, [form, selectedQuestion])

  useEffect(() => {
    if ((questionType === 'single_choice' || questionType === 'multiple_choice') && !form.getValues('choices').length) {
      form.setValue('choices', [
        { label: '', sort_order: 1, is_correct: questionType === 'single_choice' },
        { label: '', sort_order: 2, is_correct: false },
      ])
    }
    if (questionType === 'true_false' || questionType === 'short_text') {
      form.setValue('choices', [])
    }
  }, [form, questionType])

  const saveMutation = useMutation({
    mutationFn: (values: QuestionFormValues) => {
      const payload = {
        ...values,
        explanation: values.explanation || null,
        difficulty: values.difficulty || null,
        tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      }
      if (selectedQuestion) {
        return api.updateQuestion(selectedQuestion.id, payload)
      }
      return api.createQuestion(payload)
    },
    onSuccess: () => {
      setIsModalOpen(false)
      setSelectedQuestion(null)
      form.reset(emptyQuestion)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] })
    },
  })

  if (questionsQuery.isLoading) {
    return <LoadingScreen label="Chargement de la banque de questions..." />
  }

  const questions = questionsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banque de questions"
        description="Centralisez des questions réutilisables pour composer les examens."
        action={
          <button type="button" className="btn btn-neutral" onClick={openCreateModal}>
            <Plus size={16} />
            Nouvelle question
          </button>
        }
      />

      <section className="app-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Type</th>
                <th>Points</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{question.title}</div>
                    <div className="max-w-xl text-sm text-slate-500">{question.statement}</div>
                  </td>
                  <td><StatusBadge value={question.type} /></td>
                  <td className="font-semibold text-slate-900">{question.points}</td>
                  <td>
                    <span className={`badge badge-sm ${question.is_active ? 'badge-success' : 'badge-ghost'}`}>
                      {question.is_active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => openEditModal(question)}>
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedQuestion ? 'Modifier une question' : 'Nouvelle question'}
        description="QCU, QCM, vrai/faux et réponse libre dans un seul formulaire."
        size="xl"
      >
        <form className="space-y-5" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Type</span>
              <select className="select select-bordered" {...form.register('type')}>
                <option value="single_choice">Choix unique</option>
                <option value="multiple_choice">Choix multiple</option>
                <option value="true_false">Vrai / faux</option>
                <option value="short_text">Réponse libre</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Points</span>
              <input type="number" step="0.5" className="input input-bordered" {...form.register('points', { valueAsNumber: true })} />
            </label>
          </div>

          <label className="form-control">
            <span className="label-text mb-2 text-sm font-medium text-slate-700">Titre</span>
            <input className="input input-bordered" {...form.register('title')} />
            <span className="mt-2 text-xs text-error">{form.formState.errors.title?.message}</span>
          </label>

          <label className="form-control">
            <span className="label-text mb-2 text-sm font-medium text-slate-700">Énoncé</span>
            <textarea className="textarea textarea-bordered min-h-28" {...form.register('statement')} />
            <span className="mt-2 text-xs text-error">{form.formState.errors.statement?.message}</span>
          </label>

          {questionType === 'true_false' ? (
            <div>
              <p className="text-sm font-medium text-slate-700">Bonne valeur</p>
              <div className="mt-3 flex gap-3">
                <button type="button" className={`btn ${form.watch('correct_boolean') === true ? 'btn-neutral' : 'btn-outline'}`} onClick={() => form.setValue('correct_boolean', true)}>
                  Vrai
                </button>
                <button type="button" className={`btn ${form.watch('correct_boolean') === false ? 'btn-neutral' : 'btn-outline'}`} onClick={() => form.setValue('correct_boolean', false)}>
                  Faux
                </button>
              </div>
              <span className="mt-2 block text-xs text-error">{form.formState.errors.correct_boolean?.message}</span>
            </div>
          ) : null}

          {(questionType === 'single_choice' || questionType === 'multiple_choice') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Propositions</p>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => choicesFieldArray.append({ label: '', sort_order: choicesFieldArray.fields.length + 1, is_correct: false })}>
                  <Plus size={14} />
                  Ajouter
                </button>
              </div>
              {choicesFieldArray.fields.map((field, index) => (
                <div key={field.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    {questionType === 'single_choice' ? (
                      <input
                        type="radio"
                        className="radio radio-sm mt-3"
                        checked={form.watch(`choices.${index}.is_correct`)}
                        onChange={() => choicesFieldArray.fields.forEach((_choice, choiceIndex) => form.setValue(`choices.${choiceIndex}.is_correct`, choiceIndex === index))}
                      />
                    ) : (
                      <input type="checkbox" className="checkbox checkbox-sm mt-3" checked={form.watch(`choices.${index}.is_correct`)} onChange={(event) => form.setValue(`choices.${index}.is_correct`, event.target.checked)} />
                    )}
                    <input className="input input-bordered flex-1" placeholder={`Proposition ${index + 1}`} {...form.register(`choices.${index}.label`)} />
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => choicesFieldArray.remove(index)} aria-label="Supprimer la proposition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              <span className="text-xs text-error">{typeof form.formState.errors.choices?.message === 'string' ? form.formState.errors.choices.message : undefined}</span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Tags</span>
              <input className="input input-bordered" placeholder="react, flask, api" {...form.register('tags')} />
            </label>
            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Difficulté</span>
              <input className="input input-bordered" placeholder="facile / moyen / difficile" {...form.register('difficulty')} />
            </label>
          </div>

          <label className="form-control">
            <span className="label-text mb-2 text-sm font-medium text-slate-700">Explication</span>
            <textarea className="textarea textarea-bordered min-h-24" {...form.register('explanation')} />
          </label>

          <label className="label cursor-pointer justify-start gap-3 rounded-lg border border-slate-200 px-4 py-3">
            <input type="checkbox" className="checkbox checkbox-sm" {...form.register('is_active')} />
            <span className="label-text font-medium text-slate-700">Question active</span>
          </label>

          {saveMutation.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveMutation.error.message}</p> : null}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn btn-neutral" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Enregistrement...' : selectedQuestion ? 'Mettre à jour' : 'Créer la question'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
