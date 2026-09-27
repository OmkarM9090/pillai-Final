// ============================================================
// FEATURE 5 — AI RESORT COPILOT / CHATBOT ("Resort Brain")
// One grounded AI layer used by:
//   • the floating copilot for managers, supervisors and staff
//   • the guest-facing concierge chatbot (creates real service requests)
//   • the executive weather briefing on the Live Intel page
//
// Everything the AI says is grounded in live platform state: weather feed,
// public social signals, digital-twin snapshot, tickets, roster, inventory.
// ============================================================

import { getLiveWeather, WeatherIntel } from '../intel/weatherService';
import { getSocialIntel, SocialIntel } from '../intel/socialService';
import { getDigitalTwinSnapshot } from '../simulation/snapshot';
import { runWhatIf } from '../twin/weatherTwin';
import { RESORT_ZONES, RESORT_SITE } from '../intel/resortSite';
import { OperationalTicket } from '../../models/OperationalTicket';
import { GuestRequest } from '../../models/GuestRequest';
import { PantryInventory } from '../../models/PantryInventory';
import { ActionCard } from '../../models/ActionCard';
import { processConciergeMessage } from './guestConciergeService';
import { llmComplete, llmStatus, LlmMessage } from './llmService';

export interface ResortContext {
  weather: WeatherIntel;
  social: SocialIntel | null;
  occupancyPct: number;
  rooms: { total: number; occupied: number; available: number; cleaning: number; maintenance: number };
  staff: { total: number; available: number; assigned: number; byDepartment: Record<string, { available: number; assigned: number; crossTrainedIn: number }> };
  requests: { active: number; critical: number };
  tickets: Array<{ id: string; title: string; department: string; priority: string; status: string }>;
  inventoryCritical: Array<{ item: string; stock: number; threshold: number }>;
  pendingApprovals: number;
  zonesAtRisk: Array<{ name: string; status: string; impact: number }>;
  generatedAt: string;
}

const RESORT_FACTS = {
  dining: [
    'Shoreline Restaurant & Bar — all-day dining, 07:00–23:00, indoor + covered deck (180 covers)',
    'Crystal Hall — indoor banquet/overflow venue, activated automatically in bad weather',
    'Infinity Pool Deck Grill — 11:00–19:00, weather dependent',
    '24×7 in-room dining, 15–25 min average delivery',
  ],
  wellness: ['Serenity Spa — 09:00–21:00, 6 therapy rooms, steam & sauna', 'Fitness centre 24×7', 'Indoor yoga pavilion — 07:00 & 17:30 sessions'],
  activities: ['Infinity pool & shoreline promenade', 'Kayaking and beach volleyball (fair weather only)', 'Indoor: board-game lounge, cinema room, cooking masterclass at 16:00, kids club'],
  logistics: [
    'Check-in 14:00 · Check-out 11:00 (late check-out subject to availability)',
    'Airport transfer: NMIA ~35 min in clear weather, +25 min in heavy rain via Gate 2 alternate route',
    'Free high-speed Wi-Fi — network "SmartResort360", password is your room number + surname',
    'Valet parking at the Palm Access Road porch; Gate 2 is used when the porch floods',
  ],
};

// ------------------------------------------------------------------
// Context builder
// ------------------------------------------------------------------
export async function buildResortContext(includeSocial = true): Promise<ResortContext> {
  const weather = await getLiveWeather();
  const [snapshot, social, tickets, criticalRequests, inventory, pendingApprovals] = await Promise.all([
    getDigitalTwinSnapshot(),
    includeSocial ? getSocialIntel(weather).catch(() => null) : Promise.resolve(null),
    OperationalTicket.find({ status: { $ne: 'completed' } }).sort({ createdAt: -1 }).limit(8).catch(() => []),
    GuestRequest.countDocuments({ priority: { $in: ['HIGH', 'CRITICAL'] }, status: { $ne: 'COMPLETED' } }).catch(() => 0),
    PantryInventory.find({}).catch(() => []),
    ActionCard.countDocuments({ approval_status: 'pending' }).catch(() => 0),
  ]);

  const sev = weather.severity.index;
  const zonesAtRisk = RESORT_ZONES.map((z) => {
    const impact = Math.min(1, sev * (0.45 + z.exposure * 0.85) + (weather.current.precipMm > 6 && z.elevationM < 6 ? 0.18 : 0));
    return { name: z.name, status: impact >= 0.6 ? 'CRITICAL' : impact >= 0.4 ? 'AT_RISK' : impact >= 0.22 ? 'WATCH' : 'NORMAL', impact: Number(impact.toFixed(2)) };
  }).filter((z) => z.status !== 'NORMAL').sort((a, b) => b.impact - a.impact);

  return {
    weather,
    social,
    occupancyPct: snapshot.rooms.total ? Math.round((snapshot.rooms.occupied / snapshot.rooms.total) * 100) : 0,
    rooms: snapshot.rooms,
    staff: snapshot.staff,
    requests: { active: snapshot.guestRequests.active, critical: criticalRequests },
    tickets: (tickets as any[]).map((t) => ({ id: t.ticket_id, title: t.title, department: t.department, priority: t.priority, status: t.status })),
    inventoryCritical: (inventory as any[])
      .filter((i) => i.current_stock_kg <= i.safety_threshold_kg * 1.25)
      .map((i) => ({ item: i.item_name, stock: i.current_stock_kg, threshold: i.safety_threshold_kg })),
    pendingApprovals,
    zonesAtRisk,
    generatedAt: new Date().toISOString(),
  };
}

