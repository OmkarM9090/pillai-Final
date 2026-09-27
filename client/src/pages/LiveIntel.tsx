// ============================================================
// LIVE INTEL COMMAND — Features 1 + 2 + 3 (+ AI briefing from Feature 5)
//   1. Real-time weather API feeding the AI models
//   2. Geospatial map of zones, weather exposure and impact
//   3. Public social signals: sentiment, themes, emerging conditions
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudRain, Wind, Droplets, Thermometer, Gauge as GaugeIcon, Eye, RefreshCw, Sparkles, Radio, AlertTriangle,
  TrendingUp, TrendingDown, Brain, Activity, MapPin, Clock, CheckCircle2, Zap, CloudSun, Sun, CloudFog, CloudLightning, Snowflake,
} from 'lucide-react';
import ResortMap from '../components/ResortMap';
import { AiText, Badge, Bar, Gauge, MiniChart, Panel, Skeleton, SourceChip, StatTile, sev } from '../components/ui/Primitives';
import { IntelApi, relayLiveSocial, relayLiveWeather, type GeoIntel, type SocialIntel, type WeatherIntel } from '../lib/intelApi';

const ICONS: Record<string, any> = { sun: Sun, 'cloud-sun': CloudSun, cloud: CloudSun, rain: CloudRain, drizzle: CloudRain, storm: CloudLightning, fog: CloudFog, snow: Snowflake };

