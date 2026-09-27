import { useState, useEffect } from 'react';

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

  // Critical / Emergency Incidents
  const [incidentsList, setIncidentsList] = useState<any[]>([]);
  const [emergencyType, setEmergencyType] = useState('Medical Emergency');
  const [emergencyLocation, setEmergencyLocation] = useState('Main Swimming Pool');
  const [emergencyDesc, setEmergencyDesc] = useState('Guest requires urgent on-site assistance.');
  const [triggeringEmergency, setTriggeringEmergency] = useState(false);

  const fetchIncidents = async () => {
    try {
      const res = await fetch('/api/v1/incidents', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const json = await res.json();
      if (json.success) setIncidentsList(json.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchIncidents();
    const timer = setInterval(fetchIncidents, 5000);
    return () => clearInterval(timer);
  }, []);

  const triggerEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    setTriggeringEmergency(true);
    try {
      await fetch('/api/v1/incidents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_type: emergencyType,
          location: emergencyLocation,
          description: emergencyDesc,
          severity: 'CRITICAL'
        })
      });
      fetchIncidents();
    } catch (err) {
      console.error(err);
    } finally {
      setTriggeringEmergency(false);
    }
  };

  const updateIncidentStatus = async (id: string, status: string, note?: string) => {
    try {
      await fetch(`/api/v1/incidents/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note })
      });
      fetchIncidents();
    } catch (err) {
      console.error(err);
    }
  };

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

  const handleApprove = async () => {
    if (!reallocation?.action_card?.action_id) {
      setApproved(true);
      return;
    }
    try {
      await fetch('/api/v1/approve-plan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionCardId: reallocation.action_card.action_id,
          decision: 'APPROVE',
          modifications: { relocation: 'Yes' }
        })
      });
      setApproved(true);
    } catch (err) {
      console.error(err);
      setApproved(true);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Systemic Incidents &amp; Reallocation</h1>
        <p className="text-[var(--text-secondary)]">Automated pattern detection, critical incident escalation, and constraints-based resolution engine.</p>
      </div>

      {/* EMERGENCY INCIDENT ESCALATION SECTION */}
      <div className="bg-[var(--bg-card)] border border-rose-500/30 rounded-[1.5rem] p-6 shadow-[var(--card-shadow)] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--card-border)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wide">Emergency &amp; Critical Incident Command</h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Escalates immediately to On-Duty Manager and Security. Follow configured on-site resort protocols.
            </p>
          </div>
          <span className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-lg uppercase">
            Least-Privilege Escalation
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={triggerEmergency} className="lg:col-span-5 space-y-4 bg-[var(--bg-secondary)]/60 p-4 rounded-[1rem] border border-[var(--card-border)]">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Log Emergency Incident</h3>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Incident Type</label>
              <select 
                value={emergencyType} 
                onChange={e => setEmergencyType(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)]"
              >
                <option value="Medical Emergency">Medical Emergency</option>
                <option value="Pool Safety Incident">Pool Safety Incident</option>
                <option value="Fire / Smoke Hazard">Fire / Smoke Hazard</option>
                <option value="Structural / Flood Breach">Structural / Flood Breach</option>
                <option value="Security Lockdown">Security Lockdown</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Exact Location</label>
              <input 
                type="text" 
                value={emergencyLocation}
                onChange={e => setEmergencyLocation(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)]"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Operational Description</label>
              <textarea 
                value={emergencyDesc}
                onChange={e => setEmergencyDesc(e.target.value)}
                rows={2}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)]"
                required
              />
            </div>
            <button 
              type="submit"
              disabled={triggeringEmergency}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-[var(--text-primary)] font-bold text-xs rounded-lg shadow-[var(--card-shadow)] shadow-rose-600/30 transition uppercase tracking-wider disabled:opacity-50"
            >
              {triggeringEmergency ? 'Broadcasting...' : '🚨 Trigger Critical Emergency Alert'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Active Incident Board</h3>
            {incidentsList.length === 0 ? (
              <div className="p-8 bg-[var(--bg-secondary)]/40 rounded-[1rem] border border-[var(--card-border)] text-center text-[var(--text-muted)] text-xs">
                No active critical incidents recorded.
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {incidentsList.map((inc: any) => (
                  <div key={inc.incident_id} className="p-4 bg-[var(--bg-secondary)]/80 border border-[var(--card-border)] rounded-[1rem] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-400">{inc.incident_id}</span>
                        <span className="text-xs font-black text-[var(--text-primary)]">{inc.incident_type}</span>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                        inc.status === 'DETECTED' ? 'bg-rose-500/30 text-rose-300 animate-pulse' :
                        inc.status === 'ACKNOWLEDGED' ? 'bg-amber-500/30 text-amber-300' :
                        inc.status === 'RESPONDING' ? 'bg-indigo-500/30 text-[var(--accent)]' :
                        inc.status === 'RESOLVED' ? 'bg-emerald-500/30 text-emerald-300' :
                        'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                      }`}>
                        {inc.status}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] font-medium">📍 {inc.location} — {inc.description}</div>
                    <div className="text-[10px] text-[var(--text-muted)] flex items-center justify-between">
                      <span>Reported by: {inc.detected_by}</span>
                      <span>{new Date(inc.createdAt).toLocaleTimeString()}</span>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[var(--card-border)]/80">
                      {inc.status === 'DETECTED' && (
                        <button 
                          onClick={() => updateIncidentStatus(inc.incident_id, 'ACKNOWLEDGED', 'Manager acknowledged')}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-[var(--text-primary)] font-bold text-[11px] rounded"
                        >
                          Acknowledge
                        </button>
                      )}
                      {inc.status === 'ACKNOWLEDGED' && (
                        <button 
                          onClick={() => updateIncidentStatus(inc.incident_id, 'RESPONDING', 'First responders on site')}
                          className="px-3 py-1 bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--on-accent)] transition-transform hover:scale-[1.02] active:scale-[0.98]  font-bold text-[11px] rounded"
                        >
                          Mark Responding
                        </button>
                      )}
                      {(inc.status === 'ACKNOWLEDGED' || inc.status === 'RESPONDING') && (
                        <button 
                          onClick={() => updateIncidentStatus(inc.incident_id, 'RESOLVED', 'Situation contained & stabilized')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-[var(--text-primary)] font-bold text-[11px] rounded"
                        >
                          Resolve
                        </button>
                      )}
                      {inc.status === 'RESOLVED' && (
                        <button 
                          onClick={() => updateIncidentStatus(inc.incident_id, 'CLOSED', 'Incident closed and audited')}
                          className="px-3 py-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] font-bold text-[11px] rounded"
                        >
                          Close Incident
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Col: Clusters */}
        <div className="space-y-6">
          <div className="bg-[var(--bg-card)] border border-[var(--card-border)] rounded-[1rem] p-6 shadow-[var(--card-shadow)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Pattern Detection</h2>
              <button 
                onClick={runClusterAnalysis}
                disabled={loadingClusters}
                className="px-4 py-2 bg-[var(--accent)] text-[var(--on-accent)] hover:bg-indigo-700  rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {loadingClusters ? 'Scanning...' : 'Run Cluster Analysis'}
              </button>
            </div>

            {alerts === 0 && !loadingClusters && clusters.length === 0 ? (
              <div className="text-center p-8 bg-[var(--bg-secondary)] rounded-lg border border-[var(--card-border)]">
                <span className="text-4xl block mb-2">✅</span>
                <div className="text-[var(--text-secondary)] font-medium">No Systemic Issues Detected</div>
                <div className="text-[var(--text-muted)] text-sm mt-1">All systems operating normally across 5 floors.</div>
              </div>
            ) : null}

            {clusters.map((cluster, idx) => (
              <div key={idx} className="bg-rose-950/30 border border-rose-500/30 rounded-lg p-5 mb-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                <div className="flex items-center space-x-2 mb-3">
                  <span className="animate-pulse w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-rose-400 font-bold text-xs uppercase tracking-wider">Systemic Pattern Detected</span>
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  {cluster.count} Related Complaints: {cluster.intent} (Chiller Zone B)
                </h3>
                <div className="bg-black/20 rounded p-3 mb-4">
                  <div className="text-xs text-[var(--text-secondary)] mb-1">Affected Rooms:</div>
                  <div className="flex flex-wrap gap-2">
                    {cluster.rooms.map((room: string) => (
                      <span key={room} className="px-2 py-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs rounded border border-[var(--border-color)]">
                        Room {room}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between border-t border-rose-500/20 pt-4">
                  <div>
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase">Auto-Generated Work Order</div>
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
          <div className="bg-[var(--bg-card)] border border-[var(--card-border)] rounded-[1rem] p-6 shadow-[var(--card-shadow)]">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Automated Room Reallocation</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Guest Name</label>
                <input 
                  type="text" 
                  value={guestName} 
                  onChange={e => setGuestName(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Current Room</label>
                <input 
                  type="text" 
                  value={currentRoom} 
                  onChange={e => setCurrentRoom(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]" 
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Trigger Reason</label>
                <input 
                  type="text" 
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]" 
                />
              </div>
            </div>

            <button 
              onClick={runReallocation}
              disabled={loadingReallocation}
              className="w-full py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg text-sm font-medium transition mb-6"
            >
              {loadingReallocation ? 'Calculating Matrix...' : 'Calculate Optimal Reallocation'}
            </button>

            {reallocation && (
              <div className="border border-[var(--accent)]/30 bg-indigo-500/5 rounded-lg p-5">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-[var(--accent)] font-bold uppercase text-xs tracking-widest">Recommendation Engine</h3>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">L3 MANAGER APPROVAL</span>
                </div>
                
                <div className="bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded p-4 mb-4 flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-[var(--text-secondary)] text-xs mb-1">Current</div>
                    <div className="text-lg font-bold text-rose-400">Room {currentRoom}</div>
                  </div>
                  <div className="text-[var(--text-muted)]">→</div>
                  <div className="text-center">
                    <div className="text-[var(--text-secondary)] text-xs mb-1">Proposed (Upgrade)</div>
                    <div className="text-lg font-bold text-emerald-400">Room {reallocation.recommended_room.room_number}</div>
                    <div className="text-[10px] text-emerald-500/70">{reallocation.recommended_room.type}</div>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center text-xs text-[var(--text-secondary)]">
                    <span className="text-emerald-500 mr-2">✓</span> Room is cleaned and available
                  </div>
                  <div className="flex items-center text-xs text-[var(--text-secondary)]">
                    <span className="text-emerald-500 mr-2">✓</span> Zero booking collisions for next 3 days
                  </div>
                  <div className="flex items-center text-xs text-[var(--text-secondary)]">
                    <span className="text-emerald-500 mr-2">✓</span> Compensatory upgrade value: +$100/night
                  </div>
                </div>

                {!approved ? (
                  <button 
                    onClick={handleApprove}
                    className="w-full py-3 bg-[var(--accent)] text-[var(--on-accent)] hover:bg-indigo-700  rounded-lg text-sm font-medium shadow-[var(--card-shadow)] shadow-indigo-600/20 transition"
                  >
                    1-Click Approve Room Move
                  </button>
                ) : (
                  <div className="w-full py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-center rounded-lg text-sm font-bold">
                    ✓ Move Approved &amp; Keys Updated
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

