import { getDigitalTwinSnapshot, DigitalTwinSnapshot } from './snapshot';

export interface SimulationParams {
  occupancy_pct: number;
  weather_severity: number; // 0 (normal) to 1 (extreme)
  demand_shock: number; // 1.0 = normal, 1.3 = 30% surge
  staff_availability: number; // 1.0 = 100%, 0.7 = 70%
  inventory_availability: number; // 1.0 = 100%, 0.5 = 50%
}

export async function runSimulation(params: SimulationParams) {
  const snapshot = await getDigitalTwinSnapshot();

  // 1. Calculate Occupancy & Room Turnover Demand
  const targetRooms = Math.round(snapshot.rooms.total * (params.occupancy_pct / 100));
  const guests = Math.round(targetRooms * 2.1); // Assuming 2.1 guests per room

  // Housekeeping Model
  // Assuming 1 housekeeper can clean ~12 rooms a shift (approx 35 mins/room).
  // If demand shock is high, more mess = more time
  const cleaningTimePerRoomMins = 35 * params.demand_shock;
  const totalCleaningMinutesRequired = targetRooms * cleaningTimePerRoomMins;
  const housekeepingCapacityMins = (((snapshot.staff.byDepartment['housekeeping']?.available || 0) + (snapshot.staff.byDepartment['Housekeeping']?.available || 0)) * params.staff_availability) * 8 * 60; 
  
  const housekeepingGapMins = totalCleaningMinutesRequired - housekeepingCapacityMins;
  const housekeepingStaffGap = housekeepingGapMins > 0 ? Math.ceil(housekeepingGapMins / (8 * 60)) : 0;
  
  const housekeepingPressure = Math.min(100, Math.round((totalCleaningMinutesRequired / Math.max(1, housekeepingCapacityMins)) * 100));

  // Maintenance Model
  const maintenanceDemand = snapshot.maintenance.active_tickets + (snapshot.maintenance.assets_at_risk * params.weather_severity * 2);
  const maintenanceCapacity = (((snapshot.staff.byDepartment['maintenance']?.available || 0) + (snapshot.staff.byDepartment['Maintenance']?.available || 0)) * params.staff_availability) * 5; // 5 tickets per tech
  const maintenancePressure = Math.min(100, Math.round((maintenanceDemand / Math.max(1, maintenanceCapacity)) * 100));

  // F&B Model
  const fnbDemand = guests * params.demand_shock * 1.5;
  const fnbCapacity = (((snapshot.staff.byDepartment['fnb']?.available || 0) + (snapshot.staff.byDepartment['F&B']?.available || 0)) * params.staff_availability) * 40; // 40 guests per F&B staff
  const fnbPressure = Math.min(100, Math.round((fnbDemand / Math.max(1, fnbCapacity)) * 100));

  // Guest Services (Front Desk)
  const frontDeskDemand = guests * params.demand_shock + snapshot.guestRequests.active;
  const frontDeskCapacity = (((snapshot.staff.byDepartment['front_desk']?.available || 0) + (snapshot.staff.byDepartment['Front Desk']?.available || 0)) * params.staff_availability) * 60; // 60 requests per shift
  const frontDeskPressure = Math.min(100, Math.round((frontDeskDemand / Math.max(1, frontDeskCapacity)) * 100));

  // Inventory Model
  let criticalInventoryItems = 0;
  const inventoryForecast = snapshot.inventory.map(item => {
    // Increase consumption by demand shock and occupancy
    const consumption = item.daily_consumption_rate_kg * (params.occupancy_pct / 50) * params.demand_shock;
    const remaining = (item.current_stock_kg * params.inventory_availability) - consumption;
    const isCritical = remaining <= item.safety_threshold_kg;
    if (isCritical) criticalInventoryItems++;
    return {
      item_name: item.item_name,
      current: item.current_stock_kg * params.inventory_availability,
      consumption,
      remaining,
      status: isCritical ? 'CRITICAL' : 'NORMAL'
    };
  });
  
  const inventoryPressure = Math.min(100, Math.round((criticalInventoryItems / Math.max(1, snapshot.inventory.length)) * 100));

  // Identify Bottlenecks & Ceilings
  const pressures = [
    { name: 'Housekeeping', pressure: housekeepingPressure, gap: housekeepingStaffGap },
    { name: 'Maintenance', pressure: maintenancePressure, gap: Math.ceil((maintenanceDemand - maintenanceCapacity)/5) },
    { name: 'Food & Beverage', pressure: fnbPressure, gap: Math.ceil((fnbDemand - fnbCapacity)/40) },
    { name: 'Guest Services', pressure: frontDeskPressure, gap: Math.ceil((frontDeskDemand - frontDeskCapacity)/60) },
    { name: 'Inventory', pressure: inventoryPressure, gap: criticalInventoryItems }
  ];

  pressures.sort((a, b) => b.pressure - a.pressure);
  const primaryBottleneck = pressures[0];
  
  // Calculate Safe Capacity
  // Find what occupancy would make the primary bottleneck hit exactly 100% pressure
  let safeOccupancy = params.occupancy_pct;
  if (primaryBottleneck.pressure > 100) {
    safeOccupancy = Math.round(params.occupancy_pct * (100 / primaryBottleneck.pressure));
  } else if (primaryBottleneck.pressure < 90) {
    safeOccupancy = Math.min(100, Math.round(params.occupancy_pct * (100 / Math.max(1, primaryBottleneck.pressure))));
  }

  // Strategies
  const strategies = [];
  if (primaryBottleneck.pressure > 100) {
    if (primaryBottleneck.name === 'Housekeeping') {
      const crossTrainedAvailable = (snapshot.staff.byDepartment['housekeeping']?.crossTrainedIn || 0) + (snapshot.staff.byDepartment['Housekeeping']?.crossTrainedIn || 0);
      if (crossTrainedAvailable > 0) {
        strategies.push({
          name: 'Deploy Cross-Trained Staff',
          action: `Reassign ${Math.min(crossTrainedAvailable, primaryBottleneck.gap)} cross-trained staff to Housekeeping`,
          impact: `Reduces housekeeping gap to ${Math.max(0, primaryBottleneck.gap - crossTrainedAvailable)} workers`,
          risk: 'Medium (May cause mild friction in donor departments)'
        });
      }
      
      strategies.push({
        name: 'Authorize Overtime',
        action: `Authorize 2 hours overtime for Housekeeping`,
        impact: `Increases capacity by 25%, solving ${Math.ceil(housekeepingCapacityMins * 0.25 / (8*60))} worker equivalents`,
        risk: 'High (Fatigue risk increases significantly)'
      });
    } else if (primaryBottleneck.name === 'Inventory') {
      strategies.push({
        name: 'Emergency Procurement',
        action: `Rush order for ${criticalInventoryItems} critical items`,
        impact: `Prevents F&B menu unavailability`,
        risk: 'Low (Higher cost)'
      });
    } else {
      strategies.push({
        name: `Call in temporary ${primaryBottleneck.name} staff`,
        action: `Request ${primaryBottleneck.gap} temp workers`,
        impact: `Solves primary capacity gap`,
        risk: 'Low'
      });
    }
  }

  const goppar = Math.round(150 * (params.occupancy_pct/100) * params.demand_shock);

  const resilience = Math.max(0, 100 - pressures.reduce((acc, p) => acc + (p.pressure > 100 ? (p.pressure - 100) : 0), 0));
  
  const council = {
    agents: [
      { name: 'Revenue', status: goppar > 100 ? 'active' : 'warning', recommendation: `Projected GOPPAR $${goppar}. Maximize occupancy.` },
      { name: 'Housekeeping', status: housekeepingPressure > 90 ? 'critical' : 'active', recommendation: housekeepingPressure > 100 ? `Cap occupancy at ${safeOccupancy}% or add ${housekeepingStaffGap} staff.` : 'Capacity is sufficient.' },
      { name: 'F&B', status: fnbPressure > 90 ? 'warning' : 'active', recommendation: criticalInventoryItems > 0 ? `Emergency order ${criticalInventoryItems} items.` : 'Stock and staff OK.' },
      { name: 'Workforce', status: primaryBottleneck.pressure > 100 ? 'critical' : 'active', recommendation: strategies.length > 0 ? strategies[0].name : 'No immediate action required.' },
      { name: 'Guest Exp', status: (housekeepingPressure > 100 || maintenancePressure > 100) ? 'warning' : 'active', recommendation: (housekeepingPressure > 100 || maintenancePressure > 100) ? 'High risk of service delays.' : 'Service quality stable.' }
    ],
    chief_synthesis: `Resilience is ${resilience}/100. ${primaryBottleneck.pressure > 100 ? `Primary bottleneck is ${primaryBottleneck.name}.` : 'Operations are stable.'}`,
    consensus_score: Math.round(resilience / 100 * 10) / 10
  };

  return {
    scenario: params,
    snapshot,
    safeCapacity: safeOccupancy,
    primaryBottleneck,
    pressures,
    inventoryForecast,
    strategies,
    resilience,
    council,
    decisionSummary: {
      assessment: `Projected occupancy is ${params.occupancy_pct}% while safe capacity is ${safeOccupancy}%.`,
      bottleneck: primaryBottleneck.name,
      staffingImpact: primaryBottleneck.gap > 0 ? `${primaryBottleneck.gap} additional ${primaryBottleneck.name} workers required.` : 'Sufficient staffing.',
      goppar_estimate: goppar
    }
  };
}
