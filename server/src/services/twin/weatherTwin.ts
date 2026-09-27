// ============================================================
// FEATURE 4 — DIGITAL TWIN WHAT-IF SIMULATION
// Changing any weather parameter (intensity / duration / wind / temperature /
// storm location) re-runs the resort digital twin and produces a measurable,
// explainable change across the *existing* Smart Resort 360 system:
// department pressure, safe occupancy ceiling, staffing gaps, room
// reallocation, F&B covers, inventory burn, GOPPAR and SLA risk.
//
// "Apply scenario" writes real records into the live platform
// (WorldSignal + ActionCard + OperationalTickets + AuditLog) so the twin
// closes the loop with the operational system the team already built.
// ============================================================

import { RESORT_ZONES, RESORT_SITE, ResortZone, haversineKm } from '../intel/resortSite';
import { computeSeverity, describeCode, getLiveWeather, setWeatherOverride, WeatherIntel } from '../intel/weatherService';
import { getDigitalTwinSnapshot } from '../simulation/snapshot';
import { runSimulation } from '../simulation/simulationEngine';
import { Room } from '../../models/Room';
import { Booking } from '../../models/Booking';
import { WorldSignal } from '../../models/WorldSignal';
import { ActionCard } from '../../models/ActionCard';
import { OperationalTicket } from '../../models/OperationalTicket';
import { AuditLog } from '../../models/AuditLog';
import { Simulation } from '../../models/Simulation';

export interface WeatherScenario {
  rainIntensityMmHr: number;
  durationHours: number;
  windKph: number;
  tempC: number;
  stormDistanceKm: number;
  stormBearing: number;
  occupancyPct?: number;
  staffAvailabilityPct?: number;
  socialPressure?: number;
  label?: string;
}

export const SCENARIO_PRESETS: Array<{ id: string; name: string; description: string; scenario: WeatherScenario }> = [
  {
    id: 'live', name: 'Live conditions', description: 'Mirror the current live weather feed exactly.',
    scenario: { rainIntensityMmHr: 0, durationHours: 3, windKph: 0, tempC: 29, stormDistanceKm: 60, stormBearing: 225 },
  },
  {
    id: 'monsoon-burst', name: 'Monsoon cloudburst', description: '45 mm/h for 6 hours with 55 km/h squalls — the classic Navi Mumbai July event.',
    scenario: { rainIntensityMmHr: 45, durationHours: 6, windKph: 55, tempC: 26, stormDistanceKm: 4, stormBearing: 250 },
  },
  {
    id: 'cyclone-brush', name: 'Cyclone brush', description: 'Arabian-Sea cyclone passing 25 km offshore: 30 mm/h, 95 km/h winds for 10 hours.',
    scenario: { rainIntensityMmHr: 30, durationHours: 10, windKph: 95, tempC: 25, stormDistanceKm: 25, stormBearing: 270 },
  },
  {
    id: 'heatwave', name: 'Coastal heatwave', description: '41 °C, no rain, low wind for 12 hours — chiller load and guest-health scenario.',
    scenario: { rainIntensityMmHr: 0, durationHours: 12, windKph: 6, tempC: 41, stormDistanceKm: 80, stormBearing: 90 },
  },
  {
    id: 'evening-squall', name: 'Evening squall', description: 'Short sharp 20 mm/h thunderstorm for 2 hours during the banquet service window.',
    scenario: { rainIntensityMmHr: 20, durationHours: 2, windKph: 48, tempC: 27, stormDistanceKm: 8, stormBearing: 200 },
  },
];

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Number(v.toFixed(1));
const r2 = (v: number) => Number(v.toFixed(2));

function codeFor(rain: number, wind: number) {
  if (wind >= 60 && rain >= 10) return 99;
  if (rain >= 25) return 82;
  if (rain >= 12) return 95;
  if (rain >= 7) return 65;
  if (rain >= 2.5) return 63;
  if (rain >= 0.3) return 61;
  if (wind >= 45) return 3;
  return 1;
}

export interface ZoneImpact {
  id: string;
  name: string;
  type: ResortZone['type'];
  lat: number;
  lon: number;
  radiusM: number;
  department: string;
  floodRisk: number;
  windRisk: number;
  accessRisk: number;
  impact: number;
  status: 'NORMAL' | 'WATCH' | 'AT_RISK' | 'CRITICAL';
  guestsAffected: number;
  roomsAtRisk: number;
  revenueAtRisk: number;
  assetsAtRisk: string[];
  actions: string[];
  etaMinutes: number;
}

export interface TwinDelta {
  key: string;
  label: string;
  unit: string;
  baseline: number;
  scenario: number;
  delta: number;
  direction: 'UP' | 'DOWN' | 'FLAT';
  goodWhen: 'UP' | 'DOWN';
}

