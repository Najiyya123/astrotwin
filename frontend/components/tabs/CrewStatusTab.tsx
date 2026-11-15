'use client'

import type { CrewRow } from '@/lib/types'
import { RISKS } from '@/lib/types'
import { riskColor } from '@/lib/utils'
import RiskGauge from '@/components/charts/RiskGauge'

interface CrewStatusTabProps {
  row: CrewRow | null
  today: CrewRow[]
  astronaut: string
}

export default function CrewStatusTab({ row, today, astronaut }: CrewStatusTabProps) {
  if (!row) return <div className="skeleton h-48 w-full" />

  return (
    <div className="flex flex-col gap-6">
      {/* Gauges */}
      <div>
        <h2 className="text-base font-semibold text-slate-300 mb-3">
          {astronaut} — Risk by NASA category
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(Object.entries(RISKS) as [keyof typeof RISKS, string][]).map(([key, label]) => (
            <RiskGauge key={key} value={row[key]} title={label} />
          ))}
        </div>
      </div>

      {/* Crew table */}
      <div className="glass-card overflow-x-auto">
        <div className="p-4 border-b border-white/5">
          <h2 className="text-base font-semibold text-slate-300">Whole crew today</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left p-3 pl-4 text-slate-500 font-medium">Astronaut</th>
              {Object.values(RISKS).map((label) => (
                <th key={label} className="text-center p-3 text-slate-500 font-medium whitespace-nowrap">
                  {label}
                </th>
              ))}
              <th className="text-center p-3 text-slate-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {today.map((crewRow) => (
              <tr
                key={crewRow.astronaut}
                className={`border-b border-white/5 transition-colors ${
                  crewRow.astronaut === astronaut ? 'bg-blue-600/8' : 'hover:bg-white/2'
                }`}
              >
                <td className="p-3 pl-4 font-medium text-slate-200 whitespace-nowrap">
                  {crewRow.astronaut === astronaut && (
                    <span className="text-blue-400 mr-1">›</span>
                  )}
                  {crewRow.astronaut}
                </td>
                {(Object.keys(RISKS) as (keyof typeof RISKS)[]).map((key) => {
                  const val = crewRow[key]
                  const color = riskColor(val)
                  return (
                    <td key={key} className="p-3 text-center tabular-nums">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ color, backgroundColor: `${color}18` }}
                      >
                        {val.toFixed(0)}
                      </span>
                    </td>
                  )
                })}
                <td className="p-3 text-center">
                  {crewRow.is_anomaly ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      ⚠️ Check
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      ✓ Normal
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer metrics */}
      <div className="glass-card p-4 flex flex-wrap gap-6 text-sm text-slate-400">
        <div>
          <span className="text-slate-500">Cumulative radiation: </span>
          <span className="text-slate-200 font-medium">{row.cumulative_dose_msv.toFixed(0)} mSv</span>
          <span className="text-slate-500"> of NASA&apos;s 600 mSv career limit</span>
        </div>
        <div>
          <span className="text-slate-500">Bone density: </span>
          <span
            className="font-medium"
            style={{ color: riskColor(100 - row.bone_density_pct) }}
          >
            {row.bone_density_pct.toFixed(1)}%
          </span>
          <span className="text-slate-500"> of pre-flight baseline</span>
        </div>
      </div>
    </div>
  )
}
