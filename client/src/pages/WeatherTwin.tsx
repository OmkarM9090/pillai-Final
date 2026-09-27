// ============================================================
// FEATURE 4 — DIGITAL TWIN WHAT-IF SIMULATION
// Move any weather parameter and the whole resort system responds:
// zone exposure, department pressure, staffing gaps, room reallocation,
// F&B covers, revenue, SLA risk — then push the plan into the live system.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Droplets, Wind, Thermometer, Clock, Navigation, Play, Zap, RefreshCw, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, Building2, Users, Coins, Brain, Sparkles, Radar, ListChecks, ArrowRight, Send,
} from 'lucide-react';
import ResortMap from '../components/ResortMap';
import { AiText, Badge, Bar, Gauge, Panel, Skeleton, StatTile, sev } from '../components/ui/Primitives';
import { IntelApi, type GeoIntel, type WhatIfResult } from '../lib/intelApi';

interface Preset { id: string; name: string; description: string; scenario: Record<string, number> }

const SLIDERS = [
  { key: 'rainIntensityMmHr', label: 'Rain intensity', unit: 'mm/h', min: 0, max: 60, step: 1, icon: Droplets, color: 'accent-sky-500', hint: '>7.6 mm/h = heavy rain · >16 = very heavy' },
  { key: 'durationHours', label: 'Event duration', unit: 'h', min: 1, max: 24, step: 1, icon: Clock, color: 'accent-violet-500', hint: 'Cumulative rainfall drives flooding, not intensity alone' },
  { key: 'windKph', label: 'Sustained wind', unit: 'km/h', min: 0, max: 120, step: 1, icon: Wind, color: 'accent-cyan-500', hint: '>50 km/h suspends outdoor service · >90 = cyclonic' },
  { key: 'tempC', label: 'Temperature', unit: '°C', min: 15, max: 45, step: 1, icon: Thermometer, color: 'accent-rose-500', hint: '>36 °C triggers the chiller + hydration protocol' },
  { key: 'stormDistanceKm', label: 'Storm distance', unit: 'km', min: 0, max: 80, step: 1, icon: Navigation, color: 'accent-amber-500', hint: 'Proximity amplifies every impact and shortens lead time' },
] as const;

