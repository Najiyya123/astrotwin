import type { CrewRow, MetricKey } from './types'

export function riskColor(value: number): string {
  if (value >= 70) return '#ef4444'
  if (value >= 40) return '#f59e0b'
  return '#10b981'
}

export function riskLabel(value: number): string {
  if (value >= 70) return 'High'
  if (value >= 40) return 'Watch'
  return 'OK'
}

export function riskBgClass(value: number): string {
  if (value >= 70) return 'bg-red-500/10 text-red-400 border-red-500/20'
  if (value >= 40) return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
}

const WINDOW = 14
const MIN_PERIODS = 7

export function computeRollingStats(
  rows: CrewRow[],
  metric: MetricKey,
): CrewRow[] {
  const byAstronaut = new Map<string, CrewRow[]>()
  for (const row of rows) {
    if (!byAstronaut.has(row.astronaut)) byAstronaut.set(row.astronaut, [])
    byAstronaut.get(row.astronaut)!.push(row)
  }

  const result: CrewRow[] = []
  for (const [, group] of Array.from(byAstronaut)) {
    const sorted = [...group].sort((a, b) => a.day - b.day)
    for (let i = 0; i < sorted.length; i++) {
      const start = Math.max(0, i - WINDOW)
      const window = sorted.slice(start, i).map((r) => r[metric] as number)
      let mean = NaN
      let std = NaN
      if (window.length >= MIN_PERIODS) {
        mean = window.reduce((a, b) => a + b, 0) / window.length
        const variance =
          window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window.length
        std = Math.sqrt(variance)
      }
      result.push({
        ...sorted[i],
        [`mean_${metric}`]: mean,
        [`std_${metric}`]: std,
      } as CrewRow)
    }
  }
  return result
}

export function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}
