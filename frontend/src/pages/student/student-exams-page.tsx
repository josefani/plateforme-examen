import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '../../components/common/empty-state'
import { LoadingScreen } from '../../components/common/loading-screen'
import { PageHeader } from '../../components/common/page-header'
import { StatusBadge } from '../../components/common/status-badge'
import { api } from '../../lib/api'
import { formatDateTime, formatDuration } from '../../lib/format'

export function StudentExamsPage() {
  const examsQuery = useQuery({
    queryKey: ['student', 'exams'],
    queryFn: api.studentExams,
  })

  if (examsQuery.isLoading) {
    return <LoadingScreen label="Chargement de vos examens..." />
  }

  const exams = examsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes examens"
        description="Consultez vos examens affectés, leur fenêtre d'ouverture et l'avancement de vos tentatives."
      />

      {!exams.length ? (
        <EmptyState
          title="Aucun examen disponible"
          description="Aucune affectation n'a encore été publiée sur votre compte."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {exams.map((exam) => (
            <article key={exam.id} className="app-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-900">{exam.title}</h2>
                    <StatusBadge value={exam.availability} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{exam.description || 'Sans description'}</p>
                </div>

                <Link
                  to={
                    exam.attempt?.status === 'in_progress'
                      ? `/student/attempts/${exam.attempt.id}/session`
                      : `/student/exams/${exam.id}`
                  }
                  className="btn btn-sm btn-neutral"
                >
                  {exam.attempt?.status === 'in_progress' ? 'Reprendre' : 'Voir'}
                </Link>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Durée</p>
                  <p className="mt-1">{formatDuration(exam.duration_minutes)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Points</p>
                  <p className="mt-1">{exam.total_points}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Ouverture</p>
                  <p className="mt-1">{formatDateTime(exam.available_from)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Fermeture</p>
                  <p className="mt-1">{formatDateTime(exam.available_until)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
