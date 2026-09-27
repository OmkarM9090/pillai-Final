import { processGuestRequest } from './orchestrator';
import { classifyGuestRequest } from './nlpEngine';
import { GuestConversation } from '../../models/GuestConversation';

// On-board resort knowledge base for informational questions (Phase 12/32 —
// works fully offline; no LLM or internet needed for the demo-critical path).
const RESORT_INFO: Array<[RegExp, string]> = [
  [/breakfast|lunch|dinner|buffet|restaurant|menu/, 'Our main restaurant serves breakfast 6:30–10:30 AM, lunch 12:00–3:00 PM and dinner 7:00–10:30 PM. In-room dining is available 24×7 — just ask me to order.'],
  [/pool|swim/, 'The pool deck is open 7:00 AM–9:00 PM with a lifeguard on duty until 7:00 PM. Towels are provided at the pool kiosk.'],
  [/spa|massage|sauna/, 'The spa is open 9:00 AM–8:00 PM. I can reserve a slot for you right now if you tell me your preferred time.'],
  [/gym|fitness/, 'The fitness centre is open 24×7 with your room key card.'],
  [/checkout|check-out|check out|late checkout/, 'Standard checkout is 11:00 AM. Late checkout is subject to availability and duty-manager approval — I can submit it as a request if you like.'],
  [/checkin|check-in|check in/, 'Check-in starts at 2:00 PM. Early check-in depends on room readiness.'],
  [/wifi|wi-fi|internet|password/, 'Connect to the "ResortGuest" network — your room number plus booking reference is the passphrase.'],
  [/parking|car/, 'Complimentary valet parking is available at the main entrance 24×7.'],
  [/beach|sea|ocean/, 'Beach access is via the east gate, open sunrise to 8:00 PM. Beach towels are at the kiosk.'],
  [/shuttle|airport|taxi|transfer/, 'The airport shuttle runs every hour from the lobby. The concierge desk can also book a private transfer.'],
  [/weather|rain/, 'For today\'s conditions please check the forecast board in the lobby — our team also posts weather advisories at the pool and beach.'],
  [/activity|activities|kids|tour/, 'Today\'s activities board is in the lobby: aqua aerobics 8 AM, kids\' club 9 AM–5 PM, sunset cruise 5:30 PM (bookable at the desk).'],
  [/emergency|doctor|hospital/, 'For any emergency, please also press the room phone emergency button. Our security and first-aid team responds immediately.'],
];

function answerInformational(message: string): string {
  const t = message.toLowerCase();
  for (const [pattern, answer] of RESORT_INFO) {
    if (pattern.test(t)) return answer;
  }
  return 'Happy to help! You can ask me about dining hours, the pool, spa, gym, beach, Wi-Fi, parking, shuttles or activities — or just tell me what you need for your room and I will dispatch the right team.';
}

export async function processConciergeMessage(guestId: string, roomNumber: string, message: string) {
  // 0. Informational question? Answer directly — do NOT open an operational task.
  const nlp = classifyGuestRequest(message);
  if (nlp.intent === 'INFORMATION') {
    const guestResponse = answerInformational(message);
    const conv = new GuestConversation({
      guest_id: guestId,
      room_number: roomNumber,
      message,
      response: guestResponse,
      intent: 'INFORMATION',
      category: 'FRONT_DESK',
      priority: 'P4',
      autonomy_level: 'AUTO',
      status: 'ANSWERED',
      estimated_minutes: 0,
    });
    await conv.save();
    return {
      success: true,
      conversationId: conv._id,
      guestMessage: message,
      intent: 'INFORMATION',
      category: 'FRONT_DESK',
      priority: 'P4',
      autonomyLevel: 'AUTO',
      action: 'ANSWERED',
      assignedStaff: null,
      estimatedMinutes: 0,
      guestResponse,
      requestId: null,
    };
  }

  // 1. Send the message through the existing orchestration and NLP pipeline
  const guestReq = await processGuestRequest(guestId, roomNumber, message, guestId);

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
