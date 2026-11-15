'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CrewRow, WeatherRow, AnomalyRow } from '@/lib/types'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import AlertBanner from '@/components/AlertBanner'
import CrewStatusTab from '@/components/tabs/CrewStatusTab'
import TrendsTab from '@/components/tabs/TrendsTab'
import SpaceWeatherTab from '@/components/tabs/SpaceWeatherTab'
import CheckinTab from '@/components/tabs/CheckinTab'
import ModelTab from '@/components/tabs/ModelTab'

type Tab = 'crew' | 'trends' | 'weather' | 'checkin' | 'model'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'crew', label: 'Crew status', icon: '👨‍🚀' },
  { id: 'trends', label: 'Trends', icon: '📈' },
  { id: 'weather', label: 'Space weather', icon: '☀️' },
  { id: 'checkin', label: 'Daily check-in', icon: '📋' },
  { id: 'model', label: 'How it works', icon: '🧠' },
]

function StarField() {
  const stars = useMemo(() => {
    return Array.from({ length: 80 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: `${3 + Math.random() * 5}s`,
      delay: `${Math.random() * 5}s`,
      size: Math.random() > 0.8 ? 2 : 1,
    }))
  }, [])

  return (
    <div className="star-field" aria-hidden>
      {stars.map((s, i) => (
        <div
          key={i}
          className="star"
          style={{
            left: s.left,
            top: s.top,
            '--duration': s.duration,
            '--delay': s.delay,
            width: s.size,
            height: s.size,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="hidden lg:block w-72 h-full bg-[#060e1f] border-r border-white/5" />
      <div className="flex-1 p-6 flex flex-col gap-6">
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-10 w-full" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-48" />
          ))}
        </div>
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
  )
}

export default function Home() {
  const [crewData, setCrewData] = useState<CrewRow[]>([])
  const [weatherData, setWeatherData] = useState<WeatherRow[]>([])
  const [anomaliesData, setAnomaliesData] = useState<AnomalyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [day, setDay] = useState(90)
  const [astronaut, setAstronaut] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('crew')

  useEffect(() => {
    async function loadData() {
      try {
        const [crew, weather, anomalies] = await Promise.all([
          fetch('/api/crew').then((r) => {
            if (!r.ok) throw new Error('Failed to load crew data')
            return r.json() as Promise<CrewRow[]>
          }),
          fetch('/api/weather').then((r) => r.json() as Promise<WeatherRow[]>),
          fetch('/api/anomalies').then((r) => r.json() as Promise<AnomalyRow[]>),
        ])
        setCrewData(crew)
        setWeatherData(Array.isArray(weather) ? weather : [])
        setAnomaliesData(Array.isArray(anomalies) ? anomalies : [])

        const names = Array.from(new Set(crew.map((r) => r.astronaut))).sort()
        if (names.length > 0) setAstronaut(names[0])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const astronauts = useMemo(
    () => Array.from(new Set(crewData.map((r) => r.astronaut))).sort(),
    [crewData],
  )

  const today = useMemo(
    () => crewData.filter((r) => r.day === day),
    [crewData, day],
  )

  const selectedRow = useMemo(
    () => today.find((r) => r.astronaut === astronaut) ?? null,
    [today, astronaut],
  )

  const personHistory = useMemo(
    () => crewData.filter((r) => r.astronaut === astronaut).sort((a, b) => a.day - b.day),
    [crewData, astronaut],
  )

  const eventsNow = useMemo(
    () => weatherData.filter((e) => e.mission_day >= day - 1 && e.mission_day <= day),
    [weatherData, day],
  )

  const stormDays = useMemo(
    () => Array.from(new Set(weatherData.filter((e) => e.severity === 'high').map((e) => e.mission_day))).sort((a, b) => a - b),
    [weatherData],
  )

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-red-400 mb-2">Data not found</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <p className="text-slate-500 text-xs mt-3">
            Run <code className="text-blue-400">python generate_data.py</code> and{' '}
            <code className="text-blue-400">python model.py</code> first.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <StarField />
      <div className="relative z-10 flex min-h-screen">
        <Sidebar
          day={day}
          astronaut={astronaut}
          astronauts={astronauts}
          today={today}
          onDayChange={setDay}
          onAstronautChange={setAstronaut}
        />

        <main className="flex-1 min-w-0 p-5 lg:p-7 flex flex-col gap-5">
          <Header day={day} row={selectedRow} crewCount={astronauts.length} />

          <AlertBanner row={selectedRow} eventsNow={eventsNow} astronaut={astronaut} />

          {/* Tab navigation */}
          <div className="flex gap-1.5 flex-wrap border-b border-white/5 pb-3">
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`tab-btn ${activeTab === id ? 'tab-btn-active' : 'tab-btn-inactive'}`}
              >
                <span className="mr-1.5">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1">
            {activeTab === 'crew' && (
              <CrewStatusTab row={selectedRow} today={today} astronaut={astronaut} />
            )}
            {activeTab === 'trends' && (
              <TrendsTab personHistory={personHistory} day={day} stormDays={stormDays} />
            )}
            {activeTab === 'weather' && (
              <SpaceWeatherTab weather={weatherData} day={day} />
            )}
            {activeTab === 'checkin' && (
              <CheckinTab personHistory={personHistory} day={day} astronaut={astronaut} />
            )}
            {activeTab === 'model' && (
              <ModelTab crewData={crewData} anomalies={anomaliesData} />
            )}
          </div>
        </main>
      </div>
    </>
  )
}
