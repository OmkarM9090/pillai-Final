// ============================================================
// FEATURE 1 — LIVE WEATHER INTEGRATION
// Real-time weather (Open-Meteo, no API key required) normalised into
// AI-model features that feed the forecasting models, the digital twin
// and the AI copilot.
//
// Resilience strategy (three tiers, always returns a usable payload):
//   1. LIVE      → server fetched Open-Meteo directly.
//   2. RELAY     → the browser fetched Open-Meteo and relayed the
//                  observation to /intel/weather/ingest (used when the
//                  server sits behind a restricted network).
//   3. SIMULATED → deterministic monsoon-climatology physics model so the
//                  demo never breaks. Always clearly labelled in the UI.
// ============================================================

import { RESORT_SITE } from './resortSite';

export type WeatherMode = 'LIVE' | 'RELAY' | 'SIMULATED';

export interface WeatherHour {
  time: string;
  hourLabel: string;
  tempC: number;
  precipMm: number;
  precipProb: number;
  windKph: number;
  gustKph: number;
  humidity: number;
  code: number;
  label: string;
  severity: number;
}

export interface WeatherDay {
  date: string;
  dayLabel: string;
  tMaxC: number;
  tMinC: number;
  precipSumMm: number;
  precipProbMax: number;
  windMaxKph: number;
  code: number;
  label: string;
  severity: number;
}

export interface WeatherAlert {
  id: string;
  level: 'INFO' | 'ADVISORY' | 'WATCH' | 'WARNING' | 'SEVERE';
  title: string;
  message: string;
  zones: string[];
  validUntil: string;
}

export interface WeatherIntel {
  mode: WeatherMode;
  provider: string;
  providerNote: string;
  fetchedAt: string;
  ageSeconds: number;
  site: typeof RESORT_SITE;
  current: {
    tempC: number;
    apparentC: number;
    humidity: number;
    precipMm: number;
    precipProb: number;
    windKph: number;
    gustKph: number;
    windDir: number;
    windDirLabel: string;
    pressureHpa: number;
    cloudPct: number;
    visibilityKm: number;
    uvIndex: number;
    code: number;
    label: string;
    icon: string;
    isDay: boolean;
  };
  severity: {
    index: number;
    band: 'CALM' | 'ADVISORY' | 'WATCH' | 'WARNING' | 'SEVERE';
    drivers: Array<{ factor: string; contribution: number; detail: string }>;
  };
  trend: { next6hPrecipMm: number; next6hPeakWindKph: number; direction: 'IMPROVING' | 'STEADY' | 'DETERIORATING' };
  hourly: WeatherHour[];
  daily: WeatherDay[];
  alerts: WeatherAlert[];
  /** Direct inputs handed to the AI/ML models — inspectable, not hidden. */
  aiFeatures: {
    weather_score: number;
    weather_severity: number;
    demand_shock: number;
    staff_availability: number;
    inventory_availability: number;
    outdoor_viability: number;
    season_code: number;
    is_weekend: number;
    day_of_week: number;
    month: number;
  };
  narrative: string;
}

