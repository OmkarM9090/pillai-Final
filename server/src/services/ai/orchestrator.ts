import { GuestRequest } from '../../models/GuestRequest';
import { dateGte } from '../../utils/dbCompat';
import { StaffRoster } from '../../models/StaffRoster';
import { ActionCard } from '../../models/ActionCard';
import { AuditLog } from '../../models/AuditLog';
import { classifyGuestRequest } from './nlpEngine';
import { selectBestWorker } from './workerEngine';
import { notifyManagers, notifyUsers, notifyDepartment } from '../notificationService';

const isHighPriority = (p: string) => ['CRITICAL', 'HIGH', 'P0', 'P1'].includes(String(p));

async function notifyGuestRoom(room_number: string, input: { title: string; message: string; sourceId: string }) {
  try {
    const { User } = await import('../../models/User');
    const guestUsers = await User.find({ role: 'GUEST', guestRoomNumber: room_number, isActive: true }).select('_id');
    if (guestUsers.length > 0) {
      await notifyUsers({
        userIds: guestUsers.map((u) => u._id.toString()),
        type: 'GUEST_REQUEST_UPDATE',
        priority: 'LOW',
        title: input.title,
        message: input.message,
        sourceType: 'GuestRequest',
        sourceId: input.sourceId,
      });
    }
  } catch (err) {
    console.error('notifyGuestRoom failed:', err);
  }
}

