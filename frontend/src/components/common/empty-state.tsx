import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="app-surface flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="badge badge-outline badge-lg">MVP</div>
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <p className="max-w-md text-sm text-slate-600">{description}</p>
      {action}
    </div>
  )
}
