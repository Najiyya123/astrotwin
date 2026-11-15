'use client'

import dynamic from 'next/dynamic'
import type { WeatherRow } from '@/lib/types'

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className="skeleton h-56 w-full" />,
})

interface SpaceWeatherTabProps {
  weather: WeatherRow[]
  day: number
}

const SEV_COLOR: Record<string, string> = {
  high: '#ef4444',
  moderate: '#f59e0b',
  low: '#10b981',
}

const SEV_LABEL: Record<string, string> = {
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
}

export default function SpaceWeatherTab({ weather, day }: SpaceWeatherTabProps) {
  if (weather.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-slate-500">
        No space-weather data. Run <code className="text-blue-400">python donki.py</code> first.
      </div>
    )
  }

  const soFar = weather.filter((e) => e.mission_day <= day)
  const highCount = soFar.filter((e) => e.severity === 'high').length
  const modCount = soFar.filter((e) => e.severity === 'moderate').length

  const traces = (['high', 'moderate', 'low'] as const).map((sev) => {
    const events = soFar.filter((e) => e.severity === sev)
    return {
      x: events.map((e) => e.mission_day),
      y: events.map((e) => e.type),
      mode: 'markers' as const,
      type: 'scatter' as const,
      name: SEV_LABEL[sev],
      marker: { size: 11, color: SEV_COLOR[sev], opacity: 0.85 },
      text: events.map((e) => e.detail),
      hovertemplate: 'Day %{x}<br>%{text}<extra></extra>',
    }
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="metric-card">
          <span className="text-xs text-slate-500 uppercase tracking-widest">Total events</span>
          <span className="text-3xl font-bold text-slate-100">{soFar.length}</span>
          <span className="text-xs text-slate-500">through day {day}</span>
        </div>
        <div className="metric-card">
          <span className="text-xs text-slate-500 uppercase tracking-widest">High severity</span>
          <span className="text-3xl font-bold text-red-400">{highCount}</span>
          <span className="text-xs text-slate-500">shelter required</span>
        </div>
        <div className="metric-card">
          <span className="text-xs text-slate-500 uppercase tracking-widest">Moderate</span>
          <span className="text-3xl font-bold text-amber-400">{modCount}</span>
          <span className="text-xs text-slate-500">elevated radiation</span>
        </div>
      </div>

      {/* Scatter plot */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Events by mission day &amp; type</h3>
        <Plot
          data={traces}
          layout={{
            height: 240,
            margin: { l: 130, r: 20, t: 10, b: 50 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'rgba(13,26,53,0.5)',
            font: { color: '#94a3b8', family: 'Inter', size: 11 },
            xaxis: {
              title: { text: 'Mission day', font: { color: '#64748b' } },
              range: [1, 180],
              gridcolor: 'rgba(255,255,255,0.05)',
              linecolor: '#1e3a5f',
              tickfont: { color: '#64748b' },
            },
            yaxis: {
              gridcolor: 'rgba(255,255,255,0.05)',
              linecolor: '#1e3a5f',
              tickfont: { color: '#64748b' },
              automargin: true,
            },
            legend: {
              font: { color: '#94a3b8', size: 11 },
              bgcolor: 'transparent',
            },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-x-auto">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-slate-300">Event log</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {['Day', 'Date', 'Type', 'Detail', 'Severity'].map((h) => (
                <th key={h} className="text-left p-3 pl-4 text-slate-500 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...soFar].sort((a, b) => b.mission_day - a.mission_day).map((e, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/2">
                <td className="p-3 pl-4 tabular-nums text-slate-300">{e.mission_day}</td>
                <td className="p-3 text-slate-400 whitespace-nowrap">{e.date}</td>
                <td className="p-3 text-slate-300">{e.type}</td>
                <td className="p-3 text-slate-400 max-w-xs truncate">{e.detail}</td>
                <td className="p-3">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize"
                    style={{
                      color: SEV_COLOR[e.severity],
                      backgroundColor: `${SEV_COLOR[e.severity]}18`,
                    }}
                  >
                    {e.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-600 p-4">
          Source: NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information), via NASA CCMC.
        </p>
      </div>
    </div>
  )
}
