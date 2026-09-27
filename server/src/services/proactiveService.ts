import { ActionCard } from '../models/ActionCard';
import { OperationalTicket } from '../models/OperationalTicket';
import { MaintenanceAsset } from '../models/MaintenanceAsset';
import { PantryInventory } from '../models/PantryInventory';
import { GuestRequest } from '../models/GuestRequest';
import { AuditLog } from '../models/AuditLog';
import { MLService } from './mlClient';
import { notifyManagers, notifyDepartment } from './notificationService';
import { dateGte } from '../utils/dbCompat';

/**
 * Phase 11/35 — Proactive Service Engine.
 * Reusable event→action framework:
 *   PREDICTION (trained model / deterministic rule over live DB state)
 *   → RISK evaluation → PREVENTIVE ACTION (ActionCard for manager approval,
 *     or routed OperationalTicket) → notifications → audit trail.
 * Every proactive finding is deduplicated against its open trigger so a scan
 * never spams the manager queue, and each record is traceable to its source.
 */

export interface ProactiveFinding {
  trigger: string;
  source: 'occupancy_forecast_model' | 'maintenance_condition_rule' | 'inventory_threshold_rule' | 'complaint_pattern_rule' | 'fallback_forecast';
  title: string;
  departments: string[];
  evidence: string[];
  autonomy_level: 'AUTO' | 'SUPERVISOR' | 'MANAGER' | 'CRITICAL';
  approval_required: boolean;
  options: Array<{ label: string; description: string; impact: string }>;
  implementation_steps: string[];
  ticket?: { title: string; department: string; priority: string; room_number?: string };
  notification: { title: string; message: string; priority: 'CRITICAL' | 'HIGH' | 'MEDIUM'; department?: string };
}

async function alreadyOpen(trigger: string): Promise<boolean> {
  const open = await ActionCard.findOne({ trigger, approval_status: { $nin: ['approved', 'rejected'] } }).select('_id');
  return !!open;
}

