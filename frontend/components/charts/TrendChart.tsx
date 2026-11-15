'use client'

import dynamic from 'next/dynamic'
import type { CrewRow, MetricKey } from '@/lib/types'
import { METRICS } from '@/lib/types'

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className="skeleton h-72 w-full" />,
})

interface TrendChartProps {
  personHistory: CrewRow[]
  metric: MetricKey
  day: number
  stormDays: number[]
}

export default function TrendChart({ personHistory, metric, day, stormDays }: TrendChartProps) {
  const { label, unit } = METRICS[metric]
  const data = personHistory.filter((r) => r.day <= day)

  const days = data.map((r) => r.day)
  const values = data.map((r) => r[metric] as number)
  const means = data.map((r) => (r as unknown as Record<string, number>)[`mean_${metric}`])
  const stds = data.map((r) => (r as unknown as Record<string, number>)[`std_${metric}`])

  const upperBand = means.map((m, i) => (m == null || isNaN(m) ? null : m + 2 * stds[i]))
  const lowerBand = means.map((m, i) => (m == null || isNaN(m) ? null : m - 2 * stds[i]))

  const flagged = data.filter((r) => r.is_anomaly)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shapes: any[] = stormDays
    .filter((d) => d <= day)
    .map((d) => ({
      type: 'line',
      x0: d,
      x1: d,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: 'rgba(167,139,250,0.6)', width: 1, dash: 'dot' },
    }))

  return (
    <Plot
      data={[
        {
          x: days,
          y: upperBand,
          line: { width: 0 },
          showlegend: false,
          hoverinfo: 'skip',
          type: 'scatter',
          mode: 'lines',
          name: 'upper_band',
        },
        {
          x: days,
          y: lowerBand,
          line: { width: 0 },
          fill: 'tonexty',
          fillcolor: 'rgba(16,185,129,0.12)',
          name: 'Personal normal range',
          hoverinfo: 'skip',
          type: 'scatter',
          mode: 'lines',
        },
        {
          x: days,
          y: values,
          mode: 'lines',
          line: { color: '#60a5fa', width: 2 },
          name: label,
          type: 'scatter',
          hovertemplate: `Day %{x}: %{y:.1f} ${unit}<extra></extra>`,
        },
        {
          x: flagged.map((r) => r.day),
          y: flagged.map((r) => r[metric] as number),
          mode: 'markers',
          marker: { color: '#ef4444', size: 9, symbol: 'x' },
          name: 'Flagged by AI',
          type: 'scatter',
          hovertemplate: `Day %{x} flagged<extra></extra>`,
        },
      ]}
      layout={{
        height: 320,
        margin: { l: 50, r: 20, t: 20, b: 50 },
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
          title: { text: `${label} (${unit})`, font: { color: '#64748b' } },
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
        shapes,
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%' }}
    />
  )
}