export function LiveIntel() {
  const [weather, setWeather] = useState<WeatherIntel | null>(null);
  const [social, setSocial] = useState<SocialIntel | null>(null);
  const [geo, setGeo] = useState<GeoIntel | null>(null);
  const [model, setModel] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relayState, setRelayState] = useState<'idle' | 'trying' | 'ok' | 'blocked'>('idle');
  const [auto, setAuto] = useState(true);
  const [now, setNow] = useState(new Date());
  const relayDone = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async (force = false) => {
    try {
      setError(null);
      const [w, s, g, m] = await Promise.allSettled([
        IntelApi.weather(force), IntelApi.social(force), IntelApi.geo(), IntelApi.modelForecast(),
      ]);
      if (w.status === 'fulfilled') setWeather(w.value);
      if (s.status === 'fulfilled') setSocial(s.value);
      if (g.status === 'fulfilled') setGeo(g.value);
      if (m.status === 'fulfilled') setModel(m.value);
      if (w.status === 'rejected' && s.status === 'rejected') setError('Intelligence services are unreachable. Check that the API server is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // First paint, then let the browser try to relay a genuinely live observation.
  useEffect(() => {
    load();
    if (!relayDone.current) {
      relayDone.current = true;
      setRelayState('trying');
      (async () => {
        const okW = await relayLiveWeather();
        const okS = await relayLiveSocial();
        setRelayState(okW || okS ? 'ok' : 'blocked');
        if (okW || okS) load(true);
      })();
    }
  }, [load]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => load(), 60_000);
    return () => clearInterval(t);
  }, [auto, load]);

  const refresh = async () => {
    setRefreshing(true);
    await relayLiveWeather();
    await load(true);
  };

  const runBrief = async () => {
    setBriefing(true);
    try {
      setBrief(await IntelApi.brief());
    } catch (e: any) {
      setBrief({ text: `Briefing failed: ${e.message}`, provider: 'error', mode: 'ONBOARD' });
    } finally {
      setBriefing(false);
    }
  };

  const c = weather?.current;
  const band = weather?.severity.band ?? 'INFO';
  const s = sev(band);
  const Icon = ICONS[c?.icon ?? 'cloud'] ?? CloudSun;

  const hourly = weather?.hourly ?? [];
  const tempSeries = useMemo(() => hourly.map((h) => h.tempC), [hourly]);
  const rainSeries = useMemo(() => hourly.map((h) => h.precipMm), [hourly]);
  const hourLabels = useMemo(() => hourly.map((h) => h.hourLabel), [hourly]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-8 space-y-4">
        <Skeleton className="h-24" />
        <div className="grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 space-y-5">
      {/* ---------------- Header ---------------- */}
      <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/80 to-cyan-950/40 p-5 shadow-2xl">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400">
              <Activity size={12} className="animate-pulse" /> Live operations intelligence
            </p>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Weather · Geospatial · Social Twin
            </h1>
            <p className="mt-1 max-w-3xl text-[13px] text-slate-400">
              Every number below is fetched from a live source and handed straight to the AI models, the digital twin and the copilot — nothing is hard-coded.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-slate-300">{now.toLocaleTimeString('en-IN', { hour12: false })}</span>
              <button
                onClick={() => setAuto((a) => !a)}
                className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                  auto ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-400'
                }`}
              >
                {auto ? 'Auto 60s' : 'Manual'}
              </button>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/25 disabled:opacity-50"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {weather && <SourceChip mode={weather.mode} provider={weather.provider} note={weather.providerNote} />}
              {social && <Badge tone={social.mode === 'SIMULATED' ? 'ADVISORY' : 'CALM'}>Social · {social.mode}</Badge>}
              {relayState === 'trying' && <Badge tone="INFO">Relay probing…</Badge>}
              {relayState === 'ok' && <Badge tone="CALM">Browser relay active</Badge>}
            </div>
          </div>
        </div>
        {weather?.mode === 'SIMULATED' && (
          <p className="relative mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            <AlertTriangle size={12} className="mr-1.5 inline" />
            {weather.providerNote}
          </p>
        )}
        {error && (
          <p className="relative mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{error}</p>
        )}
      </header>

      {/* ---------------- Weather hero ---------------- */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-5" title="Feature 1 · Live weather" subtitle={`${weather?.site.name} · ${weather?.site.city} · updated ${weather?.ageSeconds}s ago`} icon={<CloudRain size={16} />}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Icon size={48} className={s.text} />
                <div>
                  <div className="text-5xl font-black leading-none text-white">{c?.tempC}<span className="text-2xl">°C</span></div>
                  <p className="mt-1 text-[13px] text-slate-300">{c?.label} · feels {c?.apparentC}°C</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] text-slate-300">
                <span className="flex items-center gap-1.5"><Droplets size={13} className="text-sky-400" /> {c?.precipMm} mm/h · {c?.precipProb}%</span>
                <span className="flex items-center gap-1.5"><Wind size={13} className="text-cyan-400" /> {c?.windKph} km/h {c?.windDirLabel}</span>
                <span className="flex items-center gap-1.5"><Zap size={13} className="text-amber-400" /> gust {c?.gustKph} km/h</span>
                <span className="flex items-center gap-1.5"><Thermometer size={13} className="text-rose-400" /> {c?.humidity}% RH</span>
                <span className="flex items-center gap-1.5"><GaugeIcon size={13} className="text-violet-400" /> {c?.pressureHpa} hPa</span>
                <span className="flex items-center gap-1.5"><Eye size={13} className="text-slate-400" /> {c?.visibilityKm} km</span>
              </div>
            </div>
            <div className="text-center">
              <Gauge value={(weather?.severity.index ?? 0) * 100} label="severity" tone={band} size={116} />
              <Badge tone={band} className="mt-2" pulse={band !== 'CALM'}>{band}</Badge>
              <p className="mt-2 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {weather?.trend.direction === 'DETERIORATING' ? <TrendingUp size={11} className="text-rose-400" /> : weather?.trend.direction === 'IMPROVING' ? <TrendingDown size={11} className="text-emerald-400" /> : <Activity size={11} />}
                {weather?.trend.direction}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 rounded-xl border border-white/5 bg-black/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Severity decomposition</p>
            {weather?.severity.drivers.slice(0, 4).map((d) => (
              <div key={d.factor} className="flex items-center gap-2">
                <span className="w-36 shrink-0 truncate text-[11px] text-slate-300">{d.factor}</span>
                <Bar value={d.contribution * 100} max={40} height={6} />
                <span className="w-24 shrink-0 text-right text-[10px] text-slate-400">{d.detail}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* AI model input proof */}
        <Panel className="xl:col-span-4" title="Weather → AI model inputs" subtitle="The live feed is a real feature vector, not decoration" icon={<Brain size={16} />}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { k: 'weather_score', label: 'Weather score', tone: 'INFO' },
              { k: 'demand_shock', label: 'Demand shock', tone: 'ADVISORY' },
              { k: 'staff_availability', label: 'Staff availability', tone: 'WATCH' },
              { k: 'outdoor_viability', label: 'Outdoor viability', tone: 'CALM' },
            ].map((f) => (
              <StatTile key={f.k} compact label={f.label} value={weather?.aiFeatures[f.k] ?? '—'} tone={f.tone} />
            ))}
          </div>

          {model && (
            <div className="mt-4 rounded-xl border border-violet-500/25 bg-violet-500/10 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">Trained demand model</p>
                <Badge tone={model.source === 'ml-server' ? 'CALM' : 'ADVISORY'}>{model.source === 'ml-server' ? 'ML CORE LIVE' : 'ANALYTIC FALLBACK'}</Badge>
              </div>
              <div className="mt-2 flex items-end gap-4">
                <div>
                  <p className="text-[10px] uppercase text-slate-400">Weather-adjusted</p>
                  <p className="text-2xl font-black text-white">{model.weatherAdjusted?.occupancy_forecast}%</p>
                </div>
                <div className="opacity-60">
                  <p className="text-[10px] uppercase text-slate-400">Clear-sky counterfactual</p>
                  <p className="text-xl font-bold text-slate-300">{model.weatherAdjusted?.clearSky}%</p>
                </div>
                <div className={`ml-auto text-right ${model.weatherEffect < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                  <p className="text-[10px] uppercase text-slate-400">Weather effect</p>
                  <p className="text-xl font-black">{model.weatherEffect > 0 ? '+' : ''}{model.weatherEffect} pts</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-slate-400">{model.explanation}</p>
              {model.mlSimulation && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1.5 text-[10px] text-violet-100">
                  <span className="font-bold uppercase tracking-wider text-violet-300">ML simulator · {model.weatherCondition}</span>
                  {model.mlSimulation.revenue?.total_revenue !== undefined && (
                    <span>revenue ₹{Number(model.mlSimulation.revenue.total_revenue).toLocaleString('en-IN')}</span>
                  )}
                  {model.mlSimulation.staffing?.total_needed !== undefined && (
                    <span>· staff needed {model.mlSimulation.staffing.total_needed} (gap {model.mlSimulation.staffing.gap})</span>
                  )}
                  {model.mlSimulation.summary?.overall_status && (
                    <span>· status <b className="uppercase">{String(model.mlSimulation.summary.overall_status).replace('_', ' ')}</b></span>
                  )}
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Alerts */}
        <Panel className="xl:col-span-3" title="Active advisories" subtitle="Auto-generated from the live feed" icon={<AlertTriangle size={16} />}>
          <div className="space-y-2">
            {weather?.alerts.map((a) => {
              const st = sev(a.level);
              return (
                <div key={a.id} className={`rounded-xl border ${st.border} ${st.bg} p-3`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[12px] font-bold ${st.text}`}>{a.title}</p>
                    <Badge tone={a.level}>{a.level}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-300">{a.message}</p>
                  {!!a.zones.length && <p className="mt-1.5 text-[10px] uppercase tracking-wider text-slate-500">Zones: {a.zones.join(' · ')}</p>}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ---------------- Forecast ---------------- */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8" title="24-hour operational forecast" subtitle="Temperature line · rainfall bars · hover the strip for hourly detail" icon={<Clock size={16} />}>
          <MiniChart data={tempSeries} bars={rainSeries} labels={hourLabels} height={130} />
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {hourly.slice(0, 8).map((h) => {
              const hs = sev(h.severity >= 0.75 ? 'SEVERE' : h.severity >= 0.55 ? 'WARNING' : h.severity >= 0.35 ? 'WATCH' : h.severity >= 0.18 ? 'ADVISORY' : 'CALM');
              return (
                <div key={h.time} className={`rounded-lg border ${hs.border} ${hs.bg} px-2 py-2 text-center`}>
                  <p className="text-[10px] font-bold text-slate-400">{h.hourLabel}</p>
                  <p className="text-sm font-black text-white">{h.tempC}°</p>
                  <p className="text-[10px] text-sky-300">{h.precipMm} mm</p>
                  <p className="text-[10px] text-slate-400">{h.windKph} km/h</p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="xl:col-span-4" title="5-day outlook" subtitle="Drives roster and inventory planning" icon={<CloudSun size={16} />}>
          <div className="space-y-2">
            {weather?.daily.map((d) => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="w-10 text-[11px] font-bold uppercase text-slate-300">{d.dayLabel}</span>
                <span className="w-24 truncate text-[11px] text-slate-400">{d.label}</span>
                <Bar value={d.severity * 100} height={7} />
                <span className="w-24 shrink-0 text-right text-[11px] text-slate-300">{d.tMinC}–{d.tMaxC}° · {d.precipSumMm}mm</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ---------------- Map + social feed ---------------- */}
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          {geo && (
            <ResortMap
              site={geo.site}
              zones={geo.zones}
              socialMarkers={geo.socialMarkers}
              contextPoints={geo.contextPoints}
              storm={{ distanceKm: 14, bearing: geo.weather.windDir ?? 245, severity: geo.weather.severity, label: 'Weather cell' }}
              title="Feature 2 · Geospatial impact map"
              height={520}
            />
          )}
        </div>

        <Panel
          className="xl:col-span-4"
          title="Feature 3 · Public signal feed"
          subtitle={social ? `${social.totals.signals} signals · ${social.totals.last60min} in the last hour` : 'connecting…'}
          icon={<Radio size={16} />}
          action={social && <Badge tone={social.sentiment.net < -20 ? 'WARNING' : social.sentiment.net < 0 ? 'ADVISORY' : 'CALM'}>NET {social.sentiment.net > 0 ? '+' : ''}{social.sentiment.net}</Badge>}
        >
          <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
            {social?.signals.map((sig) => {
              const tone = sig.sentiment.label === 'NEGATIVE' ? 'WARNING' : sig.sentiment.label === 'POSITIVE' ? 'CALM' : 'INFO';
              const st = sev(tone);
              return (
                <a
                  key={sig.id}
                  href={sig.url && sig.url !== '#' ? sig.url : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`block rounded-xl border ${st.border} bg-white/[0.03] p-3 transition hover:bg-white/[0.07]`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} /> {sig.handle}
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-300">{sig.platform}</span>
                    </span>
                    <span className="text-[10px] text-slate-500">{sig.minutesAgo}m</span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-slate-300">{sig.text}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {sig.topics.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-400">{t}</span>
                    ))}
                    {sig.geo && <span className="text-[9px] text-slate-500">📍 {sig.geo.place} · {sig.geo.distanceKm} km</span>}
                  </div>
                </a>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ---------------- Social analytics ---------------- */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-3" title="Sentiment mix" subtitle={`Trend ${social?.sentiment.trend.toLowerCase() ?? '—'}`} icon={<Activity size={16} />}>
          <div className="flex items-center gap-4">
            <Gauge value={Math.abs(social?.sentiment.net ?? 0)} label={(social?.sentiment.net ?? 0) < 0 ? 'negative' : 'positive'} tone={(social?.sentiment.net ?? 0) < -20 ? 'WARNING' : 'CALM'} size={104} />
            <div className="flex-1 space-y-2">
              {[
                { l: 'Positive', v: social?.sentiment.positive ?? 0, c: 'bg-emerald-400' },
                { l: 'Neutral', v: social?.sentiment.neutral ?? 0, c: 'bg-slate-400' },
                { l: 'Negative', v: social?.sentiment.negative ?? 0, c: 'bg-rose-400' },
              ].map((r) => (
                <div key={r.l}>
                  <div className="flex justify-between text-[10px] text-slate-400"><span>{r.l}</span><span>{r.v}</span></div>
                  <div className="h-1.5 w-full rounded-full bg-white/8">
                    <div className={`h-full rounded-full ${r.c}`} style={{ width: `${((r.v / Math.max(1, social?.totals.signals ?? 1)) * 100).toFixed(0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatTile compact label="Cancellation talk" value={social?.travellerImpact.cancellations ?? 0} tone={(social?.travellerImpact.cancellations ?? 0) > 2 ? 'WARNING' : 'CALM'} />
            <StatTile compact label="Delay reports" value={social?.travellerImpact.delays ?? 0} tone={(social?.travellerImpact.delays ?? 0) > 3 ? 'WATCH' : 'CALM'} />
          </div>
        </Panel>

        <Panel className="xl:col-span-3" title="Dominant themes" subtitle="Topic model over live chatter" icon={<TrendingUp size={16} />}>
          <div className="space-y-2.5">
            {social?.themes.map((t) => (
              <div key={t.topic}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-200">{t.label}</span>
                  <span className="text-slate-400">{t.count} · {t.share}%</span>
                </div>
                <Bar value={t.share} height={7} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-3" title="Signal volume (6 h)" subtitle="Red = negative share" icon={<Radio size={16} />}>
          <MiniChart
            data={(social?.timeline ?? []).map((t) => t.count)}
            bars={(social?.timeline ?? []).map((t) => t.negative)}
            labels={(social?.timeline ?? []).map((t) => t.bucket)}
            color="#38bdf8"
            barColor="rgba(248,113,113,0.6)"
            height={120}
          />
          <p className="mt-2 text-[11px] text-slate-400">
            Twin inputs → pressure <b className="text-slate-200">{social?.twinInputs.social_pressure}</b>, reputation risk{' '}
            <b className="text-slate-200">{social?.twinInputs.reputation_risk}</b>, arrival disruption <b className="text-slate-200">{social?.twinInputs.arrival_disruption}</b>
          </p>
        </Panel>

        <Panel className="xl:col-span-3" title="Emerging conditions" subtitle="Spike detection on public reports" icon={<AlertTriangle size={16} />}>
          <div className="space-y-2">
            {social?.emerging.map((e) => {
              const st = sev(e.level);
              return (
                <div key={e.id} className={`rounded-xl border ${st.border} ${st.bg} p-3`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[12px] font-bold ${st.text}`}>{e.title}</p>
                    <Badge tone={e.level}>{(e.confidence * 100).toFixed(0)}%</Badge>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-300">{e.detail}</p>
                </div>
              );
            })}
            <div className="rounded-xl border border-white/5 bg-black/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Providers</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {social?.providers.map((p) => (
                  <span key={p.name} title={p.note} className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${p.status === 'OK' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>
                    {p.name} · {p.status} {p.count ? `(${p.count})` : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* ---------------- AI briefing ---------------- */}
      <Panel
        title="AI executive briefing"
        subtitle="Grounded in the live weather, social and operational state"
        icon={<Sparkles size={16} />}
        action={
          <button
            onClick={runBrief}
            disabled={briefing}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-50"
          >
            {briefing ? <><RefreshCw size={13} className="animate-spin" /> Reasoning…</> : <><Brain size={13} /> Generate briefing</>}
          </button>
        }
      >
        {!brief && !briefing && (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
            <Sparkles className="mx-auto mb-2 text-violet-400" />
            <p className="text-[13px] text-slate-300">Generate a decision-ready briefing from the current live picture.</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Uses your configured cloud LLM when a key is present, and the on-board grounded reasoner otherwise — both read the same live context.
            </p>
          </div>
        )}
        {briefing && <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4" />)}</div>}
        {brief && !briefing && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone={brief.mode === 'CLOUD' ? 'CALM' : 'INFO'}>{brief.mode === 'CLOUD' ? `Cloud LLM · ${brief.provider}` : 'On-board reasoner'}</Badge>
              <span className="text-[10px] text-slate-500">{brief.model} · {brief.latencyMs} ms</span>
              {brief.note && <span className="text-[10px] text-amber-300/80">{brief.note}</span>}
            </div>
            <AiText text={brief.text} />
            <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-400" /> Weather {weather?.mode}</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-400" /> Social {social?.mode}</span>
              <span className="flex items-center gap-1"><MapPin size={11} className="text-cyan-400" /> {geo?.zones.length} zones scored</span>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default LiveIntel;
