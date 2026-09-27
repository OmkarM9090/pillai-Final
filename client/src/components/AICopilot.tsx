// ============================================================
// FEATURE 5 — AI COPILOT / RESORT CHATBOT
// Floating, role-aware assistant available on every authenticated screen.
//   • Guests  → "Aria" concierge: weather-aware recommendations and it
//               actually dispatches real service requests into the system.
//   • Staff   → Operations copilot: live metrics, risk calls, and it can
//               run the digital twin ("what if 50 mm/h rain for 6 hours").
// Uses a cloud LLM when a key is configured, otherwise the grounded
// on-board reasoner — the user experience is identical either way.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, Sparkles, RefreshCw, CloudRain, Users, Ticket, Radio, Zap, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AiText, Badge } from './ui/Primitives';
import { IntelApi } from '../lib/intelApi';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  meta?: { provider?: string; mode?: string; intent?: string; latencyMs?: number; actions?: any[] };
}

const GUEST_PROMPTS = [
  'What is the weather like right now?',
  'What can I do today with this weather?',
  'Book me a table for dinner',
  'The AC in my room is not cooling',
];

const OPS_PROMPTS = [
  'Give me the current operations briefing',
  'What if 50 mm/h rain for 6 hours with 70 km/h wind?',
  'What are travellers posting about us?',
  'What is the staffing risk tonight?',
];

export default function AICopilot() {
  const { currentUser, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [ctx, setCtx] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const isGuest = currentUser?.role === 'GUEST';
  const prompts = isGuest ? GUEST_PROMPTS : OPS_PROMPTS;

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    IntelApi.aiStatus().then(setStatus).catch(() => undefined);
    if (msgs.length === 0) {
      setMsgs([
        {
          role: 'assistant',
          content: isGuest
            ? `Hello ${currentUser?.name?.split(' ')[0] ?? 'there'}! I'm **Aria**, your Smart Resort 360 concierge. I can check the live weather, recommend what to do today, book dining or spa, and raise any room request straight to our team. What can I do for you?`
            : `**Resort Operations Copilot** online. I'm reading the live weather feed, the public social stream and the digital twin. Ask me for a briefing, a readiness call, or run a what-if such as *"what if 45 mm/h rain for 6 hours"*.`,
          meta: { mode: 'ONBOARD' },
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy]);

  if (!isAuthenticated || !currentUser) return null;

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const res: any = await IntelApi.chat({
        message,
        history: msgs.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        roomNumber: isGuest ? '105' : undefined,
        guestId: isGuest ? currentUser._id : undefined,
      });
      setCtx(res.context);
      setMsgs((m) => [
        ...m,
        { role: 'assistant', content: res.reply, meta: { provider: res.provider, mode: res.mode, intent: res.intent, latencyMs: res.latencyMs, actions: res.actions } },
      ]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'assistant', content: `I could not reach the AI service: ${e.message}. Please retry — the live data layer is still running.`, meta: { mode: 'ERROR' } }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-5 right-5 z-[900] flex items-center gap-2 rounded-full px-4 py-3 font-bold text-white shadow-2xl transition-all hover:scale-105 ${
          open ? 'bg-[var(--bg-secondary)] shadow-black/50' : 'bg-gradient-to-r from-violet-600 to-cyan-600 shadow-violet-900/50'
        }`}
        aria-label="AI assistant"
      >
        {open ? <X size={18} /> : <Bot size={18} />}
        <span className="hidden text-[11px] uppercase tracking-wider sm:inline">{open ? 'Close' : isGuest ? 'Ask Aria' : 'AI Copilot'}</span>
        {!open && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-[900] flex h-[min(640px,80vh)] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-primary)]/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <p className="text-[13px] font-black text-white">{isGuest ? 'Aria · Resort Concierge' : 'Operations Copilot'}</p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {status?.cloudConfigured ? `${status.activeProvider} · ${status.activeModel}` : 'On-board grounded reasoner'} · live data
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-white/10 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {/* Live context strip */}
          {ctx && (
            <div className="flex flex-wrap gap-1.5 border-b border-white/5 bg-black/30 px-3 py-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-[var(--text-secondary)]">
                <CloudRain size={9} className="text-sky-400" /> {ctx.weather?.tempC}°C · {ctx.weather?.precipMm}mm · {ctx.weather?.band}
              </span>
              {!isGuest && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-[var(--text-secondary)]">
                    <Users size={9} className="text-emerald-400" /> {ctx.occupancyPct}% occupancy
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-[var(--text-secondary)]">
                    <Ticket size={9} className="text-amber-400" /> {ctx.openTickets} tickets
                  </span>
                  {ctx.socialNet !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-[var(--text-secondary)]">
                      <Radio size={9} className="text-fuchsia-400" /> sentiment {ctx.socialNet}
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                    m.role === 'user'
                      ? 'rounded-br-sm bg-gradient-to-br from-cyan-600 to-violet-600 text-white'
                      : 'rounded-bl-sm border border-white/10 bg-white/[0.04]'
                  }`}
                >
                  {m.role === 'user' ? (
                    <p className="text-[13px] leading-relaxed">{m.content}</p>
                  ) : (
                    <>
                      <AiText text={m.content} />
                      {!!m.meta?.actions?.length && (
                        <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
                          {m.meta.actions.map((a: any, k: number) => (
                            <div key={k} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5">
                              <p className="text-[11px] font-bold text-emerald-200">✓ {a.label}</p>
                              <p className="text-[10px] text-[var(--text-secondary)]">{a.detail}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {m.meta?.mode && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge tone={m.meta.mode === 'CLOUD' ? 'CALM' : m.meta.mode === 'ERROR' ? 'WARNING' : 'INFO'}>
                            {m.meta.mode === 'CLOUD' ? m.meta.provider : m.meta.mode === 'TOOL' ? 'dispatched' : 'on-board AI'}
                          </Badge>
                          {m.meta.intent && <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">intent: {m.meta.intent}</span>}
                          {!!m.meta.latencyMs && <span className="text-[9px] text-[var(--text-muted)]">{m.meta.latencyMs} ms</span>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] px-3.5 py-3">
                  <RefreshCw size={12} className="animate-spin text-cyan-400" />
                  <span className="text-[12px] text-[var(--text-secondary)]">
                    {isGuest ? 'Checking live conditions…' : 'Reading live twin + weather + social…'}
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-1.5 border-t border-white/5 px-3 py-2">
            {prompts.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={busy}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-[var(--text-secondary)] transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200 disabled:opacity-40"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-white/10 bg-black/30 p-3">
            <div className="relative flex-1">
              <MessageSquare size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={isGuest ? 'Ask Aria anything about your stay…' : 'Ask the copilot or run a what-if…'}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-[13px] text-white placeholder-slate-500 outline-none transition focus:border-cyan-400/50 focus:bg-white/10"
              />
            </div>
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 p-2.5 text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
            >
              {busy ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>

          <p className="border-t border-white/5 bg-black/40 px-3 py-1.5 text-center text-[9px] text-[var(--text-muted)]">
            <Zap size={8} className="mr-1 inline" />
            Grounded in live weather, social signals and the digital twin — no hallucinated metrics
          </p>
        </div>
      )}
    </>
  );
}
