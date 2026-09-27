// ============================================================
// FEATURE 3 — REAL-WORLD SOCIAL SIGNAL INTEGRATION
// Pulls publicly available social / open-web signals about the weather
// event around the resort, scores sentiment + topics, geo-locates them,
// detects emerging conditions and feeds the AI + digital twin.
//
// Sources (all keyless, public):
//   • GDELT 2.0 Doc API   — global news/social article index
//   • Reddit public JSON  — r/mumbai, r/india traveller chatter
//   • Mastodon public tag timelines — open micro-blog firehose
// Falls back to a weather-coupled synthetic traveller stream (clearly
// labelled) when the host has no egress, so the demo never shows an
// empty feed. The browser can also relay real results via /ingest.
// ============================================================

import { RESORT_SITE, haversineKm } from './resortSite';
import { WorldSignal } from '../../models/WorldSignal';
import type { WeatherIntel } from './weatherService';

export type SocialMode = 'LIVE' | 'RELAY' | 'SIMULATED' | 'MIXED';

export interface SocialSignal {
  id: string;
  platform: 'X' | 'Reddit' | 'Mastodon' | 'News' | 'TripAdvisor' | 'Instagram' | 'GoogleReview';
  author: string;
  handle: string;
  text: string;
  url: string;
  timestamp: string;
  minutesAgo: number;
  sentiment: { score: number; label: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' };
  topics: string[];
  severityHint: number;
  geo: { lat: number; lon: number; place: string; distanceKm: number } | null;
  engagement: number;
  isTraveller: boolean;
  verified: boolean;
  source: 'GDELT' | 'Reddit' | 'Mastodon' | 'Synthetic' | 'Relay';
}

export interface SocialIntel {
  mode: SocialMode;
  fetchedAt: string;
  providers: Array<{ name: string; status: 'OK' | 'UNREACHABLE' | 'EMPTY'; count: number; note?: string }>;
  totals: { signals: number; travellers: number; last60min: number };
  sentiment: { positive: number; neutral: number; negative: number; net: number; trend: 'IMPROVING' | 'STABLE' | 'WORSENING' };
  themes: Array<{ topic: string; label: string; count: number; sentiment: number; severity: number; share: number }>;
  timeline: Array<{ bucket: string; count: number; negative: number }>;
  emerging: Array<{ id: string; title: string; detail: string; confidence: number; level: 'INFO' | 'WATCH' | 'ALERT'; topics: string[] }>;
  travellerImpact: { cancellations: number; delays: number; complaints: number; praise: number; riskScore: number };
  signals: SocialSignal[];
  aiSummary: string;
  /** Feeds straight into the twin: extra demand/ops pressure derived from chatter. */
  twinInputs: { social_pressure: number; reputation_risk: number; arrival_disruption: number };
}

// ------------------------------------------------------------------
// Lexicons
// ------------------------------------------------------------------
const NEG = ['flood', 'flooded', 'flooding', 'waterlog', 'waterlogged', 'cancel', 'cancelled', 'delay', 'delayed', 'stranded', 'stuck', 'jam', 'gridlock', 'outage', 'blackout', 'power cut', 'damage', 'damaged', 'ruined', 'terrible', 'awful', 'worst', 'horrible', 'angry', 'refund', 'complaint', 'poor', 'leak', 'leaking', 'unsafe', 'danger', 'dangerous', 'closed', 'shut', 'chaos', 'nightmare', 'warning', 'alert', 'evacuat', 'disrupt', 'collapse', 'miss', 'missed'];
const POS = ['beautiful', 'amazing', 'lovely', 'great', 'excellent', 'perfect', 'cosy', 'cozy', 'wonderful', 'enjoy', 'enjoying', 'love', 'loved', 'best', 'stunning', 'relax', 'relaxing', 'recommend', 'smooth', 'helpful', 'clean', 'safe', 'refreshing', 'pleasant', 'thanks', 'thank you', 'kudos'];

const TOPIC_MAP: Array<{ topic: string; label: string; keys: string[]; severity: number }> = [
  { topic: 'flooding', label: 'Flooding / waterlogging', keys: ['flood', 'waterlog', 'water log', 'knee deep', 'submerg', 'drain'], severity: 0.9 },
  { topic: 'transport', label: 'Transport disruption', keys: ['traffic', 'jam', 'train', 'local', 'highway', 'road', 'cab', 'uber', 'ola', 'bridge', 'metro', 'gridlock'], severity: 0.7 },
  { topic: 'flights', label: 'Flight / travel delays', keys: ['flight', 'airport', 'delay', 'divert', 'boarding', 'terminal'], severity: 0.75 },
  { topic: 'power', label: 'Power / utility outage', keys: ['power cut', 'outage', 'blackout', 'electricity', 'generator', 'no power'], severity: 0.85 },
  { topic: 'storm', label: 'Storm & wind', keys: ['storm', 'thunder', 'lightning', 'gust', 'wind', 'cyclone', 'squall'], severity: 0.8 },
  { topic: 'rain', label: 'Rainfall', keys: ['rain', 'downpour', 'shower', 'monsoon', 'drizzle', 'imd'], severity: 0.5 },
  { topic: 'booking', label: 'Booking / cancellation intent', keys: ['cancel', 'refund', 'reschedul', 'postpone', 'book', 'checkout', 'check-in', 'check in'], severity: 0.8 },
  { topic: 'hospitality', label: 'Hotel & resort experience', keys: ['resort', 'hotel', 'room', 'staff', 'buffet', 'restaurant', 'spa', 'pool', 'service'], severity: 0.4 },
  { topic: 'safety', label: 'Safety advisory', keys: ['advisory', '警', 'warning', 'ndrf', 'rescue', 'evacuat', 'helpline', 'alert'], severity: 0.95 },
];

const TRAVELLER_HINTS = ['trip', 'travel', 'holiday', 'vacation', 'weekend', 'resort', 'hotel', 'check-in', 'checkin', 'booking', 'stay', 'getaway', 'tourist', 'guest'];

const NEARBY_PLACES = [
  { place: 'Palm Beach Road', lat: 19.0452, lon: 73.0192 },
  { place: 'CBD Belapur', lat: 19.0154, lon: 73.0374 },
  { place: 'Vashi Bridge', lat: 19.0656, lon: 72.999 },
  { place: 'Nerul Jetty', lat: 19.0322, lon: 73.0159 },
  { place: 'Panvel Junction', lat: 18.9894, lon: 73.1175 },
  { place: 'Kharghar Hills', lat: 19.0473, lon: 73.0693 },
  { place: 'NMIA Access Road', lat: 18.9894, lon: 73.07 },
  { place: 'Seawoods Grand', lat: 19.0197, lon: 73.0169 },
  { place: 'Resort Gate 1', lat: 19.0356, lon: 73.0296 },
  { place: 'Shoreline Promenade', lat: 19.0301, lon: 73.0331 },
];

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function scoreSentiment(text: string) {
  const t = ` ${text.toLowerCase()} `;
  let score = 0;
  NEG.forEach((w) => { if (t.includes(w)) score -= 1; });
  POS.forEach((w) => { if (t.includes(w)) score += 1; });
  const norm = Math.max(-1, Math.min(1, score / 3));
  return { score: Number(norm.toFixed(2)), label: (norm > 0.15 ? 'POSITIVE' : norm < -0.15 ? 'NEGATIVE' : 'NEUTRAL') as SocialSignal['sentiment']['label'] };
}

function detectTopics(text: string) {
  const t = text.toLowerCase();
  const topics: string[] = [];
  let severity = 0;
  TOPIC_MAP.forEach((m) => {
    if (m.keys.some((k) => t.includes(k))) {
      topics.push(m.topic);
      severity = Math.max(severity, m.severity);
    }
  });
  return { topics: topics.length ? topics : ['general'], severityHint: severity };
}

function placeFor(seed: number) {
  const p = NEARBY_PLACES[seed % NEARBY_PLACES.length];
  const jitter = ((seed * 37) % 100) / 12000;
  const lat = p.lat + jitter;
  const lon = p.lon - jitter;
  return { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)), place: p.place, distanceKm: haversineKm(RESORT_SITE.lat, RESORT_SITE.lon, lat, lon) };
}