function contextDigest(ctx: ResortContext) {
  const w = ctx.weather;
  return [
    `RESORT: ${RESORT_SITE.name}, ${RESORT_SITE.city} (${RESORT_SITE.lat}, ${RESORT_SITE.lon}) — ${ctx.rooms.total} rooms.`,
    `LIVE WEATHER [${w.mode}/${w.provider}] ${w.current.label}, ${w.current.tempC}°C (feels ${w.current.apparentC}°C), rain ${w.current.precipMm} mm/h, wind ${w.current.windKph} km/h ${w.current.windDirLabel} gust ${w.current.gustKph}, humidity ${w.current.humidity}%, visibility ${w.current.visibilityKm} km.`,
    `SEVERITY ${w.severity.index} (${w.severity.band}); next 6 h rain ${w.trend.next6hPrecipMm} mm, trend ${w.trend.direction}.`,
    `ALERTS: ${w.alerts.map((a) => `${a.level}:${a.title}`).join(' | ')}`,
    `AI MODEL INPUTS: weather_score ${w.aiFeatures.weather_score}, demand_shock ${w.aiFeatures.demand_shock}, staff_availability ${w.aiFeatures.staff_availability}, outdoor_viability ${w.aiFeatures.outdoor_viability}.`,
    `OPERATIONS: occupancy ${ctx.occupancyPct}% (${ctx.rooms.occupied}/${ctx.rooms.total} occupied, ${ctx.rooms.available} available, ${ctx.rooms.cleaning} cleaning, ${ctx.rooms.maintenance} maintenance). Staff ${ctx.staff.available} idle / ${ctx.staff.assigned} busy of ${ctx.staff.total}. Active guest requests ${ctx.requests.active} (${ctx.requests.critical} high/critical). Pending approvals ${ctx.pendingApprovals}.`,
    `OPEN TICKETS: ${ctx.tickets.slice(0, 5).map((t) => `${t.id} ${t.priority} ${t.department} — ${t.title}`).join(' | ') || 'none'}`,
    `INVENTORY AT/NEAR THRESHOLD: ${ctx.inventoryCritical.map((i) => `${i.item} ${i.stock}kg/${i.threshold}kg`).join(', ') || 'all healthy'}`,
    `ZONES AT RISK: ${ctx.zonesAtRisk.map((z) => `${z.name} (${z.status} ${z.impact})`).join(', ') || 'none'}`,
    ctx.social
      ? `PUBLIC SOCIAL SIGNALS [${ctx.social.mode}] ${ctx.social.totals.signals} scanned, net sentiment ${ctx.social.sentiment.net} (${ctx.social.sentiment.trend}). Top themes: ${ctx.social.themes.slice(0, 3).map((t) => `${t.label} ×${t.count}`).join(', ')}. Emerging: ${ctx.social.emerging[0]?.title}. Traveller impact: ${ctx.social.travellerImpact.cancellations} cancellation mentions, ${ctx.social.travellerImpact.delays} delay mentions.`
      : 'PUBLIC SOCIAL SIGNALS: unavailable.',
  ].join('\n');
}

// ------------------------------------------------------------------
// On-board grounded reasoner (works with zero API keys)
// ------------------------------------------------------------------
type Intent =
  | 'greeting' | 'weather' | 'forecast' | 'whatif' | 'occupancy' | 'staffing' | 'tickets' | 'social'
  | 'revenue' | 'briefing' | 'risk' | 'dining' | 'spa' | 'activities' | 'logistics' | 'wifi'
  | 'checkout' | 'request' | 'thanks' | 'capability' | 'fallback';

const INTENT_RULES: Array<{ intent: Intent; keys: string[] }> = [
  { intent: 'greeting', keys: ['hi', 'hello', 'hey', 'namaste', 'good morning', 'good evening', 'good afternoon'] },
  { intent: 'thanks', keys: ['thank', 'thanks', 'appreciate', 'great job'] },
  { intent: 'capability', keys: ['what can you do', 'help me', 'how can you help', 'capabilities', 'who are you'] },
  { intent: 'whatif', keys: ['what if', 'what-if', 'simulate', 'scenario', 'suppose', 'if it rains', 'if the storm', 'if wind'] },
  { intent: 'forecast', keys: ['forecast', 'tomorrow', 'next hours', 'later today', 'tonight', 'outlook', 'next 6'] },
  { intent: 'weather', keys: ['weather', 'rain', 'raining', 'storm', 'wind', 'temperature', 'humid', 'hot', 'cold', 'monsoon', 'climate'] },
  { intent: 'occupancy', keys: ['occupancy', 'rooms', 'how full', 'bookings', 'check-ins', 'checkins', 'arrivals', 'vacant'] },
  { intent: 'staffing', keys: ['staff', 'roster', 'housekeep', 'workforce', 'shift', 'manpower', 'overtime', 'team'] },
  { intent: 'tickets', keys: ['ticket', 'incident', 'complaint', 'issue', 'maintenance', 'broken', 'escalat', 'sla'] },
  { intent: 'social', keys: ['social', 'twitter', 'x post', 'reddit', 'mastodon', 'instagram', 'facebook', 'sentiment', 'reviews', 'guests saying', 'people saying', 'posting', 'posts', 'chatter', 'buzz', 'mentions', 'traveller', 'traveler', 'public', 'trend', 'online'] },
  { intent: 'revenue', keys: ['revenue', 'goppar', 'adr', 'revpar', 'profit', 'money', 'loss', 'financial'] },
  { intent: 'briefing', keys: ['brief', 'summary', 'status', 'overview', 'situation', 'report', 'update me'] },
  { intent: 'risk', keys: ['risk', 'danger', 'safe', 'safety', 'prepare', 'readiness', 'contingency', 'action', 'recommend', 'should i', 'what do i do'] },
  { intent: 'dining', keys: ['dinner', 'lunch', 'breakfast', 'restaurant', 'food', 'eat', 'menu', 'buffet', 'bar', 'drink', 'room service'] },
  { intent: 'spa', keys: ['spa', 'massage', 'wellness', 'gym', 'fitness', 'yoga', 'sauna'] },
  { intent: 'activities', keys: ['activity', 'activities', 'things to do', 'kids', 'pool', 'beach', 'kayak', 'entertainment', 'bored', 'tour'] },
  { intent: 'logistics', keys: ['airport', 'transfer', 'taxi', 'cab', 'parking', 'shuttle', 'reach', 'directions', 'gate'] },
  { intent: 'wifi', keys: ['wifi', 'wi-fi', 'internet', 'password', 'network'] },
  { intent: 'checkout', keys: ['check out', 'checkout', 'check-in', 'checkin', 'late check', 'early check', 'bill', 'invoice'] },
  { intent: 'request', keys: ['towel', 'clean my room', 'housekeeping please', 'ac ', 'air conditioner', 'not working', 'leak', 'send', 'bring', 'need', 'broken', 'repair', 'water bottle', 'pillow', 'laundry'] },
];