export async function runProactiveScan(): Promise<{ findings: number; created: string[] }> {
  const created: string[] = [];
  const findings: ProactiveFinding[] = [];

  // ── 1. Forecast-driven staffing (trained occupancy/staff-demand models) ──
  const now = new Date();
  let forecastSource: ProactiveFinding['source'] = 'occupancy_forecast_model';
  let predictedOccupancy = 0;
  let staffNeeded = 0;
  try {
    const fc = await MLService.predictDemand({
      day_of_week: (now.getDay() + 6) % 7,
      month: now.getMonth() + 1,
      is_weekend: [0, 6].includes(now.getDay()) ? 1 : 0,
      is_holiday: 0,
      season_code: 1,
      weather_score: 0.7,
      event_score: 0,
      historical_avg: 72,
      trend_score: 0.5,
    });
    predictedOccupancy = Number(fc.occupancy_forecast) || 0;
    staffNeeded = Number(fc.staff_demand) || 0;
  } catch {
    forecastSource = 'fallback_forecast';
  }
  if (predictedOccupancy >= 85) {
    findings.push({
      trigger: `proactive:occupancy-surge`,
      source: forecastSource,
      title: `Proactive Staffing: forecasted occupancy surge to ${Math.round(predictedOccupancy)}%`,
      departments: ['housekeeping', 'front_desk'],
      evidence: [
        `Trained demand model forecasts ${Math.round(predictedOccupancy)}% occupancy (model source: ${forecastSource})`,
        `Projected staff requirement ≈ ${Math.round(staffNeeded)} across service departments`,
      ],
      autonomy_level: 'MANAGER',
      approval_required: true,
      options: [
        { label: 'Extend current shifts', description: 'Offer overtime to available roster', impact: 'Covers ~4 staff-equivalents' },
        { label: 'Cross-train redeploy', description: 'Move cross-trained spa/front-desk staff to housekeeping', impact: 'Closes most of the gap without hiring' },
      ],
      implementation_steps: ['Approve one staffing option', 'Notify affected staff', 'Confirm coverage before check-in wave'],
      notification: {
        title: `Occupancy surge forecast (${Math.round(predictedOccupancy)}%)`,
        message: `The trained forecast model projects ${Math.round(predictedOccupancy)}% occupancy and ~${Math.round(staffNeeded)} staff demand. A proactive staffing plan awaits your decision.`,
        priority: 'HIGH',
      },
    });
  }

  // ── 2. Preventive maintenance — assets whose condition score is degrading ──
  const weakAssets = await MaintenanceAsset.find({ condition_score: { $lte: 75 } }).sort({ condition_score: 1 }).limit(3);
  for (const asset of weakAssets) {
    findings.push({
      trigger: `proactive:maintenance:${asset.asset_id}`,
      source: 'maintenance_condition_rule',
      title: `Preventive Inspection: ${asset.name} condition ${asset.condition_score}%`,
      departments: ['maintenance'],
      evidence: [`Asset ${asset.asset_id} condition score is ${asset.condition_score}% (≤75% preventive threshold)`, 'Rule: inspect before guest-facing failure'],
      autonomy_level: 'AUTO',
      approval_required: false,
      options: [],
      implementation_steps: ['Inspect asset', 'Log readings', 'Schedule repair if confirmed'],
      ticket: { title: `Preventive inspection — ${asset.name}`, department: 'maintenance', priority: (asset.condition_score ?? 100) <= 60 ? 'High' : 'Medium' },
      notification: {
        title: `Preventive inspection: ${asset.name}`,
        message: `Condition score ${asset.condition_score}% — a preventive inspection ticket was opened before any guest-facing failure.`,
        priority: 'MEDIUM',
        department: 'maintenance',
      },
    });
  }

  // ── 3. Inventory risk — consumption outruns safety stock ──
  const riskyStock = await PantryInventory.find({ $expr: { $lte: ['$current_stock_kg', { $multiply: ['$safety_threshold_kg', 1.5] }] } }).limit(3);
  for (const item of riskyStock) {
    const daysLeft = Math.round((item.current_stock_kg / Math.max(item.daily_consumption_rate_kg, 0.1)) * 10) / 10;
    findings.push({
      trigger: `proactive:inventory:${item.item_name}`,
      source: 'inventory_threshold_rule',
      title: `Reorder Point: ${item.item_name} (${daysLeft} days of stock)`,
      departments: ['fnb', 'procurement'],
      evidence: [`${item.item_name}: ${item.current_stock_kg}kg on hand, safety threshold ${item.safety_threshold_kg}kg, burn ${item.daily_consumption_rate_kg}kg/day`, `≈${daysLeft} days of stock remaining`],
      autonomy_level: 'MANAGER',
      approval_required: true,
      options: [
        { label: 'Standard reorder', description: 'Reorder to 3× safety stock', impact: 'Restores buffer within lead time' },
        { label: 'Menu adjustment', description: 'Feature low-dependency dishes until restock', impact: 'Cuts burn rate immediately' },
      ],
      implementation_steps: ['Approve reorder quantity', 'Send PO to vendor', 'Confirm delivery slot'],
      notification: {
        title: `Inventory risk: ${item.item_name}`,
        message: `${item.item_name} has ≈${daysLeft} days of stock (${item.current_stock_kg}kg vs ${item.safety_threshold_kg}kg safety). A reorder recommendation is pending.`,
        priority: 'MEDIUM',
      },
    });
  }

  // ── 4. Repeated room complaint pattern — inspect similar rooms/assets ──
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentReqs: any[] = await GuestRequest.collection.find(dateGte('created_at', since) as any).toArray();
  const byIntent = new Map<string, Set<string>>();
  for (const r of recentReqs) {
    if (!['AC', 'PLUMBING', 'WIFI', 'ELECTRICAL'].includes(r.intent)) continue;
    if (!byIntent.has(r.intent)) byIntent.set(r.intent, new Set());
    byIntent.get(r.intent)!.add(r.room_number);
  }
  for (const [intent, rooms] of byIntent) {
    if (rooms.size >= 2) {
      findings.push({
        trigger: `proactive:pattern:${intent}`,
        source: 'complaint_pattern_rule',
        title: `Pattern Detected: ${rooms.size} rooms reported ${intent} issues in 24h`,
        departments: ['maintenance'],
        evidence: [`Rooms affected: ${[...rooms].join(', ')}`, 'Rule: ≥2 similar complaints in 24h → inspect shared systems proactively'],
        autonomy_level: 'SUPERVISOR',
        approval_required: true,
        options: [{ label: 'Inspect shared system', description: 'Check floor riser / HVAC zone feeding these rooms', impact: 'Prevents further complaints' }],
        implementation_steps: ['Inspect common system', 'Fix root cause', 'Verify affected rooms'],
        notification: {
          title: `Repeated ${intent} complaints (${rooms.size} rooms)`,
          message: `${intent} issues were reported in ${rooms.size} rooms within 24h (${[...rooms].join(', ')}). Proactive inspection recommended before more guests are affected.`,
          priority: 'HIGH',
          department: 'maintenance',
        },
      });
    }
  }

  // Persist deduplicated findings
  for (const f of findings) {
    if (await alreadyOpen(f.trigger)) continue;
    await ActionCard.create({
      title: f.title,
      affected_departments: f.departments,
      trigger: f.trigger,
      situation: f.source,
      evidence: f.evidence,
      autonomy_level: f.autonomy_level,
      approval_required: f.approval_required,
      options: f.options,
      implementation_steps: f.implementation_steps,
    });
    if (f.ticket) {
      await OperationalTicket.create({
        title: f.ticket.title,
        department: f.ticket.department,
        priority: f.ticket.priority,
        source: 'proactive',
        room_number: f.ticket.room_number,
        evidence_terms: f.evidence,
        is_systemic: false,
      });
    }
    await notifyManagers({
      type: 'PROACTIVE_RECOMMENDATION',
      priority: f.notification.priority,
      title: f.notification.title,
      message: f.notification.message,
      sourceType: 'ProactiveScan',
      sourceId: f.trigger,
    });
    if (f.notification.department) {
      await notifyDepartment(f.notification.department, {
        type: 'PROACTIVE_TASK',
        priority: f.notification.priority === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM',
        title: f.notification.title,
        message: f.notification.message,
        sourceType: 'ProactiveScan',
        sourceId: f.trigger,
      });
    }
    await AuditLog.create({
      user_name: 'Proactive Service Engine',
      action_type: 'PROACTIVE_RECOMMENDATION_CREATED',
      entity_type: 'ActionCard',
      entity_id: f.trigger,
      new_state: { source: f.source, departments: f.departments },
      reason: f.evidence.join(' | '),
    });
    created.push(f.trigger);
  }

  return { findings: findings.length, created };
}

/** Auto-scan cadence — best-effort; failures only log, never crash the API. */
export function startProactiveLoop(intervalMs = 5 * 60 * 1000) {
  const tick = async () => {
    try {
      const { created } = await runProactiveScan();
      if (created.length > 0) console.log(`🤖 Proactive engine created: ${created.join(', ')}`);
    } catch (err) {
      console.error('Proactive scan failed (non-fatal):', err);
    }
  };
  setTimeout(tick, 30 * 1000); // first run shortly after boot
  setInterval(tick, intervalMs);
}
