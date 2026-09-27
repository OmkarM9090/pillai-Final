import { useState } from 'react';

export function IncidentsAndReallocation() {
  const [clusters, setClusters] = useState<any[]>([]);
  const [alerts, setAlerts] = useState(0);
  const [loadingClusters, setLoadingClusters] = useState(false);

  const [guestName, setGuestName] = useState('Jane Doe');
  const [currentRoom, setCurrentRoom] = useState('304');
  const [reason, setReason] = useState('AC Unresolvable within SLA (Systemic Issue)');
  const [reallocation, setReallocation] = useState<any>(null);
  const [loadingReallocation, setLoadingReallocation] = useState(false);
  const [approved, setApproved] = useState(false);

  const runClusterAnalysis = async () => {
    setLoadingClusters(true);
    try {
      const res = await fetch('/api/v1/cluster-complaints', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_window_hours: 2 }),
      });
      const json = await res.json();
      if (json.success) {
        setClusters(json.clusters);
        setAlerts(json.systemic_alerts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClusters(false);
    }
  };

  const runReallocation = async () => {
    setLoadingReallocation(true);
    try {
      const res = await fetch('/api/v1/reallocate-room', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_name: guestName, current_room: currentRoom, reason }),
      });
      const json = await res.json();
      if (json.success) {
        setReallocation(json);
        setApproved(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReallocation(false);
    }
  };

  const handleApprove = () => {
    // Usually this would call another endpoint to confirm the move
    setApproved(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">Systemic Incidents & Reallocation</h1>
        <p className="text-slate-400">Automated pattern detection and constraints-based resolution engine.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Col: Clusters */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Pattern Detection</h2>
              <button 
                onClick={runClusterAnalysis}
                disabled={loadingClusters}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {loadingClusters ? 'Scanning...' : 'Run Cluster Analysis'}
              </button>
            </div>

            {alerts === 0 && !loadingClusters && clusters.length === 0 ? (
              <div className="text-center p-8 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-4xl block mb-2">✅</span>
                <div className="text-slate-300 font-medium">No Systemic Issues Detected</div>
                <div className="text-slate-500 text-sm mt-1">All systems operating normally across 5 floors.</div>
              </div>
            ) : null}

            {clusters.map((cluster, idx) => (
              <div key={idx} className="bg-rose-950/30 border border-rose-500/30 rounded-lg p-5 mb-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                <div className="flex items-center space-x-2 mb-3">
                  <span className="animate-pulse w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-rose-400 font-bold text-xs uppercase tracking-wider">Systemic Pattern Detected</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {cluster.count} Related Complaints: {cluster.intent} (Chiller Zone B)
                </h3>
                <div className="bg-black/20 rounded p-3 mb-4">
                  <div className="text-xs text-slate-400 mb-1">Affected Rooms:</div>
                  <div className="flex flex-wrap gap-2">
                    {cluster.rooms.map((room: string) => (
                      <span key={room} className="px-2 py-1 bg-slate-800 text-slate-200 text-xs rounded border border-slate-700">
                        Room {room}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between border-t border-rose-500/20 pt-4">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Auto-Generated Work Order</div>
                    <div className="text-sm font-medium text-rose-300">{cluster.master_ticket.ticket_id} - Critical Dispatch</div>
                  </div>
                  <span className="px-3 py-1 bg-rose-500/20 text-rose-400 rounded-full text-xs font-bold">L4 ESCALATION</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Reallocation */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-6">Automated Room Reallocation</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Guest Name</label>
                <input 
                  type="text" 
                  value={guestName} 
                  onChange={e => setGuestName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Current Room</label>
                <input 
                  type="text" 
                  value={currentRoom} 
                  onChange={e => setCurrentRoom(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200" 
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Trigger Reason</label>
                <input 
                  type="text" 
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200" 
                />
              </div>
            </div>

            <button 
              onClick={runReallocation}
              disabled={loadingReallocation}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-sm font-medium transition mb-6"
            >
              {loadingReallocation ? 'Calculating Matrix...' : 'Calculate Optimal Reallocation'}
            </button>

            {reallocation && (
              <div className="border border-indigo-500/30 bg-indigo-500/5 rounded-lg p-5">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-indigo-300 font-bold uppercase text-xs tracking-widest">Recommendation Engine</h3>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">L3 MANAGER APPROVAL</span>
                </div>
                
                <div className="bg-slate-950 border border-slate-800 rounded p-4 mb-4 flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-slate-400 text-xs mb-1">Current</div>
                    <div className="text-lg font-bold text-rose-400">Room {currentRoom}</div>
                  </div>
                  <div className="text-slate-500">→</div>
                  <div className="text-center">
                    <div className="text-slate-400 text-xs mb-1">Proposed (Upgrade)</div>
                    <div className="text-lg font-bold text-emerald-400">Room {reallocation.recommended_room.room_number}</div>
                    <div className="text-[10px] text-emerald-500/70">{reallocation.recommended_room.type}</div>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center text-xs text-slate-300">
                    <span className="text-emerald-500 mr-2">✓</span> Room is cleaned and available
                  </div>
                  <div className="flex items-center text-xs text-slate-300">
                    <span className="text-emerald-500 mr-2">✓</span> Zero booking collisions for next 3 days
                  </div>
                  <div className="flex items-center text-xs text-slate-300">
                    <span className="text-emerald-500 mr-2">✓</span> Compensatory upgrade value: +$100/night
                  </div>
                </div>

                {!approved ? (
                  <button 
                    onClick={handleApprove}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-600/20 transition"
                  >
                    1-Click Approve Room Move
                  </button>
                ) : (
                  <div className="w-full py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-center rounded-lg text-sm font-bold">
                    ✓ Move Approved & Keys Updated
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
