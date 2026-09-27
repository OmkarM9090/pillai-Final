import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Database,
  Gauge,
  History,
  Info,
  Loader2,
  MessageSquareText,
  Package,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Utensils,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import api from '../services/api';

interface ScenarioInputs {
  occupancy_pct: number;
  weather_severity: number;
  demand_shock: number;
  staff_availability: number;
  inventory_availability: number;
}

interface Pressure {
  name: string;
  pressure: number;
  gap: number;
}

interface InventoryForecast {
  item_name: string;
  current: number;
  consumption: number;
  remaining: number;
  status: string;
}

interface SimulationResult {
  id?: string;
  scenario: ScenarioInputs;
  snapshot: {
    rooms: { total: number; occupied: number; available: number; cleaning: number; maintenance: number };
    staff: { total: number; available: number; assigned: number; byDepartment?: Record<string, unknown> };
    maintenance: { active_tickets: number; assets_at_risk: number };
    guestRequests: { active: number; critical: number };
  };
  safeCapacity: number;
  primaryBottleneck: Pressure;
  pressures: Pressure[];
  inventoryForecast: InventoryForecast[];
  strategies: Array<{ name: string; action: string; impact: string; risk: string }>;
  resilience: number;
  council: {
    agents: Array<{ name: string; status: string; recommendation: string }>;
    chief_synthesis: string;
    consensus_score: number;
  };
  decisionSummary: {
    assessment: string;
    bottleneck: string;
    staffingImpact: string;
    goppar_estimate: number;
  };
}

interface ActionPlan {
  _id?: string;
  action_id?: string;
  title: string;
  affected_departments?: string[];
  trigger?: string;
  situation?: string;
  evidence?: string[];
  options?: Array<{ label: string; description: string; impact: string }>;
  implementation_steps?: string[];
  approval_required?: boolean;
  approval_status?: string;
  confidence?: number;
  rollback_plan?: string;
  recommendation?: string;
}

interface HistoryEntry {
  id: string;
  createdAt: string;
  prompt: string;
  inputs: ScenarioInputs;
  result: SimulationResult;
}

type Stage = 'analyzing' | 'processing' | 'calculating' | 'complete';
type Tone = 'neutral' | 'positive' | 'warning' | 'danger';

const DEFAULT_INPUTS: ScenarioInputs = {
  occupancy_pct: 85,
  weather_severity: 0,
  demand_shock: 1,
  staff_availability: 1,
  inventory_availability: 1,
};

const stageLabels: Array<{ id: Stage; label: string }> = [
  { id: 'analyzing', label: 'Analyzing current digital twin' },
  { id: 'processing', label: 'Processing scenario inputs' },
  { id: 'calculating', label: 'Calculating operational impact' },
  { id: 'complete', label: 'Results returned by simulation engine' },
];

function readError(error: unknown, fallback: string) {
  const response = (error as { response?: { data?: { error?: string; message?: string } } })?.response;
  return response?.data?.error || response?.data?.message || (error instanceof Error ? error.message : fallback);
}

function round(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `₹${formatNumber(value)}`;
}

function normalized(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

function findPressure(result: SimulationResult | null, names: string[]) {
  if (!result) return undefined;
  return result.pressures.find((pressure) => names.some((name) => normalized(pressure.name).includes(normalized(name))));
}

function totalGap(result: SimulationResult | null) {
  return result?.pressures.reduce((sum, pressure) => sum + Math.max(0, pressure.gap || 0), 0) ?? null;
}

function criticalInventory(result: SimulationResult | null) {
  return result?.inventoryForecast.filter((item) => item.status === 'CRITICAL').length ?? null;
}

function deltaText(scenario: number | null, baseline: number | null, suffix = '') {
  if (scenario === null || baseline === null) return 'Not returned';
  const delta = scenario - baseline;
  return `${delta >= 0 ? '+' : ''}${formatNumber(delta)}${suffix}`;
}

function toneForDelta(delta: number | null, goodWhen: 'up' | 'down' = 'up'): Tone {
  if (delta === null || delta === 0) return 'neutral';
  const positive = goodWhen === 'up' ? delta > 0 : delta < 0;
  return positive ? 'positive' : 'warning';
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] shadow-[var(--card-shadow)] ${className}`}>
      {children}
    </section>
  );
}

function SectionHeading({ icon, eyebrow, title, detail }: { icon: React.ReactNode; eyebrow: string; title: string; detail?: string }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--text-primary)]">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">{eyebrow}</p>
          <h2 className="mt-1 text-base font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>
          {detail && <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  const styles: Record<Tone, string> = {
    neutral: 'border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
    positive: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500',
    warning: 'border-amber-500/25 bg-amber-500/10 text-amber-500',
    danger: 'border-rose-500/25 bg-rose-500/10 text-rose-500',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${styles[tone]}`}>{children}</span>;
}

function MetricCard({
  label,
  icon,
  scenario,
  baseline,
  delta,
  suffix = '',
  tone = 'neutral',
  scenarioLabel = 'Scenario',
}: {
  label: string;
  icon: React.ReactNode;
  scenario: string;
  baseline?: string;
  delta?: string;
  suffix?: string;
  tone?: Tone;
  scenarioLabel?: string;
}) {
  const toneClass: Record<Tone, string> = {
    neutral: 'text-[var(--text-primary)]',
    positive: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-rose-500',
  };
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] p-4 shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          <span className="text-[var(--text-secondary)]">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{scenarioLabel}</span>
      </div>
      <div className={`mt-3 text-2xl font-black tracking-tight ${toneClass[tone]}`}>{scenario}{suffix}</div>
      {(baseline !== undefined || delta !== undefined) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {baseline !== undefined && <span className="text-[var(--text-muted)]">Baseline {baseline}{suffix}</span>}
          {delta !== undefined && <span className={`font-bold ${toneClass[tone]}`}>{delta}</span>}
        </div>
      )}
    </div>
  );
}

