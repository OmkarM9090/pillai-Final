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
  const [guestRequests, setGuestRequests] = useState<any[]>([]);
  const [feedbackData, setFeedbackData] = useState<{ feedback: any[]; average_rating: number | null }>({ feedback: [], average_rating: null });
  const [observations, setObservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [creatingMasterTicket, setCreatingMasterTicket] = useState(false);

  const [modalConfig, setModalConfig] = useState<{ type: 'APPROVE' | 'REJECT' | 'MODIFY' | 'CONFIRM_MOVE' | null, card: any }>({ type: null, card: null });
  const [rejectReason, setRejectReason] = useState('');
  const [modifyData, setModifyData] = useState<any>({});

  const fetchAll = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

      const [dashRes, acRes, incRes, auditRes, staffRes, safeRes, grRes, fbRes, obsRes] = await Promise.all([
        fetch('/api/v1/dashboard', { headers }),
        fetch('/api/v1/action-cards', { headers }),
        fetch('/api/v1/tickets', { headers }),
        fetch('/api/v1/audit-logs', { headers }),
        fetch('/api/v1/staff', { headers }),
        fetch('/api/v1/safe-envelope', { method: 'POST', headers }),
        fetch('/api/v1/guest-requests', { headers }),
        fetch('/api/v1/manager/feedback', { headers }),
        fetch('/api/v1/manager/observations', { headers })
      ]);

      const [dashJson, acJson, incJson, auditJson, staffJson, safeJson, grJson, fbJson, obsJson] = await Promise.all([
        dashRes.json(), acRes.json(), incRes.json(), auditRes.json(), staffRes.json(), safeRes.json(), grRes.json(), fbRes.json(), obsRes.json()
      ]);

      if (dashJson.success) setDashboardData(dashJson.data);
      if (acJson.success) setActionCards(acJson.data.filter((c: any) => c.approval_status !== 'approved' && c.approval_status !== 'rejected'));
      if (incJson.success) setIncidents(incJson.data);
      if (auditJson.success) setAuditLogs(auditJson.data);
      if (staffJson.success) setStaffList(staffJson.data);
      if (safeJson.success) setSafeEnvelope(safeJson.data);
      if (grJson.success) setGuestRequests(grJson.data);
      if (fbJson.success) setFeedbackData(fbJson.data);
      if (obsJson.success) setObservations(obsJson.data);

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
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-[var(--text-secondary)]">
        <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
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
    { id: 'guests', label: 'Guests' },
    { id: 'decisions', label: 'Decisions' },
    { id: 'staff', label: 'Staff' },
    { id: 'feedback', label: 'Feedback & Observations' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'systemic', label: 'Systemic Issues' },
    { id: 'resilience', label: 'Resilience' },
    { id: 'audit', label: 'Audit' }
  ];

  const pendingGuestApprovals = guestRequests.filter((r: any) => ['PENDING_APPROVAL', 'CLASSIFIED'].includes(r.status));
  const activeGuestRequests = guestRequests.filter((r: any) => ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'CREATED', 'ROUTED'].includes(r.status));

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-20 font-sans text-[var(--text-secondary)]">

      {/* INTERNAL NAVIGATION */}
      <div className="sticky top-0 z-40 bg-[var(--nav-bg)] backdrop-blur-md border-b border-[var(--card-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6 overflow-x-auto py-3 scrollbar-hide text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            {navItems.map(item => (
              <a key={item.id} href={`#${item.id}`} className="hover:text-[var(--text-primary)] transition whitespace-nowrap">{item.label}</a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8 md:space-y-12">

        {/* SECTION 1: EXECUTIVE STATUS BAR */}
        <section id="overview" className="flex flex-col md:flex-row justify-between items-start md:items-center card">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold font-display tracking-tight text-[var(--text-primary)]">Smart Resort 360</h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1 font-medium tracking-wide uppercase">AI Operations Command Center</p>
          </div>
          <div className="mt-6 md:mt-0 flex flex-wrap gap-4 items-center">
            <div className="flex flex-col items-end px-4 border-r border-[var(--border-color)]">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest">System Status</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 text-sm uppercase"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Operational</span>
            </div>
            <div className="flex flex-col items-end px-4 border-r border-[var(--border-color)]">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest">Resort Load</span>
              <span className="text-[var(--text-primary)] font-bold text-sm uppercase">{health.occupancy}% Occupied</span>
            </div>
            <div className="flex flex-col items-end px-4">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest">Last Updated</span>
              <span className="text-[var(--text-primary)] font-bold text-sm uppercase">{lastUpdated.toLocaleTimeString()}</span>
            </div>
          </div>
        </section>

        {/* SECTION 2: LIVE OPERATIONAL OVERVIEW */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Active Requests', val: safeNumber(health?.activeGuestRequests), color: 'text-[var(--text-primary)]' },
              { label: 'Pending Approvals', val: safeNumber(health?.pendingApprovals), color: safeNumber(health?.pendingApprovals) > 0 ? 'text-amber-400' : 'text-emerald-400' },
              { label: 'In Progress', val: safeNumber(health?.inProgress), color: 'text-[var(--accent)]' },
              { label: 'Completed Today', val: safeNumber(health?.completedToday), color: 'text-emerald-400' },
              { label: 'Critical Incidents', val: safeNumber(health?.criticalIncidents), color: safeNumber(health?.criticalIncidents) > 0 ? 'text-[var(--color-resort-error)]' : 'text-[var(--color-resort-success)]' },
              { label: 'Avg Resolution', val: `${safeNumber(health?.averageWaitTime)}m`, color: 'text-[var(--text-primary)]' },
            ].map((kpi, i) => (
              <div key={i} className="card flex flex-col !p-6 justify-center items-center text-center shadow-sm hover:shadow-md transition duration-200">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{kpi.label}</div>
                <div className={`text-3xl font-bold font-display tracking-tight ${kpi.color}`}>{kpi.val}</div>
              </div>
            ))}
          </div>
        </section>

        {/* AI AUTONOMY DISTRIBUTION */}
        <section className="card !p-6 shadow-sm">
          <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-4">AI Autonomy Distribution</h2>
          <div className="w-full bg-[var(--bg-secondary)] rounded-full h-4 flex overflow-hidden">
            <div className="bg-emerald-500 h-full" style={{ width: `${autonomyDistribution?.L1 || 0}%` }} title="L1 Auto"></div>
            <div className="bg-indigo-500 h-full" style={{ width: `${autonomyDistribution?.L2 || 0}%` }} title="L2 Supervisor"></div>
            <div className="bg-amber-500 h-full" style={{ width: `${autonomyDistribution?.L3 || 0}%` }} title="L3 Manager"></div>
            <div className="bg-rose-500 h-full" style={{ width: `${autonomyDistribution?.L4 || 0}%` }} title="L4 Critical"></div>
          </div>
          <div className="flex justify-between mt-3 text-xs font-bold uppercase">
            <span className="text-emerald-400">L1 AUTO {autonomyDistribution?.L1 || 0}%</span>
            <span className="text-[var(--accent)]">L2 SUP {autonomyDistribution?.L2 || 0}%</span>
            <span className="text-amber-400">L3 MGR {autonomyDistribution?.L3 || 0}%</span>
            <span className="text-rose-400">L4 CRIT {autonomyDistribution?.L4 || 0}%</span>
          </div>
        </section>

        {/* GUEST REQUESTS SNAPSHOT — drillable into the dedicated manager section */}
        <section id="guests" className="card overflow-hidden !p-0 shadow-sm">
          <div className="flex justify-between items-center px-6 py-5 border-b border-[var(--card-border)] bg-[var(--bg-secondary)]/30">
            <h2 className="text-lg md:text-xl font-semibold font-display text-[var(--text-primary)] tracking-tight">Guest Requests — Live</h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="px-2 py-0.5 rounded badge badge-warning font-bold">{pendingGuestApprovals.length} awaiting decision</span>
              <span className="px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)] font-bold">{activeGuestRequests.length} in execution</span>
              <a href="/guest-requests" className="text-[var(--accent)] hover:text-[var(--accent)] font-bold uppercase tracking-wider">Open Guest Requests →</a>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[var(--bg-secondary)] text-[10px] uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--card-border)]">
                  <th className="p-3 font-bold">ID</th>
                  <th className="p-3 font-bold">Room</th>
                  <th className="p-3 font-bold">Request</th>
                  <th className="p-3 font-bold">Priority</th>
                  <th className="p-3 font-bold">Dept</th>
                  <th className="p-3 font-bold">Status</th>
                  <th className="p-3 font-bold">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {[...pendingGuestApprovals, ...activeGuestRequests].slice(0, 7).map((r: any) => (
                  <tr key={r.request_id} className="hover:bg-[var(--bg-secondary)] transition-colors align-middle">
                    <td className="p-3 font-bold text-[var(--text-primary)] text-xs">{r.request_id}</td>
                    <td className="p-3 text-[var(--text-secondary)] text-xs">{r.room_number}</td>
                    <td className="p-3 text-[var(--text-secondary)] text-xs max-w-[260px] truncate">{r.request_text}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${['CRITICAL', 'HIGH', 'P0', 'P1'].includes(r.priority) ? 'badge badge-error' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>{r.priority}</span></td>
                    <td className="p-3 text-[var(--text-secondary)] text-xs capitalize">{r.department}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${['PENDING_APPROVAL', 'CLASSIFIED'].includes(r.status) ? 'badge badge-warning' : ['COMPLETED', 'VERIFIED'].includes(r.status) ? 'badge badge-success' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>{String(r.status).replace('_', ' ')}</span></td>
                    <td className="p-3 text-[var(--text-secondary)] text-xs">{r.assigned_staff || '—'}</td>
                  </tr>
                ))}
                {[...pendingGuestApprovals, ...activeGuestRequests].length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-[var(--text-muted)] italic text-sm">No guest requests in flight right now.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* DECISION & REALLOCATION SPLIT */}
        <div id="decisions" className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* SECTION 3: NEEDS MY DECISION */}
          <section className="flex flex-col h-[500px]">
            <h2 className="text-lg md:text-xl font-semibold font-display text-[var(--text-primary)] tracking-tight mb-5 flex justify-between items-center">
              Needs My Decision
              <span className="px-2 py-0.5 badge badge-warning rounded text-xs">{regularDecisions.length}</span>
            </h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
              {regularDecisions.length === 0 ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center h-full flex flex-col justify-center items-center">
                  <span className="text-3xl mb-3">✅</span>
                  <span className="text-emerald-400 font-bold uppercase tracking-wider text-sm">ALL DECISIONS CLEARED</span>
                  <span className="text-[var(--color-resort-success)]/60 text-xs mt-2">No manager actions currently require attention.</span>
                </div>
              ) : (
                regularDecisions.map((card: any) => (
                  <div key={card._id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 shadow-[var(--card-shadow)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-widest mb-1">{card.action_id || card._id.slice(-6)} • {card.affected_departments?.[0]}</div>
                        <h3 className="text-[var(--text-primary)] font-bold text-lg">{card.title}</h3>
                      </div>
                      <span className="px-2 py-1 badge badge-warning text-[10px] font-bold uppercase rounded">{card.autonomy_level}</span>
                    </div>

                    <div className="bg-[var(--bg-secondary)] p-3 rounded-lg mb-4 text-sm text-[var(--text-secondary)] font-mono">
                      {card.evidence?.map((e: string, i: number) => <div key={i}>• {e}</div>)}
                    </div>

                    <div className="flex space-x-2">
                      <button onClick={() => setModalConfig({ type: 'APPROVE', card })} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-[var(--text-primary)] text-xs font-bold rounded uppercase tracking-wider transition">Approve</button>
                      <button onClick={() => { setModalConfig({ type: 'MODIFY', card }); setModifyData({ priority: 'HIGH', department: card.affected_departments?.[0] || 'management', eta: 30, compensation: 'None', relocation: 'No' }); }} className="flex-1 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--on-accent)] transition-transform hover:scale-[1.02] active:scale-[0.98]  text-xs font-bold rounded uppercase tracking-wider transition">Modify</button>
                      <button onClick={() => setModalConfig({ type: 'REJECT', card })} className="flex-1 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)] text-rose-400 text-xs font-bold rounded uppercase tracking-wider transition">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* SECTION 8: ROOM REALLOCATION / ESCALATION */}
          <section className="flex flex-col h-[500px]">
            <h2 className="text-lg md:text-xl font-semibold font-display text-[var(--text-primary)] tracking-tight mb-5 flex justify-between items-center">
              Room Reallocation
              <span className="px-2 py-0.5 badge badge-error rounded text-xs">{unresolvedTasks.length}</span>
            </h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
              {unresolvedTasks.length === 0 ? (
                <div className="bg-[var(--bg-card)] border border-[var(--card-border)] rounded-xl p-6 text-center h-full flex flex-col justify-center items-center">
                  <span className="text-[var(--text-muted)] font-bold uppercase tracking-wider text-sm">No Active Escalations</span>
                </div>
              ) : (
                unresolvedTasks.map((card: any) => (
                  <div key={card._id} className="bg-[var(--bg-card)] border border-rose-900/50 rounded-xl p-5 shadow-[var(--card-shadow)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                    <div className="mb-4">
                      <div className="text-[10px] text-rose-400 uppercase font-bold tracking-widest mb-1">ESCALATION • {card.trigger}</div>
                      <h3 className="text-[var(--text-primary)] font-bold text-lg">{card.title}</h3>
                    </div>

                    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg mb-4 border border-[var(--card-border)]">
                      <div className="text-xs text-[var(--text-muted)] font-bold mb-2 uppercase tracking-wider">Alternatives</div>
                      {card.implementation_steps?.map((step: string, idx: number) => (
                        <div key={idx} className="flex justify-between items-center mb-2 last:mb-0">
                          <span className="text-sm font-bold text-[var(--text-primary)]">{step}</span>
                          {step.includes('MOVE') ? (
                            <button onClick={() => { setModalConfig({ type: 'MODIFY', card }); setModifyData({ priority: 'CRITICAL', department: 'front_desk', eta: 15, compensation: 'None', relocation: 'Yes', instructions: step }); }} className="px-3 py-1 bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--on-accent)] transition-transform hover:scale-[1.02] active:scale-[0.98]  text-[10px] font-bold rounded uppercase">Select</button>
                          ) : (
                            <button onClick={() => { setModalConfig({ type: 'MODIFY', card }); setModifyData({ priority: 'HIGH', department: card.affected_departments?.[0], eta: 30, compensation: 'None', relocation: 'No', instructions: step }); }} className="px-3 py-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] text-[10px] font-bold rounded uppercase">Select</button>
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
          <h2 className="text-lg md:text-xl font-semibold font-display text-[var(--text-primary)] tracking-tight mb-5">Live Staff Operations</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {Object.entries(departmentPressure || {}).map(([dept, p]: [string, any]) => (
              <div key={dept} className="card !p-6 shadow-sm hover:shadow-md transition duration-200">
                <div className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-4">{dept.replace('_', ' ')}</div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[var(--text-muted)]">AVAILABLE</span>
                    <span className="text-emerald-400">{safeNumber(p.available)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[var(--text-muted)]">ASSIGNED</span>
                    <span className="text-amber-400">{safeNumber(p.busy)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[var(--text-muted)]">IN PROGRESS</span>
                    <span className="text-[var(--accent)]">{safeNumber(p.activeTasks)}</span>
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
          <div className="card overflow-hidden !p-0 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-secondary)] border-b border-[var(--card-border)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
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
                    <tr key={staff.id} className="border-b border-[var(--accent-soft-border)] hover:bg-[var(--bg-secondary)]/30 transition">
                      <td className="p-4 font-bold text-[var(--text-primary)]">{staff.name}</td>
                      <td className="p-4 text-[var(--text-secondary)] uppercase text-xs font-bold tracking-wider">{staff.department}</td>
                      <td className="p-4 text-[var(--text-secondary)]">{staff.currentTask}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${staff.status === 'OVERLOADED' ? 'badge badge-error' : staff.status === 'BUSY' ? 'badge badge-warning' : 'badge badge-success'}`}>
                          {staff.taskCount > 0 ? 'In Progress' : 'Available'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-[var(--bg-secondary)] h-2 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${staff.taskCount > 3 ? 'bg-rose-500' : staff.taskCount > 1 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, staff.taskCount * 25)}%` }}></div>
                          </div>
                          <span className="text-xs text-[var(--text-muted)] font-bold">{staff.taskCount} tasks</span>
                        </div>
                      </td>
                      <td className="p-4 text-[var(--text-secondary)]">{staff.fatigue > 75 ? 'High' : staff.fatigue > 50 ? 'Medium' : 'Normal'}</td>
                      <td className="p-4 font-mono text-[var(--accent)]">{staff.eta} min</td>
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
            <h2 className="text-lg md:text-xl font-semibold font-display text-rose-500 tracking-tight mb-5 flex justify-between items-center">
              Critical Incidents
              {criticalIncidentsList.length === 0 && <span className="px-2 py-0.5 badge badge-success rounded text-xs">0</span>}
            </h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {criticalIncidentsList.length === 0 ? (
                <div className="bg-[var(--bg-card)] border border-[var(--card-border)] rounded-xl p-6 text-center h-full flex flex-col justify-center items-center">
                  <span className="text-3xl mb-3">✅</span>
                  <span className="text-emerald-400 font-bold uppercase tracking-wider text-sm">NO ACTIVE CRITICAL INCIDENTS</span>
                </div>
              ) : (
                criticalIncidentsList.map((inc: any) => (
                  <div key={inc._id} className="bg-rose-950/20 border border-rose-900 rounded-xl p-5 shadow-[var(--card-shadow)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500 animate-pulse"></div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-[10px] text-rose-400 uppercase font-bold tracking-widest mb-1">🚨 L4 CRITICAL</div>
                        <h3 className="text-[var(--text-primary)] font-bold text-lg uppercase">{inc.title || inc.issue_description}</h3>
                      </div>
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] mb-4">Triggered: {new Date(inc.createdAt).toLocaleTimeString()}</div>
                    <div className="flex space-x-2">
                      <button onClick={() => acknowledgeIncident(inc._id || inc.ticket_id)} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-[var(--text-primary)] text-xs font-bold rounded uppercase tracking-wider transition">Acknowledge</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* SECTION 6: SYSTEMIC ISSUES / CLUSTER DETECTION */}
          <section id="systemic" className="flex flex-col h-[400px]">
            <h2 className="text-lg md:text-xl font-semibold font-display text-[var(--text-primary)] tracking-tight mb-5 flex justify-between items-center">
              Systemic Issues Detected
            </h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {potentialClusters?.length === 0 ? (
                <div className="bg-[var(--bg-card)] border border-[var(--card-border)] rounded-xl p-6 text-center h-full flex flex-col justify-center items-center">
                  <span className="text-3xl mb-3">✅</span>
                  <span className="text-emerald-400 font-bold uppercase tracking-wider text-sm">NO SYSTEMIC PATTERNS DETECTED</span>
                </div>
              ) : (
                potentialClusters?.map((cluster: any, idx: number) => (
                  <div key={idx} className="bg-[var(--bg-card)] border border-amber-500/50 rounded-xl p-5 shadow-[var(--card-shadow)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    <h3 className="text-[var(--text-primary)] font-bold text-lg uppercase mb-4">{cluster.intent} CLUSTER DETECTED</h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mb-1">Impact</div>
                        <div className="text-sm font-bold text-amber-400">{cluster.count} Complaints</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mb-1">Affected Rooms</div>
                        <div className="text-sm text-[var(--text-secondary)]">{cluster.rooms.join(', ')}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mb-1">Time Window</div>
                        <div className="text-sm text-[var(--text-secondary)]">{cluster.timeWindow}</div>
                      </div>
                    </div>
                    <button
                      onClick={createMasterWorkOrder}
                      disabled={creatingMasterTicket}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-[var(--text-primary)] text-xs font-bold rounded uppercase tracking-wider transition">
                      {creatingMasterTicket ? 'Creating...' : 'Create Master Work Order'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>

        {/* FEEDBACK & STAFF OBSERVATIONS (Phase 8/9/10) */}
        <div id="feedback" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="card h-[380px] flex flex-col shadow-sm !p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg md:text-xl font-semibold font-display text-[var(--text-primary)] tracking-tight">Guest Feedback</h2>
              {feedbackData.average_rating != null && (
                <span className="text-amber-400 font-black">{feedbackData.average_rating}★ <span className="text-[10px] text-[var(--text-muted)] font-bold">avg</span></span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {feedbackData.feedback.length === 0 ? (
                <div className="text-[var(--text-muted)] text-sm italic text-center py-10">Feedback appears here once completed tasks are rated by guests.</div>
              ) : feedbackData.feedback.slice(0, 10).map((f: any) => (
                <div key={f.request_id} className="bg-[var(--accent-soft)] border border-[var(--border-color)] rounded-xl p-3.5">
                  <div className="flex justify-between">
                    <span className="text-amber-400 text-sm">{'★'.repeat(f.guest_rating)}{'☆'.repeat(5 - f.guest_rating)}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Room {f.room_number} · {f.request_id}</span>
                  </div>
                  <div className="text-sm text-[var(--text-primary)] mt-1.5">“{f.guest_feedback || 'No written comment'}”</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1.5">by <span className="text-[var(--text-secondary)] font-bold">{f.assigned_staff || '—'}</span> · {f.department}{f.completed_at ? ` · done ${new Date(f.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card h-[380px] flex flex-col shadow-sm !p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg md:text-xl font-semibold font-display text-[var(--text-primary)] tracking-tight">Staff On-Site Observations</h2>
              <span className="px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded text-xs font-bold">{observations.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {observations.length === 0 ? (
                <div className="text-[var(--text-muted)] text-sm italic text-center py-10">When staff spot an unlisted issue on-site, it lands here instantly — routed to the right department.</div>
              ) : observations.slice(0, 10).map((o: any) => (
                <div key={o.observation_id} className="bg-[var(--accent-soft)] border border-[var(--border-color)] rounded-xl p-3.5">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{o.staff_name} · Room {o.room_number ?? 'n/a'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${o.status === 'ROUTED' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>{o.status}</span>
                  </div>
                  <div className="text-sm text-[var(--text-primary)] mt-1.5">“{o.note}”</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1.5">
                    {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {o.task_id ? ` · during ${o.task_id}` : ''}
                    {o.routed_ticket_id && <> · ticket <span className="text-[var(--accent)] font-bold">{o.routed_ticket_id}</span> → {o.department}</>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* SECTION 7 & 10 SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* SECTION 7: SAFE OPERATING ENVELOPE */}
          <section id="resilience" className="card h-[450px] flex flex-col shadow-sm !p-6">
            <h2 className="text-lg md:text-xl font-semibold font-display text-[var(--text-primary)] tracking-tight mb-6">Safe Operating Envelope</h2>
            {safeEnvelope ? (
              <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-6">
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mb-1">Current Resilience</div>
                  <div className={`text-5xl font-black ${safeNumber(safeEnvelope.resilienceScore) >= 90 ? 'text-emerald-400' : safeNumber(safeEnvelope.resilienceScore) >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {Math.round(safeNumber(safeEnvelope.resilienceScore))}%
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] mt-2">
                    {safeNumber(safeEnvelope.resilienceScore) >= 90 ? 'Operational stability is within the safe envelope.' : 'Operational stability is stressed.'}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">Constraints & Bottlenecks</h3>
                  {safeEnvelope.constraints?.length > 0 ? (
                    <div className="space-y-3">
                      {safeEnvelope.constraints.map((c: any, i: number) => {
                        const sev = safeNumber(c.severity);
                        return (
                          <div key={i} className="flex justify-between items-center border-b border-[var(--card-border)] pb-2">
                            <div>
                              <div className="text-sm font-bold text-[var(--text-primary)]">{c.name}</div>
                              <div className="text-xs text-[var(--text-muted)]">{c.description || `${Math.round(sev)}% utilization`}</div>
                            </div>
                            <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${sev > 90 ? 'badge badge-error' : sev > 70 ? 'badge badge-warning' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
                              {sev > 90 ? 'High' : sev > 70 ? 'Medium' : 'Low'} severity
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-resort-success)]/80">No active constraints detected.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[var(--text-muted)] animate-pulse">Calculating...</div>
            )}
          </section>

          {/* SECTION 10: MANAGER DECISION HISTORY */}
          <section id="audit" className="card h-[450px] flex flex-col shadow-sm !p-6">
            <h2 className="text-lg md:text-xl font-semibold font-display text-[var(--text-primary)] tracking-tight mb-6">Manager Decision History</h2>
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-secondary)] border-b border-[var(--card-border)] text-[10px] uppercase tracking-widest text-[var(--text-muted)] sticky top-0">
                    <th className="p-3 font-bold">Time</th>
                    <th className="p-3 font-bold">Request</th>
                    <th className="p-3 font-bold">Decision</th>
                    <th className="p-3 font-bold">Manager</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {auditLogs.filter(log => log.user_role === 'MANAGER' || log.user_name?.toLowerCase().includes('manager')).map((log: any) => (
                    <tr key={log._id} className="border-b border-[var(--accent-soft-border)] hover:bg-[var(--bg-secondary)]/30 transition">
                      <td className="p-3 text-[var(--text-secondary)] text-xs font-mono">{new Date(log.createdAt || log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="p-3 font-bold text-[var(--text-primary)] text-xs">{log.entity_id?.slice(-6) || 'SYS'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${log.action_type.includes('APPROVED') ? 'badge badge-success' : log.action_type.includes('REJECTED') ? 'badge badge-error' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>
                          {log.decision || log.action_type.split('_').pop()}
                        </span>
                      </td>
                      <td className="p-3 text-[var(--text-secondary)] text-xs">{log.user_name}</td>
                    </tr>
                  ))}
                  {auditLogs.filter(log => log.user_role === 'MANAGER' || log.user_name?.toLowerCase().includes('manager')).length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-[var(--text-muted)] italic">No manager decisions recorded today.</td>
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
        <div className="fixed inset-0 bg-[var(--bg-primary)]/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--card-border)] p-8 rounded-2xl w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-hide">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6 tracking-tight border-b border-[var(--card-border)] pb-4">
              {modalConfig.type} ACTION
            </h2>

            <div className="mb-6 bg-[var(--bg-secondary)] border border-[var(--card-border)] p-4 rounded-xl">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Target</div>
              <div className="text-sm font-bold text-[var(--text-primary)] mb-2">{modalConfig.card.title}</div>
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Triggering Event</div>
              <div className="text-sm text-[var(--text-secondary)]">{modalConfig.card.trigger || 'Guest Request'}</div>
            </div>

            {modalConfig.type === 'APPROVE' && (
              <div className="space-y-4 mb-6 bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--card-border)]">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">AI Classification</div>
                  <div className="text-xs font-mono bg-[var(--accent-soft)] text-[var(--accent)] px-2 py-1 rounded inline-block font-bold">
                    {modalConfig.card.autonomy_level || 'L3 MANAGER'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Recommended Department</div>
                  <div className="text-sm text-[var(--text-secondary)] font-bold uppercase">{modalConfig.card.affected_departments?.join(', ')}</div>
                </div>
              </div>
            )}

            {modalConfig.type === 'REJECT' && (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-2">Reason required:</label>
                  <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg p-3 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:outline-none" placeholder="Enter reason..." />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-3">Optional alternatives:</label>
                  <div className="space-y-3">
                    {['Not operationally required', 'Duplicate request', 'Insufficient resources', 'Unsafe to execute', 'Better alternative available', 'Other'].map(opt => (
                      <label key={opt} className="flex items-center space-x-3 text-sm text-[var(--text-secondary)] cursor-pointer">
                        <input type="radio" name="reject_reason" value={opt} onChange={() => setRejectReason(opt)} className="text-[var(--color-resort-error)] bg-[var(--bg-secondary)] border-[var(--card-border)] focus:ring-rose-500 h-4 w-4" />
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
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">Priority</label>
                    <select value={modifyData.priority} onChange={e => setModifyData({ ...modifyData, priority: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg p-2.5 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:outline-none font-bold">
                      <option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">Department</label>
                    <select value={modifyData.department} onChange={e => setModifyData({ ...modifyData, department: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg p-2.5 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:outline-none font-bold">
                      <option value="housekeeping">Housekeeping</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="fnb">F&B</option>
                      <option value="front_desk">Front Desk</option>
                      <option value="security">Security</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">Assign Staff</label>
                    <select value={modifyData.worker} onChange={e => setModifyData({ ...modifyData, worker: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg p-2.5 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:outline-none font-bold">
                      <option value="auto">Auto Assign</option>
                      {staffList.filter(s => s.department === modifyData.department).map(s => (
                        <option key={s._id} value={s.name}>{s.name} ({s.task_status})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">Est Completion (mins)</label>
                    <input type="number" value={modifyData.eta} onChange={e => setModifyData({ ...modifyData, eta: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg p-2.5 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:outline-none font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">Service Recovery</label>
                    <select value={modifyData.compensation} onChange={e => setModifyData({ ...modifyData, compensation: e.target.value })} className="w-full bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-amber-400 text-sm focus:border-amber-500 focus:outline-none font-bold">
                      <option>None</option>
                      <option>₹500 Credit</option>
                      <option>₹1000 Credit</option>
                      <option>10% Discount</option>
                      <option>Free Meal</option>
                      <option>Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">Relocation Move</label>
                    <select value={modifyData.relocation} onChange={e => setModifyData({ ...modifyData, relocation: e.target.value })} className="w-full bg-indigo-500/10 border border-[var(--accent)]/30 rounded-lg p-2.5 text-[var(--accent)] text-sm focus:border-[var(--accent)] focus:outline-none font-bold">
                      <option>No</option><option>Yes</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">Manager Instructions</label>
                  <textarea
                    value={modifyData.instructions || ''}
                    onChange={e => setModifyData({ ...modifyData, instructions: e.target.value })}
                    placeholder="Enter explicit instructions for staff to follow..."
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg p-3 text-[var(--text-primary)] text-sm h-24 focus:border-[var(--accent)] focus:outline-none font-mono"
                  ></textarea>
                </div>
              </div>
            )}

            <div className="flex space-x-3 mt-8 pt-4 border-t border-[var(--card-border)]">
              <button onClick={() => setModalConfig({ type: null, card: null })} className="flex-1 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] font-bold rounded-xl uppercase tracking-wider transition">
                CANCEL
              </button>
              <button
                onClick={() => handleActionCard(modalConfig.card.action_id || modalConfig.card._id, modalConfig.type!, { reason: rejectReason, modifications: modifyData })}
                disabled={modalConfig.type === 'REJECT' && !rejectReason}
                className={`flex-1 py-3 font-bold rounded-xl uppercase tracking-wider transition shadow-[var(--card-shadow)] ${modalConfig.type === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50 text-[var(--text-primary)]' :
                  modalConfig.type === 'REJECT' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/50 text-[var(--text-primary)] disabled:opacity-50' :
                    'bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--on-accent)] transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-indigo-900/50 '
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
