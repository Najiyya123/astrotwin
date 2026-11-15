'use client'

import type { CrewRow, WeatherRow, MetricKey } from '@/lib/types'
import { ACTIONS, METRICS } from '@/lib/types'

interface AlertBannerProps {
  row: CrewRow | null
  eventsNow: WeatherRow[]
  astronaut: string
}

function getUnusualMetrics(row: CrewRow, threshold = 2.5) {
  const found: { metric: MetricKey; z: number; message: string }[] = []
  for (const [col, { direction, message }] of Object.entries(ACTIONS) as [
    MetricKey,
    { direction: 1 | -1; message: string },
  ][]) {
    const z = row[`z_${col}` as keyof CrewRow] as number
    if (!isNaN(z) && direction * z >= threshold) {
      found.push({ metric: col, z, message })
    }
  }
  return found
}

export default function AlertBanner({ row, eventsNow, astronaut }: AlertBannerProps) {
  if (!row) return null

  const highEvents = eventsNow.filter((e) => e.severity === 'high')
  const isSolarAlert = row.solar_storm_alert || highEvents.length > 0
  const flags = getUnusualMetrics(row)
  const isAnomalous = row.is_anomaly || flags.length > 0

  return (
    <div className="flex flex-col gap-2">
      {isSolarAlert && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10">
          <span className="text-2xl mt-0.5 shrink-0">☢️</span>
          <div>
            <p className="font-semibold text-red-300">SOLAR STORM ALERT — move crew to shielded shelter now</p>
            {highEvents.length > 0 && (
              <p className="text-sm text-red-400/80 mt-0.5">
                NASA DONKI: {highEvents.map((e) => e.detail).slice(0, 3).join('; ')}
              </p>
            )}
          </div>
        </div>
      )}

      {isAnomalous ? (
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <p className="font-semibold text-amber-300">
            ⚠️ {astronaut}: today looks unusual for you
          </p>
          {flags.map(({ metric, z, message }) => (
            <div key={metric} className="text-sm text-amber-200/80">
              <span className="font-medium">{METRICS[metric].label}</span> is {Math.abs(z).toFixed(1)}× your
              normal spread. {message}
            </div>
          ))}
        </div>
      ) : !isSolarAlert ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <span className="text-emerald-400">✓</span>
          <p className="text-emerald-300 font-medium">
            {astronaut}: all readings within your personal normal today
          </p>
        </div>
      ) : null}
    </div>
  )
}
