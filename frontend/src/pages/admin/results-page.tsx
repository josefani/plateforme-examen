import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { LoadingScreen } from '../../components/common/loading-screen'
import { ConfirmModal, Modal } from '../../components/common/modal'
import { PageHeader } from '../../components/common/page-header'
import { StatusBadge } from '../../components/common/status-badge'
import { api } from '../../lib/api'
import { formatPercentage } from '../../lib/format'

const publishSchema = z.object({
  exam_id: z.number().min(1, 'Sélectionnez un examen'),
})

type PublishFormValues = z.infer<typeof publishSchema>

export function AdminResultsPage() {
  const queryClient = useQueryClient()
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
  const [attemptToPublish, setAttemptToPublish] = useState<number | null>(null)
  const resultsQuery = useQuery({
    queryKey: ['admin', 'results'],
    queryFn: api.adminResults,
  })
  const examsQuery = useQuery({
    queryKey: ['admin', 'exams'],
    queryFn: api.adminExams,
  })

  const form = useForm<PublishFormValues>({
    resolver: zodResolver(publishSchema),
    defaultValues: {
      exam_id: 0,
    },
  })

  const publishMutation = useMutation({
    mutationFn: (payload: { exam_id?: number; attempt_ids?: number[] }) => api.publishResults(payload),
    onSuccess: async () => {
      setIsPublishModalOpen(false)
      setAttemptToPublish(null)
      form.reset({ exam_id: 0 })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'results'] })
    },
  })

  if (resultsQuery.isLoading || examsQuery.isLoading) {
    return <LoadingScreen label="Chargement des résultats..." />
  }

  const results = resultsQuery.data?.items ?? []
  const exams = examsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Résultats"
        description="Publiez les notes une fois la correction terminée, examen par examen ou tentative par tentative."
        action={
          <button type="button" className="btn btn-neutral" onClick={() => setIsPublishModalOpen(true)}>
            <Send size={16} />
            Publier par examen
          </button>
        }
      />

      <div className="space-y-6">
        <section className="app-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Étudiant</th>
                  <th>Examen</th>
                  <th>Statut</th>
                  <th>Score</th>
                  <th>Publication</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.attempt.id}>
                    <td className="font-semibold text-slate-900">{item.student.full_name}</td>
                    <td>{item.exam.title}</td>
                    <td>
                      <StatusBadge value={item.attempt.status} />
                    </td>
                    <td className="font-semibold text-slate-900">
                      {item.attempt.result?.total_points ?? 0} / {item.attempt.result?.max_points ?? item.attempt.max_score}
                      <div className="text-xs text-slate-500">{formatPercentage(item.attempt.result?.percentage)}</div>
                    </td>
                    <td>
                      {item.attempt.result?.is_published ? (
                        <StatusBadge value="published" />
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setAttemptToPublish(item.attempt.id)}
                        >
                          Publier
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal
        open={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        title="Publier les notes d'un examen"
        description="Les tentatives en cours ou avec correction manuelle en attente ne seront pas publiables."
      >
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => publishMutation.mutate({ exam_id: values.exam_id }))}
        >
          <label className="form-control">
            <span className="label-text mb-2 text-sm font-medium text-slate-700">Examen</span>
            <select
              className="select select-bordered"
              {...form.register('exam_id', { setValueAs: (value) => Number(value) })}
            >
              <option value={0}>Choisir un examen</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
            <span className="mt-2 text-xs text-error">{form.formState.errors.exam_id?.message}</span>
          </label>

          {publishMutation.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{publishMutation.error.message}</p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-outline" onClick={() => setIsPublishModalOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-neutral" disabled={publishMutation.isPending}>
              {publishMutation.isPending ? 'Publication...' : 'Publier'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={attemptToPublish !== null}
        title="Publier cette note"
        description="La note deviendra visible pour l'étudiant."
        confirmLabel="Publier"
        isPending={publishMutation.isPending}
        onCancel={() => setAttemptToPublish(null)}
        onConfirm={() => attemptToPublish && publishMutation.mutate({ attempt_ids: [attemptToPublish] })}
      />
    </div>
  )
}
