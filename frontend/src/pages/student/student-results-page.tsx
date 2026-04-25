import { useQuery } from '@tanstack/react-query'
import { Award, XCircle, Trophy, TrendingUp, Clock } from 'lucide-react'
import { EmptyState } from '../../components/common/empty-state'
import { LoadingScreen } from '../../components/common/loading-screen'
import { PageHeader } from '../../components/common/page-header'
import { StatusBadge } from '../../components/common/status-badge'
import { api } from '../../lib/api'
import { formatDateTime, formatPercentage } from '../../lib/format'

const PASS_THRESHOLD = 75

function PercentageRing({ percentage }: { percentage: number }) {
  const passed = percentage >= PASS_THRESHOLD
  const radius = 40
  const stroke = 6
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(percentage, 100)
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={passed ? '#dcfce7' : '#fee2e2'}
          strokeWidth={stroke}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={passed ? '#22c55e' : '#ef4444'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
          {formatPercentage(percentage)}
        </span>
      </div>
    </div>
  )
}

function PassFailBadge({ percentage }: { percentage: number }) {
  const passed = percentage >= PASS_THRESHOLD

  if (passed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 ring-1 ring-green-200">
        <Trophy size={16} className="text-green-600" />
        <span className="text-sm font-bold text-green-700">Réussi</span>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 ring-1 ring-red-200">
      <XCircle size={16} className="text-red-600" />
      <span className="text-sm font-bold text-red-700">Échoué</span>
    </div>
  )
}

export function StudentResultsPage() {
  const resultsQuery = useQuery({
    queryKey: ['student', 'results'],
    queryFn: api.studentResults,
  })

  if (resultsQuery.isLoading) {
    return <LoadingScreen label="Chargement de vos résultats..." />
  }

  const items = resultsQuery.data?.items ?? []

  const passedCount = items.filter(
    (exam) => (exam.attempt?.result?.percentage ?? 0) >= PASS_THRESHOLD,
  ).length
  const failedCount = items.filter(
    (exam) =>
      exam.attempt?.result?.percentage !== undefined &&
      exam.attempt?.result?.percentage !== null &&
      exam.attempt.result.percentage < PASS_THRESHOLD,
  ).length

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
        <>
          {/* Summary stats */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="app-surface flex items-center gap-4 p-4">
              <div className="rounded-xl bg-sky-50 p-3">
                <Award size={20} className="text-sky-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total examens</p>
                <p className="text-2xl font-bold text-slate-900">{items.length}</p>
              </div>
            </div>
            <div className="app-surface flex items-center gap-4 p-4">
              <div className="rounded-xl bg-green-50 p-3">
                <TrendingUp size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Réussis</p>
                <p className="text-2xl font-bold text-green-600">{passedCount}</p>
              </div>
            </div>
            <div className="app-surface flex items-center gap-4 p-4">
              <div className="rounded-xl bg-red-50 p-3">
                <XCircle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Échoués</p>
                <p className="text-2xl font-bold text-red-600">{failedCount}</p>
              </div>
            </div>
          </div>

          {/* Result cards */}
          <div className="grid gap-4 xl:grid-cols-2">
            {items.map((exam) => {
              const percentage = exam.attempt?.result?.percentage ?? 0
              const passed = percentage >= PASS_THRESHOLD

              return (
                <article
                  key={exam.id}
                  className={`app-surface overflow-hidden transition-shadow hover:shadow-md ${
                    passed ? 'ring-1 ring-green-100' : 'ring-1 ring-red-100'
                  }`}
                >
                  {/* Colored top bar */}
                  <div
                    className={`h-1.5 ${passed ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-rose-500'}`}
                  />

                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold text-slate-900">{exam.title}</h2>
                          <StatusBadge value={exam.attempt?.status ?? 'graded'} />
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                          <Clock size={14} />
                          <span>Publié le {formatDateTime(exam.attempt?.result?.published_at)}</span>
                        </div>
                      </div>
                      <PassFailBadge percentage={percentage} />
                    </div>

                    <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
                      {/* Percentage ring */}
                      <PercentageRing percentage={percentage} />

                      {/* Score details */}
                      <div className="grid flex-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Score obtenu</p>
                          <p className="mt-2 text-lg font-bold text-slate-900">
                            {exam.attempt?.result?.total_points ?? '--'}{' '}
                            <span className="text-sm font-medium text-slate-400">
                              / {exam.attempt?.result?.max_points ?? '--'}
                            </span>
                          </p>
                        </div>
                        <div
                          className={`rounded-2xl p-4 ${
                            passed ? 'bg-green-50' : 'bg-red-50'
                          }`}
                        >
                          <p
                            className={`text-xs font-semibold uppercase tracking-wider ${
                              passed ? 'text-green-500' : 'text-red-500'
                            }`}
                          >
                            Verdict
                          </p>
                          <p
                            className={`mt-2 text-lg font-bold ${
                              passed ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {passed ? '✓ Admis' : '✗ Non admis'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Seuil de réussite : {PASS_THRESHOLD}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