export function detectIntent(text: string, role: string): Intent {
  const t = ` ${text.toLowerCase().trim()} `;
  if (t.trim().length <= 3) return 'greeting';
  const hits = INTENT_RULES.filter((r) => r.keys.some((k) => t.includes(k)));
  if (!hits.length) return 'fallback';
  // Guests asking for something physical → service request, not analytics.
  if (role === 'GUEST' && hits.some((h) => h.intent === 'request')) return 'request';

  // Guest asking to book/reserve something concrete → dispatch a real request.
  if (role === 'GUEST' && /\b(book|reserve|reservation|arrange|schedule)\b/.test(t) &&
      hits.some((h) => ['dining', 'spa', 'activities', 'logistics', 'request'].includes(h.intent))) {
    return 'request';
  }
  // "What can I do today?" is an activities question even if the weather is mentioned.
  if (/(things to do|what can i do|anything to do|what to do|keep the kids|activities)/.test(t)) return 'activities';

  // A bare time adverb ("tonight", "tomorrow") must not hijack a domain question
  // such as "what is the staffing risk tonight" — only explicit forecast words do.
  const STRONG_FORECAST = ['forecast', 'outlook', 'next hours', 'next 6', '5-day', 'five day'];
  const DOMAIN = ['staffing', 'occupancy', 'tickets', 'revenue', 'social', 'risk', 'briefing', 'whatif'];
  if (
    hits.some((h) => h.intent === 'forecast') &&
    !STRONG_FORECAST.some((k) => t.includes(k)) &&
    hits.some((h) => DOMAIN.includes(h.intent))
  ) {
    hits.splice(hits.findIndex((h) => h.intent === 'forecast'), 1);
  }

  const order: Intent[] = ['whatif', 'request', 'forecast', 'weather', 'social', 'occupancy', 'staffing', 'tickets', 'revenue', 'risk', 'briefing', 'dining', 'spa', 'activities', 'logistics', 'wifi', 'checkout', 'capability', 'thanks', 'greeting'];
  for (const o of order) if (hits.some((h) => h.intent === o)) return o;
  return hits[0].intent;
}

const bullet = (lines: string[]) => lines.map((l) => `• ${l}`).join('\n');

function weatherAnswer(ctx: ResortContext) {
  const w = ctx.weather;
  return [
    `**Live conditions at ${RESORT_SITE.name}** (${w.mode === 'SIMULATED' ? 'physics model — upstream feed unreachable from this host' : `${w.provider}, ${w.ageSeconds}s old`})`,
    '',
    bullet([
      `${w.current.label} · **${w.current.tempC}°C** (feels ${w.current.apparentC}°C), humidity ${w.current.humidity}%`,
      `Rain **${w.current.precipMm} mm/h**, ${w.current.precipProb}% probability this hour`,
      `Wind **${w.current.windKph} km/h ${w.current.windDirLabel}**, gusting ${w.current.gustKph} km/h`,
      `Visibility ${w.current.visibilityKm} km · pressure ${w.current.pressureHpa} hPa · cloud ${w.current.cloudPct}%`,
      `Twin severity **${(w.severity.index * 100).toFixed(0)}% (${w.severity.band})** — biggest driver: ${w.severity.drivers[0].factor} (${w.severity.drivers[0].detail})`,
    ]),
    '',
    `**Next 6 hours:** ${w.trend.next6hPrecipMm} mm rain, peak wind ${w.trend.next6hPeakWindKph} km/h — outlook **${w.trend.direction.toLowerCase()}**.`,
    '',
    `**What this does to the models right now:** weather_score ${w.aiFeatures.weather_score}, demand_shock ${w.aiFeatures.demand_shock}×, staff_availability ${(w.aiFeatures.staff_availability * 100).toFixed(0)}%, outdoor viability ${(w.aiFeatures.outdoor_viability * 100).toFixed(0)}%.`,
    ctx.zonesAtRisk.length ? `\n**Zones needing attention:** ${ctx.zonesAtRisk.map((z) => `${z.name} (${z.status})`).join(', ')}.` : '\nNo resort zone is currently above the attention threshold.',
  ].join('\n');
}

