import { useState } from 'react';

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Morning (6AM-2PM)',
  afternoon: 'Afternoon (2PM-10PM)',
  night: 'Night (10PM-6AM)',
};

const DEPT_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping',
  fnb: 'F&B',
  front_desk: 'Front Desk',
  maintenance: 'Maintenance',
};

export function RosterPlanner() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [predictedOccupancy, setPredictedOccupancy] = useState(85);
  const [event, setEvent] = useState('none');
  const [roster, setRoster] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRoster = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/staff/generate-roster', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, predicted_occupancy: predictedOccupancy, event }),
      });
      const json = await res.json();
      if (json.success) {
        setRoster(json.data);
      } else {
        throw new Error(json.error || 'Roster generation failed');
      }
    } catch (err: any) {
      console.error(err);
      setError('Roster engine unavailable — showing no data. Please retry.');
      setRoster(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-black text-white tracking-tight">AI STAFF ROSTER SCHEDULER</h1>
          <span className="px-2 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[10px] font-bold rounded">
            GASA ALGORITHM
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Greedy Allocation Staff Algorithm — matches skill, preference, and predicted demand into an optimal shift roster.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Roster Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Predicted Occupancy: {predictedOccupancy}%</label>
            <input
              type="range"
              min={30}
              max={100}
              value={predictedOccupancy}
              onChange={(e) => setPredictedOccupancy(Number(e.target.value))}
              className="w-full accent-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Special Event</label>
            <select
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="none">None</option>
              <option value="wedding">Wedding</option>
              <option value="conference">Conference</option>
            </select>
          </div>
          <button
            onClick={generateRoster}
            disabled={loading}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow transition"
          >
            {loading ? 'Optimizing Roster...' : 'Generate Optimal Roster →'}
          </button>
        </div>
        {error && <div className="mt-3 text-xs text-rose-400 font-semibold">{error}</div>}
      </div>

      {roster && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Staff Assigned</div>
              <div className="text-2xl font-black text-white mt-1">{roster.summary.total_assigned}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Coverage Score</div>
              <div className={`text-2xl font-black mt-1 ${roster.summary.coverage_score >= 90 ? 'text-emerald-400' : roster.summary.coverage_score >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                {roster.summary.coverage_score}%
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Est. Labor Cost</div>
              <div className="text-2xl font-black text-indigo-400 mt-1">₹{roster.summary.estimated_cost.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Coverage Gaps</div>
              <div className={`text-2xl font-black mt-1 ${roster.alerts.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{roster.alerts.length}</div>
            </div>
          </div>

          {/* Alerts */}
          {roster.alerts.length > 0 && (
            <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-rose-300 uppercase tracking-wider mb-2">⚠️ Understaffed Shifts</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {roster.alerts.map((a: any, i: number) => (
                  <div key={i} className="flex justify-between items-center bg-black/20 rounded-lg px-3 py-2 text-xs">
                    <span className="text-slate-200 font-semibold">{DEPT_LABELS[a.department] || a.department} · {a.shift}</span>
                    <span className={`font-bold px-2 py-0.5 rounded ${a.severity === 'critical' ? 'bg-rose-500/30 text-rose-300' : 'bg-amber-500/30 text-amber-300'}`}>
                      -{a.gap} short
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roster grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">Shift Assignment Board — {roster.date}</h2>
            <div className="space-y-6">
              {Object.entries(roster.roster).map(([dept, shifts]: [string, any]) => (
                <div key={dept}>
                  <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">{DEPT_LABELS[dept] || dept}</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(shifts).map(([shift, staffList]: [string, any]) => (
                      <div key={shift} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-bold text-slate-300">{SHIFT_LABELS[shift] || shift}</span>
                          <span className="text-[10px] text-slate-500">{staffList.length} staff</span>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {staffList.length === 0 ? (
                            <div className="text-[10px] text-rose-400 italic">No staff assigned</div>
                          ) : (
                            staffList.map((s: any) => (
                              <div key={s.id} className="flex justify-between items-center text-[11px] bg-slate-900/60 rounded px-2 py-1">
                                <span className="text-slate-200 font-medium">{s.name}</span>
                                <span className="text-slate-500">{s.primary_skill === dept ? '★' : '☆'} ₹{s.cost_per_hour}/hr</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!roster && !loading && !error && (
        <div className="text-center p-12 bg-slate-900/50 border border-slate-800 border-dashed rounded-xl text-slate-500 text-sm">
          Set your parameters above and click "Generate Optimal Roster" to run the GASA scheduling engine.
        </div>
      )}
    </div>
  );
}
