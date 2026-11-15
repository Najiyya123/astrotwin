import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { AnomalyRow } from '@/lib/types'

const DATA_DIR = path.join(process.cwd(), '..', 'data')

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]))
  })
}

export async function GET() {
  try {
    const filePath = path.join(DATA_DIR, 'anomalies.csv')
    if (!fs.existsSync(filePath)) {
      return NextResponse.json([])
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    const raw = parseCSV(content)
    const rows: AnomalyRow[] = raw.map((r) => ({
      astronaut: r.astronaut,
      day: parseInt(r.day),
      event_type: r.event_type,
    }))
    return NextResponse.json(rows)
  } catch (err) {
    console.error('Failed to load anomalies:', err)
    return NextResponse.json([])
  }
}
