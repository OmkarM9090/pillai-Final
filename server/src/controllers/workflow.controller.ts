import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { GuestRequest } from '../models/GuestRequest';
import { OperationalTicket } from '../models/OperationalTicket';
import { Observation } from '../models/Observation';
import { StaffRoster } from '../models/StaffRoster';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import { selectBestWorker } from '../services/ai/workerEngine';
import { classifyGuestRequest } from '../services/ai/nlpEngine';
import { notifyManagers, notifyUsers, notifyDepartment } from '../services/notificationService';

// ============================================================
// MANAGER GUEST-REQUEST DECISIONS (Phase 6)
// APPROVE / DECLINE / MODIFY — all real, persisted, audited.
// ============================================================

const DECIDABLE_STATUSES = ['CREATED', 'CLASSIFIED', 'ROUTED', 'ESCALATED', 'PENDING_APPROVAL', 'BLOCKED', 'REJECTED'];

async function findGuestRequest(id: string) {
  const or: Record<string, unknown>[] = [{ request_id: id }];
  if (mongoose.isValidObjectId(id)) or.push({ _id: id });
  return GuestRequest.findOne({ $or: or });
}

async function notifyGuestRoom(roomNumber: string, input: { title: string; message: string; sourceId?: string; type?: string; priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }) {
  try {
    const guestUsers = await User.find({ role: 'GUEST', guestRoomNumber: roomNumber, isActive: true }).select('_id');
    if (guestUsers.length > 0) {
      await notifyUsers({
        userIds: guestUsers.map((u) => u._id.toString()),
        type: input.type ?? 'GUEST_REQUEST_UPDATE',
        priority: input.priority ?? 'MEDIUM',
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

/** Assign the best eligible worker; returns the assigned name or null. */
async function assignWorker(doc: any, department: string, equipment: string[]) {
  const result = await selectBestWorker(department, equipment || []);
  if (result.assigned_worker_name) {
    doc.assigned_staff = result.assigned_worker_name;
    doc.status = 'ASSIGNED';
    await StaffRoster.updateOne({ _id: result.assigned_worker_id }, { current_task_id: doc.request_id, task_status: 'assigned' });
    await notifyUsers({
      assignedNames: [result.assigned_worker_name],
      departments: [department],
      roles: ['SUPERVISOR'],
      type: 'TASK_ASSIGNED',
      priority: ['CRITICAL', 'HIGH', 'P0', 'P1'].includes(String(doc.priority)) ? 'HIGH' : 'MEDIUM',
      title: `New ${department} task — Room ${doc.room_number}`,
      message: `${doc.request_text?.slice(0, 140)} (Request ${doc.request_id}, priority ${doc.priority}). Open My Tasks to accept.`,
      sourceType: 'GuestRequest',
      sourceId: doc.request_id,
    });
    return result.assigned_worker_name;
  }
  doc.status = 'ESCALATED';
  doc.rejection_reason = result.rejection_reason ?? 'No eligible worker available';
  await notifyManagers({
    type: 'STAFFING_SHORTAGE',
    priority: 'HIGH',
    title: `Unassigned ${department} request — Room ${doc.room_number}`,
    message: `Request ${doc.request_id} ("${doc.request_text?.slice(0, 120)}") could not be auto-assigned: ${doc.rejection_reason}. Please assign manually.`,
    sourceType: 'GuestRequest',
    sourceId: doc.request_id,
    departments: [department],
  });
  return null;
}

export const approveGuestRequest = async (req: Request, res: Response) => {
  try {
    const doc = await findGuestRequest(String(req.params.id));
    if (!doc) return res.status(404).json({ success: false, message: 'Guest request not found' });
    if (!DECIDABLE_STATUSES.includes(doc.status)) {
      return res.status(409).json({ success: false, message: `Request is already ${doc.status}; it can no longer be approved` });
    }
    const prevStatus = doc.status;
    const note = String(req.body?.note ?? '').slice(0, 500);

    doc.manager_decision = { decision: 'APPROVE', by: req.user?.name ?? 'Manager', at: new Date(), reason: note || undefined };
    if (note) doc.resolution_notes = note;

    const assigned = doc.assigned_staff ? doc.assigned_staff : await assignWorker(doc, doc.department, doc.equipment_needed ?? []);
    if (doc.assigned_staff) doc.status = 'ASSIGNED';
    await doc.save();

    await AuditLog.create({
      action_id: doc.request_id,
      user_name: req.user?.name ?? 'Manager',
      user_role: req.user?.role,
      action_type: 'GUEST_REQUEST_APPROVED',
      entity_type: 'GuestRequest',
      entity_id: doc._id.toString(),
      original_state: { status: prevStatus },
      new_state: { status: doc.status, assigned_staff: doc.assigned_staff },
      decision: 'APPROVE',
      reason: note || undefined,
    });

    await notifyGuestRoom(doc.room_number, {
      title: 'Your request was approved',
      message: assigned
        ? `Good news — ${assigned} from ${doc.department} has been assigned to "${doc.request_text?.slice(0, 100)}".`
        : `Your request was approved and is queued for assignment.`,
      sourceId: doc.request_id,
    });

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error('approveGuestRequest error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const declineGuestRequest = async (req: Request, res: Response) => {
  try {
    const reason = String(req.body?.reason ?? '').trim();
    if (!reason) return res.status(422).json({ success: false, message: 'A decline reason is required' });

    const doc = await findGuestRequest(String(req.params.id));
    if (!doc) return res.status(404).json({ success: false, message: 'Guest request not found' });
    if (['COMPLETED', 'VERIFIED', 'DECLINED'].includes(doc.status)) {
      return res.status(409).json({ success: false, message: `Request is already ${doc.status}` });
    }
    const prevStatus = doc.status;

    doc.status = 'DECLINED';
    doc.manager_decision = { decision: 'DECLINE', by: req.user?.name ?? 'Manager', at: new Date(), reason };
    doc.rejection_reason = reason;
    await doc.save();

    await AuditLog.create({
      action_id: doc.request_id,
      user_name: req.user?.name ?? 'Manager',
      user_role: req.user?.role,
      action_type: 'GUEST_REQUEST_DECLINED',
      entity_type: 'GuestRequest',
      entity_id: doc._id.toString(),
      original_state: { status: prevStatus },
      new_state: { status: 'DECLINED' },
      decision: 'DECLINE',
      reason,
    });

    await notifyGuestRoom(doc.room_number, {
      title: 'Update on your request',
      message: `Your request "${doc.request_text?.slice(0, 100)}" was declined by the duty manager. Reason: ${reason}`,
      sourceId: doc.request_id,
      type: 'GUEST_REQUEST_DECLINED',
      priority: 'HIGH',
    });

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error('declineGuestRequest error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const modifyGuestRequest = async (req: Request, res: Response) => {
  try {
    const { priority, department, instructions, assigned_staff } = req.body ?? {};
    if (!priority && !department && !instructions && !assigned_staff) {
      return res.status(422).json({ success: false, message: 'Provide at least one modification (priority, department, instructions, assigned_staff)' });
    }
    const reason = String(req.body?.reason ?? '').trim();

    const doc = await findGuestRequest(String(req.params.id));
    if (!doc) return res.status(404).json({ success: false, message: 'Guest request not found' });
    if (['COMPLETED', 'VERIFIED', 'DECLINED'].includes(doc.status)) {
      return res.status(409).json({ success: false, message: `Request is already ${doc.status}` });
    }
    const prevState = { status: doc.status, priority: doc.priority, department: doc.department, assigned_staff: doc.assigned_staff };

    // Preserve the guest's original words before the first modification.
    if (!doc.original_request_text) doc.original_request_text = doc.request_text;

    if (priority) {
      const allowed = ['P0', 'P1', 'P2', 'P3', 'P4', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (!allowed.includes(String(priority))) return res.status(422).json({ success: false, message: 'Invalid priority' });
      doc.priority = priority;
    }
    if (department) {
      // If the department changes, re-classify reassignment target but keep the guest text.
      doc.department = String(department);
      doc.assigned_staff = undefined;
    }
    if (instructions) doc.resolution_notes = String(instructions).slice(0, 500);

    doc.manager_decision = { decision: 'MODIFY', by: req.user?.name ?? 'Manager', at: new Date(), reason: reason || undefined };

    let assigned: string | null = null;
    if (assigned_staff && assigned_staff !== 'auto') {
      const staffDoc = await StaffRoster.findOne({ name: String(assigned_staff) });
      if (!staffDoc) return res.status(422).json({ success: false, message: 'Requested staff member not found' });
      doc.assigned_staff = staffDoc.name;
      doc.status = 'ASSIGNED';
      await StaffRoster.updateOne({ _id: staffDoc._id }, { current_task_id: doc.request_id, task_status: 'assigned' });
      assigned = staffDoc.name;
      await notifyUsers({
        assignedNames: [staffDoc.name],
        type: 'TASK_ASSIGNED',
        priority: ['CRITICAL', 'HIGH', 'P0', 'P1'].includes(String(doc.priority)) ? 'HIGH' : 'MEDIUM',
        title: `Task assigned by manager — Room ${doc.room_number}`,
        message: `${doc.request_text?.slice(0, 120)}${doc.resolution_notes ? ` — Manager note: ${doc.resolution_notes}` : ''}`,
        sourceType: 'GuestRequest',
        sourceId: doc.request_id,
      });
    } else {
      assigned = await assignWorker(doc, doc.department, doc.equipment_needed ?? []);
    }
    await doc.save();

    await AuditLog.create({
      action_id: doc.request_id,
      user_name: req.user?.name ?? 'Manager',
      user_role: req.user?.role,
      action_type: 'GUEST_REQUEST_MODIFIED',
      entity_type: 'GuestRequest',
      entity_id: doc._id.toString(),
      original_state: prevState,
      new_state: { status: doc.status, priority: doc.priority, department: doc.department, assigned_staff: doc.assigned_staff, instructions },
      decision: 'MODIFY',
      reason: reason || undefined,
    });

    await notifyGuestRoom(doc.room_number, {
      title: 'Your request was updated',
      message: `The duty manager updated your request${assigned ? ` and assigned ${assigned}` : ''}.${instructions ? ` Note: ${String(instructions).slice(0, 120)}` : ''}`,
      sourceId: doc.request_id,
    });

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error('modifyGuestRequest error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
};

// ============================================================
// MANAGER FEEDBACK (Phase 10) — feedback linked to room / request / task / staff
// ============================================================
export const getManagerFeedback = async (_req: Request, res: Response) => {
  try {
    const feedback = await GuestRequest.find({ guest_rating: { $exists: true, $ne: null } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .select('request_id guest_name room_number request_text intent priority department assigned_staff status completed_at guest_rating guest_feedback updatedAt');
    const avg = feedback.length > 0
      ? Math.round((feedback.reduce((s, f) => s + (f.guest_rating ?? 0), 0) / feedback.length) * 10) / 10
      : null;
    res.json({ success: true, data: { feedback, average_rating: avg, total: feedback.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

// ============================================================
// STAFF ON-SITE OBSERVATIONS (Phase 9)
// ============================================================
export const addTaskObservation = async (req: Request, res: Response) => {
  try {
    const note = String(req.body?.note ?? '').trim();
    if (note.length < 3 || note.length > 1000) {
      return res.status(422).json({ success: false, message: 'Observation note must be 3–1000 characters' });
    }
    const id = String(req.params.id);

    // Link the observation to the task it was made during (when resolvable).
    let task: any = await GuestRequest.findOne({ request_id: id });
    let taskType: 'GuestRequest' | 'OperationalTicket' | 'NONE' = task ? 'GuestRequest' : 'NONE';
    if (!task) {
      task = await OperationalTicket.findOne({ ticket_id: id });
      if (task) taskType = 'OperationalTicket';
    }
    // Free-form observation: still allowed without a task id, but needs a room.
    const roomNumber = req.body?.room_number ?? task?.room_number;
    if (!task && !roomNumber) {
      return res.status(422).json({ success: false, message: 'A task id or room number is required for an observation' });
    }

    // Workers may only log observations for tasks assigned to them or sitting in
    // their own department queue (server-enforced; managers/supervisors exempt).
    const role = String(req.user?.role);
    const staffName = req.user?.name ?? 'Staff';
    if ((role === 'WORKER' || role === 'STAFF') && task) {
      const assigned = task.assigned_staff || task.assigned_to;
      let ownName = staffName;
      let ownDept = req.user?.department?.toLowerCase();
      if (req.user?.staffId) {
        try {
          const linked = await StaffRoster.findById(req.user.staffId).select('name department');
          if (linked?.name) ownName = linked.name;
          if (linked?.department) ownDept = linked.department;
        } catch { /* ignore */ }
      }
      const sameDepartment = ownDept && task.department && ownDept === String(task.department).toLowerCase();
      if (assigned && assigned !== ownName && assigned !== staffName && !sameDepartment) {
        return res.status(403).json({ success: false, message: 'You may only log observations for tasks assigned to you or your department' });
      }
    }

    // Classify the observation with the same on-board NLP used for guest requests.
    const nlp = classifyGuestRequest(note);
    const actionable = !['OTHER', 'INFORMATION', 'COMPLAINT'].includes(nlp.intent) || nlp.is_emergency;

    const observation = await Observation.create({
      task_type: taskType,
      task_id: id !== 'none' ? id : undefined,
      task_title: task ? (task.request_text || task.title) : undefined,
      staff_name: staffName,
      room_number: roomNumber,
      department: actionable ? nlp.department : undefined,
      intent: nlp.intent,
      priority: nlp.is_emergency ? 'CRITICAL' : nlp.priority,
      note,
      status: actionable ? 'ROUTED' : 'NEW',
    });

    // Actionable observations spawn a routed operational ticket for the right department.
    let routedTicket = null;
    if (actionable) {
      routedTicket = await OperationalTicket.create({
        title: `On-site observation (Room ${roomNumber ?? 'n/a'}): ${nlp.intent}`,
        department: nlp.department,
        priority: nlp.is_emergency ? 'Critical' : (['HIGH', 'CRITICAL', 'P0', 'P1'].includes(String(nlp.priority)) ? 'High' : 'Medium'),
        source: 'staff_observation',
        room_number: roomNumber,
        evidence_terms: [note.slice(0, 200)],
        is_systemic: false,
      });
      observation.routed_ticket_id = routedTicket.ticket_id;
      await observation.save();

      await notifyDepartment(nlp.department, {
        type: 'STAFF_OBSERVATION_TICKET',
        priority: nlp.is_emergency ? 'CRITICAL' : 'HIGH',
        title: `New ${nlp.department} ticket from on-site observation`,
        message: `${staffName} reported during ${id}: "${note.slice(0, 140)}" (Room ${roomNumber ?? 'n/a'}). Ticket ${routedTicket.ticket_id}.`,
        sourceType: 'OperationalTicket',
        sourceId: routedTicket.ticket_id,
      });
    }

    await notifyManagers({
      type: 'STAFF_OBSERVATION',
      priority: nlp.is_emergency ? 'CRITICAL' : 'MEDIUM',
      title: `Observation from ${staffName} — Room ${roomNumber ?? 'n/a'}`,
      message: `"${note.slice(0, 160)}"${routedTicket ? ` → routed to ${nlp.department} (${routedTicket.ticket_id})` : ''}`,
      sourceType: 'Observation',
      sourceId: observation.observation_id,
      metadata: { intent: nlp.intent, task: id, room: roomNumber },
    });

    await AuditLog.create({
      user_name: staffName,
      user_role: req.user?.role,
      action_type: 'STAFF_OBSERVATION_LOGGED',
      entity_type: 'Observation',
      entity_id: observation.observation_id,
      new_state: { task: id, room: roomNumber, intent: nlp.intent, routed_ticket_id: observation.routed_ticket_id },
      reason: note.slice(0, 200),
    });

    res.status(201).json({ success: true, data: { observation, routed_ticket: routedTicket } });
  } catch (error) {
    console.error('addTaskObservation error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const getObservations = async (_req: Request, res: Response) => {
  try {
    const observations = await Observation.find({}).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: observations });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};
