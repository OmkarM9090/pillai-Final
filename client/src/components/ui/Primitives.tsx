// ============================================================
// Shared UI primitives for the live-intelligence surfaces.
// Dark "mission control" design language: glass panels, tight type,
// semantic colour for severity, zero external chart dependencies.
// ============================================================

import type { ReactNode } from 'react';

export const SEVERITY_STYLE: Record<string, { text: string; bg: string; border: string; dot: string; glow: string }> = {
  CALM: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400', glow: 'shadow-emerald-500/20' },
  INFO: { text: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-500/30', dot: 'bg-sky-400', glow: 'shadow-sky-500/20' },
  ADVISORY: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400', glow: 'shadow-amber-500/20' },
  WATCH: { text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-400', glow: 'shadow-orange-500/20' },
  WARNING: { text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/30', dot: 'bg-rose-400', glow: 'shadow-rose-500/20' },
  SEVERE: { text: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/40', dot: 'bg-red-400', glow: 'shadow-red-500/30' },
  ALERT: { text: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/40', dot: 'bg-red-400', glow: 'shadow-red-500/30' },
  NORMAL: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400', glow: 'shadow-emerald-500/20' },
  AT_RISK: { text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-400', glow: 'shadow-orange-500/20' },
  CRITICAL: { text: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/40', dot: 'bg-red-400', glow: 'shadow-red-500/30' },
  STABLE: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400', glow: 'shadow-emerald-500/20' },
  ELEVATED: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400', glow: 'shadow-amber-500/20' },
  HIGH: { text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-400', glow: 'shadow-orange-500/20' },
};

export const sev = (band?: string) => SEVERITY_STYLE[(band || 'INFO').toUpperCase()] ?? SEVERITY_STYLE.INFO;

export function Panel({ children, className = '', title, subtitle, icon, action }: {
  children: ReactNode; className?: string; title?: string; subtitle?: string; icon?: ReactNode; action?: ReactNode;
}) {
  return (
    <section className={`relative rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/40 ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-start gap-3 min-w-0">
            {icon && <div className="mt-0.5 text-cyan-300 shrink-0">{icon}</div>}
            <div className="min-w-0">
              {title && <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-200 truncate">{title}</h2>}
              {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = 'INFO', className = '', pulse = false }: { children: ReactNode; tone?: string; className?: string; pulse?: boolean }) {
  const s = sev(tone);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.border} ${s.text} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${pulse ? 'animate-pulse' : ''}`} />
      {children}
    </span>
  );
}

export function StatTile({ label, value, unit, sub, tone = 'INFO', icon, compact = false }: {
  label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: string; icon?: ReactNode; compact?: boolean;
}) {
  const s = sev(tone);
  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} ${compact ? 'p-3' : 'p-4'} transition hover:scale-[1.015] hover:shadow-lg ${s.glow}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        {icon && <span className={s.text}>{icon}</span>}
      </div>
      <div className={`mt-1.5 font-black text-white leading-none ${compact ? 'text-xl' : 'text-2xl'}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-bold text-slate-400">{unit}</span>}
      </div>
      {sub && <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">{sub}</p>}
    </div>
  );
}

/** Lightweight SVG area+bar chart (no chart library required). */
export function MiniChart({ data, height = 90, color = '#38bdf8', fill = 'rgba(56,189,248,0.18)', bars, barColor = 'rgba(99,102,241,0.55)', labels }: {
  data: number[]; height?: number; color?: string; fill?: string; bars?: number[]; barColor?: string; labels?: string[];
}) {
  const w = 600;
  const h = height;
  const max = Math.max(1, ...data, ...(bars ?? []));
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => `${i * step},${h - (v / max) * (h - 14) - 6}`).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  const barW = bars && bars.length ? Math.max(2, (w / bars.length) * 0.55) : 0;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      {bars?.map((v, i) => (
        <rect key={i} x={(w / bars.length) * i + barW * 0.4} y={h - (v / max) * (h - 14) - 4} width={barW} height={Math.max(1, (v / max) * (h - 14))} fill={barColor} rx="2" />
      ))}
      <polygon points={area} fill={fill} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - (v / max) * (h - 14) - 6} r={i === 0 ? 3.5 : 2} fill={color} opacity={i === 0 ? 1 : 0.65} />
      ))}
      {labels && labels.map((l, i) => (
        i % Math.ceil(labels.length / 6) === 0 ? <text key={i} x={i * step} y={h - 1} fontSize="9" fill="rgba(226,232,240,0.5)" textAnchor="middle">{l}</text> : null
      ))}
    </svg>
  );
}

export function Gauge({ value, label, size = 120, tone = 'INFO' }: { value: number; label?: string; size?: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const s = sev(tone);
  const stroke = pct >= 75 ? '#f87171' : pct >= 50 ? '#fb923c' : pct >= 30 ? '#fbbf24' : '#34d399';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="9" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={stroke} strokeWidth="9" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className={`text-2xl font-black ${s.text}`}>{Math.round(pct)}<span className="text-xs">%</span></div>
        {label && <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{label}</div>}
      </div>
    </div>
  );
}

export function Bar({ value, max = 100, height = 8 }: { value: number; max?: number; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = value >= max ? 'bg-red-500' : value >= max * 0.85 ? 'bg-orange-500' : value >= max * 0.6 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="w-full rounded-full bg-white/8 overflow-hidden" style={{ height }}>
      <div className={`${color} h-full rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} />;
}

/** Minimal markdown renderer for AI answers (bold, bullets, headings). */
export function AiText({ text, className = '' }: { text: string; className?: string }) {
  const lines = (text || '').split('\n');
  return (
    <div className={`space-y-1.5 text-[13px] leading-relaxed text-slate-200 ${className}`}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        const html = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
          .replace(/_(.+?)_/g, '<em class="text-slate-300">$1</em>')
          .replace(/`(.+?)`/g, '<code class="rounded bg-white/10 px-1 py-0.5 text-[11px] text-cyan-200">$1</code>');
        if (line.startsWith('• ') || line.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-cyan-400 mt-0.5">▸</span>
              <span dangerouslySetInnerHTML={{ __html: html.replace(/^[•-]\s*/, '') }} />
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return <div key={i} className="pl-1" dangerouslySetInnerHTML={{ __html: html }} />;
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

export function SourceChip({ mode, provider, note }: { mode: string; provider?: string; note?: string }) {
  const tone = mode === 'LIVE' ? 'CALM' : mode === 'RELAY' ? 'INFO' : mode === 'MIXED' ? 'INFO' : 'ADVISORY';
  const label = mode === 'LIVE' ? 'LIVE FEED' : mode === 'RELAY' ? 'LIVE · BROWSER RELAY' : mode === 'MIXED' ? 'LIVE + MODEL' : 'MODEL FALLBACK';
  return (
    <span title={note || provider} className="inline-flex items-center gap-1.5">
      <Badge tone={tone} pulse={mode !== 'SIMULATED'}>{label}</Badge>
      {provider && <span className="hidden sm:inline text-[10px] text-slate-500">{provider}</span>}
    </span>
  );
}
