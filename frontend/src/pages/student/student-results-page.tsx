import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '../../components/common/empty-state'
import { LoadingScreen } from '../../components/common/loading-screen'
import { PageHeader } from '../../components/common/page-header'
import { StatusBadge } from '../../components/common/status-badge'
import { api } from '../../lib/api'
import { formatDateTime, formatPercentage } from '../../lib/format'

export function StudentResultsPage() {
  const resultsQuery = useQuery({
    queryKey: ['student', 'results'],
    queryFn: api.studentResults,
  })

  if (resultsQuery.isLoading) {
    return <LoadingScreen label="Chargement de vos résultats..." />
  }

  const items = resultsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes résultats"
        description="Consultez ici les notes publiées et les informations de correction disponibles."
      />

      {!items.length ? (
        <EmptyState
          title="Aucun résultat publié"
          description="Vos résultats apparaîtront ici après publication par l'administration."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((exam) => (
            <article key={exam.id} className="app-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{exam.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Publié le {formatDateTime(exam.attempt?.result?.published_at)}
                  </p>
                </div>
                <StatusBadge value={exam.attempt?.status ?? 'graded'} />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Score</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {exam.attempt?.result?.total_points} / {exam.attempt?.result?.max_points}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Pourcentage</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {formatPercentage(exam.attempt?.result?.percentage)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Statut</p>
                  <p className="mt-2 text-sm text-slate-700">{exam.attempt?.status}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