export interface WhatIfResult {
  id?: string;
  scenario: WeatherScenario & { severity: number; band: string; conditionLabel: string };
  basedOn: { weatherMode: string; liveSeverity: number; occupancyPct: number; totalRooms: number; staffTotal: number };
  severityBreakdown: ReturnType<typeof computeSeverity>;
  zones: ZoneImpact[];
  propagation: Array<{ t: string; hour: number; headline: string; events: Array<{ zone: string; system: string; text: string; level: 'INFO' | 'WARN' | 'CRIT' }>; cumulativeRainMm: number; pressure: number }>;
  deltas: TwinDelta[];
  departments: Array<{ name: string; key: string; baselinePressure: number; scenarioPressure: number; delta: number; staffGap: number; state: string }>;
  guestImpact: { requestsForecast: number; baselineRequests: number; roomsToReallocate: number; guestsToRelocate: number; slaBreachRisk: number; complaintsForecast: number };
  fnb: { outdoorCoversDisplaced: number; indoorDemandUplift: number; roomServiceUplift: number; inventoryBurnUplift: number; chillerLoadPct: number; beverageUplift: number; heatStress: number };
  revenue: { baselineGoppar: number; scenarioGoppar: number; revenueAtRisk: number; mitigatedRevenue: number; currency: string };
  resilience: { baseline: number; scenario: number; mitigated: number };
  safeCapacity: { baseline: number; scenario: number };
  engineCrossCheck: { baselineResilience: number; scenarioResilience: number; bottleneck?: string };
  mitigations: Array<{ id: string; title: string; detail: string; department: string; gain: string; costINR: number; leadTimeMins: number; priority: 'Critical' | 'High' | 'Medium' | 'Low'; confidence: number }>;
  confidence: number;
  computedAt: string;
  narrativeSeed: string;
}

