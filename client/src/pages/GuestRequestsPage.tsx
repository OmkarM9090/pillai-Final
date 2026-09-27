import { useState, useEffect, useCallback } from 'react';

const JWT = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-500/20 text-amber-400',
  CLASSIFIED: 'bg-amber-500/20 text-amber-400',
  ASSIGNED: 'bg-indigo-500/20 text-indigo-400',
  ACCEPTED: 'bg-blue-500/20 text-blue-400',
  IN_PROGRESS: 'bg-sky-500/20 text-sky-400',
  COMPLETED: 'bg-emerald-500/20 text-emerald-400',
  VERIFIED: 'bg-emerald-600/20 text-emerald-300',
  DECLINED: 'bg-rose-500/20 text-rose-400',
  ESCALATED: 'bg-rose-500/20 text-rose-400',
  BLOCKED: 'bg-rose-500/20 text-rose-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-rose-500/25 text-rose-300', P0: 'bg-rose-500/25 text-rose-300',
  HIGH: 'bg-rose-500/20 text-rose-400', P1: 'bg-rose-500/20 text-rose-400',
  MEDIUM: 'bg-amber-500/20 text-amber-400', P2: 'bg-amber-500/20 text-amber-400',
  LOW: 'bg-slate-700 text-slate-300', P3: 'bg-slate-700 text-slate-300', P4: 'bg-slate-700 text-slate-300',
};

type ModalState = { type: 'APPROVE' | 'DECLINE' | 'MODIFY' | null; req: any };