// ------------------------------------------------------------------
// WMO weather-code dictionary
// ------------------------------------------------------------------
const WMO: Record<number, { label: string; icon: string; sev: number }> = {
  0: { label: 'Clear sky', icon: 'sun', sev: 0 },
  1: { label: 'Mainly clear', icon: 'sun', sev: 0.02 },
  2: { label: 'Partly cloudy', icon: 'cloud-sun', sev: 0.05 },
  3: { label: 'Overcast', icon: 'cloud', sev: 0.1 },
  45: { label: 'Fog', icon: 'fog', sev: 0.25 },
  48: { label: 'Rime fog', icon: 'fog', sev: 0.3 },
  51: { label: 'Light drizzle', icon: 'drizzle', sev: 0.15 },
  53: { label: 'Moderate drizzle', icon: 'drizzle', sev: 0.22 },
  55: { label: 'Dense drizzle', icon: 'drizzle', sev: 0.3 },
  56: { label: 'Freezing drizzle', icon: 'drizzle', sev: 0.35 },
  57: { label: 'Dense freezing drizzle', icon: 'drizzle', sev: 0.4 },
  61: { label: 'Light rain', icon: 'rain', sev: 0.25 },
  63: { label: 'Moderate rain', icon: 'rain', sev: 0.45 },
  65: { label: 'Heavy rain', icon: 'rain', sev: 0.7 },
  66: { label: 'Freezing rain', icon: 'rain', sev: 0.6 },
  67: { label: 'Heavy freezing rain', icon: 'rain', sev: 0.75 },
  71: { label: 'Light snow', icon: 'snow', sev: 0.4 },
  73: { label: 'Moderate snow', icon: 'snow', sev: 0.55 },
  75: { label: 'Heavy snow', icon: 'snow', sev: 0.8 },
  77: { label: 'Snow grains', icon: 'snow', sev: 0.4 },
  80: { label: 'Rain showers', icon: 'rain', sev: 0.4 },
  81: { label: 'Heavy rain showers', icon: 'rain', sev: 0.62 },
  82: { label: 'Violent rain showers', icon: 'storm', sev: 0.85 },
  85: { label: 'Snow showers', icon: 'snow', sev: 0.5 },
  86: { label: 'Heavy snow showers', icon: 'snow', sev: 0.7 },
  95: { label: 'Thunderstorm', icon: 'storm', sev: 0.8 },
  96: { label: 'Thunderstorm with hail', icon: 'storm', sev: 0.9 },
  99: { label: 'Severe thunderstorm with hail', icon: 'storm', sev: 1 },
};

