export function LoadingScreen({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <span className="loading loading-spinner loading-sm text-info" />
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
    </div>
  )
}