function buildSignal(base: Partial<SocialSignal> & { id: string; text: string; platform: SocialSignal['platform']; timestamp: string; source: SocialSignal['source'] }, idx: number): SocialSignal {
  const sentiment = scoreSentiment(base.text);
  const { topics, severityHint } = detectTopics(base.text);
  const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(base.timestamp).getTime()) / 60000));
  return {
    id: base.id,
    platform: base.platform,
    author: base.author ?? 'Public account',
    handle: base.handle ?? '@public',
    text: base.text,
    url: base.url ?? '#',
    timestamp: base.timestamp,
    minutesAgo,
    sentiment,
    topics,
    severityHint,
    geo: base.geo ?? placeFor(idx + base.text.length),
    engagement: base.engagement ?? ((idx * 37) % 240) + 8,
    isTraveller: TRAVELLER_HINTS.some((h) => base.text.toLowerCase().includes(h)),
    verified: base.verified ?? false,
    source: base.source,
  };
}

// ------------------------------------------------------------------
// Live providers
// ------------------------------------------------------------------
async function getJson(url: string, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'SmartResort360/1.0 (ops-intel)', accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const GDELT_URL =
  'https://api.gdeltproject.org/api/v2/doc/doc?query=' +
  encodeURIComponent('(Mumbai OR "Navi Mumbai") (rain OR flood OR storm OR monsoon OR weather OR waterlogging)') +
  '&mode=artlist&maxrecords=25&sort=datedesc&format=json';

const REDDIT_URL = 'https://www.reddit.com/r/mumbai/search.json?q=rain%20OR%20flood%20OR%20traffic%20OR%20weather&restrict_sr=1&sort=new&limit=25&t=week';

const MASTODON_URL = 'https://mastodon.social/api/v1/timelines/tag/mumbai?limit=20';

export function parseGdelt(json: any): SocialSignal[] {
  const arts = Array.isArray(json?.articles) ? json.articles : [];
  return arts.map((a: any, i: number) =>
    buildSignal({
      id: `gdelt-${a.url?.slice(-24) ?? i}`,
      platform: 'News',
      author: a.domain ?? 'News wire',
      handle: `@${(a.domain ?? 'news').split('.')[0]}`,
      text: a.title ?? 'Weather report',
      url: a.url ?? '#',
      timestamp: a.seendate
        ? new Date(`${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}T${a.seendate.slice(9, 11)}:${a.seendate.slice(11, 13)}:00Z`).toISOString()
        : new Date().toISOString(),
      verified: true,
      source: 'GDELT',
    }, i),
  );
}

export function parseReddit(json: any): SocialSignal[] {
  const kids = json?.data?.children ?? [];
  return kids.map((c: any, i: number) => {
    const d = c.data ?? {};
    return buildSignal({
      id: `rd-${d.id ?? i}`,
      platform: 'Reddit',
      author: `u/${d.author ?? 'redditor'}`,
      handle: `r/${d.subreddit ?? 'mumbai'}`,
      text: `${d.title ?? ''} ${String(d.selftext ?? '').slice(0, 180)}`.trim(),
      url: d.permalink ? `https://reddit.com${d.permalink}` : '#',
      timestamp: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : new Date().toISOString(),
      engagement: (d.score ?? 0) + (d.num_comments ?? 0),
      source: 'Reddit',
    }, i);
  });
}

export function parseMastodon(json: any): SocialSignal[] {
  const arr = Array.isArray(json) ? json : [];
  return arr.map((s: any, i: number) =>
    buildSignal({
      id: `mst-${s.id ?? i}`,
      platform: 'Mastodon',
      author: s.account?.display_name || s.account?.username || 'Mastodon user',
      handle: `@${s.account?.acct ?? 'user'}`,
      text: String(s.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240),
      url: s.url ?? '#',
      timestamp: s.created_at ?? new Date().toISOString(),
      engagement: (s.favourites_count ?? 0) + (s.reblogs_count ?? 0),
      source: 'Mastodon',
    }, i),
  );
}

// ------------------------------------------------------------------
// Weather-coupled synthetic traveller stream (labelled fallback)
// ------------------------------------------------------------------
const AUTHORS = [
  ['Ananya Kulkarni', '@ananya_wanders', 'X'], ['Rohit Shetty', '@rohit_travels', 'X'],
  ['Meera Nair', '@meeranair', 'Instagram'], ['u/navi_local', 'r/mumbai', 'Reddit'],
  ['Traveller_Sam', '@sam_onthego', 'X'], ['Priya Desai', '@priyad', 'TripAdvisor'],
  ['Arjun Mehta', '@arjunm', 'GoogleReview'], ['Navi Mumbai Traffic Watch', '@nmtrafficwatch', 'X'],
  ['Kavya Raghav', '@kavyaraghav', 'Instagram'], ['u/weekend_escapes', 'r/india', 'Reddit'],
  ['Deepak Iyer', '@deepakiyer', 'X'], ['Coastal Weather India', '@coastalwx', 'X'],
] as const;

const TEMPLATES_SEVERE = [
  'Palm Beach Road is completely waterlogged near {place} — knee deep water, cabs refusing pickups. Our resort transfer is stuck.',
  'IMD red alert for Navi Mumbai. {mm}mm in the last hour. Anyone else stranded near {place}?',
  'Flight out of NMIA delayed 2 hrs because of the storm. Extending our resort stay another night.',
  'Power flickering across {place} — third cut this evening. Hope the resort generator holds up.',
  'Beach access shut at the resort, staff moved everything indoors. Honestly handled well but the lawn dinner is cancelled.',
  'Massive jam on the approach road to the resort, {place} is gridlocked. 40 min for 2 km.',
  'Wind is howling. Parasols flying off the pool deck near {place}. Please stay inside people.',
  'Our check-in is at 3, currently stranded at {place} due to flooding. Called the resort, they are holding the room.',
];
const TEMPLATES_MODERATE = [
  'Steady rain over {place}, roads slow but moving. Resort shuttle running 15 min late.',
  'Grey skies and {mm}mm showers today — perfect excuse for the indoor spa at the resort.',
  'Traffic building near {place} after the afternoon shower. Leave early if you have a check-in.',
  'Monsoon vibes at the shoreline. Buffet moved indoors, staff were quick about it.',
  'Drizzle at {place}, humidity is brutal at {rh}%. Pool deck still open for now.',
  'Anyone know if the banquet lawn event tonight is still on? Rain looks persistent.',
];
const TEMPLATES_CALM = [
  'Gorgeous evening at the shoreline near {place}. {t}°C and a light breeze — best weekend getaway.',
  'Sunset from the infinity pool is unreal today. Zero rain, clear skies.',
  'Roads clear around {place}, reached the resort in 25 minutes flat.',
  'Breakfast on the lawn, {t}°C, no humidity. Highly recommend this resort in this season.',
  'Great service at check-in, room ready early. Weather is perfect for the beach.',
];

function synthesise(weather: WeatherIntel | null): SocialSignal[] {
  const sev = weather?.severity.index ?? 0.25;
  const mm = weather?.current.precipMm ?? 2;
  const t = weather?.current.tempC ?? 29;
  const rh = weather?.current.humidity ?? 78;
  const bucket = sev >= 0.55 ? TEMPLATES_SEVERE : sev >= 0.28 ? TEMPLATES_MODERATE : TEMPLATES_CALM;
  const mixIn = sev >= 0.55 ? TEMPLATES_MODERATE : sev >= 0.28 ? TEMPLATES_CALM : TEMPLATES_MODERATE;
  const count = sev >= 0.55 ? 14 : sev >= 0.28 ? 11 : 8;
  const halfHour = Math.floor(Date.now() / (30 * 60 * 1000));

  return Array.from({ length: count }, (_, i) => {
    const pick = (i % 4 === 3 ? mixIn : bucket)[(halfHour + i * 3) % (i % 4 === 3 ? mixIn.length : bucket.length)];
    const place = NEARBY_PLACES[(halfHour + i * 5) % NEARBY_PLACES.length];
    const [author, handle, platform] = AUTHORS[(halfHour + i * 7) % AUTHORS.length];
    const text = pick
      .replace('{place}', place.place)
      .replace('{mm}', String(Math.max(1, Math.round(mm * 6))))
      .replace('{t}', String(Math.round(t)))
      .replace('{rh}', String(Math.round(rh)));
    // Weight the stream towards the last 90 minutes so trend + spike detection is meaningful.
    const minutesAgo = i < 6 ? 3 + i * 12 + ((halfHour + i) % 7) : 80 + (i - 6) * 26 + ((halfHour + i) % 13);
    return buildSignal({
      id: `syn-${halfHour}-${i}`,
      platform: platform as SocialSignal['platform'],
      author,
      handle,
      text,
      url: '#',
      timestamp: new Date(Date.now() - minutesAgo * 60000).toISOString(),
      engagement: 6 + ((halfHour * (i + 3)) % 320),
      verified: i % 5 === 0,
      geo: { lat: place.lat, lon: place.lon, place: place.place, distanceKm: haversineKm(RESORT_SITE.lat, RESORT_SITE.lon, place.lat, place.lon) },
      source: 'Synthetic',
    }, i);
  });
}

// ------------------------------------------------------------------
// Aggregation
// ------------------------------------------------------------------
function aggregate(signals: SocialSignal[], mode: SocialMode, providers: SocialIntel['providers'], weather: WeatherIntel | null): SocialIntel {
  const sorted = [...signals].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 40);
  const total = sorted.length || 1;

  const positive = sorted.filter((s) => s.sentiment.label === 'POSITIVE').length;
  const negative = sorted.filter((s) => s.sentiment.label === 'NEGATIVE').length;
  const neutral = total - positive - negative;
  const net = Number((((positive - negative) / total) * 100).toFixed(0));

  const recent = sorted.filter((s) => s.minutesAgo <= 90);
  const older = sorted.filter((s) => s.minutesAgo > 90);
  const recentNeg = recent.length ? recent.filter((s) => s.sentiment.label === 'NEGATIVE').length / recent.length : 0;
  const olderNeg = older.length ? older.filter((s) => s.sentiment.label === 'NEGATIVE').length / older.length : recentNeg;
  const trend = recentNeg > olderNeg + 0.1 ? 'WORSENING' : recentNeg < olderNeg - 0.1 ? 'IMPROVING' : 'STABLE';

  const themeCounts = new Map<string, { count: number; sentimentSum: number; severity: number }>();
  sorted.forEach((s) => s.topics.forEach((tp) => {
    const cur = themeCounts.get(tp) ?? { count: 0, sentimentSum: 0, severity: 0 };
    const def = TOPIC_MAP.find((m) => m.topic === tp);
    themeCounts.set(tp, { count: cur.count + 1, sentimentSum: cur.sentimentSum + s.sentiment.score, severity: Math.max(cur.severity, def?.severity ?? 0.3) });
  }));

  const themes = [...themeCounts.entries()]
    .map(([topic, v]) => ({
      topic,
      label: TOPIC_MAP.find((m) => m.topic === topic)?.label ?? 'General chatter',
      count: v.count,
      sentiment: Number((v.sentimentSum / v.count).toFixed(2)),
      severity: v.severity,
      share: Number(((v.count / total) * 100).toFixed(0)),
    }))
    .sort((a, b) => b.count * b.severity - a.count * a.severity)
    .slice(0, 6);

  const timeline = Array.from({ length: 12 }, (_, i) => {
    const from = (11 - i) * 30;
    const to = from - 30;
    const inBucket = sorted.filter((s) => s.minutesAgo <= from && s.minutesAgo > Math.max(0, to));
    return {
      bucket: `-${from}m`,
      count: inBucket.length,
      negative: inBucket.filter((s) => s.sentiment.label === 'NEGATIVE').length,
    };
  });

  const emerging: SocialIntel['emerging'] = [];
  themes.forEach((th) => {
    const recentCount = recent.filter((s) => s.topics.includes(th.topic)).length;
    const olderCount = older.filter((s) => s.topics.includes(th.topic)).length;
    const rising = recentCount >= 2 && recentCount > olderCount;
    if (rising && th.severity >= 0.7) {
      emerging.push({
        id: `em-${th.topic}`,
        title: `${th.label} spiking near the resort`,
        detail: `${recentCount} public reports in the last 90 minutes (vs ${olderCount} earlier). Average sentiment ${th.sentiment}. Cross-check with the ${th.topic === 'transport' ? 'arrival/airport transfer' : th.topic === 'power' ? 'utility block and DG readiness' : 'impacted zones'} before guests report it.`,
        confidence: Number(Math.min(0.96, 0.45 + recentCount * 0.09 + th.severity * 0.25).toFixed(2)),
        level: th.severity >= 0.85 ? 'ALERT' : 'WATCH',
        topics: [th.topic],
      });
    }
  });
  if (!emerging.length) {
    emerging.push({
      id: 'em-none',
      title: 'No emerging public incident detected',
      detail: `${sorted.length} signals scanned. Negative share ${(negative / total * 100).toFixed(0)}%, no topic is accelerating above the alert threshold.`,
      confidence: 0.8,
      level: 'INFO',
      topics: [],
    });
  }

  const countKeys = (keys: string[]) => sorted.filter((s) => keys.some((k) => s.text.toLowerCase().includes(k))).length;
  const cancellations = countKeys(['cancel', 'refund', 'reschedul', 'postpone']);
  const delays = countKeys(['delay', 'stuck', 'stranded', 'late', 'jam', 'traffic']);
  const complaints = sorted.filter((s) => s.sentiment.label === 'NEGATIVE' && s.topics.includes('hospitality')).length;
  const praise = sorted.filter((s) => s.sentiment.label === 'POSITIVE').length;
  const riskScore = Number(clamp((cancellations * 0.12 + delays * 0.07 + complaints * 0.1 + (negative / total) * 0.5)).toFixed(2));

  const travellers = sorted.filter((s) => s.isTraveller).length;
  const social_pressure = Number(clamp((negative / total) * 0.6 + (delays / Math.max(1, total)) * 0.6).toFixed(2));
  const reputation_risk = Number(clamp(complaints * 0.12 + (negative / total) * 0.55).toFixed(2));
  const arrival_disruption = Number(clamp((delays / Math.max(1, total)) * 0.9 + (weather?.severity.index ?? 0) * 0.35).toFixed(2));

  const topTheme = themes[0];
  const aiSummary =
    `${sorted.length} public signals scanned across ${providers.filter((p) => p.status === 'OK').map((p) => p.name).join(', ') || 'the fallback stream'}. ` +
    `Net sentiment ${net > 0 ? '+' : ''}${net} (${trend.toLowerCase()}). ` +
    (topTheme ? `Dominant theme: ${topTheme.label} (${topTheme.count} mentions, ${topTheme.share}% of chatter). ` : '') +
    `${travellers} signals come from travellers/guests; ${cancellations} mention cancellation or refund intent and ${delays} mention arrival delays. ` +
    `Derived twin inputs — social pressure ${social_pressure}, reputation risk ${reputation_risk}, arrival disruption ${arrival_disruption}.`;

  return {
    mode,
    fetchedAt: new Date().toISOString(),
    providers,
    totals: { signals: sorted.length, travellers, last60min: sorted.filter((s) => s.minutesAgo <= 60).length },
    sentiment: { positive, neutral, negative, net, trend },
    themes,
    timeline,
    emerging,
    travellerImpact: { cancellations, delays, complaints, praise, riskScore },
    signals: sorted,
    aiSummary,
    twinInputs: { social_pressure, reputation_risk, arrival_disruption },
  };
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------
const CACHE_TTL_MS = 4 * 60 * 1000;
let cache: { data: SocialIntel; at: number } | null = null;
let relayed: { signals: SocialSignal[]; at: number } | null = null;

export async function getSocialIntel(weather: WeatherIntel | null, force = false): Promise<SocialIntel> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const providers: SocialIntel['providers'] = [];
  const collected: SocialSignal[] = [];

  const results = await Promise.allSettled([getJson(GDELT_URL, 7000), getJson(REDDIT_URL, 7000), getJson(MASTODON_URL, 7000)]);

  const [gd, rd, ms] = results;
  if (gd.status === 'fulfilled') {
    const parsed = parseGdelt(gd.value);
    collected.push(...parsed);
    providers.push({ name: 'GDELT', status: parsed.length ? 'OK' : 'EMPTY', count: parsed.length });
  } else {
    providers.push({ name: 'GDELT', status: 'UNREACHABLE', count: 0, note: String((gd as PromiseRejectedResult).reason?.message ?? gd.status) });
  }
  if (rd.status === 'fulfilled') {
    const parsed = parseReddit(rd.value);
    collected.push(...parsed);
    providers.push({ name: 'Reddit', status: parsed.length ? 'OK' : 'EMPTY', count: parsed.length });
  } else {
    providers.push({ name: 'Reddit', status: 'UNREACHABLE', count: 0, note: String((rd as PromiseRejectedResult).reason?.message ?? rd.status) });
  }
  if (ms.status === 'fulfilled') {
    const parsed = parseMastodon(ms.value);
    collected.push(...parsed);
    providers.push({ name: 'Mastodon', status: parsed.length ? 'OK' : 'EMPTY', count: parsed.length });
  } else {
    providers.push({ name: 'Mastodon', status: 'UNREACHABLE', count: 0, note: String((ms as PromiseRejectedResult).reason?.message ?? ms.status) });
  }

  // Browser-relayed live signals (valid for 20 minutes)
  if (relayed && Date.now() - relayed.at < 20 * 60 * 1000) {
    collected.push(...relayed.signals);
    providers.push({ name: 'Browser relay', status: 'OK', count: relayed.signals.length, note: 'Live signals fetched by the operator browser' });
  }

  let mode: SocialMode = collected.length ? 'LIVE' : 'SIMULATED';
  if (collected.length && relayed && Date.now() - relayed.at < 20 * 60 * 1000) mode = collected.length > relayed.signals.length ? 'MIXED' : 'RELAY';

  if (collected.length < 6) {
    const synth = synthesise(weather);
    collected.push(...synth);
    providers.push({
      name: 'Weather-coupled stream',
      status: 'OK',
      count: synth.length,
      note: 'Fallback traveller stream generated from the live weather state (labelled simulated) so the feed is never empty.',
    });
    mode = collected.length > synth.length ? 'MIXED' : 'SIMULATED';
  }

  const data = aggregate(collected, mode, providers, weather);
  cache = { data, at: Date.now() };
  void persistSignals(data);
  return data;
}

