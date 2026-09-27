import { useState, useEffect, useCallback } from 'react';

interface Pressure {
  name: string;
  pressure: number;
  gap: number;
}

interface Strategy {
  name: string;
  action: string;
  impact: string;
  risk: string;
}

export function TimeMachine() {
  const [occupancy, setOccupancy] = useState(95);
  const [weatherSeverity, setWeatherSeverity] = useState(0.8);
  const [demandShock, setDemandShock] = useState(1.3);
  const [staffAvailability, setStaffAvailability] = useState(1.0);
  const [inventoryAvailability, setInventoryAvailability] = useState(1.0);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [actionPlanStatus, setActionPlanStatus] = useState<string | null>(null);
  const [weeklyForecast, setWeeklyForecast] = useState<any[] | null>(null);
  const [forecastFallback, setForecastFallback] = useState(false);

  // Seed the twin with the live weather signal; the slider remains available for what-if testing.
  useEffect(() => {
    fetch('/api/v1/world-intel', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()).then(j => {
      const severity = j.data?.current?.severity;
      if (typeof severity === 'number') setWeatherSeverity(severity);
    }).catch(() => undefined);
  }, []);

  // Fetch real trained-ML occupancy forecast (Ridge/Gradient Boosting models via ML core)
  useEffect(() => {
    fetch('/api/v1/forecast/weekly', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.weekly_forecast) {
          setWeeklyForecast(json.data.weekly_forecast);
          setForecastFallback(false);
        } else {
          throw new Error('forecast unavailable');
        }
      })
      .catch(() => {
        setForecastFallback(true);
        setWeeklyForecast([
          { day: 'Mon', predicted_occupancy: 68, risk_level: 'medium' },
          { day: 'Tue', predicted_occupancy: 70, risk_level: 'medium' },
          { day: 'Wed', predicted_occupancy: 66, risk_level: 'medium' },
          { day: 'Thu', predicted_occupancy: 64, risk_level: 'low' },
          { day: 'Fri', predicted_occupancy: 74, risk_level: 'medium' },
          { day: 'Sat', predicted_occupancy: 91, risk_level: 'high' },
          { day: 'Sun', predicted_occupancy: 88, risk_level: 'high' },
        ]);
      });
  }, []);

  const runSimulation = useCallback(async () => {
    setLoading(true);
    setIsError(false);
    setActionPlanStatus(null);
    try {
      const res = await fetch('/api/v1/simulate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          occupancy_pct: occupancy,
          weather_severity: weatherSeverity,
          demand_shock: demandShock,
          staff_availability: staffAvailability,
          inventory_availability: inventoryAvailability
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
      } else {
        setIsError(true);
      }
    } catch (err) {
      console.error('Simulation API Error:', err);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [occupancy, weatherSeverity, demandShock, staffAvailability, inventoryAvailability]);

  // Run initial simulation
  useEffect(() => {
    runSimulation();
    // eslint-disable-next-line
  }, []);

  const handleCreatePlan = async () => {
    if (!results) return;
    setActionPlanStatus('Creating plan...');
    try {
      const res = await fetch('/api/v1/generate-plan', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          strategies: results.strategies,
          bottleneck: results.primaryBottleneck.name,
          scenario: results.scenario
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionPlanStatus('Action Plan Drafted! Awaiting Manager Approval in Review Kanban.');
      } else {
        setActionPlanStatus('Failed to generate Action Plan.');
      }
    } catch (err) {
      setActionPlanStatus('Failed to generate Action Plan.');
    }
  };

  if (isError) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl text-rose-500 font-bold mb-4">Simulation Engine Unavailable</h2>
        <button onClick={runSimulation} className="bg-slate-800 px-4 py-2 rounded text-white hover:bg-slate-700">Retry</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Digital Twin <span className="text-indigo-500">Time Machine</span></h1>
          <p className="text-slate-400 mt-1">Predict operational consequences of what-if scenarios</p>
        </div>
        <button 
          onClick={runSimulation}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
        >
          {loading ? 'SIMULATING...' : 'RUN SCENARIO'}
        </button>
      </div>

      {/* REAL TRAINED ML: 7-DAY OCCUPANCY FORECAST */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">0. AI Occupancy Demand Forecast</h2>
            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold rounded">
              TRAINED ML MODEL
            </span>
            {forecastFallback && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold rounded">
                FALLBACK MODE
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500">Gradient Boosting / Ridge Regression · trained on historical booking &amp; demand data</span>
        </div>
        {weeklyForecast ? (
          <div className="grid grid-cols-7 gap-2 md:gap-4 items-end">
            {weeklyForecast.map((d: any) => (
              <div key={d.day} className="flex flex-col items-center">
                <div className="text-xs font-black text-white mb-1">{d.predicted_occupancy}%</div>
                <div className="w-full bg-slate-800 rounded-t-md h-24 flex items-end overflow-hidden">
                  <div
                    className={`w-full ${d.risk_level === 'high' ? 'bg-rose-500' : d.risk_level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ height: `${Math.max(6, Math.min(100, d.predicted_occupancy))}%` }}
                  ></div>
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase">{d.day}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center text-slate-500 text-xs animate-pulse">Loading forecast from ML core...</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN - CONTROLS & SUMMARY */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">1. Scenario Inputs</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-300">Target Occupancy</label>
                  <span className="text-indigo-400 font-bold">{occupancy}%</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="100" 
                  value={occupancy}
                  onChange={e => setOccupancy(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-300">Weather Severity</label>
                  <span className="text-amber-400 font-bold">{(weatherSeverity * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1"
                  value={weatherSeverity}
                  onChange={e => setWeatherSeverity(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-300">Staff Availability</label>
                  <span className="text-teal-400 font-bold">{(staffAvailability * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.3" 
                  max="1" 
                  step="0.05"
                  value={staffAvailability}
                  onChange={e => setStaffAvailability(Number(e.target.value))}
                  className="w-full accent-teal-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-300">Inventory Availability</label>
                  <span className="text-emerald-400 font-bold">{(inventoryAvailability * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="1" 
                  step="0.1"
                  value={inventoryAvailability}
                  onChange={e => setInventoryAvailability(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-300">Demand Surge</label>
                  <span className="text-rose-400 font-bold">{(demandShock * 100 - 100).toFixed(0)}% Lift</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="2" 
                  step="0.1"
                  value={demandShock}
                  onChange={e => setDemandShock(Number(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>
            </div>
          </div>

          {results && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">11. AI Decision Summary</h2>
              <div className="space-y-4">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-1">Chief Agent Assessment</div>
                  <div className="text-sm font-semibold text-slate-200">{results.council?.chief_synthesis || results.decisionSummary.assessment}</div>
                </div>
                
                <div className="bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
                  <div className="text-xs text-rose-400 font-bold mb-1">Primary Bottleneck</div>
                  <div className="text-lg font-black text-white">{results.decisionSummary.bottleneck}</div>
                  <div className="text-xs text-slate-300 mt-2">{results.decisionSummary.staffingImpact}</div>
                </div>

                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                  <div className="text-xs text-emerald-400 font-bold mb-1">Est. GOPPAR</div>
                  <div className="text-lg font-black text-emerald-300">${results.decisionSummary.goppar_estimate}</div>
                </div>

                {results.council && (
                  <div className="mt-6 pt-6 border-t border-slate-800">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">AI Council Department Analysis</h3>
                    <div className="space-y-3">
                      {results.council.agents.map((agent: any) => (
                        <div key={agent.name} className="flex flex-col bg-slate-800/30 rounded p-3 border border-slate-700/50">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-white">{agent.name} Agent</span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                              agent.status === 'critical' ? 'bg-rose-500/20 text-rose-400' : 
                              agent.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {agent.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">{agent.recommendation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN - RESULTS */}
        <div className="lg:col-span-3 space-y-6">
          {!results && loading && (
            <div className="h-96 flex items-center justify-center bg-slate-900/50 rounded-2xl border border-slate-800">
              <div className="text-indigo-500 font-bold animate-pulse">Running Digital Twin Simulation...</div>
            </div>
          )}

          {results && (
            <>
              {/* SNAPSHOT & SAFE CAPACITY */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 relative z-10">2. Current State Snapshot</h2>
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold">TOTAL STAFF</div>
                      <div className="text-xl font-black text-white">{results.snapshot.staff.total}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold">STAFF ASSIGNED</div>
                      <div className="text-xl font-black text-amber-400">{results.snapshot.staff.assigned}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold">MAINTENANCE RISKS</div>
                      <div className="text-xl font-black text-rose-400">{results.snapshot.maintenance.assets_at_risk}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold">ACTIVE REQUESTS</div>
                      <div className="text-xl font-black text-indigo-400">{results.snapshot.guestRequests.active}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-center items-center text-center">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">12. Resort Safe Operating Capacity</h2>
                  <div className="flex items-end gap-2">
                    <span className="text-6xl font-black tracking-tighter text-white">{results.safeCapacity}%</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2 font-medium">Maximum sustainable occupancy under current conditions</p>
                </div>
              </div>

              {/* DEPARTMENT PRESSURES */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">3. Capacity Analysis & Bottlenecks</h2>
                <div className="space-y-5">
                  {results.pressures.map((p: Pressure, i: number) => {
                    const isBottleneck = i === 0;
                    return (
                      <div key={p.name}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className={`font-bold ${isBottleneck ? 'text-rose-400' : 'text-slate-300'}`}>
                            {p.name} {isBottleneck && '⚠️ (Primary Bottleneck)'}
                          </span>
                          <span className="text-slate-400 font-mono">{p.pressure}% Load</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                          <div 
                            className={`h-full ${p.pressure > 100 ? 'bg-rose-500' : (p.pressure > 85 ? 'bg-amber-500' : 'bg-emerald-500')}`}
                            style={{ width: `${Math.min(100, p.pressure)}%` }}
                          ></div>
                        </div>
                        {p.gap > 0 && (
                          <div className="mt-1 text-[10px] text-rose-400/80 font-semibold text-right">
                            Capacity Gap: {p.gap} unit(s) short
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* INVENTORY FORECAST */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">7. Inventory Forecast</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 text-xs">
                        <th className="pb-3 font-semibold">Item</th>
                        <th className="pb-3 font-semibold text-right">Current</th>
                        <th className="pb-3 font-semibold text-right">Proj. Consumption</th>
                        <th className="pb-3 font-semibold text-right">Remaining</th>
                        <th className="pb-3 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {results.inventoryForecast.map((item: any) => (
                        <tr key={item.item_name}>
                          <td className="py-3 font-medium text-slate-200">{item.item_name}</td>
                          <td className="py-3 text-right text-slate-400 font-mono">{item.current.toFixed(1)}</td>
                          <td className="py-3 text-right text-slate-400 font-mono">{item.consumption.toFixed(1)}</td>
                          <td className="py-3 text-right font-mono font-bold text-white">{item.remaining.toFixed(1)}</td>
                          <td className="py-3 text-right">
                            <span className={`px-2 py-1 text-[10px] font-bold rounded ${item.status === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* STRATEGIES */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">10. Operational Strategies</h2>
                
                {results.strategies.length === 0 ? (
                  <div className="text-slate-400 text-sm">Resort is operating within safe capacity. No drastic strategies required.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.strategies.map((strat: Strategy, i: number) => (
                      <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                        <h3 className="font-bold text-indigo-300 text-sm mb-2">{strat.name}</h3>
                        <div className="text-xs text-white mb-2"><strong>Action:</strong> {strat.action}</div>
                        <div className="text-xs text-slate-300 mb-2"><strong>Impact:</strong> {strat.impact}</div>
                        <div className={`text-[10px] font-bold mt-3 ${strat.risk.includes('High') ? 'text-rose-400' : (strat.risk.includes('Medium') ? 'text-amber-400' : 'text-emerald-400')}`}>
                          RISK: {strat.risk.toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CREATE ACTION PLAN */}
              <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-6 shadow-xl flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">19. Apply Operational Plan</h2>
                  <p className="text-sm text-indigo-200">Convert the best strategies into an ActionCard for human-in-the-loop review.</p>
                  {actionPlanStatus && <p className="text-emerald-400 font-bold text-sm mt-2 flex items-center gap-2">✓ {actionPlanStatus}</p>}
                </div>
                <button 
                  onClick={handleCreatePlan}
                  disabled={!!actionPlanStatus}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition whitespace-nowrap"
                >
                  Create Action Plan
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