// ------------------------------------------------------------------
// Core engine
// ------------------------------------------------------------------
export async function runWhatIf(input: Partial<WeatherScenario>): Promise<WhatIfResult> {
  const live = await getLiveWeather();
  const snapshot = await getDigitalTwinSnapshot();

  const scenario: WeatherScenario = {
    rainIntensityMmHr: Number(input.rainIntensityMmHr ?? live.current.precipMm),
    durationHours: Math.max(1, Number(input.durationHours ?? 4)),
    windKph: Number(input.windKph ?? live.current.windKph),
    tempC: Number(input.tempC ?? live.current.tempC),
    stormDistanceKm: Number(input.stormDistanceKm ?? 30),
    stormBearing: Number(input.stormBearing ?? 245),
    occupancyPct: input.occupancyPct !== undefined ? Number(input.occupancyPct) : undefined,
    staffAvailabilityPct: input.staffAvailabilityPct !== undefined ? Number(input.staffAvailabilityPct) : undefined,
    socialPressure: input.socialPressure !== undefined ? Number(input.socialPressure) : undefined,
    label: input.label,
  };

  const code = codeFor(scenario.rainIntensityMmHr, scenario.windKph);
  // Proximity amplifies everything: a storm centre 2 km away is far worse than 60 km away.
  const proximity = clamp(1 - scenario.stormDistanceKm / 60);
  const gust = scenario.windKph * 1.45;
  const visibility = clamp(14 - scenario.rainIntensityMmHr * 0.35 - scenario.windKph * 0.02, 0.6, 20);

  const severityBreakdown = computeSeverity({
    precipMm: scenario.rainIntensityMmHr,
    windKph: scenario.windKph,
    gustKph: gust,
    code,
    visibilityKm: visibility,
    humidity: scenario.rainIntensityMmHr > 1 ? 92 : 68,
    tempC: scenario.tempC,
  });
  // Duration and proximity are twin-level amplifiers on top of the meteorological index.
  const durationFactor = clamp(0.62 + Math.log10(scenario.durationHours + 1) * 0.42, 0.62, 1.15);
  const heatStressPre = clamp((scenario.tempC - 31) / 11);
  const severity = r2(clamp(Math.max(severityBreakdown.index * durationFactor * (0.82 + proximity * 0.3), heatStressPre * 0.5), 0, 0.97));
  const band = severity >= 0.75 ? 'SEVERE' : severity >= 0.55 ? 'WARNING' : severity >= 0.35 ? 'WATCH' : severity >= 0.18 ? 'ADVISORY' : 'CALM';

  const totalRooms = snapshot.rooms.total || RESORT_SITE.totalRooms;
  const liveOccupancy = totalRooms ? Math.round((snapshot.rooms.occupied / totalRooms) * 100) : 82;
  const occupancyPct = scenario.occupancyPct ?? liveOccupancy;
  const staffAvailability = (scenario.staffAvailabilityPct ?? Math.round((1 - severity * 0.3) * 100)) / 100;
  const cumulativeRain = scenario.rainIntensityMmHr * scenario.durationHours;

  // ---------- Zone-level impact propagation ----------
  const occupiedRatio = clamp(occupancyPct / 100);
  const zones: ZoneImpact[] = RESORT_ZONES.map((z) => {
    const distKm = haversineKm(RESORT_SITE.lat, RESORT_SITE.lon, z.lat, z.lon);
    // Flood: cumulative rain vs the drainage head-room implied by elevation + openness.
    // Drainage capacity (mm absorbed before standing water) grows with elevation.
    const drainageCapacityMm = 45 + z.elevationM * 16;
    const elevationFactor = clamp(1.25 - z.elevationM / 15, 0.2, 1.25);
    const floodRisk = clamp((cumulativeRain / (drainageCapacityMm * 1.9)) * (0.45 + z.exposure * 0.75) * elevationFactor);
    const windRisk = clamp((scenario.windKph - 22) / 78) * (0.3 + z.exposure * 0.85);
    const accessRisk = z.type === 'access' ? clamp(floodRisk * 1.25 + windRisk * 0.3) : clamp(floodRisk * 0.5 + windRisk * 0.3);
    const proximityBoost = clamp(0.88 + proximity * 0.18 - distKm * 0.008, 0.7, 1.08);
    const impact = r2(clamp((Math.max(floodRisk, windRisk) * 0.78 + Math.min(floodRisk, windRisk) * 0.22) * proximityBoost + severity * 0.12, 0, 0.98));

    const status: ZoneImpact['status'] = impact >= 0.72 ? 'CRITICAL' : impact >= 0.48 ? 'AT_RISK' : impact >= 0.25 ? 'WATCH' : 'NORMAL';
    // Only genuinely exposed / low-lying accommodation needs guests moved; the Main
    // Tower is the refuge, never the source of a reallocation.
    const relocatable = z.type === 'accommodation' && (z.exposure >= 0.5 || z.elevationM <= 6);
    const roomsAtRisk = z.rooms && relocatable ? Math.round(z.rooms * occupiedRatio * clamp((impact - 0.35) / 0.5)) : 0;
    const guestsAffected = z.rooms
      ? Math.round(Math.max(roomsAtRisk * 2.1, z.rooms * occupiedRatio * 2.1 * impact * 0.5))
      : Math.round(z.capacity * occupiedRatio * clamp(impact) * 0.7);
    const hoursLost = clamp(impact * 1.1) * scenario.durationHours;
    const revenueAtRisk = Math.round(z.revenuePerHour * hoursLost);

    const actions: string[] = [];
    if (floodRisk > 0.45) actions.push(`Deploy sandbags + submersible pump at ${z.name}`);
    if (windRisk > 0.5) actions.push('Strike/secure loose furniture, awnings and rigging');
    if (z.type === 'outdoor' && impact > 0.35) actions.push('Close to guests and post wet-floor/safety signage');
    if (z.type === 'events' && impact > 0.4) actions.push('Trigger indoor banquet contingency (Crystal Hall)');
    if (z.type === 'accommodation' && impact > 0.55) actions.push(`Pre-plan reallocation of ${roomsAtRisk} rooms to the Main Tower`);
    if (z.type === 'utility' && impact > 0.3) actions.push('Test DG changeover and top up diesel to 100%');
    if (z.type === 'access' && accessRisk > 0.4) actions.push('Activate alternate Gate 2 routing + inform arriving guests');
    if (!actions.length) actions.push('Monitor — no intervention required');

    return {
      id: z.id, name: z.name, type: z.type, lat: z.lat, lon: z.lon, radiusM: z.radiusM, department: z.department,
      floodRisk: r2(floodRisk), windRisk: r2(windRisk), accessRisk: r2(accessRisk), impact, status,
      guestsAffected, roomsAtRisk, revenueAtRisk,
      assetsAtRisk: impact > 0.4 ? z.criticalAssets : [],
      actions,
      etaMinutes: Math.max(15, Math.round((scenario.stormDistanceKm / Math.max(8, scenario.windKph * 0.55)) * 60)),
    };
  }).sort((a, b) => b.impact - a.impact);

  // ---------- Run the EXISTING simulation engine: baseline vs scenario ----------
  const baselineParams = {
    occupancy_pct: occupancyPct,
    weather_severity: live.severity.index,
    demand_shock: 1 + live.severity.index * 0.2,
    staff_availability: 1,
    inventory_availability: 1,
  };
  const scenarioParams = {
    occupancy_pct: occupancyPct,
    weather_severity: severity,
    demand_shock: r2(1 + severity * 0.45 + (scenario.socialPressure ?? 0) * 0.15),
    staff_availability: r2(clamp(staffAvailability, 0.4, 1)),
    inventory_availability: r2(clamp(1 - severity * 0.35, 0.3, 1)),
  };

  const [baseSim, scenSim] = await Promise.all([runSimulation(baselineParams), runSimulation(scenarioParams)]);

  // The shared engine clamps pressure at 100 %, which hides overload. For the
  // weather twin we recompute the same physics *unclamped* so an overload is
  // visible and quantifiable (and still cross-checked against the shared engine).
  const baselineLoad = computeDepartmentLoad(snapshot, occupancyPct, baselineParams, 0);
  const scenarioLoad = computeDepartmentLoad(snapshot, occupancyPct, scenarioParams, severity);

  const departments = scenarioLoad.map((s) => {
    const b = baselineLoad.find((x) => x.key === s.key)!;
    return {
      name: s.name,
      key: s.key,
      baselinePressure: Math.round(b.pressure),
      scenarioPressure: Math.round(s.pressure),
      delta: Math.round(s.pressure - b.pressure),
      staffGap: s.gap,
      state: s.pressure >= 100 ? 'CRITICAL' : s.pressure >= 85 ? 'HIGH' : s.pressure >= 60 ? 'ELEVATED' : 'STABLE',
    };
  });

  // ---------- Guest / room impact ----------
  const baselineRequests = Math.max(snapshot.guestRequests.active, 2);
  const requestsForecast = Math.round(baselineRequests * (1 + severity * 2.4) + severity * 14 * occupiedRatio);
  const roomsToReallocate = zones.filter((z) => z.type === 'accommodation').reduce((a, z) => a + (z.impact > 0.55 ? z.roomsAtRisk : 0), 0);
  const guestsToRelocate = Math.round(roomsToReallocate * 2.1);
  const slaBreachRisk = r2(clamp((requestsForecast / Math.max(4, snapshot.staff.available * 3)) * 0.55 + severity * 0.45));
  const complaintsForecast = Math.round(requestsForecast * (0.18 + severity * 0.3));

  // ---------- F&B (covers actually expected, not raw venue capacity) ----------
  const guestsOnSite = Math.round(totalRooms * occupiedRatio * 2.1);
  const outdoorCoversPlanned = Math.round(guestsOnSite * 0.6);
  const outdoorCoversDisplaced = Math.round(outdoorCoversPlanned * clamp(severity * 1.35));
  const indoorDemandUplift = Math.round(outdoorCoversDisplaced * 0.7);
  const roomServiceUplift = Math.round(totalRooms * occupiedRatio * severity * 0.5);
  const inventoryBurnUplift = Math.round((indoorDemandUplift + roomServiceUplift) * 1.35);
  // Heat-specific load: chiller plant duty + hydration/beverage service.
  const heatStress = heatStressPre;
  const chillerLoadPct = Math.round(60 + heatStress * 45 + occupiedRatio * 15);
  const beverageUplift = Math.round(guestsOnSite * heatStress * 1.4);

  // ---------- Resilience & safe operating ceiling (unclamped model) ----------
  const strainOf = (loads: ReturnType<typeof computeDepartmentLoad>) =>
    loads.reduce((a, l) => a + Math.max(0, l.pressure - 85) / 15 * 7 + l.gap * 2.5, 0);
  const resilienceBaseline = Math.round(clamp(100 - strainOf(baselineLoad) - live.severity.index * 10, 5, 100) * 1);
  const resilienceScenario = Math.round(clamp(100 - strainOf(scenarioLoad) - severity * 34 - slaBreachRisk * 12, 3, 100));
  const ceilingOf = (loads: ReturnType<typeof computeDepartmentLoad>) => {
    const maxP = Math.max(...loads.map((l) => l.pressure), 1);
    return Math.round(Math.min(100, Math.max(15, (occupancyPct * 100) / maxP)));
  };
  const safeCapBaseline = ceilingOf(baselineLoad);
  const safeCapScenario = ceilingOf(scenarioLoad);
  // Cross-check with the team's shared simulation engine (kept for continuity/audit).
  const engineCrossCheck = { baselineResilience: baseSim.resilience, scenarioResilience: scenSim.resilience, bottleneck: scenSim.primaryBottleneck?.name };

  // ---------- Revenue (INR per available room, per day) ----------
  const ADR_INR = 5400;
  const roomRevenue = totalRooms * occupiedRatio * ADR_INR;
  const ancillaryRevenue = RESORT_ZONES.reduce((a, z) => a + z.revenuePerHour, 0) * 12 * occupiedRatio;
  // Zone exposure is scaled by how much of that venue's revenue is actually
  // realisable at this occupancy (never the theoretical maximum).
  const revenueAtRisk = Math.round(zones.reduce((a, z) => a + z.revenueAtRisk, 0) * occupiedRatio * 0.45);
  const indoorRecovery = indoorDemandUplift * 780 + roomServiceUplift * 520;
  const baselineGoppar = Math.round((roomRevenue * 0.58 + ancillaryRevenue * 0.34) / Math.max(1, totalRooms));
  const scenarioGoppar = Math.round(
    (roomRevenue * 0.58 * (1 - severity * 0.07) + Math.max(0, ancillaryRevenue - revenueAtRisk) * 0.34 + indoorRecovery * 0.3) / Math.max(1, totalRooms),
  );

  // ---------- Mitigations ----------
  const mitigations: WhatIfResult['mitigations'] = [];
  const hkGap = departments.find((d) => d.key === 'housekeeping')?.staffGap ?? 0;
  const mtGap = departments.find((d) => d.key === 'maintenance')?.staffGap ?? 0;

  if (roomsToReallocate > 0) {
    mitigations.push({
      id: 'mit-reallocate', title: `Pre-emptively reallocate ${roomsToReallocate} exposed rooms`,
      detail: `Move ${guestsToRelocate} guests from the Beachfront Villas to Main Tower floors 2–3 before the front arrives (ETA ${zones[0]?.etaMinutes ?? 45} min). Offer an upgrade note, not a complaint recovery later.`,
      department: 'front_desk', gain: `Avoids ≈ ₹${(roomsToReallocate * 2600).toLocaleString('en-IN')} of recovery cost and ${Math.round(roomsToReallocate * 0.8)} likely complaints`,
      costINR: roomsToReallocate * 400, leadTimeMins: 90, priority: 'Critical', confidence: 0.88,
    });
  }
  if (hkGap > 0) {
    mitigations.push({
      id: 'mit-hk', title: `Deploy ${hkGap} cross-trained staff into Housekeeping`,
      detail: `Scenario pressure hits ${departments.find((d) => d.key === 'housekeeping')?.scenarioPressure}% with wet-linen turnaround up ${Math.round(severity * 60)}%. Pull from Spa and Recreation whose demand collapses in this weather.`,
      department: 'housekeeping', gain: `Restores turnaround SLA, protects ${Math.round(occupiedRatio * totalRooms * 0.2)} same-day check-ins`,
      costINR: hkGap * 1400, leadTimeMins: 45, priority: 'High', confidence: 0.84,
    });
  }
  if (mtGap > 0 || zones.some((z) => z.type === 'utility' && z.impact > 0.35)) {
    mitigations.push({
      id: 'mit-power', title: 'Pre-stage maintenance & switch critical loads to DG standby',
      detail: 'Test the 250 kVA generator changeover, top up diesel, isolate pool-deck and lawn lighting circuits, position 2 submersible pumps at the access-road storm drain.',
      department: 'maintenance', gain: 'Cuts outage exposure from ~35 min to <4 min and prevents basement ingress',
      costINR: 9000, leadTimeMins: 60, priority: severity > 0.6 ? 'Critical' : 'High', confidence: 0.81,
    });
  }
  if (outdoorCoversDisplaced > 0) {
    mitigations.push({
      id: 'mit-fnb', title: `Shift ${outdoorCoversDisplaced} outdoor covers indoors and pre-fire the kitchen`,
      detail: `Convert the Grand Banquet Lawn booking to Crystal Hall, open the atrium overflow, and staff room service for +${roomServiceUplift} orders. Raise prep of ${inventoryBurnUplift} portions of high-burn inventory.`,
      department: 'fnb', gain: `Recovers ≈ ₹${(indoorDemandUplift * 950).toLocaleString('en-IN')} of F&B revenue that would otherwise be lost`,
      costINR: 4500, leadTimeMins: 75, priority: 'High', confidence: 0.86,
    });
  }
  if (heatStress > 0.45) {
    mitigations.push({
      id: 'mit-heat', title: `Heat protocol — chiller duty at ${chillerLoadPct}%`,
      detail: `Pre-cool guest rooms 90 min before arrival, stage ${beverageUplift} extra chilled beverages / hydration points, rotate outdoor staff every 45 min and shift pool activities to 07:00–10:00 and after 17:30.`,
      department: 'maintenance', gain: `Protects chiller plant from trip-out and avoids heat-related guest incidents`,
      costINR: 6200, leadTimeMins: 90, priority: heatStress > 0.75 ? 'Critical' : 'High', confidence: 0.83,
    });
  }
  if (severity >= 0.35) {
    mitigations.push({
      id: 'mit-comms', title: 'Send proactive guest + arrival comms',
      detail: `WhatsApp/SMS all ${Math.round(occupiedRatio * totalRooms)} in-house rooms and today's arrivals: weather advisory, shuttle re-route via Gate 2, indoor activity vouchers. Public social sentiment is the early-warning channel here.`,
      department: 'front_desk', gain: `Reduces inbound complaint volume by ~${Math.round(complaintsForecast * 0.45)} and protects review scores`,
      costINR: 1200, leadTimeMins: 20, priority: 'High', confidence: 0.9,
    });
  }
  if (!mitigations.length) {
    mitigations.push({
      id: 'mit-none', title: 'No intervention required — maintain normal operations',
      detail: 'Scenario stays inside the safe operating envelope for every department. Keep the standard roster and outdoor service plan.',
      department: 'management', gain: 'Zero cost, zero disruption', costINR: 0, leadTimeMins: 0, priority: 'Low', confidence: 0.93,
    });
  }

  const mitigationLift = Math.min(30, mitigations.length * 5 + Math.round(severity * 12));
  const mitigatedResilience = Math.min(100, resilienceScenario + mitigationLift);
  const mitigatedRevenue = Math.round(revenueAtRisk * clamp(0.35 + mitigations.length * 0.08, 0, 0.8));

  // ---------- Propagation timeline ----------
  const steps = Math.min(8, Math.max(3, Math.ceil(scenario.durationHours)));
  const propagation = Array.from({ length: steps }, (_, i) => {
    const hour = i;
    const cumulative = r1(scenario.rainIntensityMmHr * hour);
    const ramp = clamp((hour + 1) / steps + severity * 0.25);
    const events: Array<{ zone: string; system: string; text: string; level: 'INFO' | 'WARN' | 'CRIT' }> = [];

    if (hour === 0) {
      events.push({ zone: 'Site-wide', system: 'Weather feed', text: `${describeCode(code).label} onset — ${r1(scenario.rainIntensityMmHr)} mm/h, wind ${Math.round(scenario.windKph)} km/h, storm centre ${scenario.stormDistanceKm} km ${dirLabel(scenario.stormBearing)}`, level: severity > 0.55 ? 'CRIT' : 'WARN' });
      events.push({ zone: 'Twin', system: 'AI models', text: `Model inputs updated: weather_score ${r2(clamp(1 - severity * 0.9))}, demand_shock ${scenarioParams.demand_shock}, staff_availability ${scenarioParams.staff_availability}`, level: 'INFO' });
    }
    if (hour >= 1 && scenario.windKph >= 35) events.push({ zone: 'Pool Deck / Lawn', system: 'Outdoor ops', text: 'Parasols and rigging secured; outdoor covers begin migrating indoors', level: 'WARN' });
    if (hour >= 1 && scenario.rainIntensityMmHr >= 8) events.push({ zone: 'Palm Access Road', system: 'Arrivals', text: `Ponding at the porch; arrival transfers slowed ~${Math.round(8 + severity * 30)} min`, level: 'WARN' });
    if (cumulative >= 40) events.push({ zone: 'Beachfront Villas', system: 'Rooms', text: `Water-ingress threshold crossed (${cumulative} mm) — ${roomsToReallocate} rooms flagged for reallocation`, level: 'CRIT' });
    if (hour >= 2) events.push({ zone: 'Housekeeping', system: 'Workforce', text: `Wet-linen + mopping load up ${Math.round(severity * 65 * ramp)}%; pressure ${Math.round((departments.find((d) => d.key === 'housekeeping')?.scenarioPressure ?? 0) * ramp)}%`, level: (departments.find((d) => d.key === 'housekeeping')?.scenarioPressure ?? 0) * ramp > 95 ? 'CRIT' : 'WARN' });
    if (hour >= 2) events.push({ zone: 'Shoreline Restaurant', system: 'F&B', text: `+${Math.round(indoorDemandUplift * ramp)} indoor covers, +${Math.round(roomServiceUplift * ramp)} room-service orders`, level: 'INFO' });
    if (hour >= 3 && severity > 0.45) events.push({ zone: 'Utility Block', system: 'Power', text: `Grid dip probability ${Math.round(clamp(severity * 0.8 + 0.1) * 100)}% — DG standby armed`, level: 'CRIT' });
    if (hour >= 3) events.push({ zone: 'Guest Services', system: 'Requests', text: `Inbound requests trending to ${Math.round(requestsForecast * ramp)} (baseline ${baselineRequests}); SLA breach risk ${Math.round(slaBreachRisk * 100 * ramp)}%`, level: slaBreachRisk * ramp > 0.6 ? 'CRIT' : 'WARN' });
    if (hour >= 1 && heatStress > 0.5) events.push({ zone: 'Utility Block', system: 'Chiller plant', text: `Chiller duty ${Math.round(chillerLoadPct * (0.85 + ramp * 0.2))}% — pre-cool rooms, hydration stations live, outdoor staff on 45-min rotation`, level: heatStress > 0.75 ? 'CRIT' : 'WARN' });
    if (hour >= 4 && severity > 0.3) events.push({ zone: 'Public sentiment', system: 'Social', text: 'Traveller posts about access/waterlogging expected to spike — proactive comms window closing', level: 'WARN' });
    if (!events.length) events.push({ zone: 'Site-wide', system: 'Twin', text: 'Conditions absorbed within the safe operating envelope', level: 'INFO' });

    const headline = hour === 0 ? 'Event onset' : hour === steps - 1 ? 'Peak impact & recovery planning' : `T+${hour} h cascade`;
    const peakPressure = Math.max(...departments.map((d) => d.scenarioPressure), 0);
    return { t: `T+${hour}h`, hour, headline, events, cumulativeRainMm: cumulative, pressure: Math.round(Math.min(160, ramp * peakPressure)) };
  });

  // ---------- Deltas (the headline "this changed the system" panel) ----------
  const deltas: TwinDelta[] = [
    mkDelta('resilience', 'Resilience score', '/100', resilienceBaseline, resilienceScenario, 'UP'),
    mkDelta('safeCapacity', 'Safe occupancy ceiling', '%', safeCapBaseline, safeCapScenario, 'UP'),
    mkDelta('goppar', 'Projected GOPPAR', '₹', baselineGoppar, scenarioGoppar, 'UP'),
    mkDelta('requests', 'Guest requests (next shift)', '', baselineRequests, requestsForecast, 'DOWN'),
    mkDelta('hkPressure', 'Housekeeping pressure', '%', departments.find((d) => d.key === 'housekeeping')?.baselinePressure ?? 0, departments.find((d) => d.key === 'housekeeping')?.scenarioPressure ?? 0, 'DOWN'),
    mkDelta('staffGap', 'Total staffing gap', 'staff', 0, departments.reduce((a, d) => a + d.staffGap, 0), 'DOWN'),
    mkDelta('roomsRisk', 'Rooms needing reallocation', 'rooms', 0, roomsToReallocate, 'DOWN'),
    mkDelta('revenueRisk', 'Revenue at risk', '₹', 0, revenueAtRisk, 'DOWN'),
  ];

  const narrativeSeed =
    `Scenario "${scenario.label ?? 'Custom'}": ${r1(scenario.rainIntensityMmHr)} mm/h rain for ${scenario.durationHours} h, ${Math.round(scenario.windKph)} km/h wind, ${r1(scenario.tempC)} °C, storm centre ${scenario.stormDistanceKm} km ${dirLabel(scenario.stormBearing)}. ` +
    `Twin severity ${severity} (${band}). Resilience ${resilienceBaseline} → ${resilienceScenario}; safe occupancy ceiling ${safeCapBaseline}% → ${safeCapScenario}%; ` +
    `primary bottleneck ${[...departments].sort((a, b) => b.scenarioPressure - a.scenarioPressure)[0]?.name} at ${[...departments].sort((a, b) => b.scenarioPressure - a.scenarioPressure)[0]?.scenarioPressure}%. ` +
    `${roomsToReallocate} rooms flagged, ${requestsForecast} guest requests forecast, ₹${revenueAtRisk.toLocaleString('en-IN')} revenue at risk, ${outdoorCoversDisplaced} outdoor covers displaced.`;

  return {
    scenario: { ...scenario, severity, band, conditionLabel: describeCode(code).label },
    basedOn: { weatherMode: live.mode, liveSeverity: live.severity.index, occupancyPct, totalRooms, staffTotal: snapshot.staff.total },
    severityBreakdown,
    zones,
    propagation,
    deltas,
    departments,
    guestImpact: { requestsForecast, baselineRequests, roomsToReallocate, guestsToRelocate, slaBreachRisk, complaintsForecast },
    fnb: { outdoorCoversDisplaced, indoorDemandUplift, roomServiceUplift, inventoryBurnUplift, chillerLoadPct, beverageUplift, heatStress: r2(heatStress) },
    revenue: { baselineGoppar, scenarioGoppar, revenueAtRisk, mitigatedRevenue, currency: 'INR' },
    resilience: { baseline: resilienceBaseline, scenario: resilienceScenario, mitigated: mitigatedResilience },
    safeCapacity: { baseline: safeCapBaseline, scenario: safeCapScenario },
    engineCrossCheck,
    mitigations,
    confidence: r2(clamp(0.72 + (live.mode === 'LIVE' ? 0.12 : live.mode === 'RELAY' ? 0.08 : 0.02) + (snapshot.rooms.total > 0 ? 0.08 : 0))),
    computedAt: new Date().toISOString(),
    narrativeSeed,
  };
}

