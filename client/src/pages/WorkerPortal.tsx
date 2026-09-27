import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const JWT = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const OPEN = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'assigned', 'acknowledged', 'in_progress', 'todo', 'created', 'ROUTED'];
const DONELIST = ['COMPLETED', 'VERIFIED', 'completed', 'DECLINED', 'closed'];

export function WorkerPortal() {
  const { currentUser } = useAuth();
  const isWorker = currentUser?.role === 'WORKER' || currentUser?.role === 'STAFF';

  // Workers act as themselves ('me' is resolved server-side to their roster identity).
  // Managers/supervisors can additionally peek at any roster member for demo/oversight.
  const [viewAs, setViewAs] = useState<string>('me');
  const [staffOptions, setStaffOptions] = useState<string[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [ownDepartment, setOwnDepartment] = useState<string>('');
  const [staffName, setStaffName] = useState<string>('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [blockNotes, setBlockNotes] = useState<Record<string, string>>({});
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [openObs, setOpenObs] = useState<Record<string, boolean>>({});

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/worker-tasks/${encodeURIComponent(viewAs)}`, { headers: JWT() });
      const json = await res.json();
      if (json.success) {
        setStaffName(json.staffName || '');
        setOwnDepartment(json.ownDepartment || '');
        const combined = [
          ...(json.guestRequests || []).map((r: any) => ({ ...r, type: 'GuestRequest', id: r.request_id })),
          ...(json.operationalTickets || []).map((t: any) => ({ ...t, type: 'OperationalTicket', id: t.ticket_id })),
        ];
        combined.sort((a: any, b: any) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime());
        setTasks(combined);
        const dq = [
          ...(json.departmentQueue?.guestRequests || []).map((r: any) => ({ ...r, type: 'GuestRequest', id: r.request_id })),
          ...(json.departmentQueue?.operationalTickets || []).map((t: any) => ({ ...t, type: 'OperationalTicket', id: t.ticket_id })),
        ];
        setQueue(dq);
        setError(null);
      }
      const nRes = await fetch('/api/v1/notifications', { headers: JWT() });
      const nJson = await nRes.json();
      if (nJson.success) setNotifications(nJson.data.notifications.slice(0, 6));
    } catch {
      setError('Connectivity issue — retrying automatically.');
    }
  }, [viewAs]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 4000); // polling fallback for realtime
    return () => clearInterval(interval);
  }, [fetchTasks]);

  useEffect(() => {
    if (!isWorker) {
      fetch('/api/v1/staff', { headers: JWT() }).then(r => r.json()).then(j => {
        if (j.success) setStaffOptions(j.data.map((s: any) => s.name));
      }).catch(() => undefined);
    }
  }, [isWorker]);

  const act = async (taskId: string, action: string, body: any) => {
    setLoading(taskId + action);
    setToast(null);
    try {
      const res = await fetch(`/api/v1/worker-tasks/${taskId}/${action}`, {
        method: 'PATCH',
        headers: { ...JWT(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) setToast(`⚠ ${json.message || 'Action failed'}`);
      else {
        if (action === 'complete') setToast(`✓ ${taskId} completed — guest can now leave feedback`);
        await fetchTasks();
      }
      return json;
    } catch {
      setToast('⚠ Network error — not saved.');
      return null;
    } finally {
      setLoading(null);
    }
  };

  const submitObservation = async (task: any) => {
    const note = (observations[task.id] || '').trim();
    if (note.length < 3) { setToast('⚠ Enter an observation first.'); return; }
    setLoading(task.id + 'obs');
    try {
      const res = await fetch(`/api/v1/worker-tasks/${task.id}/observation`, {
        method: 'POST',
        headers: { ...JWT(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, room_number: task.room_number }),
      });
      const json = await res.json();
      if (json.success) {
        const t = json.data?.routed_ticket;
        setToast(t ? `✓ Observation logged & routed to ${t.department} (${t.ticket_id})` : '✓ Observation logged for the duty manager');
        setObservations({ ...observations, [task.id]: '' });
        setOpenObs({ ...openObs, [task.id]: false });
      } else {
        setToast(`⚠ ${json.message || 'Observation failed'}`);
      }
    } catch {
      setToast('⚠ Network error — observation not saved.');
    } finally {
      setLoading(null);
    }
  };

  const activeTasks = tasks.filter(t => OPEN.includes(t.status));
  const completedTasks = tasks.filter(t => DONELIST.includes(t.status));

  const taskCard = (task: any, isQueue = false) => {
    const myTask = !isQueue;
    return (
      <div key={task.id} className={`bg-[var(--bg-card)] border rounded-xl p-5 shadow-[var(--card-shadow)] border-l-4 ${isQueue ? 'border-[var(--border-color)] border-l-[var(--text-muted)]' : 'border-[var(--border-color)] border-l-indigo-500'}`}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-md text-[11px] font-bold">{task.id}</span>
              <span className="text-[var(--text-secondary)] text-sm">Room {task.room_number || 'N/A'}</span>
              {isQueue && <span className="px-2 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded text-[10px] uppercase font-bold">Dept queue · {task.assigned_staff || task.assigned_to || 'unassigned'}</span>}
              {(task.priority === 'P0' || task.priority === 'CRITICAL' || task.priority === 'Critical') ? (
                <span className="px-2 py-0.5 badge badge-error rounded text-[10px] uppercase font-bold">🚨 {task.priority}</span>
              ) : (
                <span className="px-2 py-0.5 badge badge-warning rounded text-[10px] uppercase font-bold">Priority: {task.priority || 'P3'}</span>
              )}
              {(task.sla_target_resolution_mins || task.sla_deadline) && (
                <span className="px-2 py-0.5 bg-sky-500/15 text-sky-300 rounded text-[10px] font-bold">
                  SLA: {task.sla_target_resolution_mins ? `${task.sla_target_resolution_mins} min` : new Date(task.sla_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="text-[var(--text-primary)] text-lg font-medium">{task.request_text || task.title}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Source: {task.type === 'GuestRequest' ? `Guest request · ${task.guest_name || ''}` : `Operational ticket · ${task.source || 'system'}`}
            </div>
            {task.equipment_needed?.length > 0 && (
              <div className="text-xs text-[var(--text-muted)] mt-1"><strong>Required:</strong> {task.equipment_needed.join(', ')}</div>
            )}
          </div>
          <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase whitespace-nowrap ${
            ['ASSIGNED', 'assigned', 'todo', 'created', 'ROUTED'].includes(task.status) ? 'badge badge-warning'
            : ['ACCEPTED', 'acknowledged'].includes(task.status) ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
            : ['IN_PROGRESS', 'in_progress'].includes(task.status) ? 'badge badge-primary'
            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
          }`}>
            {String(task.status).replace('_', ' ')}
          </span>
        </div>

        {task.resolution_notes && (
          <div className="mb-3 bg-[var(--bg-secondary)] border border-[var(--card-border)] p-3 rounded-lg">
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Manager Instructions</div>
            <div className="text-sm text-amber-100">{task.resolution_notes}</div>
          </div>
        )}

        {/* State machine actions — only for own tasks (or supervisors overseeing) */}
        {myTask && OPEN.includes(task.status) && (
          <div className="mt-4 pt-4 border-t border-[var(--card-border)] space-y-3">
            {['ASSIGNED', 'assigned', 'todo', 'created', 'ROUTED'].includes(task.status) && (
              <>
                <button disabled={loading !== null} onClick={() => act(task.id, 'accept', {})}
                  className="w-full px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-[var(--text-primary)] font-medium rounded-lg transition disabled:opacity-50">
                  Accept Task
                </button>
                <div className="flex gap-3 items-center">
                  <select value={rejectionNotes[task.id] || ''} onChange={e => setRejectionNotes({ ...rejectionNotes, [task.id]: e.target.value })}
                    className="flex-1 bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-rose-500">
                    <option value="" disabled>Select rejection reason (required)…</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="wrong skill">Wrong skill</option>
                    <option value="equipment unavailable">Equipment unavailable</option>
                    <option value="shift ended">Shift ended</option>
                    <option value="unsafe">Unsafe</option>
                    <option value="other">Other</option>
                  </select>
                  <button disabled={loading !== null || !rejectionNotes[task.id]} onClick={() => act(task.id, 'reject', { reason: rejectionNotes[task.id] })}
                    className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-[var(--text-primary)] font-medium rounded-lg transition disabled:opacity-50">
                    Reject
                  </button>
                </div>
              </>
            )}

            {['ACCEPTED', 'acknowledged'].includes(task.status) && (
              <button disabled={loading !== null} onClick={() => act(task.id, 'start', {})}
                className="w-full px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] font-medium rounded-lg transition disabled:opacity-50">
                Start Work (En Route)
              </button>
            )}

            {['IN_PROGRESS', 'in_progress'].includes(task.status) && (
              <>
                <div className="flex gap-3">
                  <input type="text" placeholder="Completion note (required)…" value={completionNotes[task.id] || ''}
                    onChange={e => setCompletionNotes({ ...completionNotes, [task.id]: e.target.value })}
                    className="flex-1 bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                  <button disabled={loading !== null || !(completionNotes[task.id] || '').trim()}
                    onClick={() => act(task.id, 'complete', { completion_note: completionNotes[task.id] })}
                    className="px-6 py-2 bg-[var(--accent)] text-[var(--on-accent)] hover:bg-indigo-700  font-medium rounded-lg transition disabled:opacity-50">
                    Complete ✓
                  </button>
                </div>
                <div className="flex gap-3 items-center pt-2 border-t border-[var(--accent-soft-border)]">
                  <select value={blockNotes[task.id] || ''} onChange={e => setBlockNotes({ ...blockNotes, [task.id]: e.target.value })}
                    className="flex-1 bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-amber-500">
                    <option value="" disabled>Escalate / block reason…</option>
                    <option value="Equipment unavailable">Equipment unavailable</option>
                    <option value="Parts unavailable">Parts unavailable</option>
                    <option value="Guest unavailable">Guest unavailable</option>
                    <option value="Unsafe condition">Unsafe condition</option>
                    <option value="Other">Other</option>
                  </select>
                  <button disabled={loading !== null || !blockNotes[task.id]} onClick={() => act(task.id, 'block', { reason: blockNotes[task.id] })}
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-[var(--text-primary)] font-medium rounded-lg transition disabled:opacity-50">
                    Escalate
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Phase 9 — on-site observation (available on any active task you can see) */}
        {OPEN.includes(task.status) && (
          <div className="mt-3 pt-3 border-t border-[var(--card-border)]/60">
            {!openObs[task.id] ? (
              <button onClick={() => setOpenObs({ ...openObs, [task.id]: true })}
                className="text-xs font-bold text-teal-400 hover:text-teal-300 uppercase tracking-wider transition">
                + Log on-site observation
              </button>
            ) : (
              <div className="space-y-2">
                <textarea rows={2} value={observations[task.id] || ''} onChange={e => setObservations({ ...observations, [task.id]: e.target.value })}
                  placeholder='Noticed something else? e.g. "AC leaking + sink blocked in this room" — the right department gets a ticket automatically.'
                  className="w-full bg-[var(--bg-secondary)] border border-teal-800 rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-teal-500" />
                <div className="flex gap-2">
                  <button disabled={loading !== null || (observations[task.id] || '').trim().length < 3} onClick={() => submitObservation(task)}
                    className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-[var(--text-primary)] text-xs font-bold rounded-lg transition disabled:opacity-50">
                    {loading === task.id + 'obs' ? 'Sending…' : 'Send to Manager'}
                  </button>
                  <button onClick={() => setOpenObs({ ...openObs, [task.id]: false })} className="px-4 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs font-bold rounded-lg">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">My Tasks</h1>
          <div className="text-[var(--text-secondary)] text-sm">
            {staffName ? <span className="text-[var(--text-primary)] font-bold">{staffName}</span> : 'Frontline worker'}
            {ownDepartment && <span className="capitalize"> · {ownDepartment}</span>}
            <span className="text-[var(--text-muted)]"> · live queue</span>
          </div>
        </div>
        {!isWorker && staffOptions.length > 0 && (
          <div className="bg-[var(--bg-card)] border border-[var(--card-border)] rounded-lg p-2">
            <select value={viewAs} onChange={e => setViewAs(e.target.value)} className="bg-transparent text-[var(--text-primary)] text-sm focus:outline-none pr-2">
              <option value="me" className="bg-[var(--bg-card)]">Myself ({currentUser?.name})</option>
              {staffOptions.map(s => <option key={s} value={s} className="bg-[var(--bg-card)]">{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {toast && <div className="mb-4 bg-[var(--bg-card)] border border-[var(--accent)]/40 text-indigo-200 text-sm rounded-xl px-4 py-3">{toast}</div>}
      {error && <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-xl px-4 py-3">{error}</div>}

      {/* Latest dispatch notifications */}
      {notifications.length > 0 && (
        <div className="mb-6 bg-[var(--bg-card)]/70 border border-[var(--card-border)] rounded-xl p-4">
          <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Latest dispatches</div>
          <div className="space-y-1.5">
            {notifications.map((n: any) => (
              <div key={n._id} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.priority === 'CRITICAL' ? 'bg-rose-500' : n.priority === 'HIGH' ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
                <span className="text-[var(--text-secondary)]"><span className="font-bold text-[var(--text-primary)]">{n.title}</span> — {n.message.slice(0, 90)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Active Dispatch Queue</h2>
        {activeTasks.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--card-border)] border-dashed rounded-xl p-12 text-center text-[var(--text-muted)]">
            No active tasks assigned to you. New dispatches appear here automatically.
          </div>
        ) : activeTasks.map(t => taskCard(t))}
      </div>

      {queue.length > 0 && (
        <div className="space-y-4 mb-10">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-secondary)] capitalize">{ownDepartment} Department Queue</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Tasks assigned to colleagues in your department — visible so queues never strand a guest request.</p>
          </div>
          {queue.map(t => taskCard(t, true))}
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-[var(--text-secondary)] mb-6">Completed — Audit Trail</h2>
        <div className="space-y-3">
          {completedTasks.length === 0 && <div className="text-[var(--text-muted)] text-sm italic">Nothing completed yet today.</div>}
          {completedTasks.map(task => (
            <div key={task.id} className="bg-[var(--bg-card)]/50 border border-[var(--accent-soft-border)] rounded-lg p-4 flex justify-between items-center opacity-70">
              <div>
                <div className="text-[var(--text-secondary)] line-through text-sm">{task.request_text || task.title}</div>
                <div className="text-xs text-[var(--color-resort-success)]/80 mt-1">✓ {task.completion_note || task.resolution_notes || 'Completed'}</div>
              </div>
              <div className="text-xs text-[var(--text-muted)]">{new Date(task.completed_at || task.updatedAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
