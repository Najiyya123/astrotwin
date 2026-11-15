'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { CrewRow, MetricKey } from '@/lib/types'
import { METRICS, RISKS } from '@/lib/types'
import TrendChart from '@/components/charts/TrendChart'

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className="skeleton h-64 w-full" />,
})

interface TrendsTabProps {
  personHistory: CrewRow[]
  day: number
  stormDays: number[]
}

export default function TrendsTab({ personHistory, day, stormDays }: TrendsTabProps) {
  const [metric, setMetric] = useState<MetricKey>('resting_hr')

  const data = personHistory.filter((r) => r.day <= day)

  const riskTraces = (Object.entries(RISKS) as [keyof typeof RISKS, string][]).map(([key, label]) => ({
    x: data.map((r) => r.day),
    y: data.map((r) => r[key]),
    name: label,
    mode: 'lines' as const,
    type: 'scatter' as const,
    hovertemplate: `${label}: %{y:.0f}<extra></extra>`,
    line: { width: 2 },
  }))

  return (
    <div className="flex flex-col gap-6">
      {/* Metric selector */}
      <div className="glass-card p-4 flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-slate-400">Measurement:</span>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(METRICS) as [MetricKey, { label: string; unit: string }][]).map(
              ([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setMetric(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    metric === key
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        <TrendChart personHistory={personHistory} metric={metric} day={day} stormDays={stormDays} />

        <p className="text-xs text-slate-500">
          Green band = this astronaut&apos;s own normal range (previous 14 days) ·{' '}
          <span className="text-red-400">Red ✕</span> = days the AI flagged ·{' '}
          <span className="text-purple-400">Purple lines</span> = major solar events
        </p>
      </div>

      {/* Risk history */}
      <div className="glass-card p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-300">Risk score history — all categories</h3>
        <Plot
          data={riskTraces}
          layout={{
            height: 280,
            margin: { l: 50, r: 20, t: 10, b: 50 },
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
              title: { text: 'Risk (0–100)', font: { color: '#64748b' } },
              range: [0, 100],
              gridcolor: 'rgba(255,255,255,0.05)',
              linecolor: '#1e3a5f',
              tickfont: { color: '#64748b' },
            },
            legend: {
              orientation: 'h',
              y: 1.12,
              font: { color: '#94a3b8', size: 11 },
              bgcolor: 'transparent',
            },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
        <div className="flex gap-3 flex-wrap">
          <span className="text-xs text-slate-600">
            Risk 0–39: <span className="text-emerald-400">OK</span> · 40–69:{' '}
            <span className="text-amber-400">Watch</span> · 70–100:{' '}
            <span className="text-red-400">High</span>
          </span>
        </div>
      </div>
    </div>
  )
}
