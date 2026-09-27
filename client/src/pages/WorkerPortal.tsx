import { useState, useEffect } from 'react';

export function WorkerPortal() {
  const staffOptions = [
    'Staff H1', 'Staff H2', 
    'Staff M1', 'Staff M2', 
    'Staff FNB1', 'Staff FNB2'
  ];
  const [currentStaff, setCurrentStaff] = useState('Staff H1');
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/v1/worker-tasks/${encodeURIComponent(currentStaff)}`, { 
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
      });
      const json = await res.json();
      if (json.success) {
        const combined = [
          ...json.guestRequests.map((r: any) => ({ ...r, type: 'GuestRequest', id: r.request_id })),
          ...json.operationalTickets.map((t: any) => ({ ...t, type: 'OperationalTicket', id: t.ticket_id }))
        ];
        combined.sort((a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime());
        setTasks(combined);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000); // Polling for fast state updates
    return () => clearInterval(interval);
  }, [currentStaff]);

  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [blockNotes, setBlockNotes] = useState<Record<string, string>>({});

  const handleAction = async (taskId: string, action: 'accept' | 'reject' | 'start' | 'complete' | 'block') => {
    setLoading(true);
    try {
      let body: any = {};
      if (action === 'complete') {
        body = { completion_note: completionNotes[taskId] || 'Completed via App', staff_name: currentStaff };
      } else if (action === 'reject') {
        body = { reason: rejectionNotes[taskId] || 'Other' };
      } else if (action === 'block') {
        body = { reason: blockNotes[taskId] || 'Other' };
      }

      await fetch(`/api/v1/worker-tasks/${taskId}/${action}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      fetchTasks();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activeTasks = tasks.filter(t => !['COMPLETED', 'VERIFIED', 'REJECTED', 'completed', 'feedback_received'].includes(t.status));
  const completedTasks = tasks.filter(t => ['COMPLETED', 'VERIFIED', 'completed', 'feedback_received'].includes(t.status));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Tasks</h1>
          <div className="flex items-center space-x-3">
            <span className="text-slate-400 text-sm">Frontline Worker Interface</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <select 
            value={currentStaff}
            onChange={(e) => setCurrentStaff(e.target.value)}
            className="bg-transparent text-slate-200 text-sm focus:outline-none pr-4"
          >
            {staffOptions.map(staff => (
              <option key={staff} value={staff} className="bg-slate-900">{staff}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-6 mb-12">
        <h2 className="text-xl font-semibold text-white">Active Dispatch Queue</h2>
        {activeTasks.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-12 text-center text-slate-500">
            No active tasks. You are fully caught up!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {activeTasks.map(task => (
              <div key={task.id} className="bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-lg border-l-4 border-l-indigo-500">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-md text-[11px] font-bold">
                        {task.id}
                      </span>
                      <span className="text-slate-400 text-sm">Room {task.room_number || 'N/A'}</span>
                      {task.priority === 'P0' || task.priority === 'CRITICAL' ? (
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[10px] uppercase font-bold">🚨 {task.priority} Emergency</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] uppercase font-bold">Priority: {task.priority || 'P3'}</span>
                      )}
                    </div>
                    <div className="text-slate-100 text-lg font-medium">
                      {task.request_text || task.title}
                    </div>
                    {task.equipment_needed && task.equipment_needed.length > 0 && (
                      <div className="text-xs text-slate-500 mt-2">
                        <strong>Required Equipment:</strong> {task.equipment_needed.join(', ')}
                      </div>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase ${
                    task.status === 'ASSIGNED' ? 'bg-amber-500/20 text-amber-400' :
                    task.status === 'ACCEPTED' ? 'bg-indigo-500/20 text-indigo-400' :
                    task.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>

                {task.resolution_notes && task.status !== 'COMPLETED' && (
                  <div className="mb-4 mt-2 bg-slate-950 border border-slate-800 p-3 rounded-lg">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Manager Instructions</div>
                    <div className="text-sm text-amber-100">{task.resolution_notes}</div>
                  </div>
                )}

                {/* State Machine Actions */}
                <div className="mt-4 pt-4 border-t border-slate-800">
                  
                  {task.status === 'ASSIGNED' && (
                    <div className="space-y-3">
                      <div className="flex space-x-3">
                        <button
                          disabled={loading}
                          onClick={() => handleAction(task.id, 'accept')}
                          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-lg shadow-emerald-600/20 transition flex-1"
                        >
                          Accept Task
                        </button>
                      </div>
                      <div className="flex space-x-3 items-center">
                        <select 
                          value={rejectionNotes[task.id] || ''} 
                          onChange={e => setRejectionNotes({...rejectionNotes, [task.id]: e.target.value})}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500"
                        >
                          <option value="" disabled>Select rejection reason...</option>
                          <option value="unavailable">Unavailable</option>
                          <option value="wrong skill">Wrong skill</option>
                          <option value="equipment unavailable">Equipment unavailable</option>
                          <option value="shift ended">Shift ended</option>
                          <option value="unsafe">Unsafe</option>
                          <option value="other">Other</option>
                        </select>
                        <button
                          disabled={loading || !rejectionNotes[task.id]}
                          onClick={() => handleAction(task.id, 'reject')}
                          className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-lg shadow-rose-600/20 transition disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {task.status === 'ACCEPTED' && (
                    <button
                      disabled={loading}
                      onClick={() => handleAction(task.id, 'start')}
                      className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-600/20 transition"
                    >
                      Start Work (En Route)
                    </button>
                  )}

                  {task.status === 'IN_PROGRESS' && (
                    <div className="space-y-3">
                      <div className="flex space-x-3">
                        <input
                          type="text"
                          placeholder="Add completion notes..."
                          value={completionNotes[task.id] || ''}
                          onChange={(e) => setCompletionNotes({...completionNotes, [task.id]: e.target.value})}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          disabled={loading}
                          onClick={() => handleAction(task.id, 'complete')}
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                        >
                          Mark Completed ✓
                        </button>
                      </div>
                      <div className="flex space-x-3 items-center pt-2 border-t border-slate-800/50">
                        <select 
                          value={blockNotes[task.id] || ''} 
                          onChange={e => setBlockNotes({...blockNotes, [task.id]: e.target.value})}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        >
                          <option value="" disabled>Select block reason...</option>
                          <option value="Equipment unavailable">Equipment unavailable</option>
                          <option value="Parts unavailable">Parts unavailable</option>
                          <option value="Guest unavailable">Guest unavailable</option>
                          <option value="Unsafe condition">Unsafe condition</option>
                          <option value="Other">Other</option>
                        </select>
                        <button
                          disabled={loading || !blockNotes[task.id]}
                          onClick={() => handleAction(task.id, 'block')}
                          className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-lg shadow-amber-600/20 transition disabled:opacity-50"
                        >
                          Mark Blocked
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Fallback for OperationalTickets or older statuses */}
                  {!['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(task.status) && task.type !== 'GuestRequest' && (
                    <button
                      disabled={loading}
                      onClick={() => handleAction(task.id, 'complete')}
                      className="w-full px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition disabled:opacity-50"
                    >
                      Complete Ticket
                    </button>
                  )}

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-slate-400 mb-6">Completed Tasks Audit Log</h2>
        <div className="space-y-3">
          {completedTasks.map(task => (
            <div key={task.id} className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4 flex justify-between items-center opacity-70">
              <div>
                <div className="text-slate-300 line-through text-sm">{task.request_text || task.title}</div>
                <div className="text-xs text-emerald-500/80 mt-1">✓ {task.completion_note || 'Completed'}</div>
              </div>
              <div className="text-xs text-slate-500">
                {new Date(task.completed_at || task.updatedAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
