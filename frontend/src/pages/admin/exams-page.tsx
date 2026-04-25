import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LoadingScreen } from '../../components/common/loading-screen'
import { PageHeader } from '../../components/common/page-header'
import { StatusBadge } from '../../components/common/status-badge'
import { api } from '../../lib/api'
import { formatDateTime, formatDuration } from '../../lib/format'

export function AdminExamsPage() {
  const examsQuery = useQuery({
    queryKey: ['admin', 'exams'],
    queryFn: api.adminExams,
  })

  if (examsQuery.isLoading) {
    return <LoadingScreen label="Chargement des examens..." />
  }

  const exams = examsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examens"
        description="Consultez vos examens existants et ouvrez l'éditeur pour en créer ou en modifier."
        action={
          <Link to="/admin/exams/new" className="btn btn-neutral">
            Créer un examen
          </Link>
        }
      />

      <section className="grid gap-4 xl:grid-cols-2">
        {exams.map((exam) => (
          <article key={exam.id} className="app-surface p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-900">{exam.title}</h2>
                  <StatusBadge value={exam.status} />
                </div>
                <p className="mt-3 text-sm text-slate-600">{exam.description || 'Sans description'}</p>
              </div>
              <Link to={`/admin/exams/${exam.id}/edit`} className="btn btn-sm btn-outline">
                Modifier
              </Link>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Durée</p>
                <p className="mt-1">{formatDuration(exam.duration_minutes)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Points</p>
                <p className="mt-1">{exam.total_points}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Disponible du</p>
                <p className="mt-1">{formatDateTime(exam.available_from)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Jusqu’au</p>
                <p className="mt-1">{formatDateTime(exam.available_until)}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
