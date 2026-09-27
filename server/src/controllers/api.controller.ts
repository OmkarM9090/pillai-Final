import { Request, Response } from 'express';
import { GuestRequest } from '../models/GuestRequest';
import { ActionCard } from '../models/ActionCard';
import { StaffRoster } from '../models/StaffRoster';
import { OperationalTicket } from '../models/OperationalTicket';
import { AuditLog } from '../models/AuditLog';
import { Room } from '../models/Room';
import { classifyRequest } from '../services/autonomyService';
import { MLService } from '../services/mlClient';
import { spawn } from 'child_process';
import { Booking } from '../models/Booking';
import { PantryInventory } from '../models/PantryInventory';
import { MaintenanceAsset } from '../models/MaintenanceAsset';
import { WorldSignal } from '../models/WorldSignal';
import mongoose from 'mongoose';
import { dateGte } from '../utils/dbCompat';
import { Notification } from '../models/Notification';
import { Incident } from '../models/Incident';
import { notifyDepartment, notifyManagers, notifyUsers } from '../services/notificationService';

import { getCommandCenterState } from '../services/ai/commandCenterService';

// ==========================================
// NEW ENDPOINTS
// ==========================================

function isManager(req: Request): boolean {
  return ['MANAGER', 'GENERAL_MANAGER', 'SUPER_ADMIN'].includes(String(req.user?.role));
}

async function findTaskByExternalId(id: string): Promise<any> {
  const guestRequest = await GuestRequest.findOne({ request_id: id });
  if (guestRequest) return guestRequest;
  return OperationalTicket.findOne({ ticket_id: id });
}

function actorStaffName(req: Request): string | undefined {
  return req.user?.name;
}

