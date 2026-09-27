import { Room } from '../../models/Room';
import { Booking } from '../../models/Booking';
import { StaffRoster } from '../../models/StaffRoster';
import { PantryInventory } from '../../models/PantryInventory';
import { MaintenanceAsset } from '../../models/MaintenanceAsset';
import { GuestRequest } from '../../models/GuestRequest';
import { OperationalTicket } from '../../models/OperationalTicket';

export interface DigitalTwinSnapshot {
  rooms: {
    total: number;
    occupied: number;
    available: number;
    cleaning: number;
    maintenance: number;
  };
  staff: {
    total: number;
    available: number;
    assigned: number;
    byDepartment: Record<string, { available: number; assigned: number; crossTrainedIn: number }>;
  };
  inventory: Array<{
    item_name: string;
    current_stock_kg: number;
    safety_threshold_kg: number;
    daily_consumption_rate_kg: number;
  }>;
  maintenance: {
    active_tickets: number;
    assets_at_risk: number;
  };
  guestRequests: {
    active: number;
  };
}

export async function getDigitalTwinSnapshot(): Promise<DigitalTwinSnapshot> {
  const [
    rooms,
    staff,
    inventory,
    tickets,
    requests,
    assets
  ] = await Promise.all([
    Room.find({}),
    StaffRoster.find({}),
    PantryInventory.find({}),
    OperationalTicket.countDocuments({ status: { $ne: 'completed' } }),
    GuestRequest.countDocuments({ status: { $ne: 'completed' } }),
    MaintenanceAsset.countDocuments({ failure_risk: { $in: ['high', 'critical'] } })
  ]);

  const staffByDept: Record<string, { available: number; assigned: number; crossTrainedIn: number }> = {};
  let staffAvailable = 0;
  let staffAssigned = 0;

  staff.forEach(s => {
    if (!staffByDept[s.department]) {
      staffByDept[s.department] = { available: 0, assigned: 0, crossTrainedIn: 0 };
    }
    
    if (s.is_available) {
      if (s.task_status === 'assigned' || s.task_status === 'in_progress') {
        staffByDept[s.department].assigned++;
        staffAssigned++;
      } else {
        staffByDept[s.department].available++;
        staffAvailable++;
      }
    }

    if (s.cross_trained && s.cross_trained.length > 0) {
      s.cross_trained.forEach(ct => {
        if (!staffByDept[ct]) {
          staffByDept[ct] = { available: 0, assigned: 0, crossTrainedIn: 0 };
        }
        if (s.is_available && (s.task_status === 'idle' || s.task_status === 'completed')) {
          staffByDept[ct].crossTrainedIn++;
        }
      });
    }
  });

  return {
    rooms: {
      total: rooms.length,
      occupied: rooms.filter(r => r.status === 'occupied').length,
      available: rooms.filter(r => r.status === 'available').length,
      cleaning: rooms.filter(r => r.status === 'cleaning').length,
      maintenance: rooms.filter(r => r.status === 'maintenance' || r.status === 'out-of-order').length,
    },
    staff: {
      total: staff.length,
      available: staffAvailable,
      assigned: staffAssigned,
      byDepartment: staffByDept
    },
    inventory: inventory.map(i => ({
      item_name: i.item_name,
      current_stock_kg: i.current_stock_kg,
      safety_threshold_kg: i.safety_threshold_kg,
      daily_consumption_rate_kg: i.daily_consumption_rate_kg
    })),
    maintenance: {
      active_tickets: tickets,
      assets_at_risk: assets
    },
    guestRequests: {
      active: requests
    }
  };
}
