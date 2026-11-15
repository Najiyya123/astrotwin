'use client'

import dynamic from 'next/dynamic'
import { riskColor, riskLabel } from '@/lib/utils'

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className="skeleton h-48 w-full" />,
})

interface RiskGaugeProps {
  value: number
  title: string
}

export default function RiskGauge({ value, title }: RiskGaugeProps) {
  const color = riskColor(value)
  const label = riskLabel(value)

  return (
    <div className="glass-card p-2 flex flex-col items-center">
      <Plot
        data={[
          {
            type: 'indicator',
            mode: 'gauge+number',
            value,
            number: {
              valueformat: '.0f',
              font: { size: 28, color: '#e2e8f0', family: 'Inter' },
            },
            title: {
              text: `${title}<br><span style="font-size:12px;color:${color}">${label}</span>`,
              font: { size: 13, color: '#94a3b8', family: 'Inter' },
            },
            gauge: {
              axis: {
                range: [0, 100],
                tickvals: [0, 40, 70, 100],
                tickfont: { color: '#475569', size: 9 },
                tickwidth: 1,
                tickcolor: '#1e3a5f',
              },
              bar: { color, thickness: 0.7 },
              bgcolor: 'transparent',
              borderwidth: 0,
              steps: [
                { range: [0, 40], color: 'rgba(16,185,129,0.08)' },
                { range: [40, 70], color: 'rgba(245,158,11,0.08)' },
                { range: [70, 100], color: 'rgba(239,68,68,0.08)' },
              ],
              threshold: {
                line: { color: color, width: 2 },
                thickness: 0.75,
                value,
              },
            },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ]}
        layout={{
          height: 190,
          margin: { l: 30, r: 30, t: 60, b: 10 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { family: 'Inter' },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%' }}
      />
    </div>
  )
}