async function assertTaskAccess(req: Request, task: any): Promise<boolean> {
  if (isManager(req) || req.user?.role === 'SUPERVISOR') return true;
  const assigned = task.assigned_staff || task.assigned_to;
  if (req.user?.role === 'WORKER' || req.user?.role === 'STAFF') {
    if (!assigned) return true;
    if (assigned === req.user.name) return true;
    if (req.user.department && task.department && req.user.department.toLowerCase() === task.department.toLowerCase()) return true;
    return true;
  }
  return false;
}

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const dashboardState = await getCommandCenterState();
    res.json({
      success: true,
      data: dashboardState
    });
  } catch (error) {
    console.error('Command Center Error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
};

import { runSimulation } from '../services/simulation/simulationEngine';
import { getDigitalTwinSnapshot } from '../services/simulation/snapshot';

export const simulate = async (req: Request, res: Response) => {
  try {
    const { occupancy_pct, weather_severity, demand_shock, staff_availability, inventory_availability } = req.body;
    
    // Call the actual digital twin simulation engine
    const results = await runSimulation({
      occupancy_pct: Number(occupancy_pct) || 80,
      weather_severity: Number(weather_severity) || 0,
      demand_shock: Number(demand_shock) || 1.0,
      staff_availability: Number(staff_availability) || 1.0,
      inventory_availability: Number(inventory_availability) || 1.0
    });

    const simRecord = await Simulation.create({ scenarioType: req.body.scenarioType || 'Custom', parameters: req.body, currentState: results.snapshot, projectedState: { resilience: results.resilience, pressures: results.pressures, safeCapacity: results.safeCapacity, goppar_estimate: results.decisionSummary.goppar_estimate }, constraints: results.pressures, bottlenecks: [results.primaryBottleneck], recommendation: results.strategies, createdBy: req.user?.name || 'System' });
      res.json({ success: true, data: { ...results, id: simRecord._id } });
  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const getSafeEnvelope = async (req: Request, res: Response) => {
  try {
    const snapshot = await getDigitalTwinSnapshot();
    const currentOccupancy = snapshot.rooms.total > 0 ? Math.round((snapshot.rooms.occupied / snapshot.rooms.total) * 100) : 0;

    const baseSim = await runSimulation({
      occupancy_pct: currentOccupancy,
      weather_severity: 0,
      demand_shock: 1.0,
      staff_availability: 1.0,
      inventory_availability: 1.0
    });

    res.json({
      success: true,
      data: {
        resilienceScore: baseSim.resilience,
        safe_occupancy_pct: baseSim.safeCapacity,
        projected_demand_pct: currentOccupancy,
        bottleneck_department: baseSim.primaryBottleneck.name,
        limiting_factor: `Capacity limit reached for ${baseSim.primaryBottleneck.name} (${baseSim.primaryBottleneck.pressure}%)`,
        constraints: baseSim.pressures.map((p: any) => ({
          name: p.name,
          description: p.gap > 0 ? `Gap of ${p.gap} units` : 'Stable',
          severity: p.pressure > 100 ? 100 : p.pressure,
          impact: p.pressure > 90 ? 'High' : p.pressure > 70 ? 'Medium' : 'Low',
          mitigation: p.gap > 0 ? `Requires ${p.gap} additional units` : 'None required',
          // Fields consumed by the Safe Envelope page
          department: p.name,
          ceiling: Math.min(100, Math.max(0, Math.round((currentOccupancy * 100) / Math.max(p.pressure, 1)))),
          limit_factor: p.gap > 0 ? `Gap of ${p.gap} units — requires ${p.gap} additional capacity` : 'Operating within safe capacity'
        })),
        unlock_actions: baseSim.strategies.map((s: any) => ({
          action: s.name,
          capacity_gain: s.impact
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const getDecisionCouncil = async (req: Request, res: Response) => {
  try {
    const snapshot = await getDigitalTwinSnapshot();
    const currentOccupancy = Math.round((snapshot.rooms.occupied / snapshot.rooms.total) * 100);

    const baseSim = await runSimulation({
      occupancy_pct: currentOccupancy,
      weather_severity: 0,
      demand_shock: 1.0,
      staff_availability: 1.0,
      inventory_availability: 1.0
    });

    const data = {
      council_agents: baseSim.council.agents.map((a: any) => ({
        name: `${a.name} Agent`,
        role: 'Department Head',
        risk: a.status === 'critical' ? 'CRITICAL' : (a.status === 'warning' ? 'ELEVATED' : 'NORMAL'),
        verdict: a.status === 'critical' ? 'Require Mitigation' : 'Approve',
        reasoning: a.recommendation
      })),
      chief_synthesis: {
        title: baseSim.primaryBottleneck.pressure > 100 ? `MITIGATE ${baseSim.primaryBottleneck.name.toUpperCase()} BOTTLENECK` : 'PROCEED NORMALLY',
        confidence: baseSim.council.consensus_score,
        recommended_action: baseSim.council.chief_synthesis,
        implementation_steps: baseSim.strategies.length > 0 ? baseSim.strategies.map((s: any) => s.action) : ['No action required'],
        rollback_plan: 'Release temporary workers and restore standard operating procedures.'
      }
    };

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const generateActionCard = async (req: Request, res: Response) => {
  try {
    const { strategies, bottleneck, scenario } = req.body || {};
      let actualStrategies = strategies;
      let actualBottleneck = bottleneck || 'Housekeeping';
      let actualScenario = scenario || { occupancy_pct: 95, weather_severity: 0, staff_availability: 1.0 };
      if (!actualStrategies || actualStrategies.length === 0) {
        const snap = await getDigitalTwinSnapshot();
        const baseSim = await runSimulation({ occupancy_pct: 95, weather_severity: 0, demand_shock: 1.0, staff_availability: 1.0, inventory_availability: 1.0 });
        actualStrategies = baseSim.strategies.length > 0 ? baseSim.strategies : [{ name: 'Fallback Mitigation', action: 'Reallocate 2 Spa staff to Housekeeping', impact: 'Reduces gap', risk: 'Low' }];
        actualBottleneck = baseSim.primaryBottleneck.name;
      }

    const actionCard = await ActionCard.create({
      title: `Simulation Plan: Address ${actualBottleneck} constraint`,
      affected_departments: [actualBottleneck.toLowerCase()],
      trigger: 'Simulation Output',
      evidence: [`Occupancy at ${actualScenario.occupancy_pct}%`, `Weather Severity ${actualScenario.weather_severity}`, `Staff Avail ${actualScenario.staff_availability}`],
      autonomy_level: 'MANAGER',
      approval_required: true,
      options: actualStrategies.map((s: any) => ({
        label: s.name,
        description: s.impact,
        impact: s.risk
      })),
      implementation_steps: actualStrategies.map((s: any) => s.action)
    });

    res.json({ success: true, data: actionCard });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const approvePlan = async (req: Request, res: Response) => {
  try {
    const { actionCardId, action_id, decision, reason, modifications } = req.body;
    const actualId = actionCardId || action_id;
    const idConditions: Record<string, unknown>[] = [{ action_id: actualId }];
    if (mongoose.isValidObjectId(actualId)) {
      idConditions.push({ _id: actualId });
    }
    let card = await ActionCard.findOne({ $or: idConditions });

    if (!card) {
      return res.status(404).json({ success: false, message: 'ActionCard not found' });
    }

    // 1. Update ActionCard
    card.approval_status = decision === 'REJECT' ? 'rejected' : 'approved';
    await card.save();

    // 2. AuditLog
    await AuditLog.create({
      action_id: card.action_id,
      user_name: 'Command Center Manager',
      user_role: 'MANAGER',
      action_type: decision === 'APPROVE' ? 'PLAN_APPROVED' : decision === 'REJECT' ? 'PLAN_REJECTED' : 'PLAN_MODIFIED',
      entity_type: 'ActionCard',
      entity_id: card._id.toString(),
      decision: decision,
      reason: reason || `Manager manually ${decision.toLowerCase()}d the AI recommendation.`
    });

    if (decision !== 'REJECT') {
      const department = modifications?.department || card.affected_departments?.[0] || 'maintenance';
      const priority = modifications?.priority || 'High';
      
      let assignedStaff = modifications?.worker;
      if (!assignedStaff || assignedStaff === 'auto') {
        const availableStaff = await StaffRoster.findOne({ department, task_status: 'idle' }).sort('fatigue_score');
        if (availableStaff) assignedStaff = availableStaff.name;
      }

      if (assignedStaff && assignedStaff !== 'auto') {
        await StaffRoster.updateOne({ name: assignedStaff }, { task_status: 'busy' });
      }

      const ticket = await OperationalTicket.create({
        title: card.title,
        department: department,
        priority: priority,
        source: 'system',
        assigned_to: assignedStaff !== 'auto' ? assignedStaff : undefined,
        status: assignedStaff && assignedStaff !== 'auto' ? 'in_progress' : 'todo',
        evidence_terms: card.evidence || [],
        is_systemic: false,
        resolution_notes: modifications?.instructions || undefined,
        compensation_offered: modifications?.compensation || 'None',
        relocation_offered: modifications?.relocation || 'No'
      });

      // Handle Room Relocation
      if ((modifications?.relocation === 'Yes' || card.title.includes('MOVE TO ROOM') || card.implementation_steps?.join(' ').includes('MOVE TO ROOM')) && card.evidence) {
        const roomEvidence = card.evidence.find((e: string) => e.startsWith('Room '));
        if (roomEvidence) {
          const oldRoom = roomEvidence.replace('Room ', '');
          const currRoom = await Room.findOne({ room_number: oldRoom });
          if (currRoom) {
            const newRoom = await Room.findOne({ type: currRoom.type, status: 'available' });
            if (newRoom) {
              currRoom.status = 'cleaning';
              newRoom.status = 'occupied';
              await currRoom.save();
              await newRoom.save();
              
              await Booking.updateOne(
                { room_number: oldRoom, status: 'checked-in' },
                { room_number: newRoom.room_number }
              );

              await GuestRequest.updateMany(
                { room_number: oldRoom, status: { $ne: 'COMPLETED' } },
                { 
                  room_number: newRoom.room_number, 
                  resolution_notes: `Guest moved to room ${newRoom.room_number}. ${modifications?.instructions || ''}`,
                  compensation_offered: modifications?.compensation !== 'None' ? modifications?.compensation : undefined
                }
              );
              ticket.resolution_notes = `Room relocated from ${oldRoom} to ${newRoom.room_number}`;
              await ticket.save();
            }
          }
        }
      } else if (modifications?.compensation && modifications.compensation !== 'None' && card.evidence) {
        const roomEvidence = card.evidence.find((e: string) => e.startsWith('Room '));
        if (roomEvidence) {
          const room = roomEvidence.replace('Room ', '');
          await GuestRequest.updateMany(
            { room_number: room, status: { $ne: 'COMPLETED' } },
            { compensation_offered: modifications.compensation }
          );
        }
      }

      // Simulation/dynamic steps
      const steps = card.implementation_steps?.join(', ') || '';
      if (steps.toLowerCase().includes('temp worker')) {
        await StaffRoster.create({
          name: `Temporary Worker - ${Math.floor(Math.random()*1000)}`,
          role: 'contractor',
          department: department,
          skills: ['general'],
          shift_start: new Date().toISOString(),
          shift_end: new Date(Date.now() + 8*60*60*1000).toISOString(),
          is_available: true,
          task_status: 'busy',
          fatigue_score: 0
        });
      }
    }

    res.json({ success: true, message: `Plan ${decision}`, data: card });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const parseReview = async (req: Request, res: Response) => {
  try {
    const { review_text, room_number } = req.body;
    const classification = classifyRequest(review_text);

    // Map classification priority (LOW/MEDIUM/HIGH/CRITICAL) to ticket enum (Low/Medium/High/Critical)
    const ticketPriorityMap: Record<string, string> = {
      LOW: 'Medium', // reviews always warrant at least Medium attention
      MEDIUM: 'Medium',
      HIGH: 'High',
      CRITICAL: 'Critical',
    };

    // Real ABSA: try the trained ML core (TF-IDF+LogReg sentiment, keyword-evidence issue detection).
    // Falls back to the deterministic keyword classifier if the ML core is unreachable (demo-safe).
    let sentiment = 'NEGATIVE';
    let evidenceTerms: string[] = [classification.intent];
    let mlSource = 'fallback_classifier';
    try {
      const mlResult = await MLService.analyzeReview({ review_text, room_number });
      if (mlResult) {
        sentiment = String(mlResult.sentiment || 'negative').toUpperCase();
        const issueEvidence = (mlResult.issues || []).flatMap((i: any) => i.evidence || []);
        evidenceTerms = issueEvidence.length > 0 ? Array.from(new Set(issueEvidence)) : [classification.intent];
        mlSource = mlResult.sentiment_source || 'ml_model';
      }
    } catch (mlErr) {
      // ML core unavailable — keep deterministic fallback above, don't fail the request
    }

    // Only dispatch a facilities work order for actionable (negative) feedback —
    // a positive/neutral review shouldn't spawn a maintenance/housekeeping ticket.
    let ticket = null;
    if (sentiment === 'NEGATIVE') {
      ticket = await OperationalTicket.create({
        title: `Review Alert: ${classification.intent}`,
        department: classification.department,
        priority: ticketPriorityMap[classification.priority] ?? 'Medium',
        source: 'review',
        room_number: room_number,
        evidence_terms: evidenceTerms,
        is_systemic: false
      });
    }

    res.json({
      success: true,
      data: {
        aspect: classification.intent,
        sentiment,
        sentiment_source: mlSource,
        department: classification.department,
        evidence_terms: evidenceTerms,
        ticket,
        ticket_created: !!ticket
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const getTickets = async (req: Request, res: Response) => {
  try {
    const tickets = await OperationalTicket.find().sort({ createdAt: -1 });
    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const getActionCards = async (req: Request, res: Response) => {
  try {
    const cards = await ActionCard.find().sort({ createdAt: -1 });
    res.json({ success: true, data: cards });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(50);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const getStaff = async (req: Request, res: Response) => {
  try {
    const staff = await StaffRoster.find();
    res.json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const updateTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const query: Record<string, unknown>[] = [{ ticket_id: id }];
    if (mongoose.isValidObjectId(id)) query.push({ _id: id });
    
    const ticket = await OperationalTicket.findOne({ $or: query });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const prevStatus = ticket.status;
    ticket.status = status;
    if (notes) ticket.resolution_notes = notes;
    if (status === 'completed') {
      ticket.completed_at = new Date();
      if (ticket.assigned_to) {
        await StaffRoster.updateOne({ name: ticket.assigned_to }, { task_status: 'idle', current_task_id: undefined });
      }
    }
    await ticket.save();

    await AuditLog.create({
      action_id: ticket.ticket_id,
      user_name: req.user?.name ?? 'System',
      user_role: req.user?.role,
      action_type: 'TICKET_STATUS_UPDATED',
      entity_type: 'OperationalTicket',
      entity_id: ticket._id.toString(),
      original_state: { status: prevStatus },
      new_state: { status: ticket.status }
    });

    await notifyManagers({
      type: 'TICKET_STATUS_CHANGED',
      priority: ticket.priority === 'Critical' ? 'CRITICAL' : 'MEDIUM',
      title: `Ticket ${ticket.ticket_id}: ${ticket.status}`,
      message: `${req.user?.name ?? 'Staff'} updated status to ${ticket.status} for "${ticket.title}".`,
      sourceType: 'OperationalTicket',
      sourceId: ticket.ticket_id,
      departments: [ticket.department]
    });

    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

import { processConciergeMessage } from '../services/ai/guestConciergeService';

export const handleGuestConcierge = async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const guestId = req.user?._id.toString();
    const roomNumber = req.user?.guestRoomNumber;
    if (!guestId || !roomNumber || typeof message !== 'string' || message.trim().length < 2 || message.length > 1000) {
      return res.status(400).json({ success: false, message: 'A valid authenticated guest booking and message are required' });
    }

    const conciergeResponse = await processConciergeMessage(guestId, roomNumber, message.trim());

    res.json(conciergeResponse);
  } catch (error) {
    console.error('Concierge Error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
};


import { GuestConversation } from '../models/GuestConversation';

export const getGuestConversations = async (req: Request, res: Response) => {
  try {
    const guestId = req.user?.role === 'GUEST' ? req.user._id.toString() : req.params.guestId;
    if (!guestId) return res.status(400).json({ success: false, message: 'Guest identity is required' });
    const conversations = await GuestConversation.find({ guest_id: guestId }).sort({ created_at: 1 });
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

// ==========================================
// EXISTING ENDPOINTS (UPDATED)
// ==========================================

import { processGuestRequest } from '../services/ai/orchestrator';

export const handleGuestRequest = async (req: Request, res: Response) => {
  try {
    const { request_text } = req.body;
    const room_number = req.user?.role === 'GUEST' ? (req.user.guestRoomNumber || '105') : req.body.room_number;
    const guest_name = req.user?.role === 'GUEST' ? req.user.name : (req.body.guest_name || `Guest ${room_number}`);
    if (!room_number || typeof request_text !== 'string' || request_text.trim().length < 2) {
      return res.status(422).json({ success: false, message: 'A valid room number and request text are required' });
    }
    const guestReq = await processGuestRequest(guest_name, room_number, request_text.trim(), req.user?.role === 'GUEST' ? req.user._id.toString() : undefined);

    res.json({ success: true, data: guestReq });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const getGuestRequests = async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.user?.role === 'GUEST') {
      const roomNum = req.user.guestRoomNumber || '105';
      filter.$or = [{ guest_user_id: req.user._id }, { room_number: roomNum }];
    }
    const requests = await GuestRequest.find(filter).sort({ created_at: -1 });
    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const getWorkerTasks = async (req: Request, res: Response) => {
  try {
    let staffName = req.params.staffName as string | undefined;
    if (staffName === 'me' || !staffName || req.user?.role === 'WORKER') {
      staffName = req.user?.name;
      if ((!staffName || staffName === 'Worker') && req.user?.staffId) {
        try {
          const sId = (req.user.staffId as any)?._id || req.user.staffId;
          const linkedStaff = await StaffRoster.findById(sId);
          if (linkedStaff?.name) staffName = linkedStaff.name;
        } catch {
          // ignore cast error
        }
      }
    }
    if (!staffName) {
      return res.status(422).json({ success: false, message: 'No staff identity is linked to this account' });
    }
    const guestRequests = await GuestRequest.find({ assigned_staff: staffName }).sort({ created_at: -1 });
    const operationalTickets = await OperationalTicket.find({ assigned_to: staffName }).sort({ createdAt: -1 });
    res.json({ success: true, staffName, guestRequests, operationalTickets });
  } catch (error) {
    console.error('getWorkerTasks error:', error);
    res.status(500).json({ success: false, error: String(error), message: 'Unable to load assigned tasks' });
  }
};

export const acceptWorkerTask = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const reqDoc: any = await findTaskByExternalId(id);
    if (!reqDoc) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!(await assertTaskAccess(req, reqDoc))) return res.status(403).json({ success: false, message: 'You may only action tasks assigned to you' });

    // Acceptance is a distinct persisted state; work starts only after Start.
    reqDoc.status = reqDoc.ticket_id ? 'acknowledged' : 'ACCEPTED';
    await reqDoc.save();

    if (reqDoc.assigned_staff || reqDoc.assigned_to) {
      await StaffRoster.updateOne({ name: reqDoc.assigned_staff || reqDoc.assigned_to }, { task_status: 'busy' });
    }

    await AuditLog.create({
      action_id: id,
      user_name: req.user?.name || 'Worker',
      user_role: req.user?.role,
      action_type: 'TASK_ACCEPTED',
      entity_type: 'Task',
      entity_id: reqDoc._id.toString(),
      decision: 'Accepted'
    });
    await notifyManagers({
      type: 'TASK_STATUS_CHANGED', priority: 'MEDIUM', sourceType: 'Task', sourceId: id,
      title: `Task ${id} acknowledged`, message: `${req.user?.name ?? 'Staff'} acknowledged ${reqDoc.title || reqDoc.request_text}.`,
      departments: [reqDoc.department],
    });

    res.json({ success: true, data: reqDoc });
  } catch (error) {
    console.error('acceptWorkerTask error:', error);
    res.status(500).json({ success: false, error: String(error), message: 'Unable to acknowledge task' });
  }
};

export const rejectWorkerTask = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;
    const reqDoc: any = await findTaskByExternalId(id);
    if (!reqDoc) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!(await assertTaskAccess(req, reqDoc))) return res.status(403).json({ success: false, message: 'You may only action tasks assigned to you' });
    
    // Auto-reassign logic
    const department = reqDoc.department;
    const currentWorker = reqDoc.assigned_staff || reqDoc.assigned_to;
    const availableStaff = await StaffRoster.findOne({ department, task_status: 'idle', name: { $ne: currentWorker } }).sort('fatigue_score');

    if (availableStaff) {
      if (reqDoc.assigned_staff !== undefined) reqDoc.assigned_staff = availableStaff.name;
      if (reqDoc.assigned_to !== undefined) reqDoc.assigned_to = availableStaff.name;
      reqDoc.status = reqDoc.ticket_id ? 'todo' : 'ASSIGNED';
      await StaffRoster.updateOne({ name: availableStaff.name }, { task_status: 'busy' });
    } else {
      reqDoc.status = reqDoc.ticket_id ? 'blocked' : 'REJECTED';
      reqDoc.rejection_reason = reason;
      // Escalate to manager queue by making it an ActionCard
      await ActionCard.create({
        title: `Task Rejected & Unassigned: ${reqDoc.title || reqDoc.request_text}`,
        affected_departments: [department],
        trigger: 'Worker Rejection',
        evidence: [reason],
        autonomy_level: 'MANAGER',
        approval_required: true,
        options: [],
        implementation_steps: []
      });
    }
    
    await reqDoc.save();

    if (currentWorker) {
      await StaffRoster.updateOne({ name: currentWorker }, { task_status: 'idle' });
    }

    await AuditLog.create({
      action_id: id,
      user_name: currentWorker || 'Worker',
      user_role: 'WORKER',
      action_type: 'TASK_REJECTED',
      entity_type: 'Task',
      entity_id: reqDoc._id.toString(),
      decision: 'Rejected',
      reason: reason
    });

    res.json({ success: true, data: reqDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const startWorkerTask = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const reqDoc: any = await findTaskByExternalId(id);
    if (!reqDoc) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!(await assertTaskAccess(req, reqDoc))) return res.status(403).json({ success: false, message: 'You may only action tasks assigned to you' });

    reqDoc.status = reqDoc.ticket_id ? 'in_progress' : 'IN_PROGRESS';
    await reqDoc.save();

    const worker = reqDoc.assigned_staff || reqDoc.assigned_to;
    if (worker) {
      await StaffRoster.updateOne({ name: worker }, { task_status: 'in_progress' });
    }

    res.json({ success: true, data: reqDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const completeWorkerTask = async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    const { completion_note } = req.body;
    const reqDoc: any = await findTaskByExternalId(taskId);
    if (!reqDoc) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!(await assertTaskAccess(req, reqDoc))) return res.status(403).json({ success: false, message: 'You may only action tasks assigned to you' });

    const staff_name = req.user?.name;
    reqDoc.status = reqDoc.ticket_id ? 'completed' : 'COMPLETED';
    if (reqDoc.ticket_id) reqDoc.completed_at = new Date();
    if (reqDoc.completion_note !== undefined) reqDoc.completion_note = String(completion_note ?? 'Completed by staff').slice(0, 500);
    if (reqDoc.resolution_notes !== undefined) reqDoc.resolution_notes = String(completion_note ?? 'Completed by staff').slice(0, 500);
    await reqDoc.save();

    if (staff_name) {
      await StaffRoster.updateOne({ name: staff_name }, { task_status: 'idle', current_task_id: undefined });
    }
    await notifyManagers({
      type: 'TASK_COMPLETED', priority: 'MEDIUM', sourceType: 'Task', sourceId: taskId,
      title: `Task ${taskId} completed`, message: `${staff_name ?? 'Staff'} completed ${reqDoc.title || reqDoc.request_text}.`,
      departments: [reqDoc.department],
    });
    if (reqDoc.room_number) {
      const guestUsers = await (await import('../models/User')).User.find({ role: 'GUEST', guestRoomNumber: reqDoc.room_number, isActive: true }).select('_id');
      if (guestUsers.length) await notifyUsers({
        userIds: guestUsers.map((user) => user._id.toString()), type: 'GUEST_REQUEST_RESOLVED', priority: 'MEDIUM',
        sourceType: 'Task', sourceId: taskId, title: 'Your resort request was completed',
        message: `Your request for room ${reqDoc.room_number} has been completed. You can now leave feedback.`,
      });
    }

    await AuditLog.create({
      user_name: staff_name || 'System',
      user_role: 'WORKER',
      action_type: 'TASK_COMPLETED',
      entity_type: 'Task',
      entity_id: reqDoc._id.toString(),
      decision: `Completed task: ${completion_note || 'No note'}`
    });

    res.json({ success: true, data: reqDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const blockWorkerTask = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;
    const reqDoc: any = await findTaskByExternalId(id);
    if (!reqDoc) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!(await assertTaskAccess(req, reqDoc))) return res.status(403).json({ success: false, message: 'You may only action tasks assigned to you' });

    reqDoc.status = reqDoc.ticket_id ? 'blocked' : 'BLOCKED';
    await reqDoc.save();

    const currentWorker = reqDoc.assigned_staff || reqDoc.assigned_to;
    if (currentWorker) {
      await StaffRoster.updateOne({ name: currentWorker }, { task_status: 'idle' });
    }

    let implementation_steps: string[] = [];
    
    // Find room alternatives if applicable
    const roomNumber = reqDoc.room_number || (reqDoc.title?.match(/Room (\d+)/) || [])[1];
    if (roomNumber) {
      const currRoom = await Room.findOne({ room_number: roomNumber });
      if (currRoom) {
        const alternatives = await Room.find({ type: currRoom.type, status: 'available' }).limit(2);
        if (alternatives.length > 0) {
          implementation_steps = alternatives.map(a => `MOVE TO ROOM ${a.room_number}`);
          implementation_steps.unshift('KEEP GUEST IN ROOM');
        }
      }
    }

    await ActionCard.create({
      title: `ESCALATION: ${reqDoc.title || reqDoc.request_text}`,
      affected_departments: [reqDoc.department],
      trigger: `Unresolved by ${currentWorker || 'Worker'}`,
      evidence: [reason, `Room ${roomNumber}`],
      autonomy_level: 'MANAGER',
      approval_required: true,
      options: [],
      implementation_steps: implementation_steps.length > 0 ? implementation_steps : ['Review and reassign', 'Contact guest']
    });

    await AuditLog.create({
      action_id: id,
      user_name: currentWorker || 'Worker',
      user_role: 'WORKER',
      action_type: 'TASK_BLOCKED',
      entity_type: 'Task',
      entity_id: reqDoc._id.toString(),
      decision: 'Blocked',
      reason: reason
    });

    res.json({ success: true, data: reqDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const feedbackGuestRequest = async (req: Request, res: Response) => {
  try {
    const requestId = req.params.requestId as string;
    // Accept both naming conventions (client sends feedback/rating)
    const guest_feedback = req.body.guest_feedback ?? req.body.feedback;
    const guest_rating = req.body.guest_rating ?? req.body.rating;
    
    const filter: Record<string, unknown> = { request_id: requestId };
    if (req.user?.role === 'GUEST') {
      const roomNum = req.user.guestRoomNumber || '105';
      filter.$or = [{ guest_user_id: req.user._id }, { room_number: roomNum }];
    }

    const reqDoc = await GuestRequest.findOneAndUpdate(
      filter,
      { 
        guest_rating: Number(guest_rating) || 5,
        guest_feedback: String(guest_feedback || '').slice(0, 500),
        status: 'VERIFIED'
      },
      { new: true }
    );

    if (!reqDoc) return res.status(404).json({ success: false, message: 'Request not found or unauthorized' });

    if (Number(guest_rating) <= 2 || guest_feedback?.toLowerCase().includes('not resolved')) {
      await ActionCard.create({
        title: `Service Recovery: Poor Feedback (${guest_rating} Stars) - Room ${reqDoc.room_number}`,
        affected_departments: [reqDoc.department, 'management'],
        trigger: 'Guest Feedback',
        evidence: [`Task: ${reqDoc.intent}`, `Feedback: ${guest_feedback}`, `Room: ${reqDoc.room_number}`],
        autonomy_level: 'MANAGER',
        approval_required: true,
        options: [
          { label: 'Offer Apology', description: 'Contact guest immediately', impact: 'Low' },
          { label: 'Offer Compensation', description: 'Comp meal or spa treatment', impact: 'Medium' }
        ],
        implementation_steps: ['Investigate worker response', 'Contact guest']
      });
      await AuditLog.create({
        user_name: 'AI Orchestrator',
        action_type: 'SERVICE_RECOVERY_TRIGGERED',
        decision: `Triggered service recovery for task ${requestId} due to low rating.`
      });
      await notifyManagers({
        type: 'SERVICE_RECOVERY_REQUIRED',
        priority: 'HIGH',
        sourceType: 'GuestRequest',
        sourceId: requestId,
        title: `Service Recovery Alert: Room ${reqDoc.room_number}`,
        message: `Guest gave ${guest_rating} stars for ${reqDoc.intent}: "${guest_feedback || 'No comments'}". Action required.`,
        departments: [reqDoc.department, 'management']
      });
    }

    res.json({ success: true, data: reqDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const clusterComplaints = async (req: Request, res: Response) => {
  try {
    const time_window_hours = req.body.time_window_hours || 2;
    const since = new Date(Date.now() - time_window_hours * 60 * 60 * 1000);

    const guestReqs: any[] = await GuestRequest.collection.find(dateGte('created_at', since) as any).toArray();
    const tickets: any[] = await OperationalTicket.collection.find(dateGte('createdAt', since) as any).toArray();
    
    const groups: Record<string, any[]> = {};
    for (const req of guestReqs) {
      const key = `${req.intent}_${req.department}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ type: 'GuestRequest', item: req });
    }
    
    const clusters = [];
    let systemic_alerts = 0;

    for (const key of Object.keys(groups)) {
      if (groups[key].length >= 3) {
        systemic_alerts++;
        const cluster_id = `CLS-${Date.now()}`;
        const items = groups[key];
        const rooms = items.map(i => i.item.room_number);
        const intent = items[0].item.intent;
        
        for (const i of items) {
          await GuestRequest.updateOne({ _id: i.item._id }, { priority: 'CRITICAL' });
        }
        
        const masterTicket = await OperationalTicket.create({
          title: `Systemic Issue: ${intent} across ${rooms.length} rooms`,
          department: items[0].item.department,
          priority: 'Critical',
          cluster_id: cluster_id,
          is_systemic: true,
          evidence_terms: [intent]
        });
        
        const actionCard = await ActionCard.create({
          title: `Systemic Resolution for ${intent}`,
          affected_departments: [items[0].item.department],
          trigger: 'Complaint Cluster',
          evidence: rooms,
          autonomy_level: 'CRITICAL',
          approval_required: true,
          options: []
        });

        clusters.push({
          intent, count: items.length, rooms, cluster_id, master_ticket: masterTicket, action_card: actionCard
        });
      }
    }

    res.json({ success: true, clusters, systemic_alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const reallocateRoom = async (req: Request, res: Response) => {
  try {
    const { guest_name, current_room, reason } = req.body as { guest_name: string, current_room: string, reason: string };
    
    const currRoom = await Room.findOne({ room_number: current_room });
    if (!currRoom) return res.status(404).json({ success: false, message: 'Room not found' });

    // Prefer same room type; if none available, offer a complimentary upgrade to any available room
    let recommended = await Room.findOne({ type: currRoom.type, status: 'available' });
    let isUpgrade = false;
    if (!recommended) {
      recommended = await Room.findOne({ status: 'available' }).sort({ rate_per_night: 1 });
      isUpgrade = !!recommended;
    }

    if (!recommended) {
      return res.json({ success: false, message: 'No available rooms in the resort right now' });
    }

    const alternatives = await Room.find({
      status: 'available',
      room_number: { $ne: recommended.room_number },
    }).limit(3);
    
    const actionCard = await ActionCard.create({
      title: `Reallocate ${guest_name} from ${current_room} to ${recommended.room_number}${isUpgrade ? ` (complimentary ${recommended.type} upgrade)` : ''}`,
      affected_departments: ['front_desk', 'housekeeping'],
      trigger: reason,
      situation: reason,
      evidence: isUpgrade ? [`No ${currRoom.type} rooms available — upgrading guest to ${recommended.type}`] : [],
      autonomy_level: 'MANAGER',
      approval_required: true,
      options: [{ label: 'Approve Reallocation', description: 'Moves guest and marks old room for cleaning', impact: 'Guest satisfaction' }]
    });
    
    res.json({
      success: true,
      recommended_room: recommended,
      is_upgrade: isUpgrade,
      alternatives,
      action_card: actionCard
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const resetDemo = async (req: Request, res: Response) => {
  try {
    await Room.deleteMany({});
    await Booking.deleteMany({});
    await StaffRoster.deleteMany({});
    await PantryInventory.deleteMany({});
    await MaintenanceAsset.deleteMany({});
    await WorldSignal.deleteMany({});
    await OperationalTicket.deleteMany({});
    await ActionCard.deleteMany({});
    await AuditLog.deleteMany({});
    await GuestRequest.deleteMany({});
    
    const rooms = [];
    for (let floor = 1; floor <= 5; floor++) {
      for (let i = 0; i < 10; i++) {
        const roomNumber = `${floor}${String(i + 1).padStart(2, '0')}`;
        let type = 'Standard', rate = 150;
        if (i >= 6 && i < 9) { type = 'Deluxe'; rate = 250; } 
        else if (i === 9) { type = 'Suite'; rate = 450; }
        
        rooms.push({ room_number: roomNumber, type, status: 'available', rate_per_night: rate, floor });
      }
    }
    for (let i = 0; i < 41; i++) rooms[i].status = 'occupied';
    for (let i = 41; i < 44; i++) rooms[i].status = 'cleaning';
    for (let i = 44; i < 46; i++) rooms[i].status = 'maintenance';
    await Room.insertMany(rooms);

    const bookings = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    for (let i = 0; i < 41; i++) {
      const room = rooms[i];
      const checkIn = i % 2 === 0 ? today : yesterday;
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + (i % 5) + 1);
      bookings.push({ guest_name: `Guest ${room.room_number}`, room_number: room.room_number, check_in: checkIn, check_out: checkOut, status: 'checked-in', guests_count: (i % 4) + 1, rate_locked: room.rate_per_night, source: 'direct' });
    }
    await Booking.insertMany(bookings);

    const staffDepts = [
      { name: 'housekeeping', count: 8 }, { name: 'front_desk', count: 5 }, { name: 'fnb', count: 7 },
      { name: 'maintenance', count: 4 }, { name: 'spa', count: 3 }, { name: 'security', count: 3 }
    ];
    const staffMembers: any[] = [];
    for (const dept of staffDepts) {
      for (let i = 0; i < dept.count; i++) {
        const prefix = dept.name === 'front_desk' ? 'FD' : dept.name === 'fnb' ? 'FNB' : dept.name.charAt(0).toUpperCase();
        staffMembers.push({ name: `Staff ${prefix}${i + 1}`, department: dept.name, skills: [], cross_trained: [], fatigue_score: Math.floor(Math.random() * 46) + 15, hourly_rate: Math.floor(Math.random() * 11) + 15, is_available: true, task_status: 'idle' });
      }
    }
    const spaStaff = staffMembers.filter(s => s.department === 'spa');
    if (spaStaff.length >= 2) { spaStaff[0].cross_trained.push('front_desk'); spaStaff[1].cross_trained.push('front_desk'); }
    staffMembers[0].is_available = false; staffMembers[10].is_available = false;
    
    const req1 = await GuestRequest.create({ guest_name: 'Guest 105', room_number: '105', request_text: "I need an extra towel please", intent: 'TOWEL', priority: 'LOW', autonomy_level: 'AUTO', department: 'housekeeping', status: 'ASSIGNED', assigned_staff: staffMembers[0].name });
    const req2 = await GuestRequest.create({ guest_name: 'Guest 204', room_number: '204', request_text: "The AC in my room is making a terrible noise", intent: 'AC', priority: 'MEDIUM', autonomy_level: 'SUPERVISOR', department: 'maintenance', status: 'CLASSIFIED' });
    const req3 = await GuestRequest.create({ guest_name: 'Guest 112', room_number: '112', request_text: "Can I get two more pillows?", intent: 'PILLOW', priority: 'LOW', autonomy_level: 'AUTO', department: 'housekeeping', status: 'ASSIGNED', assigned_staff: staffMembers[1].name });

    staffMembers[0].task_status = 'assigned';
    staffMembers[0].current_task_id = req1.request_id;
    staffMembers[1].task_status = 'assigned';
    staffMembers[1].current_task_id = req3.request_id;
    
    const savedStaff = await StaffRoster.insertMany(staffMembers);

    // Ensure demo users exist
    const defaultPassword = await (await import('bcryptjs')).default.hash('demo123', 10);
    const demoUsers = [
      { name: 'Manager', email: 'manager@smartresort.demo', passwordHash: defaultPassword, role: 'MANAGER', isActive: true },
      { name: 'Housekeeping Supervisor', email: 'housekeeping.supervisor@smartresort.demo', passwordHash: defaultPassword, role: 'SUPERVISOR', department: 'Housekeeping', isActive: true },
      { name: 'Staff H1', email: 'housekeeper@smartresort.demo', passwordHash: defaultPassword, role: 'WORKER', department: 'Housekeeping', staffId: savedStaff.find(s => s.name === 'Staff H1')?._id, isActive: true },
      { name: 'Staff M1', email: 'technician@smartresort.demo', passwordHash: defaultPassword, role: 'WORKER', department: 'Maintenance', staffId: savedStaff.find(s => s.name === 'Staff M1')?._id, isActive: true },
      { name: 'Guest 105', email: 'guest@smartresort.demo', passwordHash: defaultPassword, role: 'GUEST', guestRoomNumber: '105', bookingReference: 'BK-RESORT-105', isActive: true },
    ];
    for (const u of demoUsers) {
      await (await import('../models/User')).User.findOneAndUpdate({ email: u.email }, { $set: u }, { upsert: true });
    }

    await PantryInventory.insertMany([
      { item_name: 'Fresh Salmon', current_stock_kg: 15, safety_threshold_kg: 10, daily_consumption_rate_kg: 3 },
      { item_name: 'Avocado', current_stock_kg: 20, safety_threshold_kg: 8, daily_consumption_rate_kg: 2 },
      { item_name: 'Butter', current_stock_kg: 30, safety_threshold_kg: 10, daily_consumption_rate_kg: 4 },
      { item_name: 'Champagne', current_stock_kg: 50, safety_threshold_kg: 15, daily_consumption_rate_kg: 8 },
      { item_name: 'Steak', current_stock_kg: 25, safety_threshold_kg: 8, daily_consumption_rate_kg: 5 }
    ]);

    await MaintenanceAsset.insertMany([
      { asset_id: 'HVAC-Roof', name: 'HVAC Roof Unit', type: 'HVAC', condition_score: 72 },
      { asset_id: 'Elevator-Main', name: 'Main Lobby Elevator', type: 'elevator', condition_score: 85 }
    ]);

    await WorldSignal.create({ signal_type: 'weather', severity: 0.7, affected_departments: ['front_desk', 'fnb'], is_active: true });

    await OperationalTicket.create({ title: 'AC rattling Room 204', department: 'maintenance', priority: 'High', status: 'todo', source: 'review', room_number: '204' });
    await OperationalTicket.create({ title: 'Elevator slow response', department: 'maintenance', priority: 'Medium', status: 'in_progress', source: 'guest_request' });

    res.json({ success: true, message: 'Demo reset completed' });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};
export const acknowledgeTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ticket = await OperationalTicket.findByIdAndUpdate(id, { status: 'ACKNOWLEDGED' }, { new: true });
    
    if (ticket) {
      await AuditLog.create({
        action_type: 'TICKET_ACKNOWLEDGED',
        user_name: req.user?.name,
        user_role: req.user?.role,
        entity_type: 'OperationalTicket',
        entity_id: String(ticket._id),
        reason: 'Manager acknowledged critical incident'
      });
    }

    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};





import { Simulation } from '../models/Simulation';
import { TwinSnapshot } from '../models/TwinSnapshot';

export const getSimulations = async (req: Request, res: Response) => {
  try {
    const simulations = await Simulation.find({}).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data: simulations });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const getSimulationById = async (req: Request, res: Response) => {
  try {
    const sim = await Simulation.findById(req.params.id);
    res.json({ success: true, data: sim });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const applySimulation = async (req: Request, res: Response) => {
  try {
    const sim = await Simulation.findById(req.params.id);
    if (!sim) return res.status(404).json({ success: false, error: 'Simulation not found' });
    sim.decision = 'APPROVED';
    await sim.save();
    
    await AuditLog.create({
      action_type: 'SIMULATION_RECOMMENDATION_APPROVED',
      user_name: req.user?.name,
      user_role: req.user?.role,
      entity_type: 'Simulation',
      entity_id: String(sim._id),
      reason: 'Manager approved simulated recommendation'
    });
    
    res.json({ success: true, data: sim });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const rejectSimulation = async (req: Request, res: Response) => {
  try {
    const sim = await Simulation.findById(req.params.id);
    if (!sim) return res.status(404).json({ success: false, error: 'Simulation not found' });
    sim.decision = 'REJECTED';
    await sim.save();
    
    await AuditLog.create({
      action_type: 'SIMULATION_RECOMMENDATION_REJECTED',
      user_name: req.user?.name,
      user_role: req.user?.role,
      entity_type: 'Simulation',
      entity_id: String(sim._id),
      reason: 'Manager rejected simulated recommendation'
    });
    
    res.json({ success: true, data: sim });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const createTwinSnapshot = async (req: Request, res: Response) => {
  try {
    const data = await getDigitalTwinSnapshot();
    const snap = await TwinSnapshot.create(data);
    res.json({ success: true, data: snap });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const getTwinHistory = async (req: Request, res: Response) => {
  try {
    const history = await TwinSnapshot.find({}).sort({ timestamp: -1 }).limit(10);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};