function forecastAnswer(ctx: ResortContext) {
  const w = ctx.weather;
  const next = w.hourly.slice(0, 8);
  const worst = [...next].sort((a, b) => b.severity - a.severity)[0];
  return [
    '**8-hour operational forecast**',
    '',
    bullet(next.map((h) => `${h.hourLabel} — ${h.label}, ${h.tempC}°C, ${h.precipMm} mm, wind ${h.windKph} km/h${h.severity > 0.5 ? '  ⚠️' : ''}`)),
    '',
    worst ? `**Peak risk window:** ${worst.hourLabel} (severity ${(worst.severity * 100).toFixed(0)}%, ${worst.precipMm} mm/h).` : '',
    '',
    '**5-day outlook**',
    bullet(w.daily.map((d) => `${d.dayLabel} ${d.date.slice(5)} — ${d.label}, ${d.tMinC}–${d.tMaxC}°C, ${d.precipSumMm} mm (${d.precipProbMax}% prob), wind ≤ ${d.windMaxKph} km/h`)),
    '',
    `Recommendation: ${w.trend.direction === 'DETERIORATING' ? 'lock the storm posture now — pre-position pumps, secure outdoor assets and start guest comms before the peak window.' : w.trend.direction === 'IMPROVING' ? 'hold current posture; you can plan re-opening outdoor venues once severity drops below 0.25 for an hour.' : 'maintain current posture and re-check in 60 minutes.'}`,
  ].join('\n');
}

function occupancyAnswer(ctx: ResortContext) {
  const capacityNote = ctx.occupancyPct > 85 ? 'You are running hot — any weather shock will hit housekeeping turnaround first.' : 'There is head-room to absorb a weather shock.';
  return [
    '**Rooms & occupancy (live twin)**',
    '',
    bullet([
      `Occupancy **${ctx.occupancyPct}%** — ${ctx.rooms.occupied} occupied, ${ctx.rooms.available} available, ${ctx.rooms.cleaning} in cleaning, ${ctx.rooms.maintenance} out of order`,
      `Active guest requests: ${ctx.requests.active} (${ctx.requests.critical} high/critical)`,
      `Staff on shift: ${ctx.staff.available} idle, ${ctx.staff.assigned} engaged of ${ctx.staff.total}`,
    ]),
    '',
    `Weather overlay: with severity ${ctx.weather.severity.index} the demand-shock multiplier on in-house services is **${ctx.weather.aiFeatures.demand_shock}×** and commute-related staff availability is **${(ctx.weather.aiFeatures.staff_availability * 100).toFixed(0)}%**.`,
    '',
    capacityNote,
  ].join('\n');
}

function staffingAnswer(ctx: ResortContext) {
  const dept = Object.entries(ctx.staff.byDepartment).filter(([k]) => !!k);
  return [
    '**Workforce position**',
    '',
    bullet(dept.map(([name, v]) => `${name}: ${v.available} idle · ${v.assigned} engaged · ${v.crossTrainedIn} cross-trained available`)),
    '',
    `Weather-adjusted availability is **${(ctx.weather.aiFeatures.staff_availability * 100).toFixed(0)}%** of roster (commute disruption at severity ${ctx.weather.severity.index}).`,
    '',
    ctx.weather.severity.index > 0.4
      ? bullet([
          'Pull Spa/Recreation staff into Housekeeping — their demand collapses in this weather while wet-linen load rises',
          'Authorise 2 h overtime for Maintenance to pre-stage pumps and DG changeover',
          'Stage one Front Desk runner at Gate 2 for re-routed arrivals',
        ])
      : 'No reallocation needed at current severity — keep the published roster.',
  ].join('\n');
}

function ticketsAnswer(ctx: ResortContext) {
  if (!ctx.tickets.length) return '**No open operational tickets.** The board is clear — good time to run preventive checks on storm drains and the DG set.';
  return [
    `**${ctx.tickets.length} open tickets**`,
    '',
    bullet(ctx.tickets.map((t) => `${t.id} · **${t.priority}** · ${t.department} — ${t.title} (${t.status})`)),
    '',
    `Critical/high items: ${ctx.tickets.filter((t) => ['Critical', 'High'].includes(t.priority)).length}. ` +
      (ctx.weather.severity.index > 0.4 ? 'Given the active weather severity, sequence maintenance tickets that protect power, drainage and guest-facing dry routes first.' : 'Standard SLA sequencing applies.'),
  ].join('\n');
}

function socialAnswer(ctx: ResortContext) {
  if (!ctx.social) return 'Public social signal feed is not available right now. Retry from the Live Intel page — the browser relay can fetch it even when the server has no egress.';
  const s = ctx.social;
  return [
    `**Public signal scan** (${s.mode}, ${s.totals.signals} signals, ${s.totals.last60min} in the last hour)`,
    '',
    bullet([
      `Net sentiment **${s.sentiment.net > 0 ? '+' : ''}${s.sentiment.net}** (${s.sentiment.positive}👍 / ${s.sentiment.neutral}😐 / ${s.sentiment.negative}👎) — trend ${s.sentiment.trend.toLowerCase()}`,
      `Top themes: ${s.themes.slice(0, 4).map((t) => `${t.label} ×${t.count}`).join(', ')}`,
      `Traveller impact: ${s.travellerImpact.cancellations} cancellation/refund mentions, ${s.travellerImpact.delays} delay mentions, risk score ${s.travellerImpact.riskScore}`,
    ]),
    '',
    `**Emerging:** ${s.emerging[0].title} — ${s.emerging[0].detail} (confidence ${(s.emerging[0].confidence * 100).toFixed(0)}%)`,
    '',
    `**Loudest recent post:** "${s.signals[0]?.text.slice(0, 180)}" — ${s.signals[0]?.handle} on ${s.signals[0]?.platform}, ${s.signals[0]?.minutesAgo} min ago near ${s.signals[0]?.geo?.place}.`,
    '',
    `These three numbers are injected into the twin: social_pressure ${s.twinInputs.social_pressure}, reputation_risk ${s.twinInputs.reputation_risk}, arrival_disruption ${s.twinInputs.arrival_disruption}.`,
  ].join('\n');
}