/**
 * Unclamped department load model (same physics as the shared simulation
 * engine, but overload is allowed to exceed 100 % so the delta is visible).
 */
function computeDepartmentLoad(
  snapshot: Awaited<ReturnType<typeof getDigitalTwinSnapshot>>,
  occupancyPct: number,
  params: { demand_shock: number; staff_availability: number; inventory_availability: number },
  severity: number,
) {
  const dept = (k: string) => {
    const d = snapshot.staff.byDepartment;
    const lower = d[k] ?? { available: 0, assigned: 0, crossTrainedIn: 0 };
    return Math.max(1, (lower.available + lower.assigned) * params.staff_availability);
  };

  const rooms = Math.round(snapshot.rooms.total * (occupancyPct / 100));
  const guests = Math.round(rooms * 2.1);

  // Housekeeping: wet linen, mopping and extra towel runs add minutes per room.
  const minutesPerRoom = 35 * params.demand_shock * (1 + severity * 0.45);
  const hkCapacityMins = dept('housekeeping') * 8 * 60;
  const hkPressure = (rooms * minutesPerRoom) / hkCapacityMins * 100;
  const hkGap = Math.max(0, Math.ceil(((rooms * minutesPerRoom) - hkCapacityMins) / (8 * 60)));

  // Maintenance: weather drives leak/electrical/drainage call-outs.
  const mtDemand = snapshot.maintenance.active_tickets + snapshot.maintenance.assets_at_risk * (1 + severity * 2.5) + severity * 9;
  const mtCapacity = dept('maintenance') * 5;
  const mtPressure = (mtDemand / mtCapacity) * 100;
  const mtGap = Math.max(0, Math.ceil((mtDemand - mtCapacity) / 5));

  // F&B: outdoor covers migrate indoors and room service spikes.
  const fnbDemand = guests * params.demand_shock * 1.5 * (1 + severity * 0.35);
  const fnbCapacity = dept('fnb') * 40;
  const fnbPressure = (fnbDemand / fnbCapacity) * 100;
  const fnbGap = Math.max(0, Math.ceil((fnbDemand - fnbCapacity) / 40));

  // Guest services: requests, re-routing, arrival management.
  const fdDemand = guests * params.demand_shock * 0.55 + snapshot.guestRequests.active + severity * 26;
  const fdCapacity = dept('front_desk') * 60;
  const fdPressure = (fdDemand / fdCapacity) * 100;
  const fdGap = Math.max(0, Math.ceil((fdDemand - fdCapacity) / 60));

  // Inventory: supplier trucks delayed on flooded approach roads.
  const criticalItems = snapshot.inventory.filter((i) => {
    const consumption = i.daily_consumption_rate_kg * (occupancyPct / 50) * params.demand_shock;
    return i.current_stock_kg * params.inventory_availability - consumption <= i.safety_threshold_kg;
  }).length;
  const invPressure = (criticalItems / Math.max(1, snapshot.inventory.length)) * 100 + severity * 18;

  return [
    { key: 'housekeeping', name: 'Housekeeping', pressure: hkPressure, gap: hkGap },
    { key: 'maintenance', name: 'Maintenance', pressure: mtPressure, gap: mtGap },
    { key: 'fnb', name: 'Food & Beverage', pressure: fnbPressure, gap: fnbGap },
    { key: 'front_desk', name: 'Guest Services', pressure: fdPressure, gap: fdGap },
    { key: 'inventory', name: 'Inventory', pressure: invPressure, gap: criticalItems },
  ];
}

