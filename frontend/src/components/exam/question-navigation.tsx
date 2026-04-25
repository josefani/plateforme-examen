interface QuestionNavigationProps {
  total: number
  currentIndex: number
  answeredCount: number
  isAnswered: (index: number) => boolean
  onSelect: (index: number) => void
}

export function QuestionNavigation({
  total,
  currentIndex,
  answeredCount,
  isAnswered,
  onSelect,
}: QuestionNavigationProps) {
  return (
    <aside className="app-surface p-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Progression</p>
          <p className="text-2xl font-bold text-slate-900">
            {answeredCount} / {total}
          </p>
        </div>
        <progress className="progress progress-info w-32" value={answeredCount} max={total} />
      </div>

      <div className="mt-5 grid grid-cols-5 gap-2">
        {Array.from({ length: total }, (_, index) => (
          <button
            key={index}
            type="button"
            className={`flex h-11 items-center justify-center rounded-2xl text-sm font-semibold transition ${
              currentIndex === index
                ? 'bg-slate-900 text-white'
                : isAnswered(index)
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            onClick={() => onSelect(index)}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </aside>
  )
}
