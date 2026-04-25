import { useQuery } from '@tanstack/react-query'
import { BarChart3, BookOpen, ClipboardCheck, FileSpreadsheet, Users, UserSquare2 } from 'lucide-react'
import { EmptyState } from '../../components/common/empty-state'
import { LoadingScreen } from '../../components/common/loading-screen'
import { PageHeader } from '../../components/common/page-header'
import { StatCard } from '../../components/common/stat-card'
import { StatusBadge } from '../../components/common/status-badge'
import { api } from '../../lib/api'
import { formatDateTime, formatPercentage } from '../../lib/format'

export function AdminDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: api.adminDashboard,
  })
  const examsQuery = useQuery({
    queryKey: ['admin', 'exams'],
    queryFn: api.adminExams,
  })
  const gradingQuery = useQuery({
    queryKey: ['admin', 'grading', 'pending'],
    queryFn: api.pendingManualGrading,
  })
  const resultsQuery = useQuery({
    queryKey: ['admin', 'results'],
    queryFn: api.adminResults,
  })

  if (dashboardQuery.isLoading) {
    return <LoadingScreen label="Chargement du tableau de bord..." />
  }

  const dashboard = dashboardQuery.data
  if (!dashboard) {
    return (
      <EmptyState
        title="Tableau de bord indisponible"
        description="Impossible de récupérer les indicateurs du backoffice."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble des étudiants, des examens publiés et du flux de correction."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Étudiants"
          value={dashboard.students}
          hint="Utilisateurs étudiants actifs ou inactifs"
          icon={<UserSquare2 size={20} />}
        />
        <StatCard
          label="Groupes"
          value={dashboard.groups}
          hint="Formations et promotions structurées"
          icon={<Users size={20} />}
        />
        <StatCard
          label="Banque de questions"
          value={dashboard.questions}
          hint="Questions réutilisables pour les examens"
          icon={<BookOpen size={20} />}
        />
        <StatCard
          label="Examens publiés"
          value={dashboard.published_exams}
          hint="Examens actuellement visibles par les étudiants"
          icon={<BarChart3 size={20} />}
        />
        <StatCard
          label="Corrections en attente"
          value={dashboard.pending_manual_grading}
          hint="Réponses libres à traiter manuellement"
          icon={<ClipboardCheck size={20} />}
        />
        <StatCard
          label="Résultats publiés"
          value={dashboard.published_results}
          hint="Tentatives dont les notes sont visibles"
          icon={<FileSpreadsheet size={20} />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="app-surface overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Examens recents</h2>
              <p className="text-sm text-slate-500">Etat, fenetre et score maximal.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Statut</th>
                  <th>Disponibilite</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {(examsQuery.data?.items ?? []).slice(0, 6).map((exam) => (
                  <tr key={exam.id}>
                    <td>
                      <div className="font-semibold text-slate-900">{exam.title}</div>
                      <div className="text-xs text-slate-500">{exam.mode}</div>
                    </td>
                    <td>
                      <StatusBadge value={exam.status} />
                    </td>
                    <td className="text-sm text-slate-600">
                      <div>{formatDateTime(exam.available_from)}</div>
                      <div>{formatDateTime(exam.available_until)}</div>
                    </td>
                    <td className="font-semibold text-slate-900">{exam.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-surface p-6">
            <h2 className="text-lg font-semibold text-slate-900">Correction manuelle</h2>
            <p className="mt-1 text-sm text-slate-500">
              {gradingQuery.data?.items.length ?? 0} reponse(s) libre(s) attendent une note.
            </p>
            <div className="mt-5 space-y-3">
              {(gradingQuery.data?.items ?? []).slice(0, 3).map((item) => (
                <div key={item.answer.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{item.student.full_name}</p>
                  <p className="text-sm text-slate-500">{item.exam.title}</p>
                  <p className="mt-2 text-sm text-slate-700">{item.answer.question.title}</p>
                </div>
              ))}
              {!gradingQuery.data?.items.length ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  Aucun lot de correction en attente.
                </p>
              ) : null}
            </div>
          </div>

          <div className="app-surface p-6">
            <h2 className="text-lg font-semibold text-slate-900">Publications recentes</h2>
            <div className="mt-4 space-y-3">
              {(resultsQuery.data?.items ?? []).slice(0, 4).map((item) => (
                <div key={item.attempt.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                  <div>
                    <p className="font-semibold text-slate-900">{item.student.full_name}</p>
                    <p className="text-sm text-slate-500">{item.exam.title}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge value={item.attempt.result?.is_published ? 'published' : item.attempt.status} />
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {formatPercentage(item.attempt.result?.percentage)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
