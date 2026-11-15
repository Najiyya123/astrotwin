'use client'

import { useState } from 'react'
import type { CrewRow, MetricKey } from '@/lib/types'
import { ACTIONS, METRICS } from '@/lib/types'

interface CheckinTabProps {
  personHistory: CrewRow[]
  day: number
  astronaut: string
}

const WINDOW = 14

interface CheckResult {
  metric: MetricKey
  value: number
  mean: number
  std: number
  z: number
  flagged: boolean
  message: string
}

export default function CheckinTab({ personHistory, day, astronaut }: CheckinTabProps) {
  const history = personHistory.filter((r) => r.day >= day - WINDOW && r.day < day)

  const avg = (key: MetricKey) => {
    const vals = history.map((r) => r[key] as number).filter((v) => !isNaN(v))
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }

  const [form, setForm] = useState({
    resting_hr: Math.round(avg('resting_hr')),
    systolic_bp: Math.round(avg('systolic_bp')),
    sleep_hours: Math.round(avg('sleep_hours') * 2) / 2,
    exercise_min: Math.round(avg('exercise_min')),
    mood: Math.round(avg('mood')) || 3,
    symptoms: false,
  })

  const [results, setResults] = useState<CheckResult[] | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (day < 8 || history.length < 7) {
    return (
      <div className="glass-card p-6 text-center">
        <div className="text-4xl mb-3">📅</div>
        <p className="text-slate-400">
          Move the slider past day 8 so AstroTwin has a week of history to compare against.
        </p>
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const checks: CheckResult[] = []
    for (const [col, { direction, message }] of Object.entries(ACTIONS) as [
      MetricKey,
      { direction: 1 | -1; message: string },
    ][]) {
      const vals = history.map((r) => r[col] as number).filter((v) => !isNaN(v))
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length
      const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length
      const std = Math.max(Math.sqrt(variance), 1e-6)
      const value = form[col] as number
      const z = (value - mean) / std
      const flagged = direction * z >= 2.5
      checks.push({ metric: col, value, mean, std, z, flagged, message })
    }
    setResults(checks)
    setSubmitted(true)
  }

  function handleReset() {
    setResults(null)
    setSubmitted(false)
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="glass-card p-5">
        <h2 className="text-base font-semibold text-slate-300 mb-4">
          1-minute check-in for {astronaut}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Heart rate */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-400">
                Resting heart rate (bpm)
              </label>
              <input
                type="number"
                min={30}
                max={200}
                value={form.resting_hr}
                onChange={(e) => setForm({ ...form, resting_hr: Number(e.target.value) })}
                className="input-field"
                disabled={submitted}
              />
            </div>

            {/* Blood pressure */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-400">
                Systolic blood pressure (mmHg)
              </label>
              <input
                type="number"
                min={70}
                max={220}
                value={form.systolic_bp}
                onChange={(e) => setForm({ ...form, systolic_bp: Number(e.target.value) })}
                className="input-field"
                disabled={submitted}
              />
            </div>

            {/* Sleep */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-400">
                Sleep last night (hours)
              </label>
              <input
                type="number"
                min={0}
                max={14}
                step={0.5}
                value={form.sleep_hours}
                onChange={(e) => setForm({ ...form, sleep_hours: Number(e.target.value) })}
                className="input-field"
                disabled={submitted}
              />
            </div>

            {/* Exercise */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-400">
                Exercise today (minutes)
              </label>
              <input
                type="number"
                min={0}
                max={300}
                value={form.exercise_min}
                onChange={(e) => setForm({ ...form, exercise_min: Number(e.target.value) })}
                className="input-field"
                disabled={submitted}
              />
            </div>
          </div>

          {/* Mood */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-400">
                Mood (1 = very low, 5 = great)
              </label>
              <span className="text-blue-400 font-bold text-lg">{form.mood}</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={form.mood}
              onChange={(e) => setForm({ ...form, mood: Number(e.target.value) })}
              className="w-full"
              disabled={submitted}
              style={{
                background: `linear-gradient(to right, #3b82f6 ${((form.mood - 1) / 4) * 100}%, rgba(99,179,237,0.2) ${((form.mood - 1) / 4) * 100}%)`,
              }}
            />
            <div className="flex justify-between text-xs text-slate-600">
              <span>😞 Very low</span>
              <span>😐 Neutral</span>
              <span>😊 Great</span>
            </div>
          </div>

          {/* Symptoms */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={form.symptoms}
              onChange={(e) => setForm({ ...form, symptoms: e.target.checked })}
              disabled={submitted}
              className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
            />
            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              Any symptoms today? (headache, nausea, dizziness…)
            </span>
          </label>

          {!submitted && (
            <button type="submit" className="btn-primary self-start">
              Check against my normal
            </button>
          )}
        </form>
      </div>

      {/* Results */}
      {submitted && results && (
        <div className="flex flex-col gap-3">
          {results.map(({ metric, value, mean, flagged, message }) => {
            const { label, unit } = METRICS[metric]
            return (
              <div
                key={metric}
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  flagged
                    ? 'bg-amber-500/8 border-amber-500/25'
                    : 'bg-emerald-500/8 border-emerald-500/20'
                }`}
              >
                <span className="text-lg shrink-0">{flagged ? '⚠️' : '✅'}</span>
                <div>
                  <p
                    className={`font-medium text-sm ${flagged ? 'text-amber-300' : 'text-emerald-300'}`}
                  >
                    {label}: {value} {unit}{' '}
                    {flagged ? '— unusual for you' : '— within your normal'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your recent average: {mean.toFixed(1)} {unit}
                    {flagged && `. ${message}`}
                  </p>
                </div>
              </div>
            )
          })}

          {form.symptoms && (
            <div className="flex items-start gap-3 p-4 rounded-xl border bg-amber-500/8 border-amber-500/25">
              <span className="text-lg shrink-0">🏥</span>
              <div>
                <p className="font-medium text-sm text-amber-300">Symptoms reported</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Log them in the medical record and repeat the check-in tomorrow morning.
                </p>
              </div>
            </div>
          )}

          {!results.some((r) => r.flagged) && !form.symptoms && (
            <div className="flex items-center gap-3 p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/25">
              <span className="text-lg">🌟</span>
              <p className="font-medium text-sm text-emerald-300">
                Everything looks normal for you today.
              </p>
            </div>
          )}

          <button
            onClick={handleReset}
            className="self-start text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Check again with different values
          </button>
        </div>
      )}
    </div>
  )
}