/** Store the strongest signals in the existing WorldSignal collection so the rest of the platform reacts. */
async function persistSignals(intel: SocialIntel) {
  try {
    const top = intel.emerging.filter((e) => e.level !== 'INFO');
    if (!top.length) return;
    for (const e of top) {
      const exists = await WorldSignal.findOne({ signal_type: 'local_event', 'data.emergingId': e.id, is_active: true });
      if (exists) continue;
      await WorldSignal.create({
        signal_type: 'local_event',
        source: `social:${intel.mode.toLowerCase()}`,
        data: { emergingId: e.id, title: e.title, detail: e.detail, topics: e.topics, sentimentNet: intel.sentiment.net },
        severity: Number(Math.min(1, e.confidence).toFixed(2)),
        affected_departments: e.topics.includes('transport') ? ['front_desk'] : e.topics.includes('power') ? ['maintenance'] : ['front_desk', 'housekeeping'],
        expected_impact: e.detail.slice(0, 220),
        is_active: true,
      });
    }
  } catch {
    /* persistence is best-effort — never breaks the feed */
  }
}

export function ingestSocialRelay(payload: { gdelt?: any; reddit?: any; mastodon?: any }) {
  const signals: SocialSignal[] = [];
  try { if (payload.gdelt) signals.push(...parseGdelt(payload.gdelt)); } catch { /* ignore */ }
  try { if (payload.reddit) signals.push(...parseReddit(payload.reddit)); } catch { /* ignore */ }
  try { if (payload.mastodon) signals.push(...parseMastodon(payload.mastodon)); } catch { /* ignore */ }
  if (signals.length) {
    relayed = { signals: signals.map((s) => ({ ...s, source: 'Relay' as const })), at: Date.now() };
    cache = null; // force recompute on next read
  }
  return { accepted: signals.length };
}
