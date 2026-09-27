const RESORT = { name: 'Smart Resort 360 · Navi Mumbai', lat: 19.033, lon: 73.029 };

export async function getWorldIntel() {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${RESORT.lat}&longitude=${RESORT.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=precipitation_probability&forecast_days=1&timezone=auto`;
  const socialUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=(Navi%20Mumbai%20OR%20Mumbai)%20(weather%20OR%20storm%20OR%20rain)&mode=artlist&maxrecords=8&format=json`;
  const [weather, social] = await Promise.allSettled([fetch(weatherUrl).then(r => r.json()), fetch(socialUrl).then(r => r.json())]);
  const w: any = weather.status === 'fulfilled' ? weather.value : {};
  const current = w.current || {};
  const articles = social.status === 'fulfilled' && Array.isArray((social.value as any)?.articles) ? (social.value as any).articles : [];
  const rain = Number(current.precipitation || 0);
  const wind = Number(current.wind_speed_10m || 0);
  const weatherSeverity = Math.min(1, Math.max(0, rain / 10 + wind / 100));
  return {
    location: RESORT,
    source: 'Open-Meteo', fetchedAt: new Date().toISOString(),
    current: { temperatureC: current.temperature_2m ?? null, humidity: current.relative_humidity_2m ?? null, precipitationMm: rain, windKph: wind, weatherCode: current.weather_code ?? null, severity: Number(weatherSeverity.toFixed(2)) },
    social: { source: 'GDELT public news/social signal index', count: articles.length, items: articles.slice(0, 8).map((a: any) => ({ title: a.title, url: a.url, seen: a.seendate })) },
    // This is an explicit, inspectable input for the AI and twin rather than a fabricated condition.
    aiInput: `Live weather at Navi Mumbai: ${current.temperature_2m ?? 'unknown'}°C, ${rain}mm precipitation, ${wind}km/h wind; ${articles.length} public weather-related signals.`
  };
}

export async function askGemini(prompt: string, context: unknown) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { configured: false, text: 'Gemini is not configured. Add GEMINI_API_KEY to server/.env to enable live AI analysis.' };
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt}\n\nLive resort context:\n${JSON.stringify(context)}` }] }] }) });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const json: any = await response.json();
  return { configured: true, text: json.candidates?.[0]?.content?.parts?.[0]?.text || 'No AI response returned.' };
}
