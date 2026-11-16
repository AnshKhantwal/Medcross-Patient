export type Severity = 'normal' | 'warn' | 'danger';
export type RangeKey = 'pulse' | 'spo2' | 'temp' | 'resp' | 'bpSys' | 'bpDia';

export interface VitalRange {
  normalLow: number;
  normalHigh: number;
  warnLow: number;
  warnHigh: number;
}

/** Same thresholds as practice/EPR/PatientSelfHistory.aspx, so patients and clinicians see the same colours. */
export const VITAL_RANGES: Record<RangeKey, VitalRange> = {
  pulse: { normalLow: 60, normalHigh: 100, warnLow: 50, warnHigh: 110 },
  spo2: { normalLow: 92, normalHigh: Infinity, warnLow: 88, warnHigh: Infinity },
  temp: { normalLow: 94, normalHigh: 99, warnLow: 92, warnHigh: 100.4 },
  resp: { normalLow: 16, normalHigh: 22, warnLow: 12, warnHigh: 27 },
  bpSys: { normalLow: 100, normalHigh: 140, warnLow: 90, warnHigh: 160 },
  bpDia: { normalLow: 70, normalHigh: 90, warnLow: 60, warnHigh: 100 }
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  normal: 'Normal',
  warn: 'Borderline',
  danger: 'Abnormal'
};

export function classifyVital(key: RangeKey, value: number | null | undefined): Severity | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const r = VITAL_RANGES[key];
  if (value >= r.normalLow && value <= r.normalHigh) return 'normal';
  if (value >= r.warnLow && value <= r.warnHigh) return 'warn';
  return 'danger';
}

const RANK: Record<Severity, number> = { normal: 0, warn: 1, danger: 2 };

export function worseSeverity(a: Severity | null, b: Severity | null): Severity | null {
  if (!a) return b;
  if (!b) return a;
  return RANK[a] >= RANK[b] ? a : b;
}
