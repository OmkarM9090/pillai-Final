import { Room } from '../../models/Room';
import { dateGte } from '../../utils/dbCompat';
import { StaffRoster } from '../../models/StaffRoster';
import { GuestRequest } from '../../models/GuestRequest';
import { OperationalTicket } from '../../models/OperationalTicket';
import { PantryInventory } from '../../models/PantryInventory';
import { MaintenanceAsset } from '../../models/MaintenanceAsset';
import { ActionCard } from '../../models/ActionCard';
import { WorldSignal } from '../../models/WorldSignal';
import { Booking } from '../../models/Booking';

export async function getCommandCenterState() {
  // 1. Resort Health & Occupancy
  const totalRooms = await Room.countDocuments();
  const occupiedRooms = await Room.countDocuments({ status: 'occupied' });
  const availableRooms = await Room.countDocuments({ status: 'available' });
  const cleaningRooms = await Room.countDocuments({ status: 'cleaning' });
  const maintenanceRooms = await Room.countDocuments({ status: 'maintenance' });
  
  const occupancy_pct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  
  // Quick hack for check-ins/check-outs today (mocking with bookings since we don't have exact time filters handy)
  const todaysCheckins = await Booking.countDocuments({ status: 'confirmed' });
  const todaysCheckouts = Math.floor(occupiedRooms * 0.2); // Rough estimate for now

  // 2. Staff Capacity View & Operational Pressure
  const allStaff = await StaffRoster.find();
  
  const departments = ['housekeeping', 'maintenance', 'fnb', 'front_desk', 'security'];
  const departmentPressure: Record<string, any> = {};
  
  let totalAvailableStaff = 0;
  let totalBusyStaff = 0;
  
  for (const dept of departments) {
    const deptStaff = allStaff.filter(s => s.department === dept);
    const available = deptStaff.filter(s => s.is_available && s.task_status === 'idle').length;
    const busy = deptStaff.filter(s => s.task_status !== 'idle').length;
    const unavailable = deptStaff.length - available - busy;
    
    totalAvailableStaff += available;
    totalBusyStaff += busy;

    const activeDeptTasks = await GuestRequest.countDocuments({ department: dept, status: { $in: ['CREATED', 'ROUTED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } });
    const activeDeptTickets = await OperationalTicket.countDocuments({ department: dept, status: { $ne: 'completed' } });
    
    const totalLoad = activeDeptTasks + activeDeptTickets;
    
    let pressureState = 'LOW';
    let utilization = 0;
    
    if (deptStaff.length > 0) {
      utilization = Math.round((busy / deptStaff.length) * 100);
      if (utilization > 90 || totalLoad > deptStaff.length * 2) pressureState = 'CRITICAL';
      else if (utilization > 75 || totalLoad > deptStaff.length) pressureState = 'HIGH';
      else if (utilization > 50) pressureState = 'MEDIUM';
    } else if (totalLoad > 0) {
      pressureState = 'CRITICAL';
      utilization = 100;
    }

    departmentPressure[dept] = {
      totalStaff: deptStaff.length,
      available,
      busy,
      unavailable,
      activeTasks: totalLoad,
      utilization,
      pressureState
    };
  }

  // 3. Manager Alert Center (Action Cards & Critical Escapes)
  // We only pull ActionCards that require manager approval or are CRITICAL
  const alerts = await ActionCard.find({ 
    $or: [
      { autonomy_level: 'MANAGER' }, 
      { autonomy_level: 'CRITICAL' },
      { approval_required: true }
    ],
    status: { $ne: 'completed' } // assuming there's a status field, if not, we just fetch top 10
  }).sort({ createdAt: -1 }).limit(10);

  // 4. Resource Bottlenecks
  const bottlenecks = [];
  if (departmentPressure.housekeeping.pressureState === 'CRITICAL') bottlenecks.push('Housekeeping Capacity');
  if (departmentPressure.maintenance.pressureState === 'CRITICAL') bottlenecks.push('Maintenance Technicians');
  if (cleaningRooms > 10 && departmentPressure.housekeeping.available === 0) bottlenecks.push('Room Turnover');

  // 5. Inventory Risk
  const criticalInventory = await PantryInventory.find({ $expr: { $lte: ['$current_stock_kg', '$safety_threshold_kg'] } });
  
  // 6. Maintenance Health
  const criticalAssets = await MaintenanceAsset.find({ condition_score: { $lt: 40 } });

  // 7. Guest Experience Health
  const activeGuestRequests = await GuestRequest.countDocuments({ status: { $in: ['CREATED', 'ROUTED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } });
  const recentPoorReviews = await GuestRequest.countDocuments({ guest_rating: { $lte: 2 } });
  const guestExperienceRisk = recentPoorReviews > 3 ? 'HIGH' : (recentPoorReviews > 1 ? 'MEDIUM' : 'LOW');

  // 8. Revenue Risk
  let revenueRisk = 'LOW';
  if (occupancy_pct > 95 && departmentPressure.housekeeping.pressureState === 'CRITICAL') revenueRisk = 'HIGH';
  if (criticalAssets.length > 2) revenueRisk = 'MEDIUM';

  // 9. World Signals
  const activeSignals = await WorldSignal.find({ is_active: true });

  // Overall Resilience Score Calculation
  const resilienceScore = Math.max(0, 100 
    - (criticalAssets.length * 5) 
    - (criticalInventory.length * 3) 
    - (recentPoorReviews * 5)
    - (Object.values(departmentPressure).filter(d => d.pressureState === 'CRITICAL').length * 10)
  );

  const pendingApprovals = await ActionCard.countDocuments({ status: 'pending', $or: [{ autonomy_level: 'MANAGER' }, { approval_required: true }] });
  const inProgress = await GuestRequest.countDocuments({ status: 'IN_PROGRESS' }) + await OperationalTicket.countDocuments({ status: 'IN_PROGRESS' });
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const completedTodayTasks = await GuestRequest.collection.countDocuments({ status: { $in: ['COMPLETED', 'VERIFIED', 'feedback_received'] }, ...dateGte('completed_at', startOfDay) } as any);
  const completedTodayTickets = await OperationalTicket.collection.countDocuments({ status: 'completed', ...dateGte('updatedAt', startOfDay) } as any);
  const completedToday = completedTodayTasks + completedTodayTickets;

  // Rough estimation of avg resolution time for today
  const completedRequests: any[] = await GuestRequest.collection.find({ status: { $in: ['COMPLETED', 'VERIFIED', 'feedback_received'] }, ...dateGte('completed_at', startOfDay) } as any).toArray();
  let avgResolutionTime = 24; // fallback default 24 min
  if (completedRequests.length > 0) {
    let totalMins = 0;
    completedRequests.forEach(req => {
      const created = new Date(req.created_at).getTime();
      const completed = req.completed_at ? new Date(req.completed_at).getTime() : Date.now();
      totalMins += (completed - created) / (1000 * 60);
    });
    avgResolutionTime = Math.round(totalMins / completedRequests.length);
  }

  // Autonomy Distribution
  const totalRequests = await GuestRequest.countDocuments();
  const l1Count = await GuestRequest.countDocuments({ autonomy_level: 'AUTO' });
  const l2Count = await GuestRequest.countDocuments({ autonomy_level: 'SUPERVISOR' });
  const l3Count = await GuestRequest.countDocuments({ autonomy_level: 'MANAGER' });
  const l4Count = await GuestRequest.countDocuments({ autonomy_level: 'CRITICAL' });

  const autonomyDistribution = {
    L1: totalRequests > 0 ? Math.round((l1Count / totalRequests) * 100) : 0,
    L2: totalRequests > 0 ? Math.round((l2Count / totalRequests) * 100) : 0,
    L3: totalRequests > 0 ? Math.round((l3Count / totalRequests) * 100) : 0,
    L4: totalRequests > 0 ? Math.round((l4Count / totalRequests) * 100) : 0
  };

  // Staff Workload
  const staffWorkload = await Promise.all(allStaff.map(async (staff) => {
    const tasks = await GuestRequest.find({ assigned_staff: staff.name, status: { $in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } });
    const tickets = await OperationalTicket.find({ assigned_to: staff.name, status: { $in: ['todo', 'in_progress'] } });
    const taskCount = tasks.length + tickets.length;
    
    let currentTaskStr = 'None';
    if (tasks.length > 0) currentTaskStr = tasks[0].room_number ? `Room ${tasks[0].room_number}` : tasks[0].request_text;
    else if (tickets.length > 0) currentTaskStr = tickets[0].title;

    let status = staff.task_status.toUpperCase();
    if (taskCount > 3) status = 'OVERLOADED';

    return {
      id: staff._id,
      name: staff.name,
      department: staff.department,
      currentTask: currentTaskStr,
      taskCount,
      status,
      fatigue: staff.fatigue_score || 0,
      eta: Math.max(0, taskCount * 15) // mock ETA calculation
    };
  }));

  // Potential Clusters (Systemic Issues)
  const recentRequests: any[] = await GuestRequest.collection.find({ status: { $ne: 'COMPLETED' }, ...dateGte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000)) } as any).toArray();
  const groups: Record<string, any[]> = {};
  for (const req of recentRequests) {
    if (!req.intent) continue;
    const key = `${req.intent}_${req.department}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(req);
  }
  
  const potentialClusters = [];
  for (const key of Object.keys(groups)) {
    if (groups[key].length >= 3) { // 3 or more is a cluster
      const items = groups[key];
      potentialClusters.push({
        intent: items[0].intent,
        department: items[0].department,
        count: items.length,
        rooms: items.map(i => i.room_number).filter(Boolean),
        timeWindow: 'Last 4 hours'
      });
    }
  }

  return {
    health: {
      occupancy: occupancy_pct,
      availableRooms,
      occupiedRooms,
      cleaningRooms,
      maintenanceRooms,
      todaysCheckins,
      todaysCheckouts,
      totalStaff: allStaff.length,
      availableStaff: totalAvailableStaff,
      busyStaff: totalBusyStaff,
      activeGuestRequests,
      pendingApprovals,
      inProgress,
      completedToday,
      averageWaitTime: avgResolutionTime,
      criticalIncidents: alerts.filter(a => a.autonomy_level === 'CRITICAL').length,
      resilienceScore: Math.round(resilienceScore)
    },
    pressure: departmentPressure,
    alerts,
    bottlenecks,
    inventoryRisk: criticalInventory,
    maintenanceHealth: {
      criticalAssets: criticalAssets.length,
      assets: criticalAssets
    },
    guestExperience: {
      activeRequests: activeGuestRequests,
      recentPoorReviews,
      riskLevel: guestExperienceRisk
    },
    revenueRisk,
    worldSignals: activeSignals,
    autonomyDistribution,
    staffWorkload,
    potentialClusters
  };
}
