import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function GuestPortal() {
  const { currentUser } = useAuth();
  const roomNumber = (currentUser as any)?.guestRoomNumber || '105';
  const guestId = currentUser?._id || 'GUEST_123';
  const guestName = currentUser?.name || 'Guest';
  
  const [requestText, setRequestText] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});

  const fetchData = async () => {
    try {
      // Fetch Requests
      const reqRes = await fetch('/api/v1/guest-requests', { 
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
      });
      const reqJson = await reqRes.json();
      if (reqJson.success) {
        setActiveRequests(reqJson.data.filter((r: any) => r.room_number === roomNumber));
      }

      // Fetch Conversations
      const convRes = await fetch(`/api/v1/guest/conversations/${guestId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const convJson = await convRes.json();
      if (convJson.success) {
        setConversations(convJson.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Polling
    return () => clearInterval(interval);
  }, [guestId]);

  const handleSubmit = async (textToSubmit: string = requestText) => {
    if (!textToSubmit.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/v1/guest/concierge', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, roomNumber, message: textToSubmit }),
      });
      setRequestText('');
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (requestId: string) => {
    try {
      await fetch(`/api/v1/guest-requests/${requestId}/feedback`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: feedbackNotes[requestId] || '',
          rating: ratings[requestId] || 5,
        }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[clamp(1.8rem,4vw,2.5rem)] font-[800] font-display tracking-tight text-[var(--text-primary)] tracking-tight mb-2">Guest AI Concierge</h1>
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 rounded-full text-sm font-bold">
              Room {roomNumber} - Deluxe Ocean View
            </span>
            <span className="text-[var(--text-secondary)] text-sm">Welcome back, {guestName}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Quick Actions & Active Requests */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[var(--bg-card)] border border-[var(--card-border)] rounded-[1.5rem] p-5 shadow-[var(--card-shadow)]">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Towels', query: 'I need two extra towels' },
                { label: 'Cleaning', query: 'Please clean my room' },
                { label: 'Food', query: 'Can I get dinner in my room?' },
                { label: 'AC Issue', query: 'The AC in my room is not working' },
                { label: 'WiFi', query: 'The WiFi is too slow' },
                { label: 'Emergency', query: 'There is smoke in the room' }
              ].map(action => (
                <button 
                  key={action.label}
                  onClick={() => handleSubmit(action.query)}
                  disabled={loading}
                  className={`text-left px-3 py-2 border rounded-[1rem] text-xs font-semibold transition ${action.label === 'Emergency' ? 'bg-rose-950/30 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--card-border)] rounded-[1.5rem] p-5 shadow-[var(--card-shadow)] min-h-[300px]">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Active Requests</h2>
            <div className="space-y-4">
              {activeRequests.filter(req => req.status !== 'VERIFIED').length === 0 ? (
                <div className="text-[var(--text-muted)] text-xs italic text-center py-10">No active requests.</div>
              ) : (
                activeRequests.filter(req => req.status !== 'VERIFIED').map(req => (
                  <div key={req.request_id} className="bg-[var(--accent-soft)] border border-[var(--border-color)] rounded-[1rem] p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-[var(--text-primary)] text-sm capitalize">{req.intent.replace('_', ' ')}</div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        req.priority === 'CRITICAL' || req.priority === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                      }`}>
                        {req.priority}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mt-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--text-secondary)]">Department</span>
                        <span className="text-[var(--text-primary)] capitalize">{req.department}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--text-secondary)]">Status</span>
                        <span className={`font-bold ${
                          req.status === 'COMPLETED' ? 'text-emerald-400' :
                          req.status === 'IN_PROGRESS' ? 'text-[var(--accent)]' :
                          'text-amber-400'
                        }`}>
                          {req.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--text-secondary)]">Assigned Staff</span>
                        <span className="text-[var(--text-primary)]">{req.assigned_staff || 'Pending...'}</span>
                      </div>
                      
                      {/* Simple Progress Bar */}
                      <div className="w-full bg-[var(--bg-secondary)] rounded-full h-1 mt-2">
                        <div className={`h-full rounded-full transition-all ${req.status === 'COMPLETED' ? 'w-full bg-emerald-500' : req.status === 'IN_PROGRESS' ? 'w-2/3 bg-indigo-500' : 'w-1/3 bg-amber-500'}`}></div>
                      </div>
                    </div>

                    {req.status === 'COMPLETED' && (
                      <div className="mt-4 pt-4 border-t border-[var(--border-color)] space-y-4">
                        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-[1rem] p-4">
                          <div className="flex items-center space-x-2 text-emerald-400 font-bold mb-2">
                            <span>✓</span>
                            <span>REQUEST RESOLVED</span>
                          </div>
                          <div className="text-sm text-[var(--text-secondary)] mb-3">
                            Your request regarding "{req.request_text}" has been resolved.
                          </div>
                          {req.resolution_notes && (
                            <div className="mb-3">
                              <span className="text-xs text-[var(--text-secondary)] block mb-1">Resolution:</span>
                              <span className="text-sm text-[var(--text-primary)]">{req.resolution_notes}</span>
                            </div>
                          )}
                          {req.compensation_offered && req.compensation_offered !== 'None' && (
                            <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded">
                              <span className="text-xs text-amber-500 font-bold block mb-1">COMPENSATION APPLIED:</span>
                              <span className="text-sm text-amber-200">{req.compensation_offered} applied to your folio</span>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="text-[var(--text-muted)] block">Completed by:</span>
                              <span className="text-[var(--text-secondary)] font-medium">{req.assigned_staff || 'Our Team'}</span>
                            </div>
                            <div>
                              <span className="text-[var(--text-muted)] block">Time:</span>
                              <span className="text-[var(--text-secondary)] font-medium">
                                {req.updatedAt ? new Date(req.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Recently'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 text-xs text-[var(--text-secondary)] italic">
                            We apologize for the inconvenience.
                          </div>
                        </div>

                        {/* Feedback Section */}
                        <div className="bg-[var(--bg-secondary)] rounded-[1rem] p-4">
                          <div className="text-sm font-semibold text-[var(--text-primary)] mb-2 text-center">Was the issue resolved satisfactorily?</div>
                          <div className="flex space-x-2 mb-4 justify-center">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={() => setRatings({ ...ratings, [req.request_id]: star })}
                                className={`text-2xl hover:scale-110 transition-transform ${
                                  (ratings[req.request_id] || 5) >= star ? 'text-amber-400 drop-shadow-md' : 'text-[var(--text-muted)]'
                                }`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-col space-y-2">
                            <input
                              type="text"
                              placeholder="Any additional feedback? (Optional)"
                              value={feedbackNotes[req.request_id] || ''}
                              onChange={(e) => setFeedbackNotes({ ...feedbackNotes, [req.request_id]: e.target.value })}
                              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                            />
                            <button
                              onClick={() => handleFeedback(req.request_id)}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-[var(--text-primary)] rounded-lg text-sm font-bold transition shadow-[var(--card-shadow)]"
                            >
                              Submit Feedback
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Conversation */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="bg-[var(--bg-card)] border border-[var(--card-border)] rounded-[1.5rem] p-6 shadow-[var(--card-shadow)] flex-1 flex flex-col h-[600px]">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-6 border-b border-[var(--card-border)] pb-4">Conversation</h2>
            
            <div className="flex-1 overflow-y-auto pr-4 space-y-6">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                  <div className="text-5xl mb-4">✨</div>
                  <p className="text-sm">Your AI Concierge is ready to assist.</p>
                </div>
              ) : (
                conversations.map((conv, i) => {
                  const req = activeRequests.find(r => r.request_id === conv.request_id);
                  return (
                    <div key={i} className="space-y-4">
                      {/* Guest Message */}
                      <div className="flex justify-end">
                        <div className="bg-[var(--accent)] text-[var(--on-accent)]  px-5 py-3 rounded-[1.5rem] rounded-tr-sm max-w-[80%] text-sm shadow-md">
                          {conv.message}
                        </div>
                      </div>

                      {/* AI Response */}
                      <div className="flex justify-start">
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] px-5 py-4 rounded-[1.5rem] rounded-tl-sm max-w-[90%] text-sm shadow-md space-y-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">🤖</span>
                            <span className="font-bold text-xs text-[var(--accent)]">Resort AI</span>
                          </div>
                          
                          <p className="text-[var(--text-primary)] leading-relaxed">{conv.response}</p>
                          
                          {/* System Action Indicator */}
                          <div className="bg-[var(--bg-card)]/50 border border-[var(--border-color)]/50 rounded-[1rem] p-3 flex flex-wrap gap-4 mt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 text-xs">✓</span>
                              <span className="text-xs text-[var(--text-secondary)]">Request: <span className="font-bold text-[var(--text-primary)] capitalize">{conv.intent.replace('_', ' ')}</span></span>
                            </div>
                            {req && req.assigned_staff && (
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-400 text-xs">✓</span>
                                <span className="text-xs text-[var(--text-secondary)]">Staff: <span className="font-bold text-[var(--text-primary)]">{req.assigned_staff}</span></span>
                              </div>
                            )}
                            {conv.estimated_minutes && (
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--accent)] text-xs">⏱</span>
                                <span className="text-xs text-[var(--text-secondary)]">ETA: <span className="font-bold text-[var(--text-primary)]">{conv.estimated_minutes} min</span></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-[var(--card-border)] flex gap-3">
              <input
                type="text"
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
                placeholder="Tell us what you need..."
                className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[1rem] px-4 py-3 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)] transition"
              />
              <button 
                onClick={() => handleSubmit()}
                disabled={loading || !requestText.trim()}
                className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--on-accent)] transition-transform hover:scale-[1.02] active:scale-[0.98]  font-bold rounded-[1rem] shadow-[var(--card-shadow)] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
              >
                {loading ? (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
