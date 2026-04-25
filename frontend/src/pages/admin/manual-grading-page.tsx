import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '../../components/common/empty-state'
import { LoadingScreen } from '../../components/common/loading-screen'
import { Modal } from '../../components/common/modal'
import { PageHeader } from '../../components/common/page-header'
import { api } from '../../lib/api'
import type { PendingManualGradingItem } from '../../types/api'

const gradingSchema = z.object({
  awarded_points: z.number().min(0, 'La note ne peut pas être négative'),
  feedback: z.string(),
})

type GradingFormValues = z.infer<typeof gradingSchema>

export function AdminManualGradingPage() {
  const queryClient = useQueryClient()
  const [selectedItem, setSelectedItem] = useState<PendingManualGradingItem | null>(null)
  const pendingQuery = useQuery({ queryKey: ['admin', 'grading', 'pending'], queryFn: api.pendingManualGrading })

  const maxPoints = useMemo(() => selectedItem?.answer.question.points ?? 0, [selectedItem])
  const form = useForm<GradingFormValues>({
    resolver: zodResolver(gradingSchema.refine((values) => values.awarded_points <= maxPoints, {
      message: `La note maximale est ${maxPoints}`,
      path: ['awarded_points'],
    })),
    defaultValues: {
      awarded_points: 0,
      feedback: '',
    },
  })

  useEffect(() => {
    if (selectedItem) {
      form.reset({ awarded_points: 0, feedback: '' })
    }
  }, [form, selectedItem])

  const gradeMutation = useMutation({
    mutationFn: (values: GradingFormValues) => {
      if (!selectedItem) {
        throw new Error('Aucune réponse sélectionnée')
      }
      return api.gradeAnswer(selectedItem.answer.id, values)
    },
    onSuccess: async () => {
      setSelectedItem(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'grading', 'pending'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'results'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    },
  })

  if (pendingQuery.isLoading) {
    return <LoadingScreen label="Chargement des copies à corriger..." />
  }

  const items = pendingQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Correction manuelle"
        description="Corrigez les réponses libres, ajoutez un retour et verrouillez la note."
      />

      {!items.length ? (
        <EmptyState title="Aucune copie en attente" description="Toutes les réponses libres sont corrigées." />
      ) : (
        <section className="app-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Étudiant</th>
                  <th>Examen</th>
                  <th>Question</th>
                  <th>Barème</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.answer.id}>
                    <td>
                      <div className="font-semibold text-slate-900">{item.student.full_name}</div>
                      <div className="text-sm text-slate-500">{item.student.email}</div>
                    </td>
                    <td className="text-sm text-slate-700">{item.exam.title}</td>
                    <td>
                      <div className="font-medium text-slate-900">{item.answer.question.title}</div>
                      <div className="max-w-xl truncate text-sm text-slate-500">{item.answer.question.statement}</div>
                    </td>
                    <td className="font-semibold text-slate-900">{item.answer.question.points} pts</td>
                    <td>
                      <button type="button" className="btn btn-sm btn-neutral" onClick={() => setSelectedItem(item)}>
                        Corriger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title="Corriger la réponse"
        description={selectedItem ? `${selectedItem.student.full_name} - ${selectedItem.exam.title}` : undefined}
        size="xl"
      >
        {selectedItem ? (
          <form className="space-y-5" onSubmit={form.handleSubmit((values) => gradeMutation.mutate(values))}>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{selectedItem.answer.question.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{selectedItem.answer.question.statement}</p>
                <div className="mt-4 rounded-lg bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Réponse étudiante</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                    {selectedItem.answer.text_answer || 'Aucune réponse'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg bg-slate-900 px-4 py-3 text-white">
                  <p className="text-xs uppercase text-slate-300">Barème maximum</p>
                  <p className="text-lg font-semibold">{maxPoints} pts</p>
                </div>

                <label className="form-control">
                  <span className="label-text mb-2 text-sm font-medium text-slate-700">Points accordés</span>
                  <input
                    type="number"
                    min={0}
                    max={maxPoints}
                    step="0.5"
                    className="input input-bordered"
                    {...form.register('awarded_points', { valueAsNumber: true })}
                  />
                  <span className="mt-2 text-xs text-error">{form.formState.errors.awarded_points?.message}</span>
                </label>

                <label className="form-control">
                  <span className="label-text mb-2 text-sm font-medium text-slate-700">Retour à l'étudiant</span>
                  <textarea className="textarea textarea-bordered min-h-32" {...form.register('feedback')} />
                </label>
              </div>
            </div>

            {gradeMutation.error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{gradeMutation.error.message}</p>
            ) : null}

            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-outline" onClick={() => setSelectedItem(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-neutral" disabled={gradeMutation.isPending}>
                {gradeMutation.isPending ? 'Validation...' : 'Valider la correction'}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
