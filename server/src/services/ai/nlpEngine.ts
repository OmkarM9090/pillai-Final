export interface NLPResult {
  intent: string;
  department: string;
  autonomy_level: string;
  priority: string;
  priority_reason: string;
  sla_target_response_mins: number;
  sla_target_resolution_mins: number;
  equipment_needed: string[];
  is_emergency: boolean;
}

export function classifyGuestRequest(text: string): NLPResult {
  const t = text.toLowerCase();
  
  const result: NLPResult = {
    intent: 'OTHER',
    department: 'front_desk',
    autonomy_level: 'MANAGER',
    priority: 'P3',
    priority_reason: 'Standard unclassified request',
    sla_target_response_mins: 15,
    sla_target_resolution_mins: 60,
    equipment_needed: [],
    is_emergency: false
  };

  // 0. INFORMATIONAL QUESTIONS (Phase 12) — pure service questions must NOT
  //    create operational tasks. A question only counts as informational when it
  //    carries no action/emergency signal ("my AC is not working" stays a task).
  const questionish = /\?\s*$/.test(text.trim()) || /^(what|when|where|how|is |are |do |does |can you tell|could you tell|tell me)/i.test(text.trim());
  const actionish = /(need|bring|send|more|another|extra|fix|repair|broken|not working|doesn't work|leak|noise|noisy|dirty|clean my|change my|upgrade|move me|too hot|too cold|fire|smoke|doctor|hurt|emergency|complain|unhappy)/i.test(t);
  if (questionish && !actionish) {
    result.intent = 'INFORMATION';
    result.department = 'front_desk';
    result.autonomy_level = 'AUTO';
    result.priority = 'P4';
    result.priority_reason = 'Informational question — answer directly, no dispatch';
    result.sla_target_response_mins = 1;
    result.sla_target_resolution_mins = 1;
    return result;
  }

  // 0.5 EMERGENCIES FIRST — safety keywords must win over everything else
  //     (e.g. "smoke in the bathroom" must never classify as TOWEL via 'bath').
  if (t.includes('doctor') || t.includes('hurt') || t.includes('pain') || t.includes('medical') || t.includes('bleed') || t.includes('heart') || t.includes('unconscious') || t.includes('drown') || t.includes('not breathing') || t.includes('ambulance')) {
    result.intent = 'MEDICAL';
    result.department = 'security';
    result.is_emergency = true;
    result.autonomy_level = 'CRITICAL';
    result.priority = 'P0';
    result.priority_reason = 'Possible medical emergency detected.';
    result.sla_target_response_mins = 2;
    result.sla_target_resolution_mins = 15;
    return result;
  }
  if (t.includes('fire') || t.includes('smoke') || t.includes('gas leak') || t.includes('explosion') || t.includes('flood') || t.includes('short circuit') || t.includes('spark')) {
    result.intent = 'SAFETY';
    result.department = 'security';
    result.is_emergency = true;
    result.autonomy_level = 'CRITICAL';
    result.priority = 'P0';
    result.priority_reason = 'Immediate threat to life or property detected.';
    result.sla_target_response_mins = 2;
    result.sla_target_resolution_mins = 15;
    return result;
  }

  // 1. INTENT & DEPARTMENT
  if (t.includes('towel') || t.includes('bath')) {
    result.intent = 'TOWEL';
    result.department = 'housekeeping';
    result.equipment_needed = ['Towel'];
  } else if (t.includes('pillow') || t.includes('cushion') || t.includes('blanket')) {
    result.intent = 'LINENS';
    result.department = 'housekeeping';
    result.equipment_needed = ['Linen'];
  } else if (t.includes('clean') || t.includes('dirty') || t.includes('mess') || t.includes('housekeeping')) {
    result.intent = 'CLEANING';
    result.department = 'housekeeping';
    result.equipment_needed = ['Cleaning Cart'];
  } else if (t.includes('shampoo') || t.includes('soap') || t.includes('toiletries')) {
    result.intent = 'TOILETRIES';
    result.department = 'housekeeping';
    result.equipment_needed = ['Toiletries'];
  } else if (t.includes('food') || t.includes('dinner') || t.includes('lunch') || t.includes('breakfast')) {
    result.intent = 'FOOD';
    result.department = 'fnb';
  } else if (t.includes('water') || t.includes('drink') || t.includes('coffee') || t.includes('tea')) {
    result.intent = 'BEVERAGE';
    result.department = 'fnb';
  } else if (t.includes('ac') || t.includes('air condition') || t.includes('hot') || t.includes('cold') || t.includes('hvac')) {
    result.intent = 'AC';
    result.department = 'maintenance';
    result.equipment_needed = ['HVAC Tools'];
  } else if (t.includes('leak') || t.includes('water') || t.includes('plumbing') || t.includes('toilet') || t.includes('sink') || t.includes('shower')) {
    result.intent = 'PLUMBING';
    result.department = 'maintenance';
    result.equipment_needed = ['Plumbing Kit'];
  } else if (t.includes('power') || t.includes('light') || t.includes('electricity') || t.includes('electrical')) {
    result.intent = 'ELECTRICAL';
    result.department = 'maintenance';
    result.equipment_needed = ['Multimeter'];
  } else if (t.includes('wifi') || t.includes('internet') || t.includes('connection')) {
    result.intent = 'WIFI';
    result.department = 'it';
  } else if (t.includes('move') || t.includes('change room') || t.includes('upgrade')) {
    result.intent = 'ROOM_CHANGE';
    result.department = 'front_desk';
  } else if (t.includes('doctor') || t.includes('hurt') || t.includes('pain') || t.includes('medical') || t.includes('bleed') || t.includes('heart')) {
    result.intent = 'MEDICAL';
    result.department = 'security'; // usually security handles first response
    result.is_emergency = true;
  } else if (t.includes('fire') || t.includes('smoke') || t.includes('gas') || t.includes('danger') || t.includes('safe')) {
    result.intent = 'SAFETY';
    result.department = 'security';
    result.is_emergency = true;
  } else if (t.includes('complain') || t.includes('unhappy') || t.includes('angry') || t.includes('terrible') || t.includes('awful')) {
    result.intent = 'COMPLAINT';
    result.department = 'front_desk';
  }

  // 2. AUTONOMY LEVEL & PRIORITY & SLA
  if (result.is_emergency) {
    result.autonomy_level = 'CRITICAL';
    result.priority = 'P0';
    result.priority_reason = 'Immediate threat to life or property detected.';
    result.sla_target_response_mins = 2;
    result.sla_target_resolution_mins = 15;
  } else if (['TOWEL', 'LINENS', 'TOILETRIES', 'CLEANING', 'FOOD', 'BEVERAGE'].includes(result.intent)) {
    result.autonomy_level = 'AUTO';
    result.priority = 'P3';
    result.priority_reason = 'Standard operational request.';
    result.sla_target_response_mins = 10;
    result.sla_target_resolution_mins = 30;
  } else if (['AC', 'PLUMBING', 'ELECTRICAL', 'WIFI'].includes(result.intent)) {
    // Basic maintenance goes to AUTO for dispatch, but if it mentions words like "flooding", "spark" it goes up
    if (t.includes('flood') || t.includes('spark') || t.includes('burst')) {
      result.autonomy_level = 'SUPERVISOR';
      result.priority = 'P1';
      result.priority_reason = 'Severe maintenance issue detected (e.g. flood/sparks).';
      result.sla_target_response_mins = 5;
      result.sla_target_resolution_mins = 45;
    } else {
      result.autonomy_level = 'AUTO';
      result.priority = 'P2';
      result.priority_reason = 'Standard maintenance issue.';
      result.sla_target_response_mins = 15;
      result.sla_target_resolution_mins = 60;
    }
  } else if (['ROOM_CHANGE', 'COMPLAINT'].includes(result.intent)) {
    result.autonomy_level = 'MANAGER';
    result.priority = 'P2';
    result.priority_reason = 'Requires managerial authority to resolve.';
    result.sla_target_response_mins = 15;
    result.sla_target_resolution_mins = 120;
  }

  return result;
}
