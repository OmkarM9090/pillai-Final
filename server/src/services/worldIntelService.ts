// ============================================================
// Backwards-compatible wrapper around the new live intelligence stack.
// Existing pages (Time Machine, legacy World Intel) keep working while
// the data now comes from the resilient weather + social services.
// ============================================================

import { getLiveWeather } from './intel/weatherService';
import { getSocialIntel } from './intel/socialService';
import { generateBriefing } from './ai/resortBrain';
import { RESORT_SITE } from './intel/resortSite';

export async function getWorldIntel() {
  const weather = await getLiveWeather();
  const social = await getSocialIntel(weather).catch(() => null);

  return {
    location: { name: `${RESORT_SITE.name} · ${RESORT_SITE.city}`, lat: RESORT_SITE.lat, lon: RESORT_SITE.lon },
    source: weather.provider,
    mode: weather.mode,
    fetchedAt: weather.fetchedAt,
    current: {
      temperatureC: weather.current.tempC,
      humidity: weather.current.humidity,
      precipitationMm: weather.current.precipMm,
      windKph: weather.current.windKph,
      weatherCode: weather.current.code,
      label: weather.current.label,
      severity: weather.severity.index,
      band: weather.severity.band,
    },
    forecast: weather.hourly.slice(0, 12),
    alerts: weather.alerts,
    aiFeatures: weather.aiFeatures,
    social: social
      ? {
          source: `${social.mode} · ${social.providers.map((p) => p.name).join(', ')}`,
          count: social.totals.signals,
          sentiment: social.sentiment,
          themes: social.themes,
          items: social.signals.slice(0, 8).map((s) => ({ title: s.text, url: s.url, seen: s.timestamp, platform: s.platform, sentiment: s.sentiment.label })),
        }
      : { source: 'unavailable', count: 0, items: [] },
    aiInput: weather.narrative,
  };
}

export async function askGemini(prompt: string, _context?: unknown) {
  const brief = await generateBriefing(prompt);
  return { configured: brief.mode === 'CLOUD', provider: brief.provider, model: brief.model, text: brief.text, note: brief.note };
}
