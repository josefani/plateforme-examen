import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock3, ShieldCheck } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { LoadingScreen } from '../../components/common/loading-screen'
import { PageHeader } from '../../components/common/page-header'
import { StatusBadge } from '../../components/common/status-badge'
import { api } from '../../lib/api'
import { formatDateTime, formatDuration } from '../../lib/format'

export function ExamInstructionsPage() {
  const navigate = useNavigate()
  const { examId } = useParams()

  const examQuery = useQuery({
    queryKey: ['student', 'exam', examId],
    queryFn: () => api.studentExam(Number(examId)),
  })

  const startMutation = useMutation({
    mutationFn: () => api.startExam(Number(examId)),
    onSuccess: (payload) => {
      navigate(`/student/attempts/${payload.item.attempt.id}/session`)
    },
  })

  if (examQuery.isLoading) {
    return <LoadingScreen label="Chargement des consignes..." />
  }

  const exam = examQuery.data?.item
  if (!exam) {
    return null
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={exam.title}
        description="Lisez attentivement les consignes avant de demarrer votre tentative."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="app-surface p-6">
          <div className="flex items-center gap-3">
            <StatusBadge value={exam.availability} />
            <StatusBadge value={exam.status} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Duree</p>
              <p className="mt-2 text-sm text-slate-600">{formatDuration(exam.duration_minutes)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Points</p>
              <p className="mt-2 text-sm text-slate-600">{exam.total_points}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Ouverture</p>
              <p className="mt-2 text-sm text-slate-600">{formatDateTime(exam.available_from)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Fermeture</p>
              <p className="mt-2 text-sm text-slate-600">{formatDateTime(exam.available_until)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">Regles importantes</p>
            <ul className="mt-3 space-y-2">
              <li>Un heartbeat est envoye regulierement pendant l’examen.</li>
              <li>Les pertes de focus et certaines actions suspectes sont journalisees.</li>
              <li>Les reponses sont autosauvegardees periodiquement.</li>
              <li>Une fois soumis, l’examen ne peut plus etre modifie.</li>
            </ul>
          </div>
        </section>

        <section className="app-surface p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-slate-900">
              <Clock3 size={18} />
              <p className="font-semibold">Mode {exam.mode}</p>
            </div>
            <div className="flex items-center gap-3 text-slate-900">
              <ShieldCheck size={18} />
              <p className="font-semibold">Autosave et surveillance basique actives</p>
            </div>
            <div className="flex items-start gap-3 text-slate-900">
              <AlertTriangle size={18} className="mt-1" />
              <p className="font-semibold">
                En quittant l’onglet ou en perdant trop longtemps le heartbeat, votre tentative peut etre soumise automatiquement.
              </p>
            </div>
          </div>

          <div className="soft-divider mt-6 pt-6">
            <h2 className="text-lg font-semibold text-slate-900">Consignes</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {exam.instructions || 'Aucune consigne specifique.'}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {exam.attempt?.status === 'in_progress' ? (
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => navigate(`/student/attempts/${exam.attempt?.id}/session`)}
              >
                Reprendre la tentative
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-neutral"
                disabled={startMutation.isPending || exam.availability !== 'open'}
                onClick={() => startMutation.mutate()}
              >
                {startMutation.isPending ? 'Demarrage...' : 'Commencer l’examen'}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
