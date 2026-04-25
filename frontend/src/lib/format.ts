export function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Non defini'
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function toDateTimeLocalInput(value?: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const adjusted = new Date(date.getTime() - offset * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

export function toApiDate(value?: string) {
  if (!value) {
    return null
  }

  return new Date(value).toISOString()
}

export function formatPercentage(value?: number | null) {
  if (value === null || value === undefined) {
    return '--'
  }
  return `${Math.round(value)}%`
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (!hours) {
    return `${remainingMinutes} min`
  }
  if (!remainingMinutes) {
    return `${hours} h`
  }
  return `${hours} h ${remainingMinutes} min`
}

export function formatRemaining(targetDate: string) {
  const remaining = new Date(targetDate).getTime() - Date.now()
  if (remaining <= 0) {
    return '00:00'
  }

  const totalSeconds = Math.floor(remaining / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
