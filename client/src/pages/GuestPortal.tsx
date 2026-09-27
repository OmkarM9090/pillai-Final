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
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Guest AI Concierge</h1>
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-sm font-bold">
              Room {roomNumber} - Deluxe Ocean View
            </span>
            <span className="text-slate-400 text-sm">Welcome back, {guestName}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Quick Actions & Active Requests */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h2>
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
                  className={`text-left px-3 py-2 border rounded-xl text-xs font-semibold transition ${action.label === 'Emergency' ? 'bg-rose-950/30 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl min-h-[300px]">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Active Requests</h2>
            <div className="space-y-4">
              {activeRequests.filter(req => req.status !== 'VERIFIED').length === 0 ? (
                <div className="text-slate-500 text-xs italic text-center py-10">No active requests.</div>
              ) : (
                activeRequests.filter(req => req.status !== 'VERIFIED').map(req => (
                  <div key={req.request_id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-white text-sm capitalize">{req.intent.replace('_', ' ')}</div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        req.priority === 'CRITICAL' || req.priority === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {req.priority}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mt-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Department</span>
                        <span className="text-slate-200 capitalize">{req.department}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Status</span>
                        <span className={`font-bold ${
                          req.status === 'COMPLETED' ? 'text-emerald-400' :
                          req.status === 'IN_PROGRESS' ? 'text-indigo-400' :
                          'text-amber-400'
                        }`}>
                          {req.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Assigned Staff</span>
                        <span className="text-slate-200">{req.assigned_staff || 'Pending...'}</span>
                      </div>
                      
                      {/* Simple Progress Bar */}
                      <div className="w-full bg-slate-700 rounded-full h-1 mt-2">
                        <div className={`h-full rounded-full transition-all ${req.status === 'COMPLETED' ? 'w-full bg-emerald-500' : req.status === 'IN_PROGRESS' ? 'w-2/3 bg-indigo-500' : 'w-1/3 bg-amber-500'}`}></div>
                      </div>
                    </div>

                    {req.status === 'COMPLETED' && (
                      <div className="mt-4 pt-4 border-t border-slate-700 space-y-4">
                        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4">
                          <div className="flex items-center space-x-2 text-emerald-400 font-bold mb-2">
                            <span>✓</span>
                            <span>REQUEST RESOLVED</span>
                          </div>
                          <div className="text-sm text-slate-300 mb-3">
                            Your request regarding "{req.request_text}" has been resolved.
                          </div>
                          {req.resolution_notes && (
                            <div className="mb-3">
                              <span className="text-xs text-slate-400 block mb-1">Resolution:</span>
                              <span className="text-sm text-slate-200">{req.resolution_notes}</span>
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
                              <span className="text-slate-500 block">Completed by:</span>
                              <span className="text-slate-300 font-medium">{req.assigned_staff || 'Our Team'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Time:</span>
                              <span className="text-slate-300 font-medium">
                                {req.updatedAt ? new Date(req.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Recently'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 text-xs text-slate-400 italic">
                            We apologize for the inconvenience.
                          </div>
                        </div>

                        {/* Feedback Section */}
                        <div className="bg-slate-800 rounded-xl p-4">
                          <div className="text-sm font-semibold text-white mb-2 text-center">Was the issue resolved satisfactorily?</div>
                          <div className="flex space-x-2 mb-4 justify-center">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={() => setRatings({ ...ratings, [req.request_id]: star })}
                                className={`text-2xl hover:scale-110 transition-transform ${
                                  (ratings[req.request_id] || 5) >= star ? 'text-amber-400 drop-shadow-md' : 'text-slate-600'
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
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              onClick={() => handleFeedback(req.request_id)}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition shadow-lg"
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex-1 flex flex-col h-[600px]">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 border-b border-slate-800 pb-4">Conversation</h2>
            
            <div className="flex-1 overflow-y-auto pr-4 space-y-6">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
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
                        <div className="bg-indigo-600 text-white px-5 py-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm shadow-md">
                          {conv.message}
                        </div>
                      </div>

                      {/* AI Response */}
                      <div className="flex justify-start">
                        <div className="bg-slate-800 border border-slate-700 px-5 py-4 rounded-2xl rounded-tl-sm max-w-[90%] text-sm shadow-md space-y-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">🤖</span>
                            <span className="font-bold text-xs text-indigo-400">Resort AI</span>
                          </div>
                          
                          <p className="text-slate-200 leading-relaxed">{conv.response}</p>
                          
                          {/* System Action Indicator */}
                          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 flex flex-wrap gap-4 mt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 text-xs">✓</span>
                              <span className="text-xs text-slate-300">Request: <span className="font-bold text-white capitalize">{conv.intent.replace('_', ' ')}</span></span>
                            </div>
                            {req && req.assigned_staff && (
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-400 text-xs">✓</span>
                                <span className="text-xs text-slate-300">Staff: <span className="font-bold text-white">{req.assigned_staff}</span></span>
                              </div>
                            )}
                            {conv.estimated_minutes && (
                              <div className="flex items-center gap-2">
                                <span className="text-indigo-400 text-xs">⏱</span>
                                <span className="text-xs text-slate-300">ETA: <span className="font-bold text-white">{conv.estimated_minutes} min</span></span>
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
            
            <div className="mt-4 pt-4 border-t border-slate-800 flex gap-3">
              <input
                type="text"
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
                placeholder="Tell us what you need..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition"
              />
              <button 
                onClick={() => handleSubmit()}
                disabled={loading || !requestText.trim()}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
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
