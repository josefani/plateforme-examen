import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

interface SelectionOption {
  id: number
  label: string
  description?: string
}

interface SelectionListProps {
  title: string
  options: SelectionOption[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  emptyLabel?: string
}

export function SelectionList({
  title,
  options,
  selectedIds,
  onChange,
  emptyLabel = 'Aucun élément disponible',
}: SelectionListProps) {
  const [search, setSearch] = useState('')
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.description ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const toggle = (id: number, checked: boolean) => {
    if (checked) {
      onChange([...selectedIds, id])
      return
    }
    onChange(selectedIds.filter((selectedId) => selectedId !== id))
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{selectedIds.length} sélectionné(s)</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            className="input input-bordered input-sm w-full pl-9 sm:w-56"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher"
          />
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto p-2">
        {filteredOptions.length ? (
          filteredOptions.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="checkbox checkbox-sm mt-1"
                checked={selectedSet.has(option.id)}
                onChange={(event) => toggle(option.id, event.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">{option.label}</span>
                {option.description ? (
                  <span className="block text-xs text-slate-500">{option.description}</span>
                ) : null}
              </span>
            </label>
          ))
        ) : (
          <p className="px-3 py-6 text-center text-sm text-slate-500">{emptyLabel}</p>
        )}
      </div>
    </div>
  )
}