export function describeCode(code: number) {
  return WMO[code] ?? { label: 'Unsettled', icon: 'cloud', sev: 0.2 };
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export function windDirLabel(deg: number) {
  return DIRS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 1) => Number(v.toFixed(d));

// ------------------------------------------------------------------
// Severity model — transparent, weighted, explainable
// ------------------------------------------------------------------
export function computeSeverity(input: {
  precipMm: number;
  windKph: number;
  gustKph: number;
  code: number;
  visibilityKm: number;
  humidity: number;
  tempC: number;
}) {
  const rain = clamp(input.precipMm / 25); // 25 mm/h ≈ extremely heavy
  const wind = clamp(input.windKph / 75);
  const gust = clamp(input.gustKph / 110);
  const codeSev = describeCode(input.code).sev;
  const vis = clamp((10 - Math.min(10, input.visibilityKm)) / 10);
  // Heat stress is an operational load driver too (chiller plant, outdoor staff
  // rotation, guest-health incidents), so it carries real weight in the index.
  const heat = clamp((input.tempC - 30) / 12) * (0.6 + 0.4 * clamp(input.humidity / 100));

  const drivers = [
    { factor: 'Rainfall intensity', contribution: round(rain * 0.34, 2), detail: `${round(input.precipMm, 1)} mm/h` },
    { factor: 'Sustained wind', contribution: round(wind * 0.18, 2), detail: `${round(input.windKph, 0)} km/h` },
    { factor: 'Gust peaks', contribution: round(gust * 0.1, 2), detail: `${round(input.gustKph, 0)} km/h` },
    { factor: 'Sky condition', contribution: round(codeSev * 0.16, 2), detail: describeCode(input.code).label },
    { factor: 'Visibility', contribution: round(vis * 0.05, 2), detail: `${round(input.visibilityKm, 1)} km` },
    { factor: 'Heat–humidity stress', contribution: round(heat * 0.2, 2), detail: `${round(input.tempC, 1)}°C · ${Math.round(input.humidity)}% RH` },
  ];

  const index = clamp(drivers.reduce((a, d) => a + d.contribution, 0));
  const band: WeatherIntel['severity']['band'] =
    index >= 0.75 ? 'SEVERE' : index >= 0.55 ? 'WARNING' : index >= 0.35 ? 'WATCH' : index >= 0.18 ? 'ADVISORY' : 'CALM';

  return { index: round(index, 2), band, drivers: drivers.sort((a, b) => b.contribution - a.contribution) };
}

// ------------------------------------------------------------------
// AI feature mapping — this is what actually enters the models
// ------------------------------------------------------------------
function buildAiFeatures(severityIndex: number, current: WeatherIntel['current'], when = new Date()) {
  const dow = (when.getDay() + 6) % 7; // 0 = Monday
  const month = when.getMonth() + 1;
  const monsoon = month >= 6 && month <= 9;
  return {
    // Higher = better weather for demand. Consumed by the trained occupancy model.
    weather_score: round(clamp(1 - severityIndex * 0.9), 2),
    weather_severity: round(severityIndex, 2),
    // Rain pushes guests indoors → in-house F&B / room-service surge.
    demand_shock: round(1 + severityIndex * 0.45, 2),
    // Commute disruption reduces the staff that can physically reach site.
    staff_availability: round(clamp(1 - severityIndex * 0.3, 0.4, 1), 2),
    // Supplier trucks are delayed on flooded approach roads.
    inventory_availability: round(clamp(1 - severityIndex * 0.35, 0.3, 1), 2),
    outdoor_viability: round(clamp(1 - (severityIndex * 1.25 + (current.precipMm > 0.4 ? 0.2 : 0))), 2),
    season_code: monsoon ? 0 : month >= 11 || month <= 2 ? 2 : 1,
    is_weekend: dow >= 5 ? 1 : 0,
    day_of_week: dow,
    month,
  };
}

function buildAlerts(sev: ReturnType<typeof computeSeverity>, current: WeatherIntel['current'], next6hPrecip: number): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const until = new Date(Date.now() + 6 * 3600_000).toISOString();

  if (current.precipMm >= 7.6 || next6hPrecip >= 35) {
    alerts.push({
      id: 'wx-flood',
      level: current.precipMm >= 16 ? 'WARNING' : 'WATCH',
      title: 'Heavy rainfall — surface flooding likely',
      message: `${round(current.precipMm, 1)} mm/h now, ${round(next6hPrecip, 0)} mm expected in 6 h. Low-lying zones (Palm Access Road, Beachfront Villas) at risk of water ingress.`,
      zones: ['access-road', 'beach-villas', 'banquet-lawn'],
      validUntil: until,
    });
  }
  else if (current.precipMm >= 2.5 || next6hPrecip >= 15) {
    alerts.push({
      id: 'wx-rain',
      level: 'ADVISORY',
      title: 'Persistent rain — outdoor service impacted',
      message: `${round(current.precipMm, 1)} mm/h now, ${round(next6hPrecip, 0)} mm expected in 6 h. Shift lawn covers indoors, deploy umbrella escorts on the buggy route and pre-position wet-floor signage.`,
      zones: ['banquet-lawn', 'pool-deck', 'access-road'],
      validUntil: until,
    });
  }
  if (current.windKph >= 35 || current.gustKph >= 50) {
    alerts.push({
      id: 'wx-wind',
      level: current.gustKph >= 70 ? 'WARNING' : 'ADVISORY',
      title: 'Strong wind advisory',
      message: `Sustained ${round(current.windKph, 0)} km/h, gusting ${round(current.gustKph, 0)} km/h. Secure marquee rigging, parasols and pool-deck furniture.`,
      zones: ['banquet-lawn', 'pool-deck', 'beach-villas'],
      validUntil: until,
    });
  }
  if ([95, 96, 99].includes(current.code)) {
    alerts.push({
      id: 'wx-thunder',
      level: 'SEVERE',
      title: 'Thunderstorm — suspend outdoor operations',
      message: 'Lightning risk. Close pool deck, move lawn service indoors and switch critical loads to DG standby.',
      zones: ['pool-deck', 'banquet-lawn', 'utility-block'],
      validUntil: until,
    });
  }
  if (current.tempC >= 35 && current.humidity >= 60) {
    alerts.push({
      id: 'wx-heat',
      level: 'ADVISORY',
      title: 'Heat–humidity stress',
      message: 'Increase hydration stations, rotate outdoor staff every 45 minutes, pre-cool guest rooms.',
      zones: ['pool-deck', 'banquet-lawn'],
      validUntil: until,
    });
  }
  if (!alerts.length) {
    alerts.push({
      id: 'wx-clear',
      level: 'INFO',
      title: 'No active weather threat',
      message: `Conditions nominal (${sev.band.toLowerCase()}). All outdoor venues cleared for normal operation.`,
      zones: [],
      validUntil: until,
    });
  }
  return alerts;
}