export function GuestRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [observations, setObservations] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [modal, setModal] = useState<ModalState>({ type: null, req: null });
  const [reason, setReason] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [modifyData, setModifyData] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    try {
      const [reqRes, fbRes, obsRes, staffRes] = await Promise.all([
        fetch('/api/v1/manager/guest-requests', { headers: JWT() }),
        fetch('/api/v1/manager/feedback', { headers: JWT() }),
        fetch('/api/v1/manager/observations', { headers: JWT() }),
        fetch('/api/v1/staff', { headers: JWT() }),
      ]);
      const [reqJson, fbJson, obsJson, staffJson] = await Promise.all([reqRes.json(), fbRes.json(), obsRes.json(), staffRes.json()]);
      if (reqJson.success) setRequests(reqJson.data);
      if (fbJson.success) { setFeedback(fbJson.data.feedback); setAvgRating(fbJson.data.average_rating); }
      if (obsJson.success) setObservations(obsJson.data);
      if (staffJson.success) setStaffList(staffJson.data);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      setError('Unable to reach the operations API. Retrying automatically…');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 6000); // live polling fallback for realtime
    return () => clearInterval(interval);
  }, [fetchAll]);

  const decide = async (id: string, action: 'approve' | 'decline' | 'modify', body: any) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/guest-requests/${id}/${action}`, {
        method: 'PATCH',
        headers: { ...JWT(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setToast(`${action === 'approve' ? 'Approved & dispatched' : action === 'decline' ? 'Declined & guest notified' : 'Modified & reassigned'} — ${id}`);
        setModal({ type: null, req: null });
        setReason(''); setApproveNote(''); setModifyData({});
        fetchAll();
      } else {
        setToast(`⚠ ${json.message || 'Action failed'}`);
      }
    } catch {
      setToast('⚠ Network error — action not saved.');
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 5000);
    }
  };

  const pendingApproval = requests.filter(r => ['PENDING_APPROVAL', 'CLASSIFIED'].includes(r.status));
  const escalated = requests.filter(r => ['ESCALATED', 'BLOCKED', 'REJECTED'].includes(r.status));
  const active = requests.filter(r => ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ROUTED', 'CREATED'].includes(r.status));
  const closed = requests.filter(r => ['COMPLETED', 'VERIFIED', 'DECLINED', 'CANCELLED'].includes(r.status));

  const visible = filter === 'ALL' ? requests
    : filter === 'PENDING' ? [...pendingApproval, ...escalated]
    : filter === 'ACTIVE' ? active
    : closed;

  const canDecide = (r: any) => !['COMPLETED', 'VERIFIED', 'DECLINED', 'CANCELLED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-sm font-bold tracking-widest uppercase">Loading Guest Requests…</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Guests <span className="text-indigo-400">/ Guest Requests</span></h1>
          <p className="text-slate-400 text-sm mt-1">Every guest request, its live state, owner and manager decision trail.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 font-bold">{pendingApproval.length + escalated.length} need decision</span>
          <span className="px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 font-bold">{active.length} active</span>
          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold">{closed.length} closed</span>
          <span className="text-slate-500 ml-2">updated {lastUpdated.toLocaleTimeString()} · live</span>
        </div>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-xl px-4 py-3">{error}</div>}
      {toast && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl px-4 py-3">{toast}</div>}

      {/* Filters */}
      <div className="flex gap-2">
        {['ALL', 'PENDING', 'ACTIVE', 'CLOSED'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Requests table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-950 text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
                <th className="p-4 font-bold">Request</th>
                <th className="p-4 font-bold">Guest / Room</th>
                <th className="p-4 font-bold">Category</th>
                <th className="p-4 font-bold">Priority</th>
                <th className="p-4 font-bold">Department</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold">Assigned</th>
                <th className="p-4 font-bold">Created</th>
                <th className="p-4 font-bold text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {visible.length === 0 && (
                <tr><td colSpan={9} className="p-10 text-center text-slate-500 italic">No requests in this view.</td></tr>
              )}
              {visible.map((r: any) => (
                <tr key={r.request_id} className="hover:bg-slate-800/30 transition align-top">
                  <td className="p-4 max-w-xs">
                    <div className="font-bold text-white">{r.request_id}</div>
                    <div className="text-slate-300 text-xs mt-1">{r.request_text}</div>
                    {r.original_request_text && (
                      <div className="text-[10px] text-amber-400/80 mt-1">Original: “{r.original_request_text}”</div>
                    )}
                    {r.resolution_notes && <div className="text-[10px] text-indigo-300/80 mt-1">Note: {r.resolution_notes}</div>}
                    {r.manager_decision && (
                      <div className={`text-[10px] mt-1 font-bold ${r.manager_decision.decision === 'DECLINE' ? 'text-rose-400' : r.manager_decision.decision === 'MODIFY' ? 'text-indigo-300' : 'text-emerald-400'}`}>
                        {r.manager_decision.decision} by {r.manager_decision.by}{r.manager_decision.reason ? ` — ${r.manager_decision.reason}` : ''}
                      </div>
                    )}
                    {r.rejection_reason && <div className="text-[10px] text-rose-400/80 mt-1">Rejected: {r.rejection_reason}</div>}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-white text-xs">{r.guest_name}</div>
                    <div className="text-slate-400 text-xs">Room {r.room_number}</div>
                  </td>
                  <td className="p-4 text-xs text-slate-300 uppercase font-bold">{r.intent}</td>
                  <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLORS[r.priority] ?? 'bg-slate-700 text-slate-300'}`}>{r.priority}</span></td>
                  <td className="p-4 text-xs text-slate-300 capitalize">{r.department}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[r.status] ?? 'bg-slate-800 text-slate-300'}`}>{String(r.status).replace('_', ' ')}</span></td>
                  <td className="p-4 text-xs text-slate-300">{r.assigned_staff || <span className="text-slate-500 italic">unassigned</span>}</td>
                  <td className="p-4 text-xs text-slate-500 whitespace-nowrap">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-4">
                    {canDecide(r) && (
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => { setModal({ type: 'APPROVE', req: r }); setApproveNote(''); }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded uppercase transition">Approve</button>
                        <button onClick={() => { setModal({ type: 'MODIFY', req: r }); setReason(''); setModifyData({ priority: r.priority, department: r.department, assigned_staff: 'auto', instructions: r.resolution_notes || '' }); }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded uppercase transition">Modify</button>
                        <button onClick={() => { setModal({ type: 'DECLINE', req: r }); setReason(''); }}
                          className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white text-[10px] font-bold rounded uppercase transition">Decline</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feedback + Observations split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Guest feedback */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Guest Feedback</h2>
            {avgRating != null && <span className="text-amber-400 font-black text-lg">{avgRating}★ <span className="text-xs text-slate-500 font-bold">avg · {feedback.length}</span></span>}
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {feedback.length === 0 ? (
              <div className="text-slate-500 text-sm italic text-center py-8">No feedback yet — it unlocks for guests once a task is completed.</div>
            ) : feedback.map((f: any) => (
              <div key={f.request_id} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-amber-400 font-bold">{'★'.repeat(f.guest_rating)}{'☆'.repeat(5 - f.guest_rating)}</span>
                    <span className="text-xs text-slate-400 ml-2">Room {f.room_number} · {f.request_id}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{f.completed_at ? new Date(f.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
                <div className="text-sm text-slate-200 mt-2">“{f.guest_feedback || 'No written comment'}”</div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Request: {f.request_text} · Staff: <span className="text-slate-300 font-bold">{f.assigned_staff || '—'}</span> · Dept: {f.department}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Staff observations */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Staff On-Site Observations</h2>
            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-xs font-bold">{observations.length}</span>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {observations.length === 0 ? (
              <div className="text-slate-500 text-sm italic text-center py-8">No observations logged by staff yet.</div>
            ) : observations.map((o: any) => (
              <div key={o.observation_id} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-white">{o.staff_name} · Room {o.room_number ?? 'n/a'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${o.status === 'ROUTED' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700 text-slate-300'}`}>{o.status}</span>
                </div>
                <div className="text-sm text-slate-200 mt-2">“{o.note}”</div>
                <div className="text-[11px] text-slate-500 mt-2">
                  During {o.task_id ?? 'round'} · {new Date(o.createdAt).toLocaleString()}
                  {o.routed_ticket_id && <> → ticket <span className="text-indigo-300 font-bold">{o.routed_ticket_id}</span> ({o.department})</>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Decision modal */}
      {modal.type && modal.req && (
        <div className="fixed inset-0 bg-[#0B1120]/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-black text-white mb-4 uppercase tracking-widest border-b border-slate-800 pb-4">{modal.type} — {modal.req.request_id}</h2>
            <div className="mb-5 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm">
              <div className="text-slate-300">“{modal.req.request_text}”</div>
              <div className="text-xs text-slate-500 mt-2">Room {modal.req.room_number} · {modal.req.guest_name} · {modal.req.intent} · {modal.req.priority}</div>
            </div>

            {modal.type === 'APPROVE' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-400">Approving assigns an eligible <span className="text-white font-bold">{modal.req.department}</span> worker immediately, notifies them and the guest, and writes an audit record.</div>
                <input value={approveNote} onChange={e => setApproveNote(e.target.value)} placeholder="Optional instruction note for staff…"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
            )}

            {modal.type === 'DECLINE' && (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">Declining notifies the guest with your reason. <span className="text-rose-400 font-bold">A reason is required.</span></div>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason shown to the guest…" rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm focus:border-rose-500 focus:outline-none" />
              </div>
            )}

            {modal.type === 'MODIFY' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Priority</label>
                    <select value={modifyData.priority} onChange={e => setModifyData({ ...modifyData, priority: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm">
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Department</label>
                    <select value={modifyData.department} onChange={e => setModifyData({ ...modifyData, department: e.target.value, assigned_staff: 'auto' })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm">
                      {['housekeeping', 'maintenance', 'fnb', 'front_desk', 'security', 'spa', 'it'].map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Assign staff</label>
                    <select value={modifyData.assigned_staff} onChange={e => setModifyData({ ...modifyData, assigned_staff: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm">
                      <option value="auto">Auto-assign (best eligible: availability × skill × workload)</option>
                      {staffList.filter(s => s.department === modifyData.department).map(s => (
                        <option key={s._id} value={s.name}>{s.name} ({s.task_status}{!s.is_available ? ', off-shift' : ''})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Modified instructions (original text is preserved)</label>
                  <textarea value={modifyData.instructions} onChange={e => setModifyData({ ...modifyData, instructions: e.target.value })} rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm focus:border-indigo-500 focus:outline-none" />
                </div>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for modification (audited)…"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm focus:border-indigo-500 focus:outline-none" />
              </div>
            )}

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-800">
              <button onClick={() => setModal({ type: null, req: null })} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl uppercase text-xs tracking-wider transition">Cancel</button>
              <button disabled={busy || (modal.type === 'DECLINE' && !reason.trim())}
                onClick={() => {
                  if (modal.type === 'APPROVE') decide(modal.req.request_id, 'approve', { note: approveNote });
                  if (modal.type === 'DECLINE') decide(modal.req.request_id, 'decline', { reason });
                  if (modal.type === 'MODIFY') decide(modal.req.request_id, 'modify', { ...modifyData, reason });
                }}
                className={`flex-1 py-3 text-white font-bold rounded-xl uppercase text-xs tracking-wider transition disabled:opacity-50 ${modal.type === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500' : modal.type === 'DECLINE' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                {busy ? 'Working…' : modal.type === 'APPROVE' ? 'Approve & Dispatch' : modal.type === 'DECLINE' ? 'Decline Request' : 'Save & Reassign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