function revenueAnswer(ctx: ResortContext) {
  const exposure = Math.round(ctx.weather.severity.index * ctx.occupancyPct * 42);
  return [
    '**Revenue exposure under current weather**',
    '',
    bullet([
      `Occupancy ${ctx.occupancyPct}% at severity ${ctx.weather.severity.index} → outdoor viability ${(ctx.weather.aiFeatures.outdoor_viability * 100).toFixed(0)}%`,
      `Outdoor venues (pool grill, lawn, promenade) carry the exposure — estimated **₹${exposure.toLocaleString('en-IN')}/hour** at risk`,
      `Offsetting uplift: in-room dining and indoor F&B rise with demand_shock ${ctx.weather.aiFeatures.demand_shock}× — typically recovers 60–75% of displaced covers if you pre-fire the kitchen`,
    ]),
    '',
    'Run the exact number for a specific storm on the **Weather Twin** page — it produces revenue-at-risk, GOPPAR delta and the mitigation set with costs.',
  ].join('\n');
}

function riskAnswer(ctx: ResortContext) {
  const sev = ctx.weather.severity.index;
  const actions = sev >= 0.55
    ? [
        'Close the pool deck and shoreline promenade; post safety signage now',
        'Move all lawn/outdoor covers into Crystal Hall and pre-fire the kitchen for the indoor surge',
        'Pre-position 2 submersible pumps and sandbags at the Palm Access Road storm drain',
        'Arm the 250 kVA DG changeover and confirm diesel at 100%',
        'Message in-house guests and today’s arrivals with the Gate 2 re-route and indoor activity vouchers',
        'Pull cross-trained Spa staff into Housekeeping for wet-linen turnaround',
      ]
    : sev >= 0.3
      ? [
          'Secure parasols and loose furniture on the pool deck and lawn',
          'Put the banquet indoor contingency on standby and confirm with the event host',
          'Brief the front desk on a +20 min transfer ETA and hold rooms for delayed arrivals',
          'Check storm drains at the access road and the villa plinth line',
        ]
      : [
          'Normal operations — no storm posture required',
          'Good window for preventive checks: drains, DG test run, awning rigging',
          'Push outdoor F&B and activity upsells while outdoor viability is high',
        ];
  return [
    `**Readiness call — severity ${sev} (${ctx.weather.severity.band})**`,
    '',
    bullet(actions),
    '',
    ctx.zonesAtRisk.length ? `**Zones to watch:** ${ctx.zonesAtRisk.map((z) => `${z.name} — ${z.status}`).join(' · ')}` : 'No zone is above the attention threshold.',
    '',
    'Want the quantified version? Say “what if 40 mm/h rain for 6 hours” and I will run it through the digital twin.',
  ].join('\n');
}

function briefingAnswer(ctx: ResortContext) {
  const s = ctx.social;
  return [
    `**Operations briefing — ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: RESORT_SITE.timezone })}**`,
    '',
    `**1. Weather.** ${ctx.weather.current.label}, ${ctx.weather.current.tempC}°C, ${ctx.weather.current.precipMm} mm/h, wind ${ctx.weather.current.windKph} km/h. Severity ${ctx.weather.severity.index} (${ctx.weather.severity.band}), ${ctx.weather.trend.direction.toLowerCase()} with ${ctx.weather.trend.next6hPrecipMm} mm expected in 6 h.`,
    '',
    `**2. Operations.** Occupancy ${ctx.occupancyPct}% (${ctx.rooms.occupied}/${ctx.rooms.total}). ${ctx.staff.available} staff idle of ${ctx.staff.total}. ${ctx.requests.active} live guest requests, ${ctx.tickets.length} open tickets, ${ctx.pendingApprovals} plans awaiting approval.`,
    '',
    `**3. Public signal.** ${s ? `${s.totals.signals} signals, net sentiment ${s.sentiment.net} (${s.sentiment.trend.toLowerCase()}). ${s.emerging[0].title}.` : 'Feed unavailable.'}`,
    '',
    '**4. Top three actions.**',
    bullet(
      (ctx.weather.severity.index >= 0.45
        ? ['Activate the storm posture: outdoor venues closed, pumps staged, DG armed', 'Reallocate exposed beachfront rooms before the front lands', 'Proactive guest comms now — cheaper than complaint recovery later']
        : ['Run preventive drain/DG checks while conditions are benign', 'Push outdoor F&B and activity revenue while viability is high', 'Clear the ticket backlog ahead of the next forecast window']),
    ),
    '',
    `**Confidence.** Weather feed ${ctx.weather.mode}, twin snapshot live, ${s ? `social ${s.mode}` : 'social offline'}.`,
  ].join('\n');
}

