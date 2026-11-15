import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { CrewRow, MetricKey } from '@/lib/types'

const DATA_DIR = path.join(process.cwd(), '..', 'data')
const WINDOW = 14
const MIN_PERIODS = 7
const METRICS: MetricKey[] = ['resting_hr', 'systolic_bp', 'sleep_hours', 'exercise_min', 'mood']

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]))
  })
}

function parseBool(val: string): boolean {
  return val.toLowerCase() === 'true'
}

function addRollingStats(rows: CrewRow[]): CrewRow[] {
  const byAstronaut = new Map<string, CrewRow[]>()
  for (const row of rows) {
    if (!byAstronaut.has(row.astronaut)) byAstronaut.set(row.astronaut, [])
    byAstronaut.get(row.astronaut)!.push(row)
  }

  const result: CrewRow[] = []
  for (const [, group] of Array.from(byAstronaut)) {
    const sorted = [...group].sort((a, b) => a.day - b.day)
    for (let i = 0; i < sorted.length; i++) {
      const row = { ...sorted[i] }
      for (const metric of METRICS) {
        const start = Math.max(0, i - WINDOW)
        const window = sorted.slice(start, i).map((r) => r[metric] as number)
        let mean = NaN
        let std = NaN
        if (window.length >= MIN_PERIODS) {
          mean = window.reduce((a, b) => a + b, 0) / window.length
          const variance =
            window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window.length
          std = Math.sqrt(variance)
        }
        ;(row as Record<string, number | boolean | string>)[`mean_${metric}`] = mean
        ;(row as Record<string, number | boolean | string>)[`std_${metric}`] = std
      }
      result.push(row)
    }
  }
  return result
}

export async function GET() {
  try {
    const filePath = path.join(DATA_DIR, 'crew_scored.csv')
    const content = fs.readFileSync(filePath, 'utf-8')
    const raw = parseCSV(content)

    const rows: CrewRow[] = raw.map((r) => ({
      date: r.date,
      day: parseInt(r.day),
      astronaut: r.astronaut,
      resting_hr: parseFloat(r.resting_hr),
      systolic_bp: parseFloat(r.systolic_bp),
      sleep_hours: parseFloat(r.sleep_hours),
      exercise_min: parseFloat(r.exercise_min),
      mood: parseFloat(r.mood),
      symptoms: parseFloat(r.symptoms),
      radiation_msv: parseFloat(r.radiation_msv),
      bone_density_pct: parseFloat(r.bone_density_pct),
      z_resting_hr: parseFloat(r.z_resting_hr),
      z_systolic_bp: parseFloat(r.z_systolic_bp),
      z_sleep_hours: parseFloat(r.z_sleep_hours),
      z_exercise_min: parseFloat(r.z_exercise_min),
      z_mood: parseFloat(r.z_mood),
      if_score: parseFloat(r.if_score),
      is_anomaly: parseBool(r.is_anomaly),
      risk_bone: parseFloat(r.risk_bone),
      risk_cardio: parseFloat(r.risk_cardio),
      risk_immune: parseFloat(r.risk_immune),
      risk_behavioral: parseFloat(r.risk_behavioral),
      cumulative_dose_msv: parseFloat(r.cumulative_dose_msv),
      risk_radiation: parseFloat(r.risk_radiation),
      solar_storm_alert: parseBool(r.solar_storm_alert),
      mean_resting_hr: NaN,
      std_resting_hr: NaN,
      mean_systolic_bp: NaN,
      std_systolic_bp: NaN,
      mean_sleep_hours: NaN,
      std_sleep_hours: NaN,
      mean_exercise_min: NaN,
      std_exercise_min: NaN,
      mean_mood: NaN,
      std_mood: NaN,
    }))

    const enriched = addRollingStats(rows)
    return NextResponse.json(enriched)
  } catch (err) {
    console.error('Failed to load crew data:', err)
    return NextResponse.json({ error: 'Failed to load crew data' }, { status: 500 })
  }
}
