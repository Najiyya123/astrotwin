'use client'

import type { CrewRow, AnomalyRow } from '@/lib/types'

interface ModelTabProps {
  crewData: CrewRow[]
  anomalies: AnomalyRow[]
}

const WINDOW = 14

export default function ModelTab({ crewData, anomalies }: ModelTabProps) {
  if (anomalies.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <div className="glass-card p-6 text-slate-500 text-sm">
          No anomaly answer key found. Run{' '}
          <code className="text-blue-400">python model.py</code> to generate it.
        </div>
        <HowItWorks />
      </div>
    )
  }

  const flaggedSet = new Set(
    crewData.filter((r) => r.is_anomaly).map((r) => `${r.astronaut}|${r.day}`),
  )
  const truthSet = new Set(anomalies.map((a) => `${a.astronaut}|${a.day}`))

  const eventGroups = new Map<string, { caught: boolean }>()
  for (const a of anomalies) {
    const key = `${a.astronaut}|${a.event_type}`
    const caught = flaggedSet.has(`${a.astronaut}|${a.day}`)
    if (!eventGroups.has(key)) {
      eventGroups.set(key, { caught })
    } else if (caught) {
      eventGroups.get(key)!.caught = true
    }
  }

  const eventsCaught = Array.from(eventGroups.values()).filter((e) => e.caught).length
  const totalEvents = eventGroups.size
  const badDaysCaught = Array.from(flaggedSet).filter((k) => truthSet.has(k)).length
  const totalBadDays = truthSet.size
  const monitored = crewData.filter((r) => r.day > WINDOW).length
  const falseAlarms = Array.from(flaggedSet).filter(
    (k) =>
      !truthSet.has(k) &&
      crewData.some((r) => `${r.astronaut}|${r.day}` === k && r.day > WINDOW),
  ).length
  const falseAlarmRate = monitored > 0 ? falseAlarms / monitored : 0

  const eventPct = totalEvents > 0 ? Math.round((eventsCaught / totalEvents) * 100) : 0
  const dayPct = totalBadDays > 0 ? Math.round((badDaysCaught / totalBadDays) * 100) : 0

  const cards = [
    {
      icon: '🎯',
      label: 'Health Events Caught',
      value: `${eventsCaught} / ${totalEvents}`,
      badge: `${eventPct}%`,
      sub: 'Distinct health events detected without being told',
      from: '#1e3a6e',
      to: '#0d1a35',
      accent: '#60a5fa',
      borderColor: 'rgba(96,165,250,0.35)',
      glowColor: 'rgba(96,165,250,0.15)',
      barColor: '#60a5fa',
      barPct: eventPct,
    },
    {
      icon: '📊',
      label: 'Bad Days Caught',
      value: `${badDaysCaught} / ${totalBadDays}`,
      badge: `${dayPct}%`,
      sub: 'Individual anomalous days flagged by the AI',
      from: '#0e3330',
      to: '#0d1a35',
      accent: '#34d399',
      borderColor: 'rgba(52,211,153,0.35)',
      glowColor: 'rgba(52,211,153,0.12)',
      barColor: '#34d399',
      barPct: dayPct,
    },
    {
      icon: '🔔',
      label: 'False Alarm Rate',
      value: `${(falseAlarmRate * 100).toFixed(1)}%`,
      badge: falseAlarmRate < 0.05 ? 'LOW' : falseAlarmRate < 0.1 ? 'MED' : 'HIGH',
      sub: `${falseAlarms} false flags out of ${monitored} monitored days`,
      from: '#3a2a0a',
      to: '#0d1a35',
      accent: '#fbbf24',
      borderColor: 'rgba(251,191,36,0.35)',
      glowColor: 'rgba(251,191,36,0.1)',
      barColor: '#fbbf24',
      barPct: Math.min(falseAlarmRate * 100 * 5, 100),
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Hero metric cards — full width, responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map(
          ({
            icon,
            label,
            value,
            badge,
            sub,
            from,
            to,
            accent,
            borderColor,
            glowColor,
            barColor,
            barPct,
          }) => (
            <div
              key={label}
              className="relative overflow-hidden rounded-2xl p-6 flex flex-col gap-4"
              style={{
                background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
                border: `1px solid ${borderColor}`,
                boxShadow: `0 8px 32px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
              }}
            >
              {/* Decorative circle */}
              <div
                className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 pointer-events-none"
                style={{ background: accent }}
              />
              <div
                className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-5 pointer-events-none"
                style={{ background: accent }}
              />

              {/* Top row: icon + badge */}
              <div className="relative z-10 flex items-start justify-between">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
                >
                  {icon}
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full tracking-widest"
                  style={{ color: accent, background: `${accent}22`, border: `1px solid ${accent}33` }}
                >
                  {badge}
                </span>
              </div>

              {/* Value */}
              <div className="relative z-10 flex flex-col gap-1">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                  {label}
                </p>
                <p
                  className="text-4xl font-black tabular-nums leading-none"
                  style={{ color: accent }}
                >
                  {value}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{sub}</p>
              </div>

              {/* Progress bar */}
              <div className="relative z-10 mt-auto">
                <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${barPct}%`,
                      background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
                    }}
                  />
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      {/* Disclaimer */}
      <div
        className="rounded-xl px-5 py-4 text-sm text-slate-400 italic border"
        style={{
          background: 'rgba(96,165,250,0.05)',
          borderColor: 'rgba(96,165,250,0.15)',
        }}
      >
        🚀 Tuned to miss nothing — on the way to Mars, a missed illness costs far more than an extra check-in.
      </div>

      {/* How it works */}
      <HowItWorks />
    </div>
  )
}

const steps = [
  {
    icon: '🧬',
    emoji_bg: 'rgba(96,165,250,0.15)',
    emoji_border: 'rgba(96,165,250,0.3)',
    accent: '#60a5fa',
    title: 'Personal Baseline',
    text: 'For each astronaut and measurement, AstroTwin builds a rolling 14-day personal normal (mean ± 2 standard deviations). What is unusual for you may be perfectly fine for another crew member.',
    tag: 'Rolling Z-score',
  },
  {
    icon: '⚡',
    emoji_bg: 'rgba(167,139,250,0.15)',
    emoji_border: 'rgba(167,139,250,0.3)',
    accent: '#a78bfa',
    title: 'Z-Score Detection',
    text: 'Each new reading is compared to the personal baseline. A z-score ≥ 2.5 in the concerning direction triggers a targeted alert with a plain-language action recommendation.',
    tag: 'Per-metric',
  },
  {
    icon: '🤖',
    emoji_bg: 'rgba(52,211,153,0.15)',
    emoji_border: 'rgba(52,211,153,0.3)',
    accent: '#34d399',
    title: 'Isolation Forest',
    text: 'An Isolation Forest algorithm looks for days that are unusual across several measurements simultaneously — catching compound events that individual z-scores might miss.',
    tag: 'Multi-variate',
  },
  {
    icon: '☀️',
    emoji_bg: 'rgba(251,191,36,0.15)',
    emoji_border: 'rgba(251,191,36,0.3)',
    accent: '#fbbf24',
    title: 'Space Weather',
    text: 'Real NASA DONKI events are layered in. High-severity solar events trigger an immediate shelter alert, independent of the health model, with direct DONKI source links.',
    tag: 'NASA DONKI',
  },
]

function HowItWorks() {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-base font-bold text-slate-200 tracking-tight">How AstroTwin Works</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {steps.map(({ icon, emoji_bg, emoji_border, accent, title, text, tag }, i) => (
          <div
            key={title}
            className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-3"
            style={{
              background: 'linear-gradient(135deg, #0d1a35 0%, #060e1f 100%)',
              border: `1px solid ${accent}22`,
              boxShadow: `0 4px 20px ${accent}08`,
            }}
          >
            {/* Step number watermark */}
            <span
              className="absolute top-3 right-4 text-6xl font-black opacity-5 leading-none select-none pointer-events-none"
              style={{ color: accent }}
            >
              {i + 1}
            </span>

            {/* Icon + tag row */}
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: emoji_bg, border: `1px solid ${emoji_border}` }}
              >
                {icon}
              </div>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full tracking-wider"
                style={{ color: accent, background: `${accent}18` }}
              >
                {tag}
              </span>
            </div>

            {/* Text */}
            <div>
              <p className="font-semibold text-slate-200 mb-1">{title}</p>
              <p className="text-sm text-slate-500 leading-relaxed">{text}</p>
            </div>

            {/* Bottom accent line */}
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5 opacity-40"
              style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