export async function processGuestRequest(guest_name: string, room_number: string, request_text: string, guest_user_id?: string) {
  // 0. Normalise the display name — callers sometimes pass the authenticated
  //    guest's ObjectId (24-char hex). Staff should never see a raw id.
  if (!guest_name || /^[a-f0-9]{24}$/i.test(guest_name)) {
    guest_name = room_number ? `Guest ${room_number}` : 'In-house guest';
  }

  // 1. NLP Classification
  const nlp = classifyGuestRequest(request_text);

  // 2. Create Request Document in CREATED state
  const guestReq = new GuestRequest({
    guest_name,
    room_number,
    request_text,
    intent: nlp.intent,
    department: nlp.department,
    autonomy_level: nlp.autonomy_level,
    priority: nlp.priority,
    status: 'CREATED',
    sla_target_response_mins: nlp.sla_target_response_mins,
    sla_target_resolution_mins: nlp.sla_target_resolution_mins,
    priority_reason: nlp.priority_reason,
    equipment_needed: nlp.equipment_needed,
    is_emergency: nlp.is_emergency,
    guest_user_id
  });

  await guestReq.save();

  // 3. Emergency Workflow (L4 Critical)
  if (nlp.is_emergency) {
    guestReq.status = 'ESCALATED';
    await guestReq.save();
    
    // Create immediate high-priority ActionCard for Managers & Security
    await ActionCard.create({
      title: `EMERGENCY ALERT: ${nlp.intent} in Room ${room_number}`,
      affected_departments: [nlp.department, 'security', 'management'],
      trigger: 'AI L4 Classification',
      evidence: [request_text, nlp.priority_reason],
      autonomy_level: 'CRITICAL',
      approval_required: true,
      options: [
        { label: 'Dispatch Security Team', description: 'Send internal security to location immediately', impact: 'High' },
        { label: 'Follow Resort Emergency Procedure', description: 'Execute the configured resort emergency protocol for this location', impact: 'High' }
      ],
      implementation_steps: ['Acknowledge Alert', 'Verify Situation', 'Execute Emergency Protocol']
    });

    // Persisted incident + critical, role-targeted notifications (manager/security/on-duty)
    try {
      const { Incident } = await import('../../models/Incident');
      const incident = await Incident.create({
        incident_id: `INC-${Date.now().toString(36).toUpperCase()}`,
        incident_type: `Guest emergency — ${nlp.intent}`,
        severity: 'CRITICAL',
        location: `Room ${room_number}`,
        description: request_text.slice(0, 2000),
        detected_by: 'AI Guest Request Routing (L4)',
        assigned_roles: ['MANAGER', 'SECURITY', 'STAFF'],
        actions: [{ actor: 'AI Orchestrator', status: 'NOTE', note: nlp.priority_reason, at: new Date() }],
      });
      await notifyUsers({
        roles: ['MANAGER', 'GENERAL_MANAGER', 'SUPER_ADMIN', 'SECURITY'],
        type: 'CRITICAL_INCIDENT',
        priority: 'CRITICAL',
        title: `Critical incident — Room ${room_number}`,
        message: `${nlp.intent}: ${request_text.slice(0, 180)} Follow the resort's configured emergency procedure.`,
        sourceType: 'Incident',
        sourceId: incident.incident_id,
      });
    } catch (err) {
      console.error('Emergency incident creation failed:', err);
    }

    await AuditLog.create({
      user_name: 'AI Orchestrator',
      action_type: 'EMERGENCY_ESCALATION',
      decision: `Escalated L4 emergency for room ${room_number}`
    });

    await notifyGuestRoom(room_number, {
      title: 'Emergency request escalated',
      message: 'Your emergency has been escalated to the duty manager and security team immediately.',
      sourceId: guestReq.request_id,
    });

    return guestReq;
  }

  // 4. Auto-Dispatch (L1) or Supervisor (L2) - Attempt Worker Assignment
  if (nlp.autonomy_level === 'AUTO' || nlp.autonomy_level === 'SUPERVISOR') {
    guestReq.status = 'ROUTED';
    await guestReq.save();

    const workerResult = await selectBestWorker(nlp.department, nlp.equipment_needed);

    if (workerResult.assigned_worker_name) {
      guestReq.status = 'ASSIGNED';
      guestReq.assigned_staff = workerResult.assigned_worker_name;
      await guestReq.save();

      // Update worker status
      await StaffRoster.updateOne(
        { _id: workerResult.assigned_worker_id },
        { current_task_id: guestReq.request_id, task_status: 'assigned' }
      );

      // Phase 4/25: notify the assigned worker directly (role-specific message),
      // plus the department so the task appears even without a linked user account.
      await notifyUsers({
        assignedNames: [workerResult.assigned_worker_name],
        roles: ['SUPERVISOR'],
        departments: [nlp.department],
        type: 'TASK_ASSIGNED',
        priority: isHighPriority(nlp.priority) ? 'HIGH' : 'MEDIUM',
        title: `New ${nlp.department} task — Room ${room_number}`,
        message: `${request_text.slice(0, 140)} (Request ${guestReq.request_id}, priority ${nlp.priority}). Open My Tasks to accept.`,
        sourceType: 'GuestRequest',
        sourceId: guestReq.request_id,
      });
      await notifyGuestRoom(room_number, {
        title: 'Request received',
        message: `${workerResult.assigned_worker_name} from ${nlp.department} has been assigned. You'll be notified when it's completed.`,
        sourceId: guestReq.request_id,
      });

      await AuditLog.create({
        user_name: 'AI Orchestrator',
        action_type: 'WORKER_ASSIGNED',
        decision: `Assigned task ${guestReq.request_id} to ${workerResult.assigned_worker_name}${workerResult.fallback_used ? ' (Cross-Trained Fallback)' : ''}`
      });
    } else {
      guestReq.status = 'ESCALATED';
      guestReq.rejection_reason = workerResult.rejection_reason;
      await guestReq.save();

      // Phase 5: no eligible staff → PENDING supervisor/manager alert
      await notifyManagers({
        type: 'STAFFING_SHORTAGE',
        priority: isHighPriority(nlp.priority) ? 'HIGH' : 'MEDIUM',
        title: `Unassigned ${nlp.department} request — Room ${room_number}`,
        message: `"${request_text.slice(0, 140)}" could not be auto-assigned: ${workerResult.rejection_reason}. Assign manually from Guest Requests.`,
        sourceType: 'GuestRequest',
        sourceId: guestReq.request_id,
        departments: [nlp.department],
      });
      await notifyGuestRoom(room_number, {
        title: 'Request received',
        message: 'Your request is queued — our supervisor is assigning the right staff member. We will update you shortly.',
        sourceId: guestReq.request_id,
      });

      // Shortage escalation
      await ActionCard.create({
        title: `Resource Shortage: Unassigned ${nlp.intent} Request`,
        affected_departments: [nlp.department],
        trigger: 'AI Worker Selection Failure',
        evidence: [`No worker available for room ${room_number}`, `Priority: ${nlp.priority}`],
        autonomy_level: 'SUPERVISOR',
        approval_required: false,
        options: [
          { label: 'Acknowledge', description: 'Review workforce', impact: 'Low' }
        ],
        implementation_steps: ['Assign manually or inform guest of delay']
      });
    }
  } else {
    // L3 Manager Level — request waits in PENDING_APPROVAL; managers decide from
    // the Guest Requests section (approve/decline/modify) which executes for real.
    guestReq.status = 'PENDING_APPROVAL';
    await guestReq.save();

    await ActionCard.create({
      title: `Manager Approval Required: ${nlp.intent}`,
      affected_departments: [nlp.department],
      trigger: 'AI L3 Classification',
      evidence: [request_text, `Room ${room_number}`, `Request ${guestReq.request_id}`],
      autonomy_level: 'MANAGER',
      approval_required: true,
      options: [
        { label: 'Approve Request', description: 'Assign staff and execute', impact: 'Low' },
        { label: 'Decline Request', description: 'Decline with a reason (guest is notified)', impact: 'Low' }
      ],
      implementation_steps: ['Review in Guest Requests section', 'Approve / Decline / Modify']
    });

    await notifyManagers({
      type: 'APPROVAL_REQUIRED',
      priority: isHighPriority(nlp.priority) ? 'HIGH' : 'MEDIUM',
      title: `Approval needed — Room ${room_number} (${nlp.intent})`,
      message: `"${request_text.slice(0, 150)}" is waiting for a manager decision in Guest Requests (${guestReq.request_id}).`,
      sourceType: 'GuestRequest',
      sourceId: guestReq.request_id,
      departments: [nlp.department],
    });
    await notifyGuestRoom(room_number, {
      title: 'Request received',
      message: 'Your request has been routed to the duty manager for approval. We will update you shortly.',
      sourceId: guestReq.request_id,
    });
  }

  // 5. Systemic Complaint Detection (Step 18)
  // If > 2 complaints about AC or PLUMBING in the last hour, escalate to Master Incident
  if (nlp.intent === 'AC' || nlp.intent === 'PLUMBING' || nlp.intent === 'WIFI') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const similarComplaints = await GuestRequest.collection.countDocuments({
      intent: nlp.intent,
      ...dateGte('created_at', oneHourAgo)
    } as any);

    if (similarComplaints >= 3) {
      await ActionCard.create({
        title: `SYSTEMIC INCIDENT DETECTED: Cluster of ${nlp.intent} Failures`,
        affected_departments: [nlp.department, 'management'],
        trigger: `AI Cluster Detection (${similarComplaints} complaints in 1hr)`,
        evidence: [`Multiple rooms reporting ${nlp.intent} issues.`],
        autonomy_level: 'MANAGER',
        approval_required: true,
        options: [
          { label: 'Declare Outage', description: 'Alert all guests and dispatch master vendor', impact: 'High' }
        ],
        implementation_steps: ['Investigate root cause', 'Broadcast status update']
      });
      await AuditLog.create({
        user_name: 'AI Orchestrator',
        action_type: 'SYSTEMIC_INCIDENT',
        decision: `Generated systemic master incident for ${nlp.intent}`
      });
    }
  }

  return guestReq;
}
