export interface CrewRow {
  date: string
  day: number
  astronaut: string
  resting_hr: number
  systolic_bp: number
  sleep_hours: number
  exercise_min: number
  mood: number
  symptoms: number
  radiation_msv: number
  bone_density_pct: number
  z_resting_hr: number
  z_systolic_bp: number
  z_sleep_hours: number
  z_exercise_min: number
  z_mood: number
  if_score: number
  is_anomaly: boolean
  risk_bone: number
  risk_cardio: number
  risk_immune: number
  risk_behavioral: number
  cumulative_dose_msv: number
  risk_radiation: number
  solar_storm_alert: boolean
  mean_resting_hr: number
  std_resting_hr: number
  mean_systolic_bp: number
  std_systolic_bp: number
  mean_sleep_hours: number
  std_sleep_hours: number
  mean_exercise_min: number
  std_exercise_min: number
  mean_mood: number
  std_mood: number
}

export interface WeatherRow {
  date: string
  mission_day: number
  type: string
  detail: string
  severity: 'high' | 'moderate' | 'low'
  link: string
}

export interface AnomalyRow {
  astronaut: string
  day: number
  event_type: string
}

export type MetricKey = 'resting_hr' | 'systolic_bp' | 'sleep_hours' | 'exercise_min' | 'mood'
export type RiskKey = 'risk_bone' | 'risk_cardio' | 'risk_immune' | 'risk_behavioral' | 'risk_radiation'

export const METRICS: Record<MetricKey, { label: string; unit: string }> = {
  resting_hr: { label: 'Resting heart rate', unit: 'bpm' },
  systolic_bp: { label: 'Systolic blood pressure', unit: 'mmHg' },
  sleep_hours: { label: 'Sleep', unit: 'hours' },
  exercise_min: { label: 'Exercise', unit: 'minutes' },
  mood: { label: 'Mood', unit: '1-5' },
}

export const RISKS: Record<RiskKey, string> = {
  risk_bone: 'Bone',
  risk_cardio: 'Cardiovascular',
  risk_immune: 'Immune',
  risk_behavioral: 'Behavioral',
  risk_radiation: 'Radiation',
}

export const ACTIONS: Record<MetricKey, { direction: 1 | -1; message: string }> = {
  resting_hr: {
    direction: 1,
    message: 'Heart rate above your normal: rest, hydrate, and re-check in 2 hours. Report to the flight surgeon if still high tomorrow.',
  },
  systolic_bp: {
    direction: 1,
    message: 'Blood pressure above your normal: reduce salt and caffeine today, re-measure this evening.',
  },
  sleep_hours: {
    direction: -1,
    message: 'Sleep below your normal: dim lights 1 hour before rest, and ask the commander to protect your next sleep period.',
  },
  exercise_min: {
    direction: -1,
    message: 'Exercise below target: schedule resistance exercise. Bone loss speeds up on low-exercise days.',
  },
  mood: {
    direction: -1,
    message: 'Mood below your normal: book a private call home or with the crew psychologist, and join a crew activity.',
  },
}
