import React, { useState, useEffect, useRef } from 'react';

interface Pressure {
  name: string;
  pressure: number;
  gap: number;
}

interface Message {
  id: string;
  role: 'user' | 'agent';
  text: string;
  type?: 'loading' | 'result' | 'plan';
  data?: any;
}

export function WhatIfSimulatorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [baseline, setBaseline] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial greeting
    setMessages([
      {
        id: '1',
        role: 'agent',
        text: 'Hello! I am the Smart Resort 360 Scenario Agent.\n\nDescribe a what-if scenario and I will run it against the live digital twin.\n\nFor example:\n"If occupancy rises to 95% and staff availability drops to 70%, what happens to wait times and revenue?"'
      }
    ]);

    // Fetch baseline
    (async () => {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
        const dashRes = await fetch('/api/v1/dashboard', { headers });
        const dash = await dashRes.json();
        const currentOccupancy = dash?.data?.health?.occupancy ?? 72;
        const baseRes = await fetch('/api/v1/simulate', {
          method: 'POST',
          headers,
          body: JSON.stringify({ occupancy_pct: currentOccupancy, weather_severity: 0, demand_shock: 1.0, staff_availability: 1.0, inventory_availability: 1.0 }),
        });
        const baseJson = await baseRes.json();
        if (baseJson.success) setBaseline({ ...baseJson.data, occupancy_pct: currentOccupancy });
      } catch (e) {
        console.error("Failed to load baseline", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const parseScenario = (text: string) => {
    const lower = text.toLowerCase();
    const parsed: any = {};

    // Occupancy
    const occMatch = lower.match(/occupancy.*?(\d+)/);
    if (occMatch) parsed.occupancy_pct = parseInt(occMatch[1], 10);

    // Staff Availability
    const staffMatch = lower.match(/staff.*?(\d+)/);
    if (staffMatch) parsed.staff_availability = parseInt(staffMatch[1], 10) / 100;
    else if (lower.includes('staff shortage') || lower.includes('low staff')) parsed.staff_availability = 0.7;

    // Weather Severity
    const weatherMatch = lower.match(/weather.*?(\d+)/);
    if (weatherMatch) parsed.weather_severity = parseInt(weatherMatch[1], 10) / 100;
    else if (lower.includes('weather severity is high') || lower.includes('bad weather') || lower.includes('storm')) parsed.weather_severity = 0.8;

    // Inventory Availability
    const invMatch = lower.match(/inventory.*?(\d+)/);
    if (invMatch) parsed.inventory_availability = parseInt(invMatch[1], 10) / 100;
    else if (lower.includes('inventory is low') || lower.includes('inventory shortage') || lower.includes('low inventory') || lower.includes('inventory pressure')) parsed.inventory_availability = 0.5;

    // Demand Shock
    const demandMatch = lower.match(/demand.*?(\d+)/);
    if (demandMatch) parsed.demand_shock = parseInt(demandMatch[1], 10) / 100;
    else if (lower.includes('demand surge') || lower.includes('high demand')) parsed.demand_shock = 1.3;

    return parsed;
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const userText = inputValue;
    setInputValue('');

    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userText }]);
    setLoading(true);

    const parsed = parseScenario(userText);
    const finalPayload = {
      occupancy_pct: parsed.occupancy_pct ?? baseline?.occupancy_pct ?? 72,
      weather_severity: parsed.weather_severity ?? 0,
      demand_shock: parsed.demand_shock ?? 1.0,
      staff_availability: parsed.staff_availability ?? 1.0,
      inventory_availability: parsed.inventory_availability ?? 1.0
    };

    const loadingId = Date.now().toString() + '-loading';
    setMessages(prev => [...prev, { id: loadingId, role: 'agent', text: 'Analyzing current digital twin...', type: 'loading', data: { interpretation: finalPayload } }]);

    try {
      const res = await fetch('/api/v1/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(finalPayload),
      });
      const data = await res.json();

      setMessages(prev => prev.filter(m => m.id !== loadingId));

      if (data.success) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'agent',
          text: 'Simulation complete. Here is the operational impact against the current digital twin:',
          type: 'result',
          data: { result: data.data, interpretation: finalPayload }
        }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', text: 'Simulation failed. ' + (data.error || 'Unknown error') }]);
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== loadingId));
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', text: 'Error connecting to the simulation engine.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActionPlan = async (result: any) => {
    const planLoadingId = Date.now().toString() + '-plan-loading';
    setMessages(prev => [...prev, { id: planLoadingId, role: 'agent', text: 'Generating Action Plan...' }]);

    try {
      const res = await fetch('/api/v1/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          strategies: result.strategies,
          bottleneck: result.primaryBottleneck?.name || 'Operations',
          scenario: result.scenario
        }),
      });
      const data = await res.json();
      setMessages(prev => prev.filter(m => m.id !== planLoadingId));

      if (data.success) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'agent',
          text: 'Action Plan generated successfully. You can approve or modify this plan to dispatch workflows to staff.',
          type: 'plan',
          data: { plan: data.data }
        }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', text: 'Failed to generate Action Plan.' }]);
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== planLoadingId));
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', text: 'Error generating Action Plan.' }]);
    }
  };

  const renderInterpretation = (interpretation: any) => {
    return (
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 mt-3">
        <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Scenario Interpretation</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] text-[var(--text-muted)]">Occupancy</div>
            <div className="font-semibold text-[var(--text-primary)]">{interpretation.occupancy_pct}%</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)]">Weather Severity</div>
            <div className="font-semibold text-[var(--text-primary)]">{(interpretation.weather_severity * 100).toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)]">Staff Availability</div>
            <div className="font-semibold text-[var(--text-primary)]">{(interpretation.staff_availability * 100).toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)]">Inventory</div>
            <div className="font-semibold text-[var(--text-primary)]">{(interpretation.inventory_availability * 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>
    );
  };

  const renderSimulationResult = (data: any) => {
    const { result, interpretation } = data;
    if (!result) return null;

    const pressureOf = (sim: any, name: string) => sim.pressures?.find((p: any) => p.name.toLowerCase().includes(name));
    const totalGap = (sim: any) => (sim.pressures || []).reduce((s: number, p: any) => s + (p.gap || 0), 0);
    const critInventory = (sim: any) => (sim.inventoryForecast || []).filter((i: any) => i.status === 'CRITICAL').length;

    const b_occ = baseline?.occupancy_pct || 72;
    const b_resilience = baseline?.resilience || 100;

    return (
      <div className="mt-4 space-y-4">
        {renderInterpretation(interpretation)}

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-[var(--border-color)] rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Occupancy</div>
            <div className="text-xl font-semibold text-[var(--text-primary)]">{b_occ}% → {interpretation.occupancy_pct}%</div>
            <div className={`text-xs font-bold mt-1 ${interpretation.occupancy_pct > b_occ ? 'text-emerald-500' : 'text-rose-500'}`}>
              {interpretation.occupancy_pct > b_occ ? '+' : ''}{interpretation.occupancy_pct - b_occ} pts
            </div>
          </div>

          <div className="bg-white border border-[var(--border-color)] rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Resilience Score</div>
            <div className="text-xl font-semibold text-[var(--text-primary)]">{Math.round(b_resilience)}% → {Math.round(result.resilience)}%</div>
            <div className={`text-xs font-bold mt-1 ${result.resilience < b_resilience ? 'text-rose-500' : 'text-emerald-500'}`}>
              {Math.round(result.resilience) - Math.round(b_resilience) >= 0 ? '+' : ''}{Math.round(result.resilience) - Math.round(b_resilience)} pts
            </div>
          </div>

          <div className="bg-white border border-[var(--border-color)] rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Staff Gap</div>
            <div className="text-xl font-semibold text-[var(--text-primary)]">{totalGap(baseline || {})} → {totalGap(result)}</div>
            <div className={`text-xs font-bold mt-1 ${totalGap(result) > totalGap(baseline || {}) ? 'text-rose-500' : 'text-[var(--text-muted)]'}`}>
              {totalGap(result) - totalGap(baseline || {}) >= 0 ? '+' : ''}{totalGap(result) - totalGap(baseline || {})} staff
            </div>
          </div>

          <div className="bg-white border border-[var(--border-color)] rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Est. GOPPAR</div>
            <div className="text-xl font-semibold text-[var(--text-primary)]">
              ${baseline?.decisionSummary?.goppar_estimate ?? 0} → ${result.decisionSummary?.goppar_estimate ?? 0}
            </div>
            <div className={`text-xs font-bold mt-1 ${(result.decisionSummary?.goppar_estimate ?? 0) < (baseline?.decisionSummary?.goppar_estimate ?? 0) ? 'text-rose-500' : 'text-emerald-500'}`}>
              ${Math.abs(Math.round((result.decisionSummary?.goppar_estimate ?? 0) - (baseline?.decisionSummary?.goppar_estimate ?? 0)))} delta
            </div>
          </div>
        </div>

        {/* DEPARTMENT IMPACT */}
        <div className="bg-white border border-[var(--border-color)] rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Department Impact</h4>
          <div className="space-y-3">
            {result.pressures.map((p: Pressure, i: number) => (
              <div key={p.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-[var(--text-secondary)]">{p.name} {i === 0 && <span className="text-rose-500 ml-1">(Primary Bottleneck)</span>}</span>
                  <span className="font-mono text-[var(--text-secondary)]">{p.pressure}% Load</span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden flex">
                  <div
                    className={`h-full ${p.pressure > 100 ? 'bg-rose-500' : (p.pressure > 85 ? 'bg-amber-500' : 'bg-emerald-500')}`}
                    style={{ width: `${Math.min(100, p.pressure)}%` }}
                  ></div>
                </div>
                {p.gap > 0 && (
                  <div className="mt-1 text-[10px] text-rose-500 font-semibold">Capacity Shortfall: {p.gap} unit(s)</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RISKS & ALERTS */}
        <div className="bg-white border border-rose-500/20 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Risks & Alerts</h4>
          <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
            {result.pressures.filter((p: any) => p.pressure > 85).map((p: any) => (
              <li key={p.name} className="flex items-start gap-2"><span className="text-rose-500">⚠</span> {p.name} is approaching critical capacity ({p.pressure}% load).</li>
            ))}
            {totalGap(result) > 0 && (
              <li className="flex items-start gap-2"><span className="text-rose-500">⚠</span> High staffing gap detected ({totalGap(result)} total staff missing).</li>
            )}
            {critInventory(result) > 0 && (
              <li className="flex items-start gap-2"><span className="text-rose-500">⚠</span> {critInventory(result)} inventory items projected to hit critical levels.</li>
            )}
            {result.resilience < 50 && (
              <li className="flex items-start gap-2"><span className="text-rose-500">⚠</span> Resort resilience is dangerously low ({Math.round(result.resilience)}%). Incident recovery will be compromised.</li>
            )}
          </ul>
        </div>

        <button
          onClick={() => handleCreateActionPlan(result)}
          className="w-full bg-[var(--accent)] hover:bg-[var(--color-resort-accent-light)] text-white font-bold py-3 px-4 rounded-xl shadow-sm transition mt-2"
        >
          Generate Action Plan
        </button>
      </div>
    );
  };

  const renderActionPlan = (planData: any) => {
    if (!planData || !planData.plan) return null;
    const plan = planData.plan;

    return (
      <div className="bg-white border border-[var(--accent)]/30 rounded-xl p-6 shadow-md mt-4">
        <div className="border-b border-[var(--card-border)] pb-4 mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{plan.title}</h3>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-600 uppercase">PRIORITY: HIGH</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-500 uppercase">{plan.autonomy_level}</span>
            {plan.approval_required && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-500 uppercase">APPROVAL REQUIRED</span>}
          </div>
        </div>

        <div className="mb-5">
          <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Evidence & Triggers</h4>
          <ul className="list-disc pl-4 text-xs text-[var(--text-secondary)] space-y-1">
            {(plan.evidence || []).map((ev: string, i: number) => (
              <li key={i}>{ev}</li>
            ))}
          </ul>
        </div>

        <div className="mb-5">
          <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Recommended Strategy</h4>
          <div className="space-y-3">
            {(plan.options || []).map((opt: any, i: number) => (
              <div key={i} className="bg-[var(--bg-secondary)] rounded-lg p-3">
                <div className="font-semibold text-sm text-[var(--text-primary)]">{opt.label}</div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">{opt.description}</div>
                <div className="text-[10px] font-bold mt-2 uppercase text-indigo-500">Expected Impact: {opt.impact}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Implementation Steps</h4>
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <ol className="list-decimal pl-4 text-xs text-[var(--text-primary)] space-y-2">
              {(plan.implementation_steps || []).map((step: string, i: number) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-[calc(100vh-64px)] flex flex-col pt-8 md:pt-12">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl md:text-3xl font-semibold font-display tracking-tight text-[var(--text-primary)]">What-If <span className="text-indigo-500">Scenario Agent</span></h1>
        <p className="text-[var(--text-secondary)] mt-1 font-medium">Explore operational possibilities through conversational simulation.</p>
      </div>

      <div className="flex-1 bg-white border border-[var(--border-color)] rounded-2xl shadow-sm flex flex-col overflow-hidden mb-8 min-h-0">

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6" ref={scrollRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[95%] md:max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-[var(--accent)] text-white rounded-br-none' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-bl-none border border-[var(--border-color)]'}`}>
                {msg.type === 'loading' ? (
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-semibold">{msg.text}</span>
                    </div>
                    {msg.data?.interpretation && renderInterpretation(msg.data.interpretation)}
                  </div>
                ) : (
                  <div className="w-full overflow-hidden">
                    <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{msg.text}</div>
                    {msg.type === 'result' && renderSimulationResult(msg.data)}
                    {msg.type === 'plan' && renderActionPlan(msg.data)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[var(--bg-card)] border-t border-[var(--card-border)] shrink-0">
          <div className="flex items-end gap-3 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="E.g. If occupancy hits 95% and staff drops to 80%..."
              className="flex-1 max-h-32 min-h-[56px] resize-none bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl py-3 px-4 text-sm md:text-base text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              disabled={loading}
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || loading}
              className="h-[56px] px-6 bg-[var(--accent)] text-white rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md shrink-0 flex items-center justify-center"
            >
              Simulate
            </button>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] text-center mt-3 uppercase tracking-widest font-bold">
            Backed by live digital twin simulation engine
          </div>
        </div>

      </div>
    </div>
  );
}