export function WeatherTwin() {
  const [scenario, setScenario] = useState<Record<string, number>>({
    rainIntensityMmHr: 45, durationHours: 6, windKph: 55, tempC: 26, stormDistanceKm: 4, stormBearing: 250,
  });
  const [label, setLabel] = useState('Monsoon cloudburst');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<any>(null);
  const [injectLive, setInjectLive] = useState(false);
  const [narrative, setNarrative] = useState<any>(null);
  const [explaining, setExplaining] = useState(false);
  const [auto, setAuto] = useState(true);
  const [geo, setGeo] = useState<GeoIntel | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (s: Record<string, number>, name: string) => {
    setRunning(true);
    setError(null);
    try {
      const res = await IntelApi.whatIf({ ...s, label: name });
      setResult(res);
      setApplied(null);
    } catch (e: any) {
      setError(e.message || 'Simulation failed');
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    IntelApi.presets().then(setPresets).catch(() => undefined);
    IntelApi.geo().then(setGeo).catch(() => undefined);
    run(scenario, label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live recompute as the operator drags a slider (debounced).
  const update = (key: string, value: number) => {
    const next = { ...scenario, [key]: value };
    setScenario(next);
    setLabel('Custom scenario');
    if (!auto) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => run(next, 'Custom scenario'), 320);
  };

  const applyPreset = (p: Preset) => {
    const next = { ...scenario, ...p.scenario };
    setScenario(next);
    setLabel(p.name);
    run(next, p.name);
  };

  const explain = async () => {
    if (!result) return;
    setExplaining(true);
    try {
      setNarrative(await IntelApi.brief(
        `Explain this digital-twin weather scenario to the duty manager and give the decision: ${result.narrativeSeed}`,
      ));
    } catch (e: any) {
      setNarrative({ text: `Explanation failed: ${e.message}`, mode: 'ONBOARD' });
    } finally {
      setExplaining(false);
    }
  };

  const apply = async () => {
    if (!result) return;
    setApplying(true);
    try {
      setApplied(await IntelApi.applyWhatIf(result, injectLive));
    } catch (e: any) {
      setError(e.message || 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const band = result?.scenario.band ?? 'CALM';

  const deltaCards = useMemo(() => result?.deltas ?? [], [result]);
  const fmt = (d: WhatIfResult['deltas'][number], v: number) =>
    d.unit === '₹' ? `₹${v.toLocaleString('en-IN')}` : `${v.toLocaleString('en-IN')}${d.unit === '%' || d.unit.startsWith('/') ? d.unit : d.unit ? ` ${d.unit}` : ''}`;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 space-y-5">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/80 to-indigo-950/50 p-5 shadow-2xl">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-400">
              <Radar size={12} className="animate-pulse" /> Feature 4 · Digital twin what-if
            </p>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">Weather Scenario Simulator</h1>
            <p className="mt-1 max-w-3xl text-[13px] text-slate-400">
              Change intensity, duration, wind, temperature or storm location — the twin re-runs the live resort state and every
              downstream system (rooms, roster, F&amp;B, revenue, SLA) moves with it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAuto((a) => !a)}
              className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ${
                auto ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-400'
              }`}
            >
              {auto ? 'Live recompute' : 'Manual run'}
            </button>
            <button
              onClick={() => run(scenario, label)}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-indigo-900/40 transition hover:brightness-110 disabled:opacity-50"
            >
              {running ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />} Run scenario
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-200">
          <AlertTriangle size={13} className="mr-1.5 inline" /> {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-12">
        {/* ------------- Controls ------------- */}
        <div className="space-y-4 xl:col-span-3">
          <Panel title="Scenario inputs" subtitle={label} icon={<Zap size={16} />}>
            <div className="space-y-4">
              {SLIDERS.map((sl) => {
                const Icon = sl.icon;
                return (
                  <div key={sl.key}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                        <Icon size={12} className="text-cyan-300" /> {sl.label}
                      </span>
                      <span className="rounded-md bg-white/8 px-2 py-0.5 text-[11px] font-black text-white">
                        {scenario[sl.key]} {sl.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={sl.min}
                      max={sl.max}
                      step={sl.step}
                      value={scenario[sl.key]}
                      onChange={(e) => update(sl.key, Number(e.target.value))}
                      className={`w-full cursor-pointer ${sl.color}`}
                    />
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{sl.hint}</p>
                  </div>
                );
              })}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Storm bearing</span>
                  <span className="rounded-md bg-white/8 px-2 py-0.5 text-[11px] font-black text-white">{scenario.stormBearing}°</span>
                </div>
                <input type="range" min={0} max={359} value={scenario.stormBearing} onChange={(e) => update('stormBearing', Number(e.target.value))} className="w-full cursor-pointer accent-fuchsia-500" />
              </div>
            </div>
          </Panel>

          <Panel title="Presets" subtitle="One-click demo scenarios" icon={<ListChecks size={16} />}>
            <div className="space-y-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className={`w-full rounded-xl border p-3 text-left transition hover:border-cyan-400/40 hover:bg-cyan-500/10 ${
                    label === p.name ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <p className="text-[12px] font-bold text-slate-100">{p.name}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{p.description}</p>
                </button>
              ))}
            </div>
          </Panel>

          {result && (
            <Panel title="Scenario severity" icon={<AlertTriangle size={16} />}>
              <div className="flex items-center gap-4">
                <Gauge value={result.scenario.severity * 100} label="severity" tone={band} size={104} />
                <div className="flex-1">
                  <Badge tone={band} pulse={band !== 'CALM'}>{band}</Badge>
                  <p className="mt-2 text-[12px] font-semibold text-slate-200">{result.scenario.conditionLabel}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Confidence {(result.confidence * 100).toFixed(0)}% · live feed {result.basedOn.weatherMode} · occupancy {result.basedOn.occupancyPct}%
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {result.severityBreakdown.drivers.slice(0, 3).map((d) => (
                  <div key={d.factor} className="flex items-center gap-2">
                    <span className="w-28 truncate text-[10px] text-slate-400">{d.factor}</span>
                    <Bar value={d.contribution * 100} max={40} height={5} />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* ------------- Results ------------- */}
        <div className="space-y-4 xl:col-span-9">
          {/* Delta grid */}
          <Panel
            title="What changes in the system"
            subtitle="Baseline (live weather) → scenario, computed on the live digital twin"
            icon={<TrendingUp size={16} />}
            action={running ? <Badge tone="INFO" pulse>Recomputing…</Badge> : result ? <Badge tone="CALM">Updated {new Date(result.computedAt).toLocaleTimeString('en-IN', { hour12: false })}</Badge> : null}
          >
            {!result ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-24" />)}</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {deltaCards.map((d) => {
                  const good = d.goodWhen === 'UP' ? d.delta >= 0 : d.delta <= 0;
                  const tone = d.delta === 0 ? 'INFO' : good ? 'CALM' : Math.abs(d.delta) > (d.baseline || 1) * 0.35 ? 'WARNING' : 'ADVISORY';
                  const st = sev(tone);
                  return (
                    <div key={d.key} className={`rounded-xl border ${st.border} ${st.bg} p-3 transition hover:scale-[1.02]`}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{d.label}</p>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="text-[13px] text-slate-500 line-through">{fmt(d, d.baseline)}</span>
                        <ArrowRight size={11} className="text-slate-500" />
                        <span className={`text-xl font-black ${st.text}`}>{fmt(d, d.scenario)}</span>
                      </div>
                      <p className={`mt-1 flex items-center gap-1 text-[11px] font-bold ${good ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {d.delta === 0 ? '—' : good ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {d.delta > 0 ? '+' : ''}{d.delta.toLocaleString('en-IN')}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-12">
            {/* Map */}
            <div className="lg:col-span-7">
              {result && (
                <ResortMap
                  site={geo?.site ?? { name: 'Smart Resort 360', lat: 19.033, lon: 73.029 }}
                  zones={result.zones}
                  socialMarkers={geo?.socialMarkers ?? []}
                  contextPoints={geo?.contextPoints ?? []}
                  storm={{ distanceKm: result.scenario.stormDistanceKm, bearing: result.scenario.stormBearing, severity: result.scenario.severity, label: label }}
                  title="Impact propagation map"
                  height={430}
                  scenarioMode
                />
              )}
            </div>

            {/* Department pressure */}
            <Panel className="lg:col-span-5" title="Department pressure" subtitle="Baseline vs scenario (unclamped — >100% is real overload)" icon={<Users size={16} />}>
              <div className="space-y-3">
                {result?.departments.map((d) => (
                  <div key={d.key}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-200">{d.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-slate-500">{d.baselinePressure}%</span>
                        <ArrowRight size={10} className="text-slate-600" />
                        <span className={`font-black ${d.scenarioPressure >= 100 ? 'text-rose-300' : d.scenarioPressure >= 85 ? 'text-orange-300' : 'text-emerald-300'}`}>{d.scenarioPressure}%</span>
                        {d.staffGap > 0 && <Badge tone="WARNING">gap {d.staffGap}</Badge>}
                      </span>
                    </div>
                    <div className="mt-1 space-y-1">
                      <Bar value={d.baselinePressure} max={140} height={4} />
                      <Bar value={d.scenarioPressure} max={140} height={8} />
                    </div>
                  </div>
                ))}
              </div>
              {result && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <StatTile compact label="Resilience" value={`${result.resilience.baseline} → ${result.resilience.scenario}`} sub={`${result.resilience.mitigated} after mitigation`} tone={result.resilience.scenario < 50 ? 'WARNING' : 'CALM'} />
                  <StatTile compact label="Safe occupancy" value={`${result.safeCapacity.scenario}%`} sub={`from ${result.safeCapacity.baseline}%`} tone={result.safeCapacity.scenario < 80 ? 'WATCH' : 'CALM'} />
                </div>
              )}
            </Panel>
          </div>

          {/* Guest / F&B / revenue */}
          {result && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Guest impact" icon={<Building2 size={16} />}>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile compact label="Requests forecast" value={result.guestImpact.requestsForecast} sub={`baseline ${result.guestImpact.baselineRequests}`} tone={result.guestImpact.requestsForecast > 12 ? 'WARNING' : 'CALM'} />
                  <StatTile compact label="Rooms to move" value={result.guestImpact.roomsToReallocate} sub={`${result.guestImpact.guestsToRelocate} guests`} tone={result.guestImpact.roomsToReallocate > 0 ? 'WATCH' : 'CALM'} />
                  <StatTile compact label="SLA breach risk" value={`${(result.guestImpact.slaBreachRisk * 100).toFixed(0)}%`} tone={result.guestImpact.slaBreachRisk > 0.5 ? 'WARNING' : 'CALM'} />
                  <StatTile compact label="Complaints" value={result.guestImpact.complaintsForecast} sub="forecast" tone={result.guestImpact.complaintsForecast > 6 ? 'WATCH' : 'CALM'} />
                </div>
              </Panel>

              <Panel title="F&B & utilities" icon={<Coins size={16} />}>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile compact label="Outdoor covers displaced" value={result.fnb.outdoorCoversDisplaced} tone={result.fnb.outdoorCoversDisplaced > 30 ? 'WATCH' : 'CALM'} />
                  <StatTile compact label="Indoor uplift" value={`+${result.fnb.indoorDemandUplift}`} tone="INFO" />
                  <StatTile compact label="Room service" value={`+${result.fnb.roomServiceUplift}`} tone="INFO" />
                  <StatTile compact label="Chiller duty" value={`${result.fnb.chillerLoadPct}%`} sub={result.fnb.heatStress > 0.5 ? 'heat protocol active' : 'normal'} tone={result.fnb.chillerLoadPct > 100 ? 'WARNING' : 'CALM'} />
                </div>
              </Panel>

              <Panel title="Revenue exposure" icon={<Coins size={16} />}>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile compact label="GOPPAR" value={`₹${result.revenue.scenarioGoppar.toLocaleString('en-IN')}`} sub={`from ₹${result.revenue.baselineGoppar.toLocaleString('en-IN')}`} tone={result.revenue.scenarioGoppar < result.revenue.baselineGoppar ? 'WATCH' : 'CALM'} />
                  <StatTile compact label="At risk" value={`₹${result.revenue.revenueAtRisk.toLocaleString('en-IN')}`} tone={result.revenue.revenueAtRisk > 20000 ? 'WARNING' : 'CALM'} />
                  <StatTile compact label="Recoverable" value={`₹${result.revenue.mitigatedRevenue.toLocaleString('en-IN')}`} sub="with the plan below" tone="CALM" />
                  <StatTile
                    compact
                    label="Primary bottleneck"
                    value={[...result.departments].sort((a, b) => b.scenarioPressure - a.scenarioPressure)[0]?.name ?? '—'}
                    sub={`${[...result.departments].sort((a, b) => b.scenarioPressure - a.scenarioPressure)[0]?.scenarioPressure ?? 0}% pressure`}
                    tone="WATCH"
                  />
                </div>
              </Panel>
            </div>
          )}

          {/* Propagation timeline */}
          {result && (
            <Panel title="Impact propagation timeline" subtitle="How the shock cascades through the resort hour by hour" icon={<Clock size={16} />}>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {result.propagation.map((p) => (
                  <div key={p.t} className="min-w-[250px] flex-1 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-200">{p.t}</span>
                      <span className="text-[10px] text-slate-500">{p.cumulativeRainMm} mm cum.</span>
                    </div>
                    <p className="mt-1.5 text-[11px] font-bold text-slate-200">{p.headline}</p>
                    <div className="mt-1.5">
                      <Bar value={p.pressure} max={160} height={5} />
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {p.events.map((e, i) => (
                        <li key={i} className="text-[11px] leading-snug">
                          <span className={`mr-1 font-bold ${e.level === 'CRIT' ? 'text-rose-300' : e.level === 'WARN' ? 'text-amber-300' : 'text-slate-400'}`}>
                            {e.zone}
                          </span>
                          <span className="text-slate-400">· {e.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Mitigations + apply */}
          {result && (
            <Panel
              title="Recommended response plan"
              subtitle="Quantified, costed and ready to push into the live operations system"
              icon={<ListChecks size={16} />}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <input type="checkbox" checked={injectLive} onChange={(e) => setInjectLive(e.target.checked)} className="accent-cyan-500" />
                    Inject into live feed
                  </label>
                  <button
                    onClick={explain}
                    disabled={explaining}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-violet-200 transition hover:bg-violet-500/25 disabled:opacity-50"
                  >
                    {explaining ? <RefreshCw size={12} className="animate-spin" /> : <Brain size={12} />} AI explain
                  </button>
                  <button
                    onClick={apply}
                    disabled={applying || !!applied}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/40 transition hover:brightness-110 disabled:opacity-50"
                  >
                    {applying ? <RefreshCw size={12} className="animate-spin" /> : applied ? <CheckCircle2 size={12} /> : <Send size={12} />}
                    {applied ? 'Applied' : 'Apply to live system'}
                  </button>
                </div>
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                {result.mitigations.map((m) => {
                  const tone = m.priority === 'Critical' ? 'SEVERE' : m.priority === 'High' ? 'WATCH' : 'INFO';
                  const st = sev(tone);
                  return (
                    <div key={m.id} className={`rounded-xl border ${st.border} ${st.bg} p-3`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-bold text-slate-100">{m.title}</p>
                        <Badge tone={tone}>{m.priority}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-slate-300">{m.detail}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                        <span className="text-emerald-300">✓ {m.gain}</span>
                        <span>₹{m.costINR.toLocaleString('en-IN')}</span>
                        <span>{m.leadTimeMins} min lead</span>
                        <span>{(m.confidence * 100).toFixed(0)}% confidence</span>
                        <span className="uppercase tracking-wider">{m.department}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {applied && (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="flex items-center gap-2 text-[12px] font-bold text-emerald-200">
                    <CheckCircle2 size={14} /> Plan pushed into the live platform
                  </p>
                  <ul className="mt-2 grid gap-1.5 text-[11px] text-slate-300 sm:grid-cols-2">
                    <li>• Action card <b className="text-white">{applied.actionCard}</b> created — awaiting approval in Council &amp; Approval</li>
                    <li>• {applied.tickets?.length ?? 0} operational tickets raised: <b className="text-white">{(applied.tickets ?? []).join(', ') || '—'}</b></li>
                    <li>• World signal registered so every module sees the weather event</li>
                    <li>• Simulation + audit-log entry written for the decision trail</li>
                    {injectLive && <li>• Scenario injected into the live weather feed for 20 minutes</li>}
                  </ul>
                  <p className="mt-2 text-[10px] text-emerald-300/80">Open the Command Center, Systemic Incidents or Council &amp; Approval pages to see them.</p>
                </div>
              )}

              {narrative && (
                <div className="mt-4 rounded-xl border border-violet-500/25 bg-violet-500/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles size={14} className="text-violet-300" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-violet-200">AI decision narrative</span>
                    <Badge tone={narrative.mode === 'CLOUD' ? 'CALM' : 'INFO'}>{narrative.mode === 'CLOUD' ? narrative.provider : 'on-board reasoner'}</Badge>
                  </div>
                  <AiText text={narrative.text} />
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

export default WeatherTwin;
