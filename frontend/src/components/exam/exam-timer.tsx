import { useEffect, useState } from 'react'
import { formatRemaining } from '../../lib/format'

export function ExamTimer({ deadlineAt }: { deadlineAt: string }) {
  const [value, setValue] = useState(() => formatRemaining(deadlineAt))

  useEffect(() => {
    const timer = window.setInterval(() => {
      setValue(formatRemaining(deadlineAt))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [deadlineAt])

  const isCritical = value.startsWith('00:') || value.startsWith('00')

  return (
    <div className={`rounded-3xl px-5 py-4 ${isCritical ? 'bg-red-50 text-red-700' : 'bg-slate-900 text-white'}`}>
      <p className={`text-xs uppercase tracking-[0.25em] ${isCritical ? 'text-red-500' : 'text-slate-300'}`}>
        Temps restant
      </p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}
