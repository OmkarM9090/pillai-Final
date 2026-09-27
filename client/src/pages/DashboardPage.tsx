import { useState, useEffect } from 'react';


const safeNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function DashboardPage() {
  // const { currentUser } = useAuth();
  
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [actionCards, setActionCards] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [safeEnvelope, setSafeEnvelope] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [creatingMasterTicket, setCreatingMasterTicket] = useState(false);

  const [modalConfig, setModalConfig] = useState<{type: 'APPROVE'|'REJECT'|'MODIFY'|'CONFIRM_MOVE'|null, card: any}>({ type: null, card: null });
  const [rejectReason, setRejectReason] = useState('');
  const [modifyData, setModifyData] = useState<any>({});

  const fetchAll = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      
      const [dashRes, acRes, incRes, auditRes, staffRes, safeRes] = await Promise.all([
        fetch('/api/v1/dashboard', { headers }),
        fetch('/api/v1/action-cards', { headers }),
        fetch('/api/v1/tickets', { headers }),
        fetch('/api/v1/audit-logs', { headers }),
        fetch('/api/v1/staff', { headers }),
        fetch('/api/v1/safe-envelope', { method: 'POST', headers })
      ]);

      const [dashJson, acJson, incJson, auditJson, staffJson, safeJson] = await Promise.all([
        dashRes.json(), acRes.json(), incRes.json(), auditRes.json(), staffRes.json(), safeRes.json()
      ]);

      if (dashJson.success) setDashboardData(dashJson.data);
      if (acJson.success) setActionCards(acJson.data.filter((c: any) => c.approval_status !== 'approved' && c.approval_status !== 'rejected'));
      if (incJson.success) setIncidents(incJson.data);
      if (auditJson.success) setAuditLogs(auditJson.data);
      if (staffJson.success) setStaffList(staffJson.data);
      if (safeJson.success) setSafeEnvelope(safeJson.data);

      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleActionCard = async (cardId: string, decision: string, payload: any = {}) => {
    try {
      await fetch('/api/v1/approve-plan', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ actionCardId: cardId, decision, ...payload })
      });
      setModalConfig({ type: null, card: null });
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  const acknowledgeIncident = async (id: string) => {
    try {
      await fetch(`/api/v1/tickets/${id}/acknowledge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  const createMasterWorkOrder = async () => {
    setCreatingMasterTicket(true);
    try {
      await fetch('/api/v1/cluster-complaints', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_window_hours: 4 })
      });
      fetchAll();
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingMasterTicket(false);
    }
  };

  if (loading || !dashboardData) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-slate-400">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-lg font-bold tracking-widest uppercase">Initializing Command Center...</div>
      </div>
    );
  }

  const { health, pressure: departmentPressure, autonomyDistribution, staffWorkload, potentialClusters } = dashboardData;
  const needsDecision = actionCards.filter(c => c.autonomy_level === 'MANAGER' || c.autonomy_level === 'CRITICAL' || c.approval_required);
  const criticalIncidentsList = incidents.filter(i => String(i.priority).toUpperCase() === 'CRITICAL' && i.status !== 'completed' && i.status !== 'ACKNOWLEDGED');
  const unresolvedTasks = needsDecision.filter(c => c.title?.includes('ESCALATION') || c.trigger?.includes('Unresolved') || c.title?.includes('Systemic Resolution'));
  const regularDecisions = needsDecision.filter(c => !c.title?.includes('ESCALATION') && !c.trigger?.includes('Unresolved') && !c.title?.includes('Systemic Resolution'));

  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'decisions', label: 'Decisions' },
    { id: 'staff', label: 'Staff' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'systemic', label: 'Systemic Issues' },
    { id: 'resilience', label: 'Resilience' },
    { id: 'audit', label: 'Audit' }
  ];

  return (
    <div className="min-h-screen bg-[#0B1120] pb-20 font-sans text-slate-300">
      
      {/* INTERNAL NAVIGATION */}
      <div className="sticky top-0 z-40 bg-[#0B1120]/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-6 overflow-x-auto py-3 scrollbar-hide text-sm font-bold uppercase tracking-wider text-slate-400">
            {navItems.map(item => (
              <a key={item.id} href={`#${item.id}`} className="hover:text-white transition whitespace-nowrap">{item.label}</a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
        
        {/* SECTION 1: EXECUTIVE STATUS BAR */}
        <section id="overview" className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">Smart Resort 360</h1>
            <p className="text-indigo-400 text-sm mt-1 font-bold tracking-widest uppercase">AI Operations Command Center</p>
          </div>
          <div className="mt-6 md:mt-0 flex flex-wrap gap-4 items-center">
            <div className="flex flex-col items-end px-4 border-r border-slate-700">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">System Status</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 text-sm uppercase"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Operational</span>
            </div>
            <div className="flex flex-col items-end px-4 border-r border-slate-700">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Resort Load</span>
              <span className="text-white font-bold text-sm uppercase">{health.occupancy}% Occupied</span>
            </div>
            <div className="flex flex-col items-end px-4">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Last Updated</span>
              <span className="text-white font-bold text-sm uppercase">{lastUpdated.toLocaleTimeString()}</span>
            </div>
          </div>
        </section>

        {/* SECTION 2: LIVE OPERATIONAL OVERVIEW */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Active Requests', val: safeNumber(health?.activeGuestRequests), color: 'text-white' },
              { label: 'Pending Approvals', val: safeNumber(health?.pendingApprovals), color: safeNumber(health?.pendingApprovals) > 0 ? 'text-amber-400' : 'text-emerald-400' },
              { label: 'In Progress', val: safeNumber(health?.inProgress), color: 'text-indigo-400' },
              { label: 'Completed Today', val: safeNumber(health?.completedToday), color: 'text-emerald-400' },
              { label: 'Critical Incidents', val: safeNumber(health?.criticalIncidents), color: safeNumber(health?.criticalIncidents) > 0 ? 'text-rose-500' : 'text-emerald-500' },
              { label: 'Avg Resolution', val: `${safeNumber(health?.averageWaitTime)}m`, color: 'text-white' },
            ].map((kpi, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-center items-center text-center shadow-lg hover:border-slate-700 transition">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{kpi.label}</div>
                <div className={`text-3xl font-black ${kpi.color}`}>{kpi.val}</div>
              </div>
            ))}
          </div>
        </section>

        {/* AI AUTONOMY DISTRIBUTION */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">AI Autonomy Distribution</h2>
          <div className="w-full bg-slate-800 rounded-full h-4 flex overflow-hidden">
            <div className="bg-emerald-500 h-full" style={{ width: `${autonomyDistribution?.L1 || 0}%` }} title="L1 Auto"></div>
            <div className="bg-indigo-500 h-full" style={{ width: `${autonomyDistribution?.L2 || 0}%` }} title="L2 Supervisor"></div>
            <div className="bg-amber-500 h-full" style={{ width: `${autonomyDistribution?.L3 || 0}%` }} title="L3 Manager"></div>
            <div className="bg-rose-500 h-full" style={{ width: `${autonomyDistribution?.L4 || 0}%` }} title="L4 Critical"></div>
          </div>
          <div className="flex justify-between mt-3 text-xs font-bold uppercase">
            <span className="text-emerald-400">L1 AUTO {autonomyDistribution?.L1 || 0}%</span>
            <span className="text-indigo-400">L2 SUP {autonomyDistribution?.L2 || 0}%</span>
            <span className="text-amber-400">L3 MGR {autonomyDistribution?.L3 || 0}%</span>
            <span className="text-rose-400">L4 CRIT {autonomyDistribution?.L4 || 0}%</span>
          </div>
        </section>

        {/* DECISION & REALLOCATION SPLIT */}
        <div id="decisions" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SECTION 3: NEEDS MY DECISION */}
          <section className="flex flex-col h-[500px]">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex justify-between items-center">
              Needs My Decision
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">{regularDecisions.length}</span>
            </h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
              {regularDecisions.length === 0 ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center h-full flex flex-col justify-center items-center">
                  <span className="text-3xl mb-3">✅</span>
                  <span className="text-emerald-400 font-bold uppercase tracking-wider text-sm">ALL DECISIONS CLEARED</span>
                  <span className="text-emerald-500/60 text-xs mt-2">No manager actions currently require attention.</span>
                </div>
              ) : (
                regularDecisions.map((card: any) => (
                  <div key={card._id} className="bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">{card.action_id || card._id.slice(-6)} • {card.affected_departments?.[0]}</div>
                        <h3 className="text-white font-bold text-lg">{card.title}</h3>
                      </div>
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase rounded">{card.autonomy_level}</span>
                    </div>
                    
                    <div className="bg-slate-950 p-3 rounded-lg mb-4 text-sm text-slate-300 font-mono">
                      {card.evidence?.map((e: string, i: number) => <div key={i}>• {e}</div>)}
                    </div>
                    
                    <div className="flex space-x-2">
                      <button onClick={() => setModalConfig({ type: 'APPROVE', card })} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded uppercase tracking-wider transition">Approve</button>
                      <button onClick={() => { setModalConfig({ type: 'MODIFY', card }); setModifyData({ priority: 'HIGH', department: card.affected_departments?.[0] || 'management', eta: 30, compensation: 'None', relocation: 'No' }); }} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded uppercase tracking-wider transition">Modify</button>
                      <button onClick={() => setModalConfig({ type: 'REJECT', card })} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-bold rounded uppercase tracking-wider transition">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* SECTION 8: ROOM REALLOCATION / ESCALATION */}
          <section className="flex flex-col h-[500px]">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex justify-between items-center">
              Room Reallocation
              <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded text-xs">{unresolvedTasks.length}</span>
            </h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
              {unresolvedTasks.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center h-full flex flex-col justify-center items-center">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-sm">No Active Escalations</span>
                </div>
              ) : (
                unresolvedTasks.map((card: any) => (
                  <div key={card._id} className="bg-slate-900 border border-rose-900/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                    <div className="mb-4">
                      <div className="text-[10px] text-rose-400 uppercase font-bold tracking-widest mb-1">ESCALATION • {card.trigger}</div>
                      <h3 className="text-white font-bold text-lg">{card.title}</h3>
                    </div>
                    
                    <div className="bg-slate-950 p-4 rounded-lg mb-4 border border-slate-800">
                      <div className="text-xs text-slate-500 font-bold mb-2 uppercase tracking-wider">Alternatives</div>
                      {card.implementation_steps?.map((step: string, idx: number) => (
                        <div key={idx} className="flex justify-between items-center mb-2 last:mb-0">
                          <span className="text-sm font-bold text-white">{step}</span>
                          {step.includes('MOVE') ? (
                            <button onClick={() => { setModalConfig({ type: 'MODIFY', card }); setModifyData({ priority: 'CRITICAL', department: 'front_desk', eta: 15, compensation: 'None', relocation: 'Yes', instructions: step }); }} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded uppercase">Select</button>
                          ) : (
                            <button onClick={() => { setModalConfig({ type: 'MODIFY', card }); setModifyData({ priority: 'HIGH', department: card.affected_departments?.[0], eta: 30, compensation: 'None', relocation: 'No', instructions: step }); }} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded uppercase">Select</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>

        {/* SECTION 4: ACTIVE STAFF OPERATIONS */}
        <section id="staff">
          <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4">Live Staff Operations</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {Object.entries(departmentPressure || {}).map(([dept, p]: [string, any]) => (
              <div key={dept} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                <div className="text-sm font-bold text-white uppercase tracking-widest mb-4">{dept.replace('_', ' ')}</div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">AVAILABLE</span>
                    <span className="text-emerald-400">{safeNumber(p.available)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">ASSIGNED</span>
                    <span className="text-amber-400">{safeNumber(p.busy)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">IN PROGRESS</span>
                    <span className="text-indigo-400">{safeNumber(p.activeTasks)}</span>
                  </div>
                </div>
                {p.pressureState === 'CRITICAL' && (
                  <div className="mt-4 pt-3 border-t border-rose-900/50 text-[10px] text-rose-400 font-bold uppercase tracking-widest flex items-center justify-center">
                    ⚠️ Capacity Risk
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* STAFF WORKLOAD TABLE */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="p-4 font-bold">Staff</th>
                    <th className="p-4 font-bold">Department</th>
                    <th className="p-4 font-bold">Current Task</th>
                    <th className="p-4 font-bold">Status</th>
                    <th className="p-4 font-bold w-48">Workload</th>
                    <th className="p-4 font-bold">Fatigue</th>
                    <th className="p-4 font-bold">ETA</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {staffWorkload?.map((staff: any) => (
                    <tr key={staff.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                      <td className="p-4 font-bold text-white">{staff.name}</td>
                      <td className="p-4 text-slate-400 uppercase text-xs font-bold tracking-wider">{staff.department}</td>
                      <td className="p-4 text-slate-300">{staff.currentTask}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${staff.status === 'OVERLOADED' ? 'bg-rose-500/20 text-rose-400' : staff.status === 'BUSY' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {staff.taskCount > 0 ? 'In Progress' : 'Available'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${staff.taskCount > 3 ? 'bg-rose-500' : staff.taskCount > 1 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, staff.taskCount * 25)}%` }}></div>
                          </div>
                          <span className="text-xs text-slate-500 font-bold">{staff.taskCount} tasks</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-400">{staff.fatigue > 75 ? 'High' : staff.fatigue > 50 ? 'Medium' : 'Normal'}</td>
                      <td className="p-4 font-mono text-indigo-400">{staff.eta} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 5 & 6 SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SECTION 5: CRITICAL INCIDENTS */}
          <section id="incidents" className="flex flex-col h-[400px]">
            <h2 className="text-sm font-black text-rose-400 uppercase tracking-widest mb-4 flex justify-between items-center">
              Critical Incidents
              {criticalIncidentsList.length === 0 && <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs">0</span>}
            </h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {criticalIncidentsList.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center h-full flex flex-col justify-center items-center">
                  <span className="text-3xl mb-3">✅</span>
                  <span className="text-emerald-400 font-bold uppercase tracking-wider text-sm">NO ACTIVE CRITICAL INCIDENTS</span>
                </div>
              ) : (
                criticalIncidentsList.map((inc: any) => (
                  <div key={inc._id} className="bg-rose-950/20 border border-rose-900 rounded-xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500 animate-pulse"></div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-[10px] text-rose-400 uppercase font-bold tracking-widest mb-1">🚨 L4 CRITICAL</div>
                        <h3 className="text-white font-bold text-lg uppercase">{inc.title || inc.issue_description}</h3>
                      </div>
                    </div>
                    <div className="text-sm text-slate-300 mb-4">Triggered: {new Date(inc.createdAt).toLocaleTimeString()}</div>
                    <div className="flex space-x-2">
                      <button onClick={() => acknowledgeIncident(inc._id || inc.ticket_id)} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded uppercase tracking-wider transition">Acknowledge</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* SECTION 6: SYSTEMIC ISSUES / CLUSTER DETECTION */}
          <section id="systemic" className="flex flex-col h-[400px]">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex justify-between items-center">
              Systemic Issues Detected
            </h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {potentialClusters?.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center h-full flex flex-col justify-center items-center">
                  <span className="text-3xl mb-3">✅</span>
                  <span className="text-emerald-400 font-bold uppercase tracking-wider text-sm">NO SYSTEMIC PATTERNS DETECTED</span>
                </div>
              ) : (
                potentialClusters?.map((cluster: any, idx: number) => (
                  <div key={idx} className="bg-slate-900 border border-amber-500/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    <h3 className="text-white font-bold text-lg uppercase mb-4">{cluster.intent} CLUSTER DETECTED</h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Impact</div>
                        <div className="text-sm font-bold text-amber-400">{cluster.count} Complaints</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Affected Rooms</div>
                        <div className="text-sm text-slate-300">{cluster.rooms.join(', ')}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Time Window</div>
                        <div className="text-sm text-slate-300">{cluster.timeWindow}</div>
                      </div>
                    </div>
                    <button 
                      onClick={createMasterWorkOrder} 
                      disabled={creatingMasterTicket}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded uppercase tracking-wider transition">
                      {creatingMasterTicket ? 'Creating...' : 'Create Master Work Order'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>

        {/* SECTION 7 & 10 SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SECTION 7: SAFE OPERATING ENVELOPE */}
          <section id="resilience" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-[450px] flex flex-col">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6">Safe Operating Envelope</h2>
            {safeEnvelope ? (
              <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-6">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Current Resilience</div>
                  <div className={`text-5xl font-black ${safeNumber(safeEnvelope.resilienceScore) >= 90 ? 'text-emerald-400' : safeNumber(safeEnvelope.resilienceScore) >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {Math.round(safeNumber(safeEnvelope.resilienceScore))}%
                  </div>
                  <div className="text-sm text-slate-400 mt-2">
                    {safeNumber(safeEnvelope.resilienceScore) >= 90 ? 'Operational stability is within the safe envelope.' : 'Operational stability is stressed.'}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Constraints & Bottlenecks</h3>
                  {safeEnvelope.constraints?.length > 0 ? (
                    <div className="space-y-3">
                      {safeEnvelope.constraints.map((c: any, i: number) => {
                        const sev = safeNumber(c.severity);
                        return (
                          <div key={i} className="flex justify-between items-center border-b border-slate-800 pb-2">
                            <div>
                              <div className="text-sm font-bold text-white">{c.name}</div>
                              <div className="text-xs text-slate-500">{c.description || `${Math.round(sev)}% utilization`}</div>
                            </div>
                            <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${sev > 90 ? 'bg-rose-500/20 text-rose-400' : sev > 70 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>
                              {sev > 90 ? 'High' : sev > 70 ? 'Medium' : 'Low'} severity
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-emerald-500/80">No active constraints detected.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-slate-500 animate-pulse">Calculating...</div>
            )}
          </section>

          {/* SECTION 10: MANAGER DECISION HISTORY */}
          <section id="audit" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-[450px] flex flex-col">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6">Manager Decision History</h2>
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500 sticky top-0">
                    <th className="p-3 font-bold">Time</th>
                    <th className="p-3 font-bold">Request</th>
                    <th className="p-3 font-bold">Decision</th>
                    <th className="p-3 font-bold">Manager</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {auditLogs.filter(log => log.user_role === 'MANAGER' || log.user_name?.toLowerCase().includes('manager')).map((log: any) => (
                    <tr key={log._id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                      <td className="p-3 text-slate-400 text-xs font-mono">{new Date(log.createdAt || log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td className="p-3 font-bold text-white text-xs">{log.entity_id?.slice(-6) || 'SYS'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${log.action_type.includes('APPROVED') ? 'bg-emerald-500/20 text-emerald-400' : log.action_type.includes('REJECTED') ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                          {log.decision || log.action_type.split('_').pop()}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 text-xs">{log.user_name}</td>
                    </tr>
                  ))}
                  {auditLogs.filter(log => log.user_role === 'MANAGER' || log.user_name?.toLowerCase().includes('manager')).length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 italic">No manager decisions recorded today.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>

      </div>

      {/* MODALS */}
      {modalConfig.type && modalConfig.card && (
        <div className="fixed inset-0 bg-[#0B1120]/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-hide">
            <h2 className="text-lg font-black text-white mb-6 uppercase tracking-widest border-b border-slate-800 pb-4">
              {modalConfig.type} ACTION
            </h2>
            
            <div className="mb-6 bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Target</div>
              <div className="text-sm font-bold text-white mb-2">{modalConfig.card.title}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Triggering Event</div>
              <div className="text-sm text-slate-400">{modalConfig.card.trigger || 'Guest Request'}</div>
            </div>

            {modalConfig.type === 'APPROVE' && (
              <div className="space-y-4 mb-6 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">AI Classification</div>
                  <div className="text-xs font-mono bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded inline-block font-bold">
                    {modalConfig.card.autonomy_level || 'L3 MANAGER'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Recommended Department</div>
                  <div className="text-sm text-slate-300 font-bold uppercase">{modalConfig.card.affected_departments?.join(', ')}</div>
                </div>
              </div>
            )}

            {modalConfig.type === 'REJECT' && (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Reason required:</label>
                  <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="Enter reason..." />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Optional alternatives:</label>
                  <div className="space-y-3">
                    {['Not operationally required', 'Duplicate request', 'Insufficient resources', 'Unsafe to execute', 'Better alternative available', 'Other'].map(opt => (
                      <label key={opt} className="flex items-center space-x-3 text-sm text-slate-400 cursor-pointer">
                        <input type="radio" name="reject_reason" value={opt} onChange={() => setRejectReason(opt)} className="text-rose-500 bg-slate-950 border-slate-800 focus:ring-rose-500 h-4 w-4" />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {modalConfig.type === 'MODIFY' && (
              <div className="space-y-5 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Priority</label>
                    <select value={modifyData.priority} onChange={e => setModifyData({...modifyData, priority: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none font-bold">
                      <option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Department</label>
                    <select value={modifyData.department} onChange={e => setModifyData({...modifyData, department: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none font-bold">
                      <option value="housekeeping">Housekeeping</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="fnb">F&B</option>
                      <option value="front_desk">Front Desk</option>
                      <option value="security">Security</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Assign Staff</label>
                    <select value={modifyData.worker} onChange={e => setModifyData({...modifyData, worker: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none font-bold">
                      <option value="auto">Auto Assign</option>
                      {staffList.filter(s => s.department === modifyData.department).map(s => (
                        <option key={s._id} value={s.name}>{s.name} ({s.task_status})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Est Completion (mins)</label>
                    <input type="number" value={modifyData.eta} onChange={e => setModifyData({...modifyData, eta: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Service Recovery</label>
                    <select value={modifyData.compensation} onChange={e => setModifyData({...modifyData, compensation: e.target.value})} className="w-full bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-amber-400 text-sm focus:border-amber-500 focus:outline-none font-bold">
                      <option>None</option>
                      <option>₹500 Credit</option>
                      <option>₹1000 Credit</option>
                      <option>10% Discount</option>
                      <option>Free Meal</option>
                      <option>Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Relocation Move</label>
                    <select value={modifyData.relocation} onChange={e => setModifyData({...modifyData, relocation: e.target.value})} className="w-full bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-2.5 text-indigo-400 text-sm focus:border-indigo-500 focus:outline-none font-bold">
                      <option>No</option><option>Yes</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Manager Instructions</label>
                  <textarea 
                    value={modifyData.instructions || ''} 
                    onChange={e => setModifyData({...modifyData, instructions: e.target.value})}
                    placeholder="Enter explicit instructions for staff to follow..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm h-24 focus:border-indigo-500 focus:outline-none font-mono"
                  ></textarea>
                </div>
              </div>
            )}

            <div className="flex space-x-3 mt-8 pt-4 border-t border-slate-800">
              <button onClick={() => setModalConfig({ type: null, card: null })} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl uppercase tracking-wider transition">
                CANCEL
              </button>
              <button 
                onClick={() => handleActionCard(modalConfig.card.action_id || modalConfig.card._id, modalConfig.type!, { reason: rejectReason, modifications: modifyData })} 
                disabled={modalConfig.type === 'REJECT' && !rejectReason}
                className={`flex-1 py-3 font-bold rounded-xl uppercase tracking-wider transition shadow-lg ${
                  modalConfig.type === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50 text-white' : 
                  modalConfig.type === 'REJECT' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/50 text-white disabled:opacity-50' : 
                  'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50 text-white'
                }`}
              >
                {modalConfig.type === 'APPROVE' ? 'APPROVE & DISPATCH' : modalConfig.type === 'REJECT' ? 'REJECT ACTION' : 'SAVE & DISPATCH'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