function guestAnswer(intent: Intent, ctx: ResortContext, roomNumber?: string) {
  const w = ctx.weather;
  const wet = w.severity.index >= 0.3 || w.current.precipMm > 1;
  switch (intent) {
    case 'dining':
      return [
        `**Dining right now** ${roomNumber ? `(Room ${roomNumber})` : ''}`,
        '',
        bullet(RESORT_FACTS.dining),
        '',
        wet
          ? `It is ${w.current.label.toLowerCase()} with ${w.current.precipMm} mm/h outside, so the deck grill may be closed — I would book the Shoreline indoor section or order in-room dining. Shall I reserve a table?`
          : `Weather is lovely (${w.current.tempC}°C, clear-ish) — the pool deck grill and outdoor promenade seating are open. Want me to hold a sunset table?`,
      ].join('\n');
    case 'spa':
      return [`**Spa & wellness**`, '', bullet(RESORT_FACTS.wellness), '', wet ? 'Perfect weather for the spa — steam + 60-min massage is the most-booked combination on rainy afternoons. Want me to request a slot?' : 'Morning slots are the quietest. Want me to request a booking?'].join('\n');
    case 'activities':
      return [
        '**Things to do**',
        '',
        wet
          ? bullet(['Indoor cooking masterclass at 16:00 (Crystal Hall)', 'Cinema room — 3 showings this evening', 'Board-game lounge and kids club, open 10:00–20:00', 'Spa steam + sauna circuit', 'Indoor yoga pavilion at 17:30'])
          : bullet(RESORT_FACTS.activities),
        '',
        `Current conditions: ${w.current.label}, ${w.current.tempC}°C, wind ${w.current.windKph} km/h. ${wet ? 'Water sports and the beach are suspended for safety.' : 'All outdoor activities are running.'}`,
      ].join('\n');
    case 'logistics':
      return [
        '**Getting around**',
        '',
        bullet(RESORT_FACTS.logistics),
        '',
        wet
          ? `Because of the rain, transfers are running about ${Math.round(10 + w.severity.index * 35)} minutes late and we are using the **Gate 2 alternate route** — the porch approach tends to pond. Tell me your flight time and I will pre-book the buffer.`
          : 'Roads are clear — standard transfer times apply.',
      ].join('\n');
    case 'wifi':
      return '**Wi-Fi:** connect to **SmartResort360**, password = your room number + surname (e.g. 412Sharma). Speeds are 200 Mbps in rooms. If it drops I can raise a ticket for the IT team right away — just say "wifi not working".';
    case 'checkout':
      return '**Check-in 14:00 · Check-out 11:00.** Late check-out to 14:00 is usually available (₹1,500, free for suites). Express checkout is on the TV or I can request your folio now. Want me to request a late checkout?';
    default:
      return '';
  }
}

export function onboardAnswer(question: string, ctx: ResortContext, role: string, roomNumber?: string): string {
  const intent = detectIntent(question, role);
  const isGuest = role === 'GUEST';

  if (intent === 'greeting') {
    return isGuest
      ? `Hello! I'm **Aria**, your Smart Resort 360 concierge. ${ctx.weather.current.label} and ${ctx.weather.current.tempC}°C outside right now. I can book dining and spa, suggest weather-appropriate activities, arrange transfers, or raise a service request for your room. What would you like?`
      : `Hi — **Resort Copilot** here. Live picture: occupancy ${ctx.occupancyPct}%, weather severity ${ctx.weather.severity.index} (${ctx.weather.severity.band}), ${ctx.requests.active} open guest requests, ${ctx.tickets.length} open tickets. Ask me for a briefing, a risk call, or run a what-if like “what if 40 mm/h rain for 6 hours”.`;
  }
  if (intent === 'thanks') return isGuest ? 'Always a pleasure — enjoy your stay! 🌴' : 'Anytime. I will keep watching the feed and flag anything that crosses the alert threshold.';
  if (intent === 'capability') {
    return isGuest
      ? bullet(['Live weather and what it means for your plans today', 'Restaurant, spa and activity recommendations (weather-aware)', 'Airport transfers, parking, Wi-Fi, check-out help', 'Raise a housekeeping / maintenance / room-service request — I dispatch it to a real staff member and give you an ETA'])
      : bullet(['Live weather + 5-day forecast with operational severity scoring', 'Public social signal scan: sentiment, themes, emerging incidents', 'Digital-twin what-if: change rain, duration, wind, temperature or storm distance and see pressure, staffing, revenue and SLA change', 'Readiness calls, executive briefings and quantified mitigation plans', 'Occupancy, roster, tickets, inventory and approval status on demand']);
  }

  if (isGuest) {
    const g = guestAnswer(intent, ctx, roomNumber);
    if (g) return g;
    if (intent === 'weather' || intent === 'forecast') {
      const w = ctx.weather;
      return [
        `**Right now at the resort:** ${w.current.label}, **${w.current.tempC}°C** (feels ${w.current.apparentC}°C), ${w.current.precipMm} mm/h rain, wind ${w.current.windKph} km/h.`,
        '',
        `**Next few hours:** ${w.hourly.slice(0, 4).map((h) => `${h.hourLabel} ${h.tempC}°C ${h.precipMm}mm`).join(' · ')}`,
        '',
        w.severity.index >= 0.35
          ? 'Outdoor areas may close for safety. I would plan the spa, the cooking masterclass at 16:00, or the cinema room. Want me to book something?'
          : 'Great conditions for the pool deck, the promenade and sunset dining. Want me to hold a table outside?',
      ].join('\n');
    }
    return [
      `Happy to help! Here is the quick picture: ${ctx.weather.current.label}, ${ctx.weather.current.tempC}°C, ${ctx.weather.current.precipMm} mm/h rain.`,
      '',
      'I can help with: dining · spa & wellness · activities · airport transfer · Wi-Fi · check-out · or raising a service request (e.g. "the AC in my room is not cooling", "please send 2 towels").',
    ].join('\n');
  }

  switch (intent) {
    case 'weather': return weatherAnswer(ctx);
    case 'forecast': return forecastAnswer(ctx);
    case 'occupancy': return occupancyAnswer(ctx);
    case 'staffing': return staffingAnswer(ctx);
    case 'tickets': return ticketsAnswer(ctx);
    case 'social': return socialAnswer(ctx);
    case 'revenue': return revenueAnswer(ctx);
    case 'risk': return riskAnswer(ctx);
    case 'briefing': return briefingAnswer(ctx);
    case 'dining': case 'spa': case 'activities': case 'logistics': case 'wifi': case 'checkout':
      return guestAnswer(intent, ctx) || briefingAnswer(ctx);
    default:
      return [
        'Here is the grounded picture I have:',
        '',
        bullet([
          `Weather: ${ctx.weather.current.label}, ${ctx.weather.current.tempC}°C, ${ctx.weather.current.precipMm} mm/h, severity ${ctx.weather.severity.index} (${ctx.weather.severity.band})`,
          `Operations: occupancy ${ctx.occupancyPct}%, ${ctx.requests.active} guest requests, ${ctx.tickets.length} open tickets, ${ctx.staff.available}/${ctx.staff.total} staff idle`,
          ctx.social ? `Public sentiment: ${ctx.social.sentiment.net} net across ${ctx.social.totals.signals} signals (${ctx.social.sentiment.trend.toLowerCase()})` : 'Public sentiment: feed unavailable',
        ]),
        '',
        'Try: “give me a briefing”, “what is the staffing risk tonight”, “what are people posting”, or “what if 50 mm/h rain for 8 hours with 70 km/h wind”.',
      ].join('\n');
  }
}

