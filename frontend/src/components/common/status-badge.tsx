interface StatusBadgeProps {
  value: string
}

const statusClasses: Record<string, string> = {
  draft: 'badge-warning',
  published: 'badge-success',
  archived: 'badge-ghost',
  in_progress: 'badge-info',
  submitted: 'badge-warning',
  auto_submitted: 'badge-error',
  graded: 'badge-success',
  open: 'badge-success',
  upcoming: 'badge-warning',
  closed: 'badge-neutral',
  student: 'badge-info',
  admin: 'badge-secondary',
  group: 'badge-accent',
}

const statusLabels: Record<string, string> = {
  draft: 'brouillon',
  published: 'publié',
  archived: 'archivé',
  in_progress: 'en cours',
  submitted: 'soumis',
  auto_submitted: 'soumis automatiquement',
  graded: 'corrigé',
  open: 'ouvert',
  upcoming: 'à venir',
  closed: 'fermé',
  student: 'étudiant',
  admin: 'administrateur',
  group: 'groupe',
  single_choice: 'choix unique',
  multiple_choice: 'choix multiple',
  true_false: 'vrai / faux',
  short_text: 'réponse libre',
}

export function StatusBadge({ value }: StatusBadgeProps) {
  return (
    <span className={`badge badge-sm border-0 capitalize ${statusClasses[value] ?? 'badge-neutral'}`}>
      {statusLabels[value] ?? value.replaceAll('_', ' ')}
    </span>
  )
}