// ------------------------------------------------------------------
// Assemble a full WeatherIntel object from normalised raw values
// ------------------------------------------------------------------
interface RawNormalised {
  tempC: number; apparentC: number; humidity: number; precipMm: number; precipProb: number;
  windKph: number; gustKph: number; windDir: number; pressureHpa: number; cloudPct: number;
  visibilityKm: number; uvIndex: number; code: number; isDay: boolean;
  hourly: Array<Omit<WeatherHour, 'label' | 'severity' | 'hourLabel'>>;
  daily: Array<Omit<WeatherDay, 'label' | 'severity' | 'dayLabel'>>;
}

function assemble(raw: RawNormalised, mode: WeatherMode, provider: string, providerNote: string, fetchedAt: Date): WeatherIntel {
  const desc = describeCode(raw.code);
  const current = {
    tempC: round(raw.tempC),
    apparentC: round(raw.apparentC),
    humidity: Math.round(raw.humidity),
    precipMm: round(raw.precipMm, 2),
    precipProb: Math.round(raw.precipProb),
    windKph: round(raw.windKph),
    gustKph: round(raw.gustKph),
    windDir: Math.round(raw.windDir),
    windDirLabel: windDirLabel(raw.windDir),
    pressureHpa: Math.round(raw.pressureHpa),
    cloudPct: Math.round(raw.cloudPct),
    visibilityKm: round(raw.visibilityKm),
    uvIndex: round(raw.uvIndex),
    code: raw.code,
    label: desc.label,
    icon: desc.icon,
    isDay: raw.isDay,
  };

  const severity = computeSeverity(current);

  const hourly: WeatherHour[] = raw.hourly.slice(0, 24).map((h) => {
    const d = describeCode(h.code);
    const s = computeSeverity({
      precipMm: h.precipMm, windKph: h.windKph, gustKph: h.gustKph, code: h.code,
      visibilityKm: 10, humidity: h.humidity, tempC: h.tempC,
    });
    return {
      ...h,
      tempC: round(h.tempC), precipMm: round(h.precipMm, 2), precipProb: Math.round(h.precipProb),
      windKph: round(h.windKph), gustKph: round(h.gustKph), humidity: Math.round(h.humidity),
      hourLabel: new Date(h.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: RESORT_SITE.timezone }),
      label: d.label,
      severity: s.index,
    };
  });

  const daily: WeatherDay[] = raw.daily.slice(0, 5).map((d) => {
    const desc2 = describeCode(d.code);
    const s = computeSeverity({
      precipMm: d.precipSumMm / 12, windKph: d.windMaxKph, gustKph: d.windMaxKph * 1.4,
      code: d.code, visibilityKm: 10, humidity: 80, tempC: d.tMaxC,
    });
    return {
      ...d,
      tMaxC: round(d.tMaxC), tMinC: round(d.tMinC), precipSumMm: round(d.precipSumMm, 1),
      precipProbMax: Math.round(d.precipProbMax), windMaxKph: round(d.windMaxKph),
      dayLabel: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', timeZone: RESORT_SITE.timezone }),
      label: desc2.label,
      severity: s.index,
    };
  });

  const next6 = hourly.slice(0, 6);
  const next6hPrecipMm = round(next6.reduce((a, h) => a + h.precipMm, 0), 1);
  const next6hPeakWindKph = round(Math.max(0, ...next6.map((h) => h.windKph)));
  const futureSev = next6.length ? next6.reduce((a, h) => a + h.severity, 0) / next6.length : severity.index;
  const direction = futureSev > severity.index + 0.06 ? 'DETERIORATING' : futureSev < severity.index - 0.06 ? 'IMPROVING' : 'STEADY';

  const aiFeatures = buildAiFeatures(severity.index, current, fetchedAt);
  const alerts = buildAlerts(severity, current, next6hPrecipMm);

  return {
    mode,
    provider,
    providerNote,
    fetchedAt: fetchedAt.toISOString(),
    ageSeconds: 0,
    site: RESORT_SITE,
    current,
    severity,
    trend: { next6hPrecipMm, next6hPeakWindKph, direction },
    hourly,
    daily,
    alerts,
    aiFeatures,
    narrative:
      `${RESORT_SITE.name}, ${RESORT_SITE.city}: ${current.label.toLowerCase()}, ${current.tempC}°C (feels ${current.apparentC}°C), ` +
      `${current.precipMm} mm/h rain, wind ${current.windKph} km/h ${current.windDirLabel} gusting ${current.gustKph} km/h, ` +
      `humidity ${current.humidity}%. Twin severity ${(severity.index * 100).toFixed(0)}% (${severity.band}); outlook ${direction.toLowerCase()} ` +
      `with ${next6hPrecipMm} mm forecast over the next 6 hours.`,
  };
}