// ------------------------------------------------------------------
// What-if extraction from natural language
// ------------------------------------------------------------------
export function parseScenarioFromText(text: string) {
  const t = text.toLowerCase();
  const num = (re: RegExp) => {
    const m = t.match(re);
    return m ? Number(m[1]) : undefined;
  };
  const rain = num(/(\d+(?:\.\d+)?)\s*(?:mm)/);
  const hours = num(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/);
  const wind = num(/(\d+(?:\.\d+)?)\s*(?:kph|km\/h|kmph|km per hour)/);
  const temp = num(/(\d+(?:\.\d+)?)\s*(?:°c|degrees|degree|celsius|c\b)/);
  const dist = num(/(\d+(?:\.\d+)?)\s*km\s*(?:away|offshore|from)/);
  const found = [rain, hours, wind, temp, dist].some((v) => v !== undefined);
  if (!found) return null;
  return {
    rainIntensityMmHr: rain,
    durationHours: hours,
    windKph: wind,
    tempC: temp,
    stormDistanceKm: dist,
    label: 'Copilot scenario',
  };
}

function whatIfNarrative(res: Awaited<ReturnType<typeof runWhatIf>>) {
  const hk = res.departments.find((d) => d.key === 'housekeeping');
  return [
    `**Digital twin re-run — ${res.scenario.rainIntensityMmHr} mm/h for ${res.scenario.durationHours} h, wind ${Math.round(res.scenario.windKph)} km/h, ${res.scenario.tempC}°C, storm ${res.scenario.stormDistanceKm} km out**`,
    '',
    `Severity **${res.scenario.severity} (${res.scenario.band})** · confidence ${(res.confidence * 100).toFixed(0)}%`,
    '',
    '**What changes in the system**',
    bullet(res.deltas.map((d) => {
      const fmt = (v: number) => (d.unit === '₹' ? `₹${v.toLocaleString('en-IN')}` : `${v.toLocaleString('en-IN')}${d.unit ? (d.unit.startsWith('/') || d.unit === '%' ? d.unit : ` ${d.unit}`) : ''}`);
      return `${d.label}: ${fmt(d.baseline)} → **${fmt(d.scenario)}** (${d.delta >= 0 ? '+' : ''}${d.delta.toLocaleString('en-IN')})`;
    })),
    '',
    `**Bottleneck:** ${hk ? `${hk.name} at ${hk.scenarioPressure}% (was ${hk.baselinePressure}%)` : res.departments[0]?.name}. Zones flagged: ${res.zones.filter((z) => z.status !== 'NORMAL').map((z) => `${z.name} (${z.status})`).join(', ') || 'none'}.`,
    '',
    '**Recommended plan**',
    bullet(res.mitigations.map((m) => `**${m.title}** — ${m.gain} (₹${m.costINR.toLocaleString('en-IN')}, ${m.leadTimeMins} min lead)`)),
    '',
    `Open the **Weather Twin** page to see the map propagation and press *Apply to live system* to create the action card and tickets.`,
  ].join('\n');
}

// ------------------------------------------------------------------
// Chat orchestration
// ------------------------------------------------------------------
export interface ChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  role: string;
  userName?: string;
  guestId?: string;
  roomNumber?: string;
}

