// ============================================================
// Typed client for the live-intelligence API + browser relay.
//
// The relay matters: when the API server sits behind a restricted
// network it cannot reach Open-Meteo, but the operator's browser can.
// We fetch the live observation client-side and POST it back so the
// server-side AI models and digital twin run on genuinely live data.
// ============================================================

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as Record<string, string>;
};

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.error || json?.message || `Request failed (${res.status})`);
  return (json?.data ?? json) as T;
}

export async function apiPost<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body ?? {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.error || json?.message || `Request failed (${res.status})`);
  return (json?.data ?? json) as T;
}

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export interface WeatherIntel {
  mode: 'LIVE' | 'RELAY' | 'SIMULATED';
  provider: string;
  providerNote: string;
  fetchedAt: string;
  ageSeconds: number;
  site: { name: string; city: string; region: string; lat: number; lon: number; timezone: string; totalRooms: number };
  current: {
    tempC: number; apparentC: number; humidity: number; precipMm: number; precipProb: number;
    windKph: number; gustKph: number; windDir: number; windDirLabel: string; pressureHpa: number;
    cloudPct: number; visibilityKm: number; uvIndex: number; code: number; label: string; icon: string; isDay: boolean;
  };
  severity: { index: number; band: string; drivers: Array<{ factor: string; contribution: number; detail: string }> };
  trend: { next6hPrecipMm: number; next6hPeakWindKph: number; direction: string };
  hourly: Array<{ time: string; hourLabel: string; tempC: number; precipMm: number; precipProb: number; windKph: number; gustKph: number; humidity: number; code: number; label: string; severity: number }>;
  daily: Array<{ date: string; dayLabel: string; tMaxC: number; tMinC: number; precipSumMm: number; precipProbMax: number; windMaxKph: number; code: number; label: string; severity: number }>;
  alerts: Array<{ id: string; level: string; title: string; message: string; zones: string[]; validUntil: string }>;
  aiFeatures: Record<string, number>;
  narrative: string;
}

export interface SocialIntel {
  mode: string;
  fetchedAt: string;
  providers: Array<{ name: string; status: string; count: number; note?: string }>;
  totals: { signals: number; travellers: number; last60min: number };
  sentiment: { positive: number; neutral: number; negative: number; net: number; trend: string };
  themes: Array<{ topic: string; label: string; count: number; sentiment: number; severity: number; share: number }>;
  timeline: Array<{ bucket: string; count: number; negative: number }>;
  emerging: Array<{ id: string; title: string; detail: string; confidence: number; level: string; topics: string[] }>;
  travellerImpact: { cancellations: number; delays: number; complaints: number; praise: number; riskScore: number };
  signals: Array<{
    id: string; platform: string; author: string; handle: string; text: string; url: string; timestamp: string;
    minutesAgo: number; sentiment: { score: number; label: string }; topics: string[]; severityHint: number;
    geo: { lat: number; lon: number; place: string; distanceKm: number } | null; engagement: number; isTraveller: boolean; verified: boolean; source: string;
  }>;
  aiSummary: string;
  twinInputs: { social_pressure: number; reputation_risk: number; arrival_disruption: number };
}

export interface GeoIntel {
  site: { name: string; city: string; lat: number; lon: number; totalRooms: number };
  zones: Array<{
    id: string; name: string; type: string; lat: number; lon: number; radiusM: number; elevationM: number;
    exposure: number; rooms?: number; capacity: number; revenuePerHour: number; department: string;
    criticalAssets: string[]; impact: number; status: string;
  }>;
  contextPoints: Array<{ id: string; name: string; lat: number; lon: number; kind: string }>;
  socialMarkers: Array<{ id: string; lat: number; lon: number; place: string; distanceKm: number; platform: string; text: string; sentiment: string; topics: string[]; minutesAgo: number; url: string }>;
  weather: { severity: number; band: string; precipMm: number; windKph: number; windDir: number; label: string; mode: string };
}

