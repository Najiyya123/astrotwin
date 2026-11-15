'use client'

import type { CrewRow } from '@/lib/types'
import { formatDate, riskColor } from '@/lib/utils'

interface HeaderProps {
  day: number
  row: CrewRow | null
  crewCount: number
}

export default function Header({ day, row, crewCount }: HeaderProps) {
  const dateStr = row ? formatDate(row.date) : '—'

  return (
    <div className="flex flex-col gap-1 pb-4 border-b border-white/5 pl-14 lg:pl-0">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
          Mission Day{' '}
          <span className="text-blue-400">{day}</span>
          <span className="text-slate-500"> / 180</span>
        </h1>
        <span className="text-sm text-slate-500 font-medium">
          {Math.round((day / 180) * 100)}% of journey complete
        </span>
      </div>
      <p className="text-sm text-slate-400">
        {dateStr}
        <span className="text-slate-600 mx-2">·</span>
        Transit to Mars
        <span className="text-slate-600 mx-2">·</span>
        Crew of {crewCount}
      </p>

      {/* Distance indicator */}
      <div className="mt-2 flex items-center gap-3">
        <div className="flex-1 max-w-xs h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300"
            style={{ width: `${(day / 180) * 100}%` }}
          />
        </div>
        <span className="text-xs text-slate-500 tabular-nums">
          ~{Math.round((day / 180) * 225)} M km from Earth
        </span>
      </div>
    </div>
  )
}