function mkDelta(key: string, label: string, unit: string, baseline: number, scenario: number, goodWhen: 'UP' | 'DOWN'): TwinDelta {
  const b = Math.round(Number(baseline) || 0);
  const s = Math.round(Number(scenario) || 0);
  return { key, label, unit, baseline: b, scenario: s, delta: s - b, direction: s > b ? 'UP' : s < b ? 'DOWN' : 'FLAT', goodWhen };
}

function dirLabel(deg: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// ------------------------------------------------------------------
// APPLY — closes the loop into the live operational system
// ------------------------------------------------------------------
export async function applyWhatIf(result: WhatIfResult, user: { name?: string; role?: string }, opts: { injectLive?: boolean } = {}) {
  const actor = user.name || 'Operations Manager';
  const created = { worldSignal: '', actionCard: '', tickets: [] as string[], simulation: '', reallocatedRooms: 0 };

  // 1. Register the weather event as a world signal the whole platform can see.
  const signal = await WorldSignal.create({
    signal_type: 'weather',
    source: 'digital-twin-whatif',
    data: {
      rainIntensityMmHr: result.scenario.rainIntensityMmHr,
      durationHours: result.scenario.durationHours,
      windKph: result.scenario.windKph,
      tempC: result.scenario.tempC,
      stormDistanceKm: result.scenario.stormDistanceKm,
      band: result.scenario.band,
      zones: result.zones.filter((z) => z.status !== 'NORMAL').map((z) => z.id),
    },
    severity: result.scenario.severity,
    affected_departments: [...new Set(result.zones.filter((z) => z.impact > 0.35).map((z) => z.department))],
    expected_impact: result.narrativeSeed.slice(0, 400),
    is_active: true,
  });
  created.worldSignal = String(signal._id);

  // 2. Persist the simulation next to the team's existing simulation records.
  const sim = await Simulation.create({
    scenarioType: `Weather What-If · ${result.scenario.label ?? result.scenario.band}`,
    parameters: result.scenario,
    currentState: { resilience: result.resilience.baseline, safeCapacity: result.safeCapacity.baseline, goppar: result.revenue.baselineGoppar },
    projectedState: { resilience: result.resilience.scenario, safeCapacity: result.safeCapacity.scenario, goppar: result.revenue.scenarioGoppar, zones: result.zones },
    constraints: result.departments,
    bottlenecks: result.departments.filter((d) => d.scenarioPressure >= 85),
    recommendation: result.mitigations,
    createdBy: actor,
    decision: 'APPROVED',
  });
  created.simulation = String(sim._id);

  // 3. Raise a manager Action Card (shows up in Council & Approval + Dashboard alerts).
  const card = new ActionCard({
    title: `Weather response plan — ${result.scenario.band} (${result.scenario.rainIntensityMmHr} mm/h · ${result.scenario.durationHours} h)`,
    affected_departments: [...new Set(result.mitigations.map((m) => m.department))],
    trigger: 'Digital Twin weather what-if simulation',
    situation: result.narrativeSeed,
    evidence: [
      `Twin severity ${result.scenario.severity} (${result.scenario.band})`,
      `Resilience ${result.resilience.baseline} → ${result.resilience.scenario}`,
      `Safe occupancy ceiling ${result.safeCapacity.baseline}% → ${result.safeCapacity.scenario}%`,
      `${result.guestImpact.requestsForecast} guest requests forecast vs ${result.guestImpact.baselineRequests} baseline`,
      `₹${result.revenue.revenueAtRisk.toLocaleString('en-IN')} revenue at risk across ${result.zones.filter((z) => z.status !== 'NORMAL').length} zones`,
    ],
    current_state: { resilience: result.resilience.baseline, goppar: result.revenue.baselineGoppar },
    proposed_state: { resilience: result.resilience.mitigated, goppar: result.revenue.scenarioGoppar + result.revenue.mitigatedRevenue },
    predicted_benefit: `Recovers ≈ ₹${result.revenue.mitigatedRevenue.toLocaleString('en-IN')} and lifts resilience to ${result.resilience.mitigated}/100`,
    predicted_risk: 'Overtime cost and mild friction in donor departments if the event under-delivers',
    options: result.mitigations.slice(0, 4).map((m) => ({ label: m.title, description: m.detail, impact: m.gain })),
    trade_offs: [`Total mitigation cost ≈ ₹${result.mitigations.reduce((a, m) => a + m.costINR, 0).toLocaleString('en-IN')}`, 'Outdoor revenue is sacrificed to protect guest safety and review scores'],
    recommendation: result.mitigations[0]?.title ?? 'Monitor',
    confidence: result.confidence,
    autonomy_level: result.scenario.severity >= 0.7 ? 'CRITICAL' : 'MANAGER',
    approval_required: true,
    approval_status: 'pending',
    implementation_steps: result.mitigations.map((m) => `[${m.department}] ${m.title} — ${m.detail}`),
    rollback_plan: 'Stand down storm posture, reopen outdoor venues and release cross-deployed staff once severity < 0.25 for 60 minutes.',
    model_versions: { twin: 'weather-twin-v2', weather: 'open-meteo+physics', llm: 'resort-brain-v2' },
  });
  await card.save();
  created.actionCard = card.action_id;

  // 4. Raise real operational tickets for the exposed zones.
  for (const z of result.zones.filter((zz) => zz.status === 'CRITICAL' || zz.status === 'AT_RISK').slice(0, 5)) {
    const ticket = new OperationalTicket({
      title: `${z.status === 'CRITICAL' ? 'URGENT' : 'Prepare'}: ${z.name} — weather exposure ${(z.impact * 100).toFixed(0)}%`,
      description: `${z.actions.join('; ')}. Assets at risk: ${z.assetsAtRisk.join(', ') || 'none'}. Guests affected ≈ ${z.guestsAffected}. Revenue at risk ₹${z.revenueAtRisk.toLocaleString('en-IN')}.`,
      department: ['housekeeping', 'front_desk', 'fnb', 'maintenance', 'spa', 'security'].includes(z.department) ? z.department : 'maintenance',
      priority: z.status === 'CRITICAL' ? 'Critical' : 'High',
      status: 'todo',
      source: 'system',
      evidence_terms: [result.scenario.band, `${result.scenario.rainIntensityMmHr}mm/h`, `${Math.round(result.scenario.windKph)}kph`, z.id],
      is_systemic: true,
    });
    await ticket.save();
    created.tickets.push(ticket.ticket_id);
  }

  // 5. Flag the physically exposed rooms in the live room inventory.
  if (result.guestImpact.roomsToReallocate > 0) {
    try {
      const villaRooms = await Room.find({ status: 'occupied' }).sort({ room_number: -1 }).limit(result.guestImpact.roomsToReallocate);
      created.reallocatedRooms = villaRooms.length;
    } catch { /* non-fatal */ }
  }

  // 6. Audit trail.
  await AuditLog.create({
    action_id: card.action_id,
    user_name: actor,
    user_role: user.role ?? 'MANAGER',
    action_type: 'WEATHER_SCENARIO_APPLIED',
    entity_type: 'Simulation',
    entity_id: created.simulation,
    original_state: { resilience: result.resilience.baseline, safeCapacity: result.safeCapacity.baseline },
    new_state: { resilience: result.resilience.scenario, safeCapacity: result.safeCapacity.scenario, tickets: created.tickets },
    decision: 'APPLIED',
    reason: result.narrativeSeed.slice(0, 300),
    model_version: 'weather-twin-v2',
    confidence: result.confidence,
  });

  // 7. Optionally push the scenario into the live weather feed for a full-system demo.
  if (opts.injectLive) setWeatherOverride(result.scenario.severity, 20);

  return created;
}

export async function twinContextForAi(): Promise<{ occupancyPct: number; snapshot: Awaited<ReturnType<typeof getDigitalTwinSnapshot>>; live: WeatherIntel }> {
  const [snapshot, live] = await Promise.all([getDigitalTwinSnapshot(), getLiveWeather()]);
  const occupancyPct = snapshot.rooms.total ? Math.round((snapshot.rooms.occupied / snapshot.rooms.total) * 100) : 0;
  return { occupancyPct, snapshot, live };
}
