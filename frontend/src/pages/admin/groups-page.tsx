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
import { api } from '../../lib/api'
import type { Group } from '../../types/api'

const groupSchema = z.object({
  name: z.string().min(2, 'Nom trop court'),
  description: z.string(),
  member_ids: z.array(z.number()),
})

type GroupFormValues = z.infer<typeof groupSchema>

const emptyValues: GroupFormValues = {
  name: '',
  description: '',
  member_ids: [],
}

export function AdminGroupsPage() {
  const queryClient = useQueryClient()
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null)
  const groupsQuery = useQuery({ queryKey: ['admin', 'groups'], queryFn: api.adminGroups })
  const studentsQuery = useQuery({ queryKey: ['admin', 'students'], queryFn: api.adminStudents })

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: emptyValues,
  })

  const openCreateModal = () => {
    setSelectedGroup(null)
    form.reset(emptyValues)
    setIsModalOpen(true)
  }

  const openEditModal = (group: Group) => {
    setSelectedGroup(group)
    setIsModalOpen(true)
  }

  useEffect(() => {
    if (!selectedGroup) {
      form.reset(emptyValues)
      return
    }

    form.reset({
      name: selectedGroup.name,
      description: selectedGroup.description ?? '',
      member_ids: selectedGroup.members.map((member) => member.id),
    })
  }, [form, selectedGroup])

  const saveMutation = useMutation({
    mutationFn: (values: GroupFormValues) => {
      if (selectedGroup) {
        return api.updateGroup(selectedGroup.id, values)
      }
      return api.createGroup(values)
    },
    onSuccess: () => {
      setIsModalOpen(false)
      setSelectedGroup(null)
      form.reset(emptyValues)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'students'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteGroup,
    onSuccess: () => {
      setGroupToDelete(null)
      setIsModalOpen(false)
      setSelectedGroup(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] })
    },
  })

  if (groupsQuery.isLoading || studentsQuery.isLoading) {
    return <LoadingScreen label="Chargement des groupes..." />
  }

  const groups = groupsQuery.data?.items ?? []
  const students = studentsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groupes"
        description="Organisez les promotions de trois mois et réutilisez-les pour les affectations."
        action={
          <button type="button" className="btn btn-neutral" onClick={openCreateModal}>
            <Plus size={16} />
            Nouveau groupe
          </button>
        }
      />

      <section className="app-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Groupe</th>
                <th>Description</th>
                <th>Membres</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td className="font-semibold text-slate-900">{group.name}</td>
                  <td className="max-w-xs text-sm text-slate-600">{group.description || '-'}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {group.members.map((member) => (
                        <span key={member.id} className="badge badge-outline badge-sm">
                          {member.full_name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => openEditModal(group)}>
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!groups.length ? (
            <div className="p-6">
              <EmptyState title="Aucun groupe" description="Créez une formation pour affecter vos examens plus vite." />
            </div>
          ) : null}
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedGroup ? 'Modifier un groupe' : 'Nouveau groupe'}
        description="Sélectionnez les étudiants concernés, même si la liste devient longue."
      >
        <form className="space-y-5" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
          <label className="form-control">
            <span className="label-text mb-2 text-sm font-medium text-slate-700">Nom du groupe</span>
            <input className="input input-bordered w-full" {...form.register('name')} />
            <span className="mt-2 text-xs text-error">{form.formState.errors.name?.message}</span>
          </label>

          <label className="form-control">
            <span className="label-text mb-2 text-sm font-medium text-slate-700">Description</span>
            <textarea className="textarea textarea-bordered min-h-28 w-full" {...form.register('description')} />
          </label>

          <SelectionList
            title="Membres"
            options={students.map((student) => ({
              id: student.id,
              label: student.full_name,
              description: student.email,
            }))}
            selectedIds={form.watch('member_ids')}
            onChange={(ids) => form.setValue('member_ids', ids)}
            emptyLabel="Aucun étudiant disponible"
          />

          {saveMutation.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveMutation.error.message}</p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {selectedGroup ? (
              <button type="button" className="btn btn-error btn-outline" onClick={() => setGroupToDelete(selectedGroup)}>
                Supprimer
              </button>
            ) : null}
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-neutral" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Enregistrement...' : selectedGroup ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(groupToDelete)}
        title="Supprimer ce groupe"
        description={`Cette action supprimera le groupe ${groupToDelete?.name ?? ''} et ses rattachements.`}
        confirmLabel="Supprimer"
        danger
        isPending={deleteMutation.isPending}
        onCancel={() => setGroupToDelete(null)}
        onConfirm={() => groupToDelete && deleteMutation.mutate(groupToDelete.id)}
      />
    </div>
  )
}
