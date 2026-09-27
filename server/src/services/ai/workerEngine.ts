import { StaffRoster, IStaffRoster } from '../../models/StaffRoster';

export interface WorkerSelectionResult {
  assigned_worker_id: string | null;
  assigned_worker_name: string | null;
  fallback_used: boolean;
  rejection_reason?: string;
}

export async function selectBestWorker(department: string, required_skills: string[]): Promise<WorkerSelectionResult> {
  // 1. Primary Search: Same department, available, idle.
  // We rank them by lowest fatigue and lowest overtime.
  const primaryCandidates = await StaffRoster.find({
    department: department,
    is_available: true,
    task_status: 'idle'
  }).sort({ fatigue_score: 1, overtime_hours_this_week: 1 });

  if (primaryCandidates.length > 0) {
    return {
      assigned_worker_id: primaryCandidates[0]._id.toString(),
      assigned_worker_name: primaryCandidates[0].name,
      fallback_used: false
    };
  }

  // 2. Secondary Search (Fallback): Cross-trained employees from other departments who are idle
  const crossTrainedCandidates = await StaffRoster.find({
    cross_trained: department,
    is_available: true,
    task_status: 'idle'
  }).sort({ fatigue_score: 1 });

  if (crossTrainedCandidates.length > 0) {
    return {
      assigned_worker_id: crossTrainedCandidates[0]._id.toString(),
      assigned_worker_name: crossTrainedCandidates[0].name,
      fallback_used: true
    };
  }

  // 3. No worker available
  return {
    assigned_worker_id: null,
    assigned_worker_name: null,
    fallback_used: false,
    rejection_reason: 'No qualified worker currently available.'
  };
}
