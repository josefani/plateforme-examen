import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { ConfirmModal, Modal } from '../../components/common/modal'
import { EmptyState } from '../../components/common/empty-state'
import { LoadingScreen } from '../../components/common/loading-screen'
import { PageHeader } from '../../components/common/page-header'
import { SelectionList } from '../../components/common/selection-list'
import { StatusBadge } from '../../components/common/status-badge'
import { api } from '../../lib/api'
import type { User } from '../../types/api'

const studentSchema = z.object({
  full_name: z.string().min(2, 'Nom trop court'),
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères').or(z.literal('')),
  is_active: z.boolean(),
  group_ids: z.array(z.number()),
})

type StudentFormValues = z.infer<typeof studentSchema>

const emptyValues: StudentFormValues = {
  full_name: '',
  email: '',
  password: '',
  is_active: true,
  group_ids: [],
}

export function AdminStudentsPage() {
  const queryClient = useQueryClient()
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [studentToDelete, setStudentToDelete] = useState<User | null>(null)

  const studentsQuery = useQuery({ queryKey: ['admin', 'students'], queryFn: api.adminStudents })
  const groupsQuery = useQuery({ queryKey: ['admin', 'groups'], queryFn: api.adminGroups })

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: emptyValues,
  })

  const openCreateModal = () => {
    setSelectedStudent(null)
    form.reset(emptyValues)
    setIsModalOpen(true)
  }

  const openEditModal = (student: User) => {
    setSelectedStudent(student)
    setIsModalOpen(true)
  }

  useEffect(() => {
    if (!selectedStudent) {
      form.reset(emptyValues)
      return
    }

    form.reset({
      full_name: selectedStudent.full_name,
      email: selectedStudent.email,
      password: '',
      is_active: selectedStudent.is_active,
      group_ids: selectedStudent.groups?.map((group) => group.id) ?? [],
    })
  }, [form, selectedStudent])

  const saveMutation = useMutation({
    mutationFn: async (values: StudentFormValues) => {
      const payload = { ...values, password: values.password || undefined }
      if (selectedStudent) {
        return api.updateStudent(selectedStudent.id, payload)
      }
      return api.createStudent({ ...payload, password: values.password })
    },
    onSuccess: () => {
      setIsModalOpen(false)
      setSelectedStudent(null)
      form.reset(emptyValues)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'students'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteStudent,
    onSuccess: () => {
      setStudentToDelete(null)
      setSelectedStudent(null)
      setIsModalOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'students'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] })
    },
  })

  if (studentsQuery.isLoading || groupsQuery.isLoading) {
    return <LoadingScreen label="Chargement des étudiants..." />
  }

  const students = studentsQuery.data?.items ?? []
  const groups = groupsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Étudiants"
        description="Créez les comptes étudiants, gérez leur statut et leurs groupes."
        action={
          <button type="button" className="btn btn-neutral" onClick={openCreateModal}>
            <Plus size={16} />
            Nouvel étudiant
          </button>
        }
      />

      <section className="app-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Groupes</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{student.full_name}</div>
                    <div className="text-sm text-slate-500">{student.email}</div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {(student.groups ?? []).map((group) => (
                        <span key={group.id} className="badge badge-outline badge-sm">
                          {group.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <StatusBadge value={student.role} />
                  </td>
                  <td>
                    <span className={`badge badge-sm ${student.is_active ? 'badge-success' : 'badge-ghost'}`}>
                      {student.is_active ? 'actif' : 'inactif'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => openEditModal(student)}>
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!students.length ? (
            <div className="p-6">
              <EmptyState title="Aucun étudiant" description="Créez votre premier compte étudiant pour commencer." />
            </div>
          ) : null}
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedStudent ? 'Modifier un étudiant' : 'Nouvel étudiant'}
        description="Le mot de passe vide conserve le mot de passe existant lors d'une modification."
      >
        <form className="space-y-5" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Nom complet</span>
              <input className="input input-bordered w-full" {...form.register('full_name')} />
              <span className="mt-2 text-xs text-error">{form.formState.errors.full_name?.message}</span>
            </label>

            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Email</span>
              <input className="input input-bordered w-full" {...form.register('email')} />
              <span className="mt-2 text-xs text-error">{form.formState.errors.email?.message}</span>
            </label>
          </div>

          <label className="form-control">
            <span className="label-text mb-2 text-sm font-medium text-slate-700">Mot de passe</span>
            <input type="password" className="input input-bordered w-full" {...form.register('password')} />
            <span className="mt-2 text-xs text-error">{form.formState.errors.password?.message}</span>
          </label>

          <label className="label cursor-pointer justify-start gap-3 rounded-lg border border-slate-200 px-4 py-3">
            <input type="checkbox" className="checkbox checkbox-sm" {...form.register('is_active')} />
            <span className="label-text font-medium text-slate-700">Compte actif</span>
          </label>

          <SelectionList
            title="Groupes"
            options={groups.map((group) => ({ id: group.id, label: group.name, description: group.description ?? undefined }))}
            selectedIds={form.watch('group_ids')}
            onChange={(ids) => form.setValue('group_ids', ids)}
          />

          {saveMutation.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveMutation.error.message}</p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {selectedStudent ? (
              <button
                type="button"
                className="btn btn-error btn-outline"
                onClick={() => setStudentToDelete(selectedStudent)}
              >
                Supprimer
              </button>
            ) : null}
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-neutral" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Enregistrement...' : selectedStudent ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(studentToDelete)}
        title="Supprimer cet étudiant"
        description={`Cette action supprimera définitivement ${studentToDelete?.full_name ?? "l'étudiant"}.`}
        confirmLabel="Supprimer"
        danger
        isPending={deleteMutation.isPending}
        onCancel={() => setStudentToDelete(null)}
        onConfirm={() => studentToDelete && deleteMutation.mutate(studentToDelete.id)}
      />
    </div>
  )
}