export async function chat(req: ChatRequest) {
  const role = (req.role || 'GUEST').toUpperCase();
  const isGuest = role === 'GUEST';
  const message = String(req.message || '').trim();
  if (!message) throw new Error('Message is required');

  const ctx = await buildResortContext(!isGuest);
  const intent = detectIntent(message, role);
  const actions: Array<{ type: string; label: string; detail: string; reference?: string }> = [];
  let toolResult: unknown = null;
  let extraGrounding = '';

  // Tool 1 — guests asking for something physical become real dispatched requests.
  if (isGuest && intent === 'request' && req.guestId && req.roomNumber) {
    try {
      const dispatched = await processConciergeMessage(req.guestId, req.roomNumber, message);
      toolResult = dispatched;
      actions.push({
        type: 'SERVICE_REQUEST_CREATED',
        label: `Request ${dispatched.requestId} dispatched`,
        detail: `${dispatched.intent} · ${dispatched.priority} priority · ${dispatched.assignedStaff?.name ? `assigned to ${dispatched.assignedStaff.name}` : 'routed to supervisor'} · ETA ${dispatched.estimatedMinutes} min`,
        reference: dispatched.requestId,
      });
      return {
        reply: `${dispatched.guestResponse}\n\n_Reference **${dispatched.requestId}** · ${dispatched.category} · ${dispatched.priority} priority · ETA ~${dispatched.estimatedMinutes} min. You can track it in "My requests" and rate it once complete._`,
        intent: 'request',
        provider: 'resort-brain',
        model: 'autonomy-orchestrator',
        mode: 'TOOL' as const,
        actions,
        toolResult,
        context: publicContext(ctx),
        latencyMs: 0,
      };
    } catch {
      /* fall through to normal answering */
    }
  }

  // Tool 2 — operators asking a what-if actually run the digital twin.
  let whatIf: Awaited<ReturnType<typeof runWhatIf>> | null = null;
  if (!isGuest && (intent === 'whatif' || /what if/i.test(message))) {
    const parsed = parseScenarioFromText(message);
    if (parsed) {
      whatIf = await runWhatIf({
        rainIntensityMmHr: parsed.rainIntensityMmHr,
        durationHours: parsed.durationHours,
        windKph: parsed.windKph,
        tempC: parsed.tempC,
        stormDistanceKm: parsed.stormDistanceKm,
        label: 'Copilot scenario',
      });
      toolResult = { scenario: whatIf.scenario, deltas: whatIf.deltas, mitigations: whatIf.mitigations };
      extraGrounding = `\nDIGITAL TWIN WHAT-IF RESULT:\n${whatIf.narrativeSeed}\nDeltas: ${whatIf.deltas.map((d) => `${d.label} ${d.baseline}→${d.scenario}`).join('; ')}\nMitigations: ${whatIf.mitigations.map((m) => `${m.title} (${m.gain})`).join('; ')}`;
      actions.push({ type: 'TWIN_SIMULATION', label: 'Digital twin re-run', detail: `Severity ${whatIf.scenario.severity} (${whatIf.scenario.band})` });
    }
  }

  const system = isGuest
    ? `You are Aria, the AI concierge of ${RESORT_SITE.name} in ${RESORT_SITE.city}. You are warm, concise and practical. You ALWAYS ground answers in the live resort context provided. You never invent prices or availability you were not given. When weather is bad, proactively recommend indoor alternatives. Use short markdown with bold key facts and bullet lists. Keep answers under 180 words.

RESORT FACTS:
${JSON.stringify(RESORT_FACTS)}

LIVE CONTEXT:
${contextDigest(ctx)}`
    : `You are the Smart Resort 360 Operations Copilot for the duty manager. You are precise, quantitative and action-oriented. Ground every statement in the live context; quote real numbers. Structure answers as: situation → impact → 3 prioritised actions. Use markdown bullets, bold the numbers. Under 220 words unless asked for more.

LIVE CONTEXT:
${contextDigest(ctx)}${extraGrounding}`;

  const history: LlmMessage[] = (req.history ?? []).slice(-6).map((m) => ({ role: m.role, content: m.content }));
  const result = await llmComplete({
    system,
    messages: [...history, { role: 'user', content: message }],
    fallback: () => (whatIf ? whatIfNarrative(whatIf) : onboardAnswer(message, ctx, role, req.roomNumber)),
    temperature: isGuest ? 0.6 : 0.3,
  });

  return {
    reply: result.text,
    intent,
    provider: result.provider,
    model: result.model,
    mode: result.mode,
    note: result.note,
    actions,
    toolResult,
    context: publicContext(ctx),
    latencyMs: result.latencyMs,
  };
}

function publicContext(ctx: ResortContext) {
  return {
    weather: { mode: ctx.weather.mode, label: ctx.weather.current.label, tempC: ctx.weather.current.tempC, precipMm: ctx.weather.current.precipMm, windKph: ctx.weather.current.windKph, severity: ctx.weather.severity.index, band: ctx.weather.severity.band },
    occupancyPct: ctx.occupancyPct,
    activeRequests: ctx.requests.active,
    openTickets: ctx.tickets.length,
    socialNet: ctx.social?.sentiment.net ?? null,
    zonesAtRisk: ctx.zonesAtRisk.length,
  };
}

// ------------------------------------------------------------------
// Executive briefing (Live Intel page)
// ------------------------------------------------------------------
export async function generateBriefing(focus?: string) {
  const ctx = await buildResortContext(true);
  const system = `You are the Chief of Staff AI for ${RESORT_SITE.name}. Produce a crisp executive weather-operations briefing for the duty manager using ONLY the live context. Format:
**SITUATION** (2 lines) → **IMPACT ON OPERATIONS** (3 bullets with numbers) → **PUBLIC SIGNAL** (1–2 bullets) → **DECISIONS REQUIRED NOW** (3 numbered actions with owner + deadline) → **CONFIDENCE** (one line stating data sources). Under 280 words.

LIVE CONTEXT:
${contextDigest(ctx)}`;

  const result = await llmComplete({
    system,
    messages: [{ role: 'user', content: focus || 'Give me the current weather-operations briefing with prioritised decisions.' }],
    fallback: () => briefingAnswer(ctx),
    temperature: 0.3,
  });

  return { ...result, context: publicContext(ctx), llm: llmStatus(), generatedAt: new Date().toISOString() };
}

export { llmStatus };
