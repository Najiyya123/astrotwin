'use client'

import { useState } from 'react'
import type { CrewRow } from '@/lib/types'
import { riskColor } from '@/lib/utils'

interface SidebarProps {
  day: number
  astronaut: string
  astronauts: string[]
  today: CrewRow[]
  onDayChange: (day: number) => void
  onAstronautChange: (name: string) => void
}

function getAstronautStatus(rows: CrewRow[], name: string): number {
  const row = rows.find((r) => r.astronaut === name)
  if (!row) return 0
  const risks = [row.risk_bone, row.risk_cardio, row.risk_immune, row.risk_behavioral, row.risk_radiation]
  return Math.max(...risks)
}

export default function Sidebar({
  day,
  astronaut,
  astronauts,
  today,
  onDayChange,
  onAstronautChange,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const content = (
    <div className="flex flex-col h-full p-5 gap-6">
      {/* Logo */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛰️</span>
          <span className="text-xl font-bold text-white tracking-tight">AstroTwin</span>
        </div>
        <p className="text-xs text-slate-500 leading-snug pl-9">
          Your health copilot when<br />Earth is 20 minutes away
        </p>
      </div>

      {/* Mission Day */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Mission Day
          </span>
          <span className="text-blue-400 font-bold text-lg tabular-nums">{day}</span>
        </div>
        <input
          type="range"
          min={1}
          max={180}
          value={day}
          onChange={(e) => onDayChange(Number(e.target.value))}
          className="w-full"
          style={{
            background: `linear-gradient(to right, #3b82f6 ${((day - 1) / 179) * 100}%, rgba(99,179,237,0.2) ${((day - 1) / 179) * 100}%)`,
          }}
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>Day 1</span>
          <span>of 180</span>
        </div>
      </div>

      {/* Astronaut Selector */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Astronaut
        </span>
        <div className="flex flex-col gap-1">
          {astronauts.map((name) => {
            const maxRisk = getAstronautStatus(today, name)
            const color = riskColor(maxRisk)
            const isSelected = name === astronaut
            return (
              <button
                key={name}
                onClick={() => onAstronautChange(name)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 ${
                  isSelected
                    ? 'bg-blue-600/20 border border-blue-500/40 text-slate-200'
                    : 'hover:bg-white/5 text-slate-400 hover:text-slate-300 border border-transparent'
                }`}
              >
                <span
                  className="status-dot shrink-0 w-2 h-2 rounded-full"
                  style={{ backgroundColor: color, color }}
                />
                <span className="text-sm font-medium truncate">{name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Disclaimer */}
      <div className="text-xs text-slate-600 leading-relaxed border-t border-white/5 pt-4">
        Health data is simulated. Space-weather events are real, from NASA&apos;s DONKI database.
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 glass-card p-2.5 rounded-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle sidebar"
      >
        <div className="flex flex-col gap-1.5">
          <span
            className={`block w-5 h-0.5 bg-slate-300 transition-all ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`}
          />
          <span className={`block w-5 h-0.5 bg-slate-300 transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
          <span
            className={`block w-5 h-0.5 bg-slate-300 transition-all ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`}
          />
        </div>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 h-screen sticky top-0 border-r border-[rgba(99,179,237,0.1)] bg-[#060e1f]">
        {content}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-full w-72 z-40 bg-[#060e1f] border-r border-[rgba(99,179,237,0.1)] transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </aside>
    </>
  )
}