function InputSlider({
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix,
  color,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  color: string;
  onChange: (value: number) => void;
}) {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="mb-2 flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-[var(--text-primary)]">{label}</span>
          <span className="mt-0.5 block text-[10px] leading-relaxed text-[var(--text-muted)]">{hint}</span>
        </span>
        <span className="shrink-0 rounded-lg bg-[var(--bg-secondary)] px-2 py-1 text-xs font-black text-[var(--text-primary)]">{value}{suffix}</span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
        style={{ background: `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, var(--bg-secondary) ${percentage}%, var(--bg-secondary) 100%)` }}
      />
      <div className="mt-1 flex justify-between text-[9px] font-medium text-[var(--text-muted)]"><span>{min}{suffix}</span><span>{max}{suffix}</span></div>
    </label>
  );
}

export function WhatIfSimulator() {
  const [inputs, setInputs] = useState<ScenarioInputs>(DEFAULT_INPUTS);
  const [scenarioText, setScenarioText] = useState('');
  const [baseline, setBaseline] = useState<SimulationResult | null>(null);
  const [activeResult, setActiveResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingBaseline, setLoadingBaseline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>('analyzing');
  const [error, setError] = useState<string | null>(null);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [showModify, setShowModify] = useState(false);
  const [modificationDepartment, setModificationDepartment] = useState('');
  const [modificationPriority, setModificationPriority] = useState('High');
  const [modificationInstructions, setModificationInstructions] = useState('');

  const loadBaseline = useCallback(async () => {
    setLoadingBaseline(true);
    setBaselineError(null);
    try {
      const dashboardResponse = await api.get('/dashboard');
      const currentOccupancy = Number(dashboardResponse.data?.data?.health?.occupancy);
      if (!Number.isFinite(currentOccupancy)) throw new Error('The current resort occupancy was not returned by the Command Center.');

      const simulationResponse = await api.post('/simulate', {
        occupancy_pct: currentOccupancy,
        weather_severity: 0,
        demand_shock: 1,
        staff_availability: 1,
        inventory_availability: 1,
        scenarioType: 'What-if baseline',
      });
      const result = simulationResponse.data?.data as SimulationResult;
      if (!result || !Array.isArray(result.pressures)) throw new Error('The baseline simulation returned an empty response.');
      setBaseline(result);
      setInputs((current) => ({ ...current, occupancy_pct: current.occupancy_pct === DEFAULT_INPUTS.occupancy_pct ? currentOccupancy : current.occupancy_pct }));
    } catch (requestError) {
      setBaselineError(readError(requestError, 'Unable to load the current digital-twin baseline.'));
    } finally {
      setLoadingBaseline(false);
    }
  }, []);

  useEffect(() => {
    void loadBaseline();
  }, [loadBaseline]);

  // The shared engine can expose recommendations either in its strategies list
  // or as non-active council agent recommendations. Both are backend output;
  // the page never writes a replacement plan or static fallback action.
  const backendRecommendations = useMemo(() => {
    if (!activeResult) return [];
    if (activeResult.strategies.length) return activeResult.strategies;
    return activeResult.council?.agents
      ?.filter((agent) => agent.status !== 'active')
      .map((agent) => ({
        name: `${agent.name} recommendation`,
        action: agent.recommendation,
        impact: `Backend agent status: ${agent.status}`,
        risk: agent.status,
      })) ?? [];
  }, [activeResult]);

  const runSimulation = useCallback(async () => {
    if (!Number.isFinite(inputs.occupancy_pct)) {
      setError('Enter an occupancy value before running the scenario.');
      return;
    }
    setLoading(true);
    setError(null);
    setPlan(null);
    setPlanError(null);
    setPlanMessage(null);
    setShowModify(false);
    setStage('analyzing');
    try {
      setStage('processing');
      const response = await api.post('/simulate', {
        ...inputs,
        // The existing simulation contract is structured. This manager brief is
        // carried with the persisted simulation record; it is never treated as a
        // client-side interpretation of the model inputs.
        ...(scenarioText.trim() ? { scenario_text: scenarioText.trim() } : {}),
        scenarioType: 'What-if scenario agent',
      });
      setStage('calculating');
      const result = response.data?.data as SimulationResult;
      if (!result || !Array.isArray(result.pressures) || !result.scenario) {
        throw new Error('The simulation engine returned an empty or invalid result.');
      }
      setStage('complete');
      setActiveResult(result);
      const historyEntry: HistoryEntry = {
        id: result.id || `${Date.now()}`,
        createdAt: new Date().toISOString(),
        prompt: scenarioText.trim() || buildPrompt(inputs),
        inputs: { ...inputs },
        result,
      };
      setHistory((current) => [historyEntry, ...current].slice(0, 8));
    } catch (requestError) {
      setError(readError(requestError, 'The simulation engine could not complete this scenario.'));
    } finally {
      setLoading(false);
    }
  }, [inputs, scenarioText]);

  const createActionPlan = useCallback(async () => {
    if (!activeResult) return;
    if (!backendRecommendations.length) {
      setPlanError('The backend returned no mitigation strategies or non-active council recommendations for this scenario, so no action plan was created.');
      return;
    }
    setPlanLoading(true);
    setPlanError(null);
    setPlanMessage(null);
    try {
      const response = await api.post('/generate-plan', {
        strategies: backendRecommendations,
        bottleneck: activeResult.primaryBottleneck.name,
        scenario: activeResult.scenario,
        // These additive fields keep the full evidence available to the existing
        // action-plan endpoint without changing its established contract.
        simulation_output: activeResult,
        current_state: activeResult.snapshot,
      });
      const generatedPlan = response.data?.data as ActionPlan;
      if (!generatedPlan || !generatedPlan.title) throw new Error('The action-plan service returned an empty response.');
      setPlan(generatedPlan);
      setPlanMessage('Plan generated from the selected simulation output.');
      setModificationDepartment(generatedPlan.affected_departments?.[0] || activeResult.primaryBottleneck.name);
    } catch (requestError) {
      setPlanError(readError(requestError, 'The action-plan service could not create a plan.'));
    } finally {
      setPlanLoading(false);
    }
  }, [activeResult, backendRecommendations]);

  const decidePlan = useCallback(async (decision: 'APPROVE' | 'REJECT' | 'MODIFY') => {
    if (!plan) return;
    setPlanLoading(true);
    setPlanError(null);
    setPlanMessage(null);
    try {
      const response = await api.post('/approve-plan', {
        actionCardId: plan.action_id || plan._id,
        decision,
        reason: decision === 'REJECT' ? 'Declined from What-if Scenario Agent.' : 'Reviewed from What-if Scenario Agent.',
        ...(decision === 'MODIFY'
          ? { modifications: { department: modificationDepartment, priority: modificationPriority, instructions: modificationInstructions } }
          : {}),
      });
      const updatedPlan = response.data?.data as ActionPlan;
      setPlan(updatedPlan || { ...plan, approval_status: decision === 'REJECT' ? 'rejected' : 'approved' });
      setShowModify(false);
      setPlanMessage(decision === 'REJECT' ? 'Plan declined. No downstream operational ticket was created.' : 'Backend confirmed the plan and created the downstream operational workflow.');
      // Re-read the live twin only after the backend confirms the decision.
      if (decision !== 'REJECT') void loadBaseline();
    } catch (requestError) {
      setPlanError(readError(requestError, 'The action-plan decision could not be completed.'));
    } finally {
      setPlanLoading(false);
    }
  }, [loadBaseline, modificationDepartment, modificationInstructions, modificationPriority, plan]);

  const activeInputs = activeResult?.scenario ?? inputs;
  const housekeepingPressure = findPressure(activeResult, ['housekeeping']);
  const fnbPressure = findPressure(activeResult, ['food beverage', 'fnb', 'food']);
  const scenarioGap = totalGap(activeResult);
  const baselineGap = totalGap(baseline);
  const scenarioCriticalItems = criticalInventory(activeResult);
  const baselineCriticalItems = criticalInventory(baseline);
  const scenarioResilience = round(activeResult?.resilience);
  const baselineResilience = round(baseline?.resilience);
  const scenarioGoppar = round(activeResult?.decisionSummary.goppar_estimate);
  const baselineGoppar = round(baseline?.decisionSummary.goppar_estimate);

  const departmentRows = useMemo(() => {
    if (!activeResult) return [];
    return activeResult.pressures.map((pressure) => {
      const baselinePressure = baseline?.pressures.find((candidate) => normalized(candidate.name) === normalized(pressure.name));
      return { ...pressure, baseline: baselinePressure };
    });
  }, [activeResult, baseline]);

  const alerts = useMemo(() => {
    if (!activeResult) return [] as Array<{ title: string; detail: string; tone: Tone }>;
    const returnedAlerts: Array<{ title: string; detail: string; tone: Tone }> = [];
    if (activeResult.primaryBottleneck) {
      returnedAlerts.push({
        title: `Primary bottleneck: ${activeResult.primaryBottleneck.name}`,
        detail: `${formatNumber(activeResult.primaryBottleneck.pressure)}% pressure · capacity gap ${formatNumber(activeResult.primaryBottleneck.gap)}`,
        tone: activeResult.primaryBottleneck.gap > 0 ? 'danger' : 'warning',
      });
    }
    activeResult.council?.agents?.filter((agent) => agent.status !== 'active').forEach((agent) => {
      returnedAlerts.push({ title: `${agent.name} returned ${agent.status}`, detail: agent.recommendation, tone: agent.status === 'critical' ? 'danger' : 'warning' });
    });
    if (scenarioCriticalItems && scenarioCriticalItems > 0) {
      returnedAlerts.push({ title: `${formatNumber(scenarioCriticalItems)} inventory item${scenarioCriticalItems === 1 ? '' : 's'} returned critical`, detail: 'See the backend inventory forecast for item-level remaining stock and consumption.', tone: 'danger' });
    }
    if (!returnedAlerts.length) returnedAlerts.push({ title: 'No operational alerts returned', detail: 'The backend did not return a bottleneck, warning agent, or critical inventory item for this run.', tone: 'positive' });
    return returnedAlerts;
  }, [activeResult, scenarioCriticalItems]);

  const submitLabel = loading ? 'Simulation running' : activeResult ? 'Run again' : 'Simulate scenario';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-8 text-[var(--text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)] shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> What-if workspace
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Existing digital-twin simulation</span>
            </div>
            <h1 className="font-display text-[clamp(2rem,4vw,3.35rem)] font-black leading-[1.02] tracking-[-0.045em] text-[var(--text-primary)]">What-if <span className="text-[var(--text-secondary)]">Scenario Agent</span></h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">Explore operational consequences before committing. Every result below comes from the existing resort simulation contract and the current digital-twin snapshot.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Database className="h-4 w-4" />
            <span>{loadingBaseline ? 'Syncing current twin…' : baseline ? 'Baseline ready' : 'Baseline unavailable'}</span>
            {!loadingBaseline && <button type="button" onClick={() => void loadBaseline()} className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]" aria-label="Refresh baseline"><RefreshCw className="h-4 w-4" /></button>}
          </div>
        </header>

        {baselineError && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-bold">Current baseline unavailable</p><p className="mt-1 text-xs">{baselineError} Simulation can still run, but baseline comparisons will remain hidden until the twin is available.</p></div></div>
            <button type="button" onClick={() => void loadBaseline()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-bold hover:bg-amber-500/10"><RefreshCw className="h-3.5 w-3.5" /> Retry baseline</button>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.55fr)]">
          <div className="space-y-6 xl:sticky xl:top-24">
            <Card className="overflow-hidden">
              <div className="border-b border-[var(--card-border)] bg-[var(--bg-secondary)]/60 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--on-accent)]"><Bot className="h-5 w-5" /></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Manager input</p><h2 className="mt-1 text-lg font-bold tracking-tight">Describe the scenario</h2><p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">Use a natural-language brief, then set the structured values that the existing simulator accepts.</p></div>
                </div>
              </div>
              <div className="p-5 sm:p-6">
                <label className="block" htmlFor="scenario-brief">
                  <span className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]"><span>Scenario brief</span><span className="font-medium normal-case tracking-normal">Optional context</span></span>
                  <textarea id="scenario-brief" value={scenarioText} onChange={(event) => setScenarioText(event.target.value)} rows={4} placeholder="If occupancy rises to 95% and staff availability drops to 70%, what changes across operations?" className="w-full resize-y rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] px-3.5 py-3 text-sm leading-relaxed text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-soft-border)]" />
                </label>
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)]/60 p-3 text-[11px] leading-relaxed text-[var(--text-secondary)]"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" /><span>The current backend contract accepts structured values below. Your brief is sent with the run as scenario context; it is not parsed or replaced by client-side logic.</span></div>

                <div className="my-6 border-t border-[var(--card-border)]" />
                <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Supported model inputs</p><p className="mt-1 text-xs text-[var(--text-secondary)]">These values are sent directly to <code className="rounded bg-[var(--bg-secondary)] px-1 py-0.5 text-[10px]">POST /simulate</code>.</p></div><SlidersHorizontal className="h-4 w-4 text-[var(--text-muted)]" /></div>
                <div className="space-y-6">
                  <InputSlider label="Occupancy" hint="Target occupied rooms" value={inputs.occupancy_pct} min={50} max={100} step={1} suffix="%" color="#818cf8" onChange={(value) => setInputs((current) => ({ ...current, occupancy_pct: value }))} />
                  <InputSlider label="Weather severity" hint="0 = normal · 1 = extreme" value={inputs.weather_severity} min={0} max={1} step={0.05} suffix="" color="#f59e0b" onChange={(value) => setInputs((current) => ({ ...current, weather_severity: value }))} />
                  <InputSlider label="Staff availability" hint="Available capacity multiplier" value={inputs.staff_availability} min={0.3} max={1} step={0.05} suffix="×" color="#14b8a6" onChange={(value) => setInputs((current) => ({ ...current, staff_availability: value }))} />
                  <InputSlider label="Inventory availability" hint="Stock available to the scenario" value={inputs.inventory_availability} min={0.1} max={1} step={0.05} suffix="×" color="#10b981" onChange={(value) => setInputs((current) => ({ ...current, inventory_availability: value }))} />
                  <InputSlider label="Demand shock" hint="1 = normal · 2 = doubled demand" value={inputs.demand_shock} min={1} max={2} step={0.05} suffix="×" color="#f43f5e" onChange={(value) => setInputs((current) => ({ ...current, demand_shock: value }))} />
                </div>
                <button type="button" onClick={() => void runSimulation()} disabled={loading || loadingBaseline} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3.5 text-sm font-bold text-[var(--on-accent)] shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{loading ? 'Running digital twin…' : submitLabel}<ChevronRight className="ml-auto h-4 w-4 opacity-60" /></button>
                {error && <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-500"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionHeading icon={<History className="h-4 w-4" />} eyebrow="Session only" title="Scenario history" detail="Recent runs are kept in this browser session. No new persistence was added." />
              {history.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--card-border)] p-4 text-center text-xs leading-relaxed text-[var(--text-muted)]">Your completed scenarios will appear here.</div> : <div className="space-y-2">{history.map((entry) => <button type="button" key={entry.id} onClick={() => { setActiveResult(entry.result); setInputs(entry.inputs); setScenarioText(entry.prompt); setPlan(null); setPlanMessage(null); setPlanError(null); }} className={`group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${activeResult?.id === entry.result.id ? 'border-[var(--text-primary)] bg-[var(--bg-secondary)]' : 'border-[var(--card-border)] hover:bg-[var(--bg-secondary)]'}`}><div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--text-secondary)]"><MessageSquareText className="h-3.5 w-3.5" /></div><span className="min-w-0 flex-1"><span className="line-clamp-2 block text-xs font-semibold leading-relaxed text-[var(--text-primary)]">{entry.prompt}</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {entry.inputs.occupancy_pct}% occupancy</span></span><ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-0.5" /></button>)}</div>}
            </Card>
          </div>

          <div className="min-w-0 space-y-6">
            {loading && <Card className="overflow-hidden border-[var(--accent-soft-border)]"><div className="border-b border-[var(--card-border)] bg-[var(--bg-secondary)]/50 p-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--on-accent)]"><Activity className="h-4 w-4 animate-pulse" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Simulation status</p><h2 className="mt-1 text-base font-bold">Running against the current digital twin</h2></div></div></div><div className="space-y-3 p-5 sm:p-6">{stageLabels.map((item, index) => { const currentIndex = stageLabels.findIndex((stageItem) => stageItem.id === stage); const itemIndex = index; const done = itemIndex < currentIndex; const current = item.id === stage; return <div key={item.id} className={`flex items-center gap-3 text-sm ${current ? 'font-bold text-[var(--text-primary)]' : done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500' : current ? 'border-[var(--text-primary)] bg-[var(--accent-soft)]' : 'border-[var(--card-border)]'}`}>{done ? <Check className="h-3.5 w-3.5" /> : current ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]" />}</span><span>{item.label}</span>{current && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Backend in flight</span>}</div>; })}</div></Card>}

            {!activeResult && !loading && <Card className="flex min-h-[470px] flex-col items-center justify-center p-8 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--accent-soft)] text-[var(--text-primary)]"><Sparkles className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-bold tracking-tight">Ready when you are</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">Set one or more supported inputs, add the manager brief if helpful, and run a real scenario against the resort twin. The result dashboard will appear here.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => setInputs((current) => ({ ...current, occupancy_pct: 95 }))} className="rounded-full border border-[var(--card-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">Try 95% occupancy</button><button type="button" onClick={() => { setInputs((current) => ({ ...current, occupancy_pct: 95, staff_availability: 0.7 })); setScenarioText('What if occupancy rises and staff availability drops?'); }} className="rounded-full border border-[var(--card-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">Try staffing pressure</button></div></Card>}

            {activeResult && !loading && <>
              <Card className="overflow-hidden">
                <div className="border-b border-[var(--card-border)] bg-[var(--bg-secondary)]/40 p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><StatusPill tone="positive"><CheckCircle2 className="mr-1 h-3 w-3" /> Backend result</StatusPill><span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">{activeResult.id ? `Run ${activeResult.id.slice(-8)}` : 'Completed run'}</span></div><h2 className="mt-3 text-xl font-bold tracking-tight">Scenario interpretation</h2><p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">These are the structured values submitted to and returned by the simulation engine.</p></div><div className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><Clock3 className="h-3.5 w-3.5" /> {scenarioText.trim() ? 'Brief attached' : 'Structured scenario'}</div></div></div>
                <div className="grid grid-cols-2 gap-px bg-[var(--card-border)] sm:grid-cols-5">{[
                  ['Occupancy', `${formatNumber(activeInputs.occupancy_pct)}%`, 'text-indigo-500'],
                  ['Weather severity', formatNumber(activeInputs.weather_severity, 2), 'text-amber-500'],
                  ['Staff availability', `${formatNumber(activeInputs.staff_availability * 100)}%`, 'text-teal-500'],
                  ['Inventory availability', `${formatNumber(activeInputs.inventory_availability * 100)}%`, 'text-emerald-500'],
                  ['Demand shock', `${formatNumber(activeInputs.demand_shock, 2)}×`, 'text-rose-500'],
                ].map(([label, value, valueClass]) => <div key={label} className="bg-[var(--bg-card)] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p><p className={`mt-2 text-lg font-black ${valueClass}`}>{value}</p></div>)}</div>
                {scenarioText.trim() && <div className="flex items-start gap-3 border-t border-[var(--card-border)] p-4 sm:p-5"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" /><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Manager brief sent with this run</p><p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">“{scenarioText.trim()}”</p></div></div>}
              </Card>

              <div><div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[var(--text-muted)]">Executive readout</p><h2 className="mt-1 text-lg font-bold tracking-tight">What changed in the model</h2></div><StatusPill tone={activeResult.primaryBottleneck?.gap > 0 ? 'warning' : 'positive'}>{activeResult.primaryBottleneck?.gap > 0 ? 'Pressure detected' : 'Within returned capacity'}</StatusPill></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Occupancy" icon={<BedDouble className="h-3.5 w-3.5" />} scenario={`${formatNumber(round(activeResult.scenario.occupancy_pct))}%`} baseline={baseline ? `${formatNumber(round(baseline.scenario.occupancy_pct))}%` : undefined} delta={baseline ? deltaText(round(activeResult.scenario.occupancy_pct), round(baseline.scenario.occupancy_pct), ' pts') : undefined} tone={toneForDelta(round(activeResult.scenario.occupancy_pct)! - (round(baseline?.scenario.occupancy_pct) ?? round(activeResult.scenario.occupancy_pct)!), 'down')} />
                <MetricCard label="Housekeeping load" icon={<Sparkles className="h-3.5 w-3.5" />} scenario={`${formatNumber(housekeepingPressure?.pressure)}%`} baseline={baseline ? formatNumber(findPressure(baseline, ['housekeeping'])?.pressure) : undefined} delta={baseline ? deltaText(round(housekeepingPressure?.pressure), round(findPressure(baseline, ['housekeeping'])?.pressure), ' pts') : undefined} tone={toneForDelta((housekeepingPressure?.pressure ?? 0) - (findPressure(baseline, ['housekeeping'])?.pressure ?? housekeepingPressure?.pressure ?? 0), 'down')} />
                <MetricCard label="F&B load" icon={<Utensils className="h-3.5 w-3.5" />} scenario={`${formatNumber(fnbPressure?.pressure)}%`} baseline={baseline ? formatNumber(findPressure(baseline, ['food beverage', 'fnb', 'food'])?.pressure) : undefined} delta={baseline ? deltaText(round(fnbPressure?.pressure), round(findPressure(baseline, ['food beverage', 'fnb', 'food'])?.pressure), ' pts') : undefined} tone={toneForDelta((fnbPressure?.pressure ?? 0) - (findPressure(baseline, ['food beverage', 'fnb', 'food'])?.pressure ?? fnbPressure?.pressure ?? 0), 'down')} />
                <MetricCard label="Staff gap" icon={<Users className="h-3.5 w-3.5" />} scenario={formatNumber(scenarioGap)} baseline={baseline ? formatNumber(baselineGap) : undefined} delta={baseline ? deltaText(scenarioGap, baselineGap) : undefined} tone={toneForDelta((scenarioGap ?? 0) - (baselineGap ?? scenarioGap ?? 0), 'down')} />
                <MetricCard label="Critical inventory" icon={<Package className="h-3.5 w-3.5" />} scenario={formatNumber(scenarioCriticalItems)} baseline={baseline ? formatNumber(baselineCriticalItems) : undefined} delta={baseline ? deltaText(scenarioCriticalItems, baselineCriticalItems) : undefined} tone={toneForDelta((scenarioCriticalItems ?? 0) - (baselineCriticalItems ?? scenarioCriticalItems ?? 0), 'down')} />
                <MetricCard label="Resilience" icon={<ShieldCheck className="h-3.5 w-3.5" />} scenario={`${formatNumber(scenarioResilience)}%`} baseline={baseline ? formatNumber(baselineResilience) : undefined} delta={baseline ? deltaText(scenarioResilience, baselineResilience, ' pts') : undefined} tone={toneForDelta((scenarioResilience ?? 0) - (baselineResilience ?? scenarioResilience ?? 0), 'up')} />
                <MetricCard label="Safe capacity" icon={<Gauge className="h-3.5 w-3.5" />} scenario={`${formatNumber(activeResult.safeCapacity)}%`} baseline={baseline ? formatNumber(baseline.safeCapacity) : undefined} delta={baseline ? deltaText(round(activeResult.safeCapacity), round(baseline.safeCapacity), ' pts') : undefined} tone={toneForDelta(activeResult.safeCapacity - (baseline?.safeCapacity ?? activeResult.safeCapacity), 'up')} />
                <MetricCard label="Estimated GOPPAR" icon={<CircleDollarSign className="h-3.5 w-3.5" />} scenario={formatCurrency(activeResult.decisionSummary?.goppar_estimate)} baseline={baseline ? formatCurrency(baselineGoppar ?? undefined) : undefined} delta={baseline ? deltaText(scenarioGoppar, baselineGoppar, '') : undefined} tone={toneForDelta((scenarioGoppar ?? 0) - (baselineGoppar ?? scenarioGoppar ?? 0), 'up')} />
              </div></div>

              {baseline && <Card className="overflow-hidden"><div className="border-b border-[var(--card-border)] p-5 sm:p-6"><SectionHeading icon={<TrendingUp className="h-4 w-4" />} eyebrow="Comparison" title="Baseline versus scenario" detail="Baseline is a separate neutral run at the current occupancy. No client-side KPI values are invented." /></div><div className="overflow-x-auto"><table className="min-w-[650px] w-full text-left text-sm"><thead><tr className="border-b border-[var(--card-border)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]"><th className="px-5 pb-3 font-bold sm:px-6">Metric</th><th className="pb-3 text-right font-bold">Baseline</th><th className="pb-3 text-right font-bold">Scenario</th><th className="px-5 pb-3 text-right font-bold sm:px-6">Delta</th></tr></thead><tbody>{[
                ['Housekeeping pressure', findPressure(baseline, ['housekeeping'])?.pressure, housekeepingPressure?.pressure, ' pts'],
                ['F&B pressure', findPressure(baseline, ['food beverage', 'fnb', 'food'])?.pressure, fnbPressure?.pressure, ' pts'],
                ['Total staff gap', baselineGap, scenarioGap, ''],
                ['Critical inventory items', baselineCriticalItems, scenarioCriticalItems, ''],
                ['Resilience', baselineResilience, scenarioResilience, ' pts'],
                ['Safe capacity', baseline.safeCapacity, activeResult.safeCapacity, ' pts'],
                ['Estimated GOPPAR', baselineGoppar, scenarioGoppar, ''],
              ].map(([label, base, scenario, suffix]) => <tr key={String(label)} className="border-t border-[var(--card-border)]"><td className="px-5 py-3 font-semibold text-[var(--text-secondary)] sm:px-6">{label}</td><td className="py-3 text-right font-mono text-[var(--text-secondary)]">{label === 'Estimated GOPPAR' ? formatCurrency(base as number | undefined) : formatNumber(base as number | undefined)}{label !== 'Estimated GOPPAR' && suffix}</td><td className="py-3 text-right font-mono font-bold text-[var(--text-primary)]">{label === 'Estimated GOPPAR' ? formatCurrency(scenario as number | undefined) : formatNumber(scenario as number | undefined)}{label !== 'Estimated GOPPAR' && suffix}</td><td className="px-5 py-3 text-right font-mono font-bold text-[var(--text-secondary)] sm:px-6">{label === 'Estimated GOPPAR' ? deltaText(scenario as number | null, base as number | null) : deltaText(scenario as number | null, base as number | null, String(suffix))}</td></tr>)}</tbody></table></div></Card>}

              <Card className="p-5 sm:p-6"><SectionHeading icon={<Database className="h-4 w-4" />} eyebrow="Current digital twin" title="State used by the simulation" detail="This snapshot is returned by the same backend run that produced the scenario output." /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)]/50 p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Occupied rooms</p><p className="mt-1 text-lg font-black">{formatNumber(activeResult.snapshot.rooms.occupied)}<span className="text-xs font-semibold text-[var(--text-muted)]"> / {formatNumber(activeResult.snapshot.rooms.total)}</span></p></div><div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)]/50 p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Available staff</p><p className="mt-1 text-lg font-black">{formatNumber(activeResult.snapshot.staff.available)}</p></div><div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)]/50 p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Active requests</p><p className="mt-1 text-lg font-black">{formatNumber(activeResult.snapshot.guestRequests.active)}</p></div><div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)]/50 p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Assets at risk</p><p className="mt-1 text-lg font-black">{formatNumber(activeResult.snapshot.maintenance.assets_at_risk)}</p></div></div></Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Card className="p-5 sm:p-6"><SectionHeading icon={<Activity className="h-4 w-4" />} eyebrow="Chart · actual response" title="Department pressure" detail="Backend-returned pressure values; bars are a visual encoding of those values." /><div className="space-y-5">{departmentRows.map((row) => { const max = Math.max(100, row.pressure, row.baseline?.pressure || 0); const scenarioWidth = Math.min(100, (row.pressure / max) * 100); const baselineWidth = Math.min(100, ((row.baseline?.pressure || 0) / max) * 100); return <div key={row.name}><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-[var(--text-primary)]">{row.name}</span><span className="font-mono text-[var(--text-secondary)]">{formatNumber(row.pressure)}%</span></div><div className="relative h-3 overflow-hidden rounded-full bg-[var(--bg-secondary)]"><div className="absolute inset-y-0 left-0 rounded-full bg-[var(--text-muted)]/30" style={{ width: `${baselineWidth}%` }} /><div className="absolute inset-y-0 left-0 rounded-full bg-[var(--text-primary)]" style={{ width: `${scenarioWidth}%` }} /></div><div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]"><span>Baseline {row.baseline ? `${formatNumber(row.baseline.pressure)}%` : '—'}</span><span>Gap {formatNumber(row.gap)}</span></div></div>; })}</div><div className="mt-5 flex items-center gap-4 text-[10px] text-[var(--text-muted)]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--text-primary)]" /> Scenario</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--text-muted)]/40" /> Baseline</span></div></Card>
                <Card className="p-5 sm:p-6"><SectionHeading icon={<Package className="h-4 w-4" />} eyebrow="Chart · actual response" title="Inventory outlook" detail="Returned stock, consumption and remaining quantities for this scenario." /><div className="space-y-4">{activeResult.inventoryForecast.map((item) => { const max = Math.max(item.current, item.consumption, Math.abs(item.remaining), 1); return <div key={item.item_name}><div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="truncate font-semibold text-[var(--text-primary)]">{item.item_name}</span><StatusPill tone={item.status === 'CRITICAL' ? 'danger' : 'positive'}>{item.status}</StatusPill></div><div className="grid grid-cols-[1fr_auto] items-center gap-3"><div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-secondary)]"><div className={`h-full rounded-full ${item.status === 'CRITICAL' ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Math.max(0, (Math.max(0, item.remaining) / max) * 100))}%` }} /></div><span className="font-mono text-[10px] text-[var(--text-secondary)]">{formatNumber(item.remaining, 1)} left</span></div><div className="mt-1 text-[10px] text-[var(--text-muted)]">Current {formatNumber(item.current, 1)} · Consumption {formatNumber(item.consumption, 1)}</div></div>; })}</div></Card></div>

              <Card className="p-5 sm:p-6"><SectionHeading icon={<BedDouble className="h-4 w-4" />} eyebrow="Department impact" title="Operational pressure by department" detail="Only departments and measures returned by the simulation are shown." /><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{departmentRows.map((row) => <div key={row.name} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)]/45 p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)]">{row.name.toLowerCase().includes('house') ? <Sparkles className="h-4 w-4" /> : row.name.toLowerCase().includes('food') ? <Utensils className="h-4 w-4" /> : row.name.toLowerCase().includes('maintenance') ? <Wrench className="h-4 w-4" /> : row.name.toLowerCase().includes('guest') ? <Users className="h-4 w-4" /> : <Package className="h-4 w-4" />}</div><h3 className="text-sm font-bold">{row.name}</h3></div>{row.name === activeResult.primaryBottleneck.name && <StatusPill tone="warning">Primary</StatusPill>}</div><div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Pressure</p><p className="mt-1 text-lg font-black">{formatNumber(row.pressure)}%</p></div><div><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Capacity gap</p><p className={`mt-1 text-lg font-black ${row.gap > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{formatNumber(row.gap)}</p></div></div><p className="mt-3 border-t border-[var(--card-border)] pt-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">{row.gap > 0 ? `Backend returned a ${formatNumber(row.gap)} unit capacity gap for this department.` : 'Backend returned no capacity gap for this department.'}</p></div>)}</div></Card>

              <Card className="p-5 sm:p-6"><SectionHeading icon={<AlertTriangle className="h-4 w-4" />} eyebrow="Risk & operational alerts" title="Returned warnings" detail="Alerts are surfaced from the simulation bottleneck, council statuses and inventory statuses." /><div className="space-y-3">{alerts.map((alert) => <div key={`${alert.title}-${alert.detail}`} className="flex items-start gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)]/40 p-3.5"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${alert.tone === 'danger' ? 'bg-rose-500/10 text-rose-500' : alert.tone === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>{alert.tone === 'positive' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</div><div><p className="text-sm font-bold text-[var(--text-primary)]">{alert.title}</p><p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{alert.detail}</p></div></div>)}</div></Card>

              <Card className="overflow-hidden border-[var(--accent-soft-border)]"><div className="border-b border-[var(--card-border)] bg-[var(--bg-secondary)]/55 p-5 sm:p-6"><SectionHeading icon={<ClipboardCheck className="h-4 w-4" />} eyebrow="Closed-loop workflow" title="Create action plan" detail="The selected scenario output and backend-generated strategies are sent to the existing action-plan endpoint." /><div className="flex flex-col gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Target className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" /><div><p className="text-sm font-bold">{backendRecommendations.length ? `${backendRecommendations.length} backend recommendation${backendRecommendations.length === 1 ? '' : 's'} available` : 'No backend recommendations returned'}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">Bottleneck: {activeResult.primaryBottleneck.name} · {activeResult.decisionSummary.staffingImpact}</p></div></div><button type="button" onClick={() => void createActionPlan()} disabled={planLoading || !backendRecommendations.length || !!plan} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-bold text-[var(--on-accent)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{planLoading && !plan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}{plan ? 'Plan created' : 'Create action plan'}</button></div></div>
                {planError && <div className="flex items-start gap-2 border-b border-[var(--card-border)] bg-rose-500/10 p-4 text-xs leading-relaxed text-rose-500"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />{planError}</div>}
                {planMessage && <div className="flex items-start gap-2 border-b border-[var(--card-border)] bg-emerald-500/10 p-4 text-xs leading-relaxed text-emerald-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{planMessage}</div>}
                {plan && <div className="p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><StatusPill tone={plan.approval_status === 'rejected' ? 'danger' : plan.approval_status === 'approved' ? 'positive' : 'warning'}>{plan.approval_status || 'pending'}</StatusPill>{plan.approval_required && <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Manager approval required</span>}</div><h3 className="mt-3 text-lg font-black tracking-tight">{plan.title}</h3></div><div className="flex flex-col items-end gap-1">{plan.action_id && <span className="font-mono text-[10px] text-[var(--text-muted)]">{plan.action_id}</span>}{typeof plan.confidence === 'number' && <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Confidence {formatNumber(plan.confidence * 100)}%</span>}</div></div><div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Evidence returned by backend</p><ul className="mt-2 space-y-2">{(plan.evidence || []).map((evidence) => <li key={evidence} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-secondary)]"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-primary)]" />{evidence}</li>)}</ul></div><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Implementation steps</p><ol className="mt-2 space-y-2">{(plan.implementation_steps || []).map((step, index) => <li key={step} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-secondary)]"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] font-bold">{index + 1}</span>{step}</li>)}</ol></div></div>{(plan.options || []).length > 0 && <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">{(plan.options || []).map((option) => <div key={option.label} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)]/50 p-3"><p className="text-xs font-bold">{option.label}</p><p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{option.description}</p><p className="mt-2 text-[10px] font-semibold text-[var(--text-muted)]">Impact: {option.impact}</p></div>)}</div>}{plan.rollback_plan && <div className="mt-5 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)]/50 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Rollback</p><p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{plan.rollback_plan}</p></div>}{plan.approval_status !== 'approved' && plan.approval_status !== 'rejected' && <div className="mt-6 border-t border-[var(--card-border)] pt-5"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void decidePlan('APPROVE')} disabled={planLoading} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Approve &amp; execute</button><button type="button" onClick={() => setShowModify((current) => !current)} disabled={planLoading} className="inline-flex items-center gap-2 rounded-lg border border-[var(--card-border)] px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"><SlidersHorizontal className="h-4 w-4" /> Modify</button><button type="button" onClick={() => void decidePlan('REJECT')} disabled={planLoading} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-3.5 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"><X className="h-4 w-4" /> Decline</button></div>{showModify && <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)]/60 p-4 md:grid-cols-3"><label className="text-xs font-semibold">Department<input value={modificationDepartment} onChange={(event) => setModificationDepartment(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-normal outline-none focus:border-[var(--text-primary)]" /></label><label className="text-xs font-semibold">Priority<select value={modificationPriority} onChange={(event) => setModificationPriority(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-xs outline-none focus:border-[var(--text-primary)]"><option>High</option><option>Critical</option><option>Medium</option><option>Low</option></select></label><label className="text-xs font-semibold md:col-span-3">Instructions<textarea value={modificationInstructions} onChange={(event) => setModificationInstructions(event.target.value)} rows={2} placeholder="Optional manager instruction" className="mt-1.5 w-full resize-y rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-normal outline-none focus:border-[var(--text-primary)]" /></label><button type="button" onClick={() => void decidePlan('MODIFY')} disabled={planLoading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--on-accent)] md:col-span-3 disabled:opacity-50">{planLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Submit modified plan to backend</button></div>}</div>}</div>}
              </Card>

              <Card className="p-5 sm:p-6"><SectionHeading icon={<Info className="h-4 w-4" />} eyebrow="Backend assessment" title="Decision summary" detail="Narrative fields below are displayed from the simulation response." /><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><div className="rounded-xl bg-[var(--bg-secondary)]/60 p-4 md:col-span-2"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Assessment</p><p className="mt-2 text-sm leading-relaxed text-[var(--text-primary)]">{activeResult.decisionSummary.assessment}</p></div><div className="rounded-xl bg-[var(--bg-secondary)]/60 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Consensus score</p><p className="mt-2 text-2xl font-black">{formatNumber(activeResult.council.consensus_score, 1)}</p></div><div className="rounded-xl bg-[var(--bg-secondary)]/60 p-4 md:col-span-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Chief synthesis</p><p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{activeResult.council.chief_synthesis}</p></div></div></Card>
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildPrompt(inputs: ScenarioInputs) {
  return `Occupancy ${formatNumber(inputs.occupancy_pct)}% · staff ${formatNumber(inputs.staff_availability * 100)}% · weather ${formatNumber(inputs.weather_severity, 2)} · inventory ${formatNumber(inputs.inventory_availability * 100)}% · demand ${formatNumber(inputs.demand_shock, 2)}×`;
}

export default WhatIfSimulator;
