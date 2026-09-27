import { GuestRequest } from '../../models/GuestRequest';
import { StaffRoster } from '../../models/StaffRoster';
import { ActionCard } from '../../models/ActionCard';
import { AuditLog } from '../../models/AuditLog';
import { classifyGuestRequest } from './nlpEngine';
import { selectBestWorker } from './workerEngine';

export async function processGuestRequest(guest_name: string, room_number: string, request_text: string) {
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
    is_emergency: nlp.is_emergency
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
        { label: 'Dispatch Emergency Services', description: 'Call 911 / Medical Response', impact: 'High' },
        { label: 'Dispatch Security Team', description: 'Send internal security to location immediately', impact: 'Medium' }
      ],
      implementation_steps: ['Acknowledge Alert', 'Verify Situation', 'Execute Emergency Protocol']
    });

    await AuditLog.create({
      user_name: 'AI Orchestrator',
      action_type: 'EMERGENCY_ESCALATION',
      decision: `Escalated L4 emergency for room ${room_number}`
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

      await AuditLog.create({
        user_name: 'AI Orchestrator',
        action_type: 'WORKER_ASSIGNED',
        decision: `Assigned task ${guestReq.request_id} to ${workerResult.assigned_worker_name}${workerResult.fallback_used ? ' (Cross-Trained Fallback)' : ''}`
      });
    } else {
      guestReq.status = 'ESCALATED';
      guestReq.rejection_reason = workerResult.rejection_reason;
      await guestReq.save();

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
    // L3 Manager Level - Direct to Action Card
    guestReq.status = 'CLASSIFIED';
    await guestReq.save();

    await ActionCard.create({
      title: `Manager Approval Required: ${nlp.intent}`,
      affected_departments: [nlp.department],
      trigger: 'AI L3 Classification',
      evidence: [request_text],
      autonomy_level: 'MANAGER',
      approval_required: true,
      options: [
        { label: 'Approve Request', description: 'Proceed with request', impact: 'Low' },
        { label: 'Reject Request', description: 'Deny request', impact: 'Low' }
      ],
      implementation_steps: ['Review guest profile', 'Execute decision']
    });
  }

  // 5. Systemic Complaint Detection (Step 18)
  // If > 2 complaints about AC or PLUMBING in the last hour, escalate to Master Incident
  if (nlp.intent === 'AC' || nlp.intent === 'PLUMBING' || nlp.intent === 'WIFI') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const similarComplaints = await GuestRequest.countDocuments({
      intent: nlp.intent,
      created_at: { $gte: oneHourAgo }
    });

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