export interface WhatIfResult {
  scenario: { rainIntensityMmHr: number; durationHours: number; windKph: number; tempC: number; stormDistanceKm: number; stormBearing: number; severity: number; band: string; conditionLabel: string; label?: string };
  basedOn: { weatherMode: string; liveSeverity: number; occupancyPct: number; totalRooms: number; staffTotal: number };
  severityBreakdown: { index: number; band: string; drivers: Array<{ factor: string; contribution: number; detail: string }> };
  zones: Array<{ id: string; name: string; type: string; lat: number; lon: number; radiusM: number; department: string; floodRisk: number; windRisk: number; accessRisk: number; impact: number; status: string; guestsAffected: number; roomsAtRisk: number; revenueAtRisk: number; assetsAtRisk: string[]; actions: string[]; etaMinutes: number }>;
  propagation: Array<{ t: string; hour: number; headline: string; cumulativeRainMm: number; pressure: number; events: Array<{ zone: string; system: string; text: string; level: string }> }>;
  deltas: Array<{ key: string; label: string; unit: string; baseline: number; scenario: number; delta: number; direction: string; goodWhen: string }>;
  departments: Array<{ name: string; key: string; baselinePressure: number; scenarioPressure: number; delta: number; staffGap: number; state: string }>;
  guestImpact: { requestsForecast: number; baselineRequests: number; roomsToReallocate: number; guestsToRelocate: number; slaBreachRisk: number; complaintsForecast: number };
  fnb: { outdoorCoversDisplaced: number; indoorDemandUplift: number; roomServiceUplift: number; inventoryBurnUplift: number; chillerLoadPct: number; beverageUplift: number; heatStress: number };
  revenue: { baselineGoppar: number; scenarioGoppar: number; revenueAtRisk: number; mitigatedRevenue: number; currency: string };
  resilience: { baseline: number; scenario: number; mitigated: number };
  safeCapacity: { baseline: number; scenario: number };
  engineCrossCheck: { baselineResilience: number; scenarioResilience: number; bottleneck?: string };
  mitigations: Array<{ id: string; title: string; detail: string; department: string; gain: string; costINR: number; leadTimeMins: number; priority: string; confidence: number }>;
  confidence: number;
  computedAt: string;
  narrativeSeed: string;
}

// ------------------------------------------------------------------
// API calls
// ------------------------------------------------------------------
export const IntelApi = {
  weather: (force = false) => apiGet<WeatherIntel>(`/api/v1/intel/weather${force ? '?force=1' : ''}`),
  social: (force = false) => apiGet<SocialIntel>(`/api/v1/intel/social${force ? '?force=1' : ''}`),
  geo: () => apiGet<GeoIntel>('/api/v1/intel/geo'),
  overview: () => apiGet('/api/v1/intel/overview'),
  modelForecast: () => apiGet('/api/v1/intel/weather/model-forecast'),
  brief: (focus?: string) => apiPost('/api/v1/ai/brief', { focus }),
  presets: () => apiGet('/api/v1/twin/presets'),
  whatIf: (scenario: Record<string, unknown>) => apiPost<WhatIfResult>('/api/v1/twin/whatif', scenario),
  applyWhatIf: (result: WhatIfResult, injectLive = false) => apiPost('/api/v1/twin/whatif/apply', { result, injectLive }),
  clearOverride: () => fetch('/api/v1/twin/weather-override', { method: 'DELETE', headers: authHeaders() }),
  chat: (payload: { message: string; history?: Array<{ role: string; content: string }>; roomNumber?: string; guestId?: string }) =>
    apiPost('/api/v1/ai/chat', payload),
  aiStatus: () => apiGet('/api/v1/ai/status'),
};

// ------------------------------------------------------------------
// Browser relay — upgrade the server feed to genuinely live data
// ------------------------------------------------------------------
const OPEN_METEO =
  'https://api.open-meteo.com/v1/forecast?latitude=19.033&longitude=73.029' +
  '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility' +
  '&hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max' +
  '&forecast_days=5&timezone=auto';

const MASTODON = 'https://mastodon.social/api/v1/timelines/tag/mumbai?limit=30';

const GDELT =
  'https://api.gdeltproject.org/api/v2/doc/doc?query=' +
  encodeURIComponent('(Mumbai OR "Navi Mumbai") (rain OR flood OR storm OR monsoon OR weather OR waterlogging)') +
  '&mode=artlist&maxrecords=25&sort=datedesc&format=json';

async function tryFetchJson(url: string, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Returns true when the browser managed to relay a genuinely live observation. */
export async function relayLiveWeather(): Promise<boolean> {
  const raw = await tryFetchJson(OPEN_METEO);
  if (!raw) return false;
  try {
    await apiPost('/api/v1/intel/weather/ingest', { raw });
    return true;
  } catch {
    return false;
  }
}

export async function relayLiveSocial(): Promise<boolean> {
  // Both endpoints are keyless and CORS-enabled; whichever answers first is relayed.
  const [gdelt, mastodon] = await Promise.all([tryFetchJson(GDELT, 9000), tryFetchJson(MASTODON, 9000)]);
  if (!gdelt && !mastodon) return false;
  try {
    const out = await apiPost<{ accepted: number }>('/api/v1/intel/social/ingest', { gdelt, mastodon });
    return (out?.accepted ?? 0) > 0;
  } catch {
    return false;
  }
}