// ------------------------------------------------------------------
// Tier 1 — direct Open-Meteo fetch (server side)
// ------------------------------------------------------------------
const OPEN_METEO_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${RESORT_SITE.lat}&longitude=${RESORT_SITE.lon}` +
  '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility' +
  '&hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max' +
  '&forecast_days=5&timezone=auto';

export function normaliseOpenMeteo(j: any): RawNormalised {
  const c = j.current ?? {};
  const h = j.hourly ?? {};
  const d = j.daily ?? {};
  const nowIso = new Date().toISOString().slice(0, 13);
  const times: string[] = h.time ?? [];
  let startIdx = times.findIndex((t: string) => t.slice(0, 13) >= nowIso);
  if (startIdx < 0) startIdx = 0;

  const hourly = times.slice(startIdx, startIdx + 24).map((t: string, i: number) => {
    const k = startIdx + i;
    return {
      time: new Date(t).toISOString(),
      tempC: Number(h.temperature_2m?.[k] ?? c.temperature_2m ?? 28),
      precipMm: Number(h.precipitation?.[k] ?? 0),
      precipProb: Number(h.precipitation_probability?.[k] ?? 0),
      windKph: Number(h.wind_speed_10m?.[k] ?? 0),
      gustKph: Number(h.wind_gusts_10m?.[k] ?? 0),
      humidity: Number(h.relative_humidity_2m?.[k] ?? 70),
      code: Number(h.weather_code?.[k] ?? 0),
    };
  });

  const daily = (d.time ?? []).map((t: string, i: number) => ({
    date: t,
    tMaxC: Number(d.temperature_2m_max?.[i] ?? 30),
    tMinC: Number(d.temperature_2m_min?.[i] ?? 24),
    precipSumMm: Number(d.precipitation_sum?.[i] ?? 0),
    precipProbMax: Number(d.precipitation_probability_max?.[i] ?? 0),
    windMaxKph: Number(d.wind_speed_10m_max?.[i] ?? 0),
    code: Number(d.weather_code?.[i] ?? 0),
  }));

  return {
    tempC: Number(c.temperature_2m ?? 28),
    apparentC: Number(c.apparent_temperature ?? c.temperature_2m ?? 28),
    humidity: Number(c.relative_humidity_2m ?? 72),
    precipMm: Number(c.precipitation ?? c.rain ?? 0),
    precipProb: Number(hourly[0]?.precipProb ?? 0),
    windKph: Number(c.wind_speed_10m ?? 0),
    gustKph: Number(c.wind_gusts_10m ?? (Number(c.wind_speed_10m ?? 0) * 1.4)),
    windDir: Number(c.wind_direction_10m ?? 240),
    pressureHpa: Number(c.pressure_msl ?? 1006),
    cloudPct: Number(c.cloud_cover ?? 40),
    visibilityKm: Number(c.visibility ?? 12000) / 1000,
    uvIndex: Number(c.uv_index ?? 6),
    code: Number(c.weather_code ?? 0),
    isDay: Number(c.is_day ?? 1) === 1,
    hourly: hourly.length ? hourly : [],
    daily,
  };
}

async function fetchWithTimeout(url: string, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'SmartResort360/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------------------------------
// Tier 3 — deterministic monsoon physics fallback
// ------------------------------------------------------------------
function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function simulateWeather(at = new Date(), forcedSeverity?: number): RawNormalised {
  const month = at.getMonth() + 1;
  const monsoon = month >= 6 && month <= 9;
  const shoulder = month === 5 || month === 10;
  const hourSeed = Math.floor(at.getTime() / (30 * 60 * 1000));
  const r1 = seeded(hourSeed);
  const r2 = seeded(hourSeed + 7.7);
  const r3 = seeded(hourSeed + 13.3);

  // Base climatology for Navi Mumbai
  const baseTemp = monsoon ? 27.5 : shoulder ? 31 : 29;
  const diurnal = Math.sin(((at.getHours() - 8) / 24) * 2 * Math.PI) * (monsoon ? 2.2 : 4.5);
  const intensity = forcedSeverity ?? (monsoon ? 0.35 + r1 * 0.45 : shoulder ? 0.12 + r1 * 0.25 : 0.04 + r1 * 0.12);

  const precip = round(intensity * (monsoon ? 26 : 8) * (0.35 + r2), 2);
  const wind = round(8 + intensity * 42 + r3 * 9);
  const gust = round(wind * (1.35 + r2 * 0.4));
  const humidity = Math.round(clamp(monsoon ? 0.82 + intensity * 0.12 : 0.58 + intensity * 0.2, 0.3, 0.99) * 100);
  const code = precip > 14 ? (wind > 45 ? 95 : 82) : precip > 6 ? 65 : precip > 2 ? 63 : precip > 0.4 ? 61 : humidity > 80 ? 3 : 1;
  const temp = round(baseTemp + diurnal - intensity * 2.5);

  const topOfHour = new Date(at);
  topOfHour.setMinutes(0, 0, 0);
  const hourly = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(topOfHour.getTime() + i * 3600_000);
    const hr = seeded(hourSeed + i * 3.1);
    const decay = Math.max(0.25, 1 - i * 0.03);
    const hIntensity = clamp(intensity * decay * (0.6 + hr * 0.8));
    const hPrecip = round(hIntensity * (monsoon ? 24 : 7) * (0.3 + hr), 2);
    const hWind = round(8 + hIntensity * 40 + hr * 7);
    return {
      time: t.toISOString(),
      tempC: round(baseTemp + Math.sin(((t.getHours() - 8) / 24) * 2 * Math.PI) * (monsoon ? 2.2 : 4.5) - hIntensity * 2.5),
      precipMm: hPrecip,
      precipProb: Math.round(clamp(hIntensity * 1.3) * 100),
      windKph: hWind,
      gustKph: round(hWind * 1.4),
      humidity: Math.round(clamp(monsoon ? 0.8 + hIntensity * 0.15 : 0.55 + hIntensity * 0.25, 0.3, 0.99) * 100),
      code: hPrecip > 14 ? 82 : hPrecip > 6 ? 65 : hPrecip > 2 ? 63 : hPrecip > 0.4 ? 61 : 2,
    };
  });

  const daily = Array.from({ length: 5 }, (_, i) => {
    const t = new Date(at.getTime() + i * 86400_000);
    const dr = seeded(Math.floor(t.getTime() / 86400000) + 5.5);
    const dInt = clamp(intensity * (0.7 + dr * 0.7));
    const sum = round(dInt * (monsoon ? 90 : 22), 1);
    return {
      date: t.toISOString().slice(0, 10),
      tMaxC: round(baseTemp + 3.5 - dInt * 2),
      tMinC: round(baseTemp - 3 - dInt),
      precipSumMm: sum,
      precipProbMax: Math.round(clamp(dInt * 1.25) * 100),
      windMaxKph: round(12 + dInt * 45),
      code: sum > 60 ? 82 : sum > 25 ? 65 : sum > 8 ? 63 : sum > 1 ? 61 : 2,
    };
  });

  return {
    tempC: temp,
    apparentC: round(temp + (humidity > 75 ? 3.2 : 1.1)),
    humidity,
    precipMm: precip,
    precipProb: Math.round(clamp(intensity * 1.3) * 100),
    windKph: wind,
    gustKph: gust,
    windDir: Math.round(200 + r3 * 90),
    pressureHpa: Math.round(1010 - intensity * 12),
    cloudPct: Math.round(clamp(0.25 + intensity * 0.8) * 100),
    visibilityKm: round(clamp(14 - intensity * 11, 1.5, 20)),
    uvIndex: round(clamp(9 - intensity * 8, 0.5, 11)),
    code,
    isDay: at.getHours() >= 6 && at.getHours() < 19,
    hourly,
    daily,
  };
}

// ------------------------------------------------------------------
// Cache + public API
// ------------------------------------------------------------------
const CACHE_TTL_MS = 3 * 60 * 1000;
let cache: { data: WeatherIntel; at: number } | null = null;
let lastUpstreamError: string | null = null;

/** Manual override injected from the What-If console (Feature 4 “inject to live twin”). */
let override: { data: WeatherIntel; until: number } | null = null;

export async function getLiveWeather(force = false): Promise<WeatherIntel> {
  if (override && override.until > Date.now()) {
    return { ...override.data, ageSeconds: 0 };
  }
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { ...cache.data, ageSeconds: Math.round((Date.now() - cache.at) / 1000) };
  }

  try {
    const json = await fetchWithTimeout(OPEN_METEO_URL, 6000);
    const data = assemble(normaliseOpenMeteo(json), 'LIVE', 'Open-Meteo', 'Fetched server-side from api.open-meteo.com', new Date());
    cache = { data, at: Date.now() };
    lastUpstreamError = null;
    return data;
  } catch (err: any) {
    lastUpstreamError = err?.message || String(err);
    // Keep a recent RELAY observation alive for 20 minutes before falling back.
    if (cache && cache.data.mode === 'RELAY' && Date.now() - cache.at < 20 * 60 * 1000) {
      return { ...cache.data, ageSeconds: Math.round((Date.now() - cache.at) / 1000) };
    }
    const data = assemble(
      simulateWeather(),
      'SIMULATED',
      'Resort physics model',
      `Upstream weather API unreachable from this host (${lastUpstreamError}). Serving the calibrated monsoon-climatology model; the browser relay will upgrade this to live data automatically.`,
      new Date(),
    );
    cache = { data, at: Date.now() };
    return data;
  }
}

/** Tier 2 — the browser fetched Open-Meteo and relayed the raw payload here. */
export function ingestWeatherObservation(raw: any): WeatherIntel {
  const data = assemble(
    normaliseOpenMeteo(raw),
    'RELAY',
    'Open-Meteo',
    'Live observation relayed from the operator browser (server egress restricted).',
    new Date(),
  );
  cache = { data, at: Date.now() };
  return data;
}

/** Feature 4 — push a simulated storm into the live twin for N minutes. */
export function setWeatherOverride(severity: number, minutes = 20): WeatherIntel {
  const data = assemble(
    simulateWeather(new Date(), clamp(severity)),
    'SIMULATED',
    'What-If injection',
    `Digital-twin scenario injected by an operator (severity ${(clamp(severity) * 100).toFixed(0)}%). Auto-expires in ${minutes} min.`,
    new Date(),
  );
  override = { data, until: Date.now() + minutes * 60_000 };
  return data;
}

export function clearWeatherOverride() {
  override = null;
}

export function weatherStatus() {
  return {
    cached: !!cache,
    mode: override && override.until > Date.now() ? 'SIMULATED (override)' : cache?.data.mode ?? 'none',
    lastUpstreamError,
    overrideActive: !!(override && override.until > Date.now()),
  };
}
