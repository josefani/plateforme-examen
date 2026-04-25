import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { LoadingScreen } from '../../components/common/loading-screen'
import { Modal } from '../../components/common/modal'
import { PageHeader } from '../../components/common/page-header'
import { SelectionList } from '../../components/common/selection-list'
import { StatusBadge } from '../../components/common/status-badge'
import { api } from '../../lib/api'

const assignmentSchema = z
  .object({
    exam_id: z.number().min(1, 'Sélectionnez un examen'),
    student_ids: z.array(z.number()),
    group_ids: z.array(z.number()),
  })
  .refine((values) => values.student_ids.length > 0 || values.group_ids.length > 0, {
    message: 'Sélectionnez au moins un étudiant ou un groupe',
    path: ['student_ids'],
  })

type AssignmentFormValues = z.infer<typeof assignmentSchema>

const emptyValues: AssignmentFormValues = {
  exam_id: 0,
  student_ids: [],
  group_ids: [],
}

export function AdminAssignmentsPage() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const examsQuery = useQuery({ queryKey: ['admin', 'exams'], queryFn: api.adminExams })
  const studentsQuery = useQuery({ queryKey: ['admin', 'students'], queryFn: api.adminStudents })
  const groupsQuery = useQuery({ queryKey: ['admin', 'groups'], queryFn: api.adminGroups })
  const assignmentsQuery = useQuery({ queryKey: ['admin', 'assignments'], queryFn: api.adminAssignments })

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: emptyValues,
  })

  const assignMutation = useMutation({
    mutationFn: (values: AssignmentFormValues) =>
      api.assignExam(values.exam_id, {
        student_ids: values.student_ids,
        group_ids: values.group_ids,
      }),
    onSuccess: () => {
      form.reset(emptyValues)
      setIsModalOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'assignments'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
    },
  })

  if (examsQuery.isLoading || studentsQuery.isLoading || groupsQuery.isLoading || assignmentsQuery.isLoading) {
    return <LoadingScreen label="Chargement des affectations..." />
  }

  const exams = examsQuery.data?.items ?? []
  const students = studentsQuery.data?.items ?? []
  const groups = groupsQuery.data?.items ?? []
  const assignments = assignmentsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Affectations"
        description="Affectez un examen à plusieurs étudiants, à des groupes entiers, ou aux deux."
        action={
          <button type="button" className="btn btn-neutral" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            Nouvelle affectation
          </button>
        }
      />

      <section className="app-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Examen</th>
                <th>Cible</th>
                <th>Type</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{assignment.exam.title}</div>
                    <div className="text-sm text-slate-500">{assignment.exam.status}</div>
                  </td>
                  <td>
                    <div className="text-sm text-slate-700">
                      {assignment.student?.full_name ?? assignment.group?.name ?? '-'}
                    </div>
                  </td>
                  <td>
                    <StatusBadge value={assignment.target_type} />
                  </td>
                  <td className="text-sm text-slate-500">{new Date(assignment.assigned_at).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nouvelle affectation"
        description="La recherche et les compteurs gardent l'affectation utilisable avec beaucoup d'utilisateurs."
        size="xl"
      >
        <form className="space-y-5" onSubmit={form.handleSubmit((values) => assignMutation.mutate(values))}>
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

          <div className="grid gap-4 lg:grid-cols-2">
            <SelectionList
              title="Étudiants"
              options={students.map((student) => ({
                id: student.id,
                label: student.full_name,
                description: student.email,
              }))}
              selectedIds={form.watch('student_ids')}
              onChange={(ids) => form.setValue('student_ids', ids)}
              emptyLabel="Aucun étudiant disponible"
            />

            <SelectionList
              title="Groupes"
              options={groups.map((group) => ({
                id: group.id,
                label: group.name,
                description: `${group.members.length} membre(s)`,
              }))}
              selectedIds={form.watch('group_ids')}
              onChange={(ids) => form.setValue('group_ids', ids)}
              emptyLabel="Aucun groupe disponible"
            />
          </div>
          <span className="block text-xs text-error">{form.formState.errors.student_ids?.message}</span>

          {assignMutation.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{assignMutation.error.message}</p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-neutral" disabled={assignMutation.isPending}>
              {assignMutation.isPending ? 'Affectation...' : "Affecter l'examen"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
