export interface ClassificationResult {
  intent: 'TOWEL' | 'PILLOW' | 'CLEANING' | 'MAINTENANCE' | 'AC' | 'PLUMBING' | 'ROOM_SERVICE' | 'OTHER';
  autonomy_level: 'AUTO' | 'SUPERVISOR' | 'MANAGER' | 'CRITICAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  department: 'housekeeping' | 'maintenance' | 'fnb' | 'front_desk';
  reason: string;
}

export function classifyRequest(requestText: string, roomNumber?: string): ClassificationResult {
  const text = requestText.toLowerCase();
  
  let intent: ClassificationResult['intent'] = 'OTHER';
  
  if (text.includes('towel') || text.includes('bath')) intent = 'TOWEL';
  else if (text.includes('pillow') || text.includes('cushion')) intent = 'PILLOW';
  else if (text.includes('clean') || text.includes('dirty') || text.includes('mess') || text.includes('housekeeping') || text.includes('maid')) intent = 'CLEANING';
  else if (text.includes('broken') || text.includes('fix') || text.includes('repair') || text.includes('not working')) intent = 'MAINTENANCE';
  else if (text.includes('ac') || text.includes('air conditioning') || text.includes('cold') || text.includes('hot') || text.includes('temperature') || text.includes('rattling')) intent = 'AC';
  else if (text.includes('leak') || text.includes('water') || text.includes('toilet') || text.includes('shower') || text.includes('drain')) intent = 'PLUMBING';
  else if (text.includes('food') || text.includes('drink') || text.includes('menu') || text.includes('order') || text.includes('breakfast') || text.includes('dinner') || text.includes('room service')) intent = 'ROOM_SERVICE';

  let department: ClassificationResult['department'] = 'front_desk';
  if (['TOWEL', 'PILLOW', 'CLEANING'].includes(intent)) department = 'housekeeping';
  else if (['MAINTENANCE', 'AC', 'PLUMBING'].includes(intent)) department = 'maintenance';
  else if (intent === 'ROOM_SERVICE') department = 'fnb';

  let autonomy_level: ClassificationResult['autonomy_level'] = 'AUTO';
  let priority: ClassificationResult['priority'] = 'LOW';
  let reason = 'Standard guest request mapped to auto-dispatch';

  // AUTO (Level 1)
  if (['TOWEL', 'PILLOW', 'ROOM_SERVICE', 'CLEANING'].includes(intent)) {
    autonomy_level = 'AUTO';
    priority = 'LOW';
    reason = 'Routine request suitable for immediate auto-dispatch';
  }
  // SUPERVISOR (Level 2)
  else if (['MAINTENANCE', 'PLUMBING'].includes(intent)) {
    autonomy_level = 'SUPERVISOR';
    priority = 'MEDIUM';
    reason = 'Maintenance issue requiring supervisor triage';
  }
  // CRITICAL (Level 4)
  else if (text.includes('fire') || text.includes('flood') || text.includes('hazard') || text.includes('smoke')) {
    autonomy_level = 'CRITICAL';
    priority = 'CRITICAL';
    reason = 'Emergency keywords detected requiring immediate critical response';
  }
  // AC specifically
  else if (intent === 'AC') {
    if (text.includes('failure') || text.includes('smoke')) {
      autonomy_level = 'CRITICAL';
      priority = 'CRITICAL';
      reason = 'Major HVAC failure reported';
    } else {
      autonomy_level = 'SUPERVISOR';
      priority = 'MEDIUM';
      reason = 'HVAC complaint requiring triage';
    }
  }
  else {
    autonomy_level = 'MANAGER';
    priority = 'HIGH';
    reason = 'Unclassified or complex request requiring manager review';
  }

  return { intent, autonomy_level, priority, department, reason };
}
