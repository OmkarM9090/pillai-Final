import { processGuestRequest } from './orchestrator';
import { GuestConversation } from '../../models/GuestConversation';

export async function processConciergeMessage(guestId: string, roomNumber: string, message: string) {
  // 1. Send the message through the existing orchestration and NLP pipeline
  const guestReq = await processGuestRequest(guestId, roomNumber, message);

  // 2. Determine an estimated time of arrival based on autonomy and department
  let estimatedMinutes = 15;
  if (guestReq.intent === 'TOWEL' || guestReq.intent === 'WATER' || guestReq.intent === 'CLEANING') {
    estimatedMinutes = 10;
  } else if (guestReq.department === 'maintenance') {
    estimatedMinutes = 25;
  }
  
  if (guestReq.priority === 'HIGH' || guestReq.priority === 'CRITICAL') {
    estimatedMinutes = Math.floor(estimatedMinutes / 2); // Priority discount
  }

  // 3. Generate Natural Language Guest Response
  let guestResponse = '';
  const assignedStr = guestReq.assigned_staff ? ` ${guestReq.assigned_staff} from our team has been assigned.` : '';
  const etaStr = `Expected arrival: approximately ${estimatedMinutes} minutes.`;

  if (guestReq.is_emergency) {
    guestResponse = `I'm very sorry about this. I've marked this as a CRITICAL emergency incident and notified security and management. Please remain safe. We will assist you immediately.`;
  } else if (guestReq.autonomy_level === 'AUTO') {
    guestResponse = `Absolutely! I've processed your request for Room ${roomNumber}.${assignedStr} ${etaStr}`;
  } else if (guestReq.autonomy_level === 'SUPERVISOR') {
    guestResponse = `I have received your request. Because it requires specialized attention, I have routed it directly to the ${guestReq.department} supervisor for immediate assignment. We will update you shortly.`;
  } else {
    guestResponse = `I've recorded your request and escalated it to our management team for review. They will get back to you as soon as possible.`;
  }

  // Save Conversation
  const conv = new GuestConversation({
    guest_id: guestId,
    room_number: roomNumber,
    message: message,
    response: guestResponse,
    intent: guestReq.intent,
    category: guestReq.department.toUpperCase(),
    priority: guestReq.priority,
    autonomy_level: guestReq.autonomy_level,
    request_id: guestReq.request_id,
    status: guestReq.status,
    estimated_minutes: estimatedMinutes
  });
  await conv.save();

  return {
    success: true,
    conversationId: conv._id,
    guestMessage: message,
    intent: guestReq.intent,
    category: guestReq.department.toUpperCase(),
    priority: guestReq.priority,
    autonomyLevel: guestReq.autonomy_level,
    action: guestReq.status === 'ASSIGNED' ? 'AUTO_DISPATCH' : 'ESCALATED',
    assignedStaff: guestReq.assigned_staff ? {
        id: guestReq.assigned_staff,
        name: guestReq.assigned_staff,
        department: guestReq.department
    } : null,
    estimatedMinutes,
    guestResponse,
    requestId: guestReq.request_id,
    dbRecord: guestReq
  };
}
