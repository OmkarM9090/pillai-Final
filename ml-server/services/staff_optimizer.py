import numpy as np
from datetime import datetime, timedelta

class StaffOptimizer:
    """GASA - Greedy Allocation Staff Algorithm"""
    
    DEPARTMENTS = ["housekeeping", "fnb", "front_desk", "maintenance", "spa", "activities"]
    SHIFTS = ["morning", "afternoon", "night"]
    
    def generate_roster(self, params: dict) -> dict:
        """
        Generate optimized staff roster based on predicted demand
        params: {
            date: "2025-01-15",
            predicted_occupancy: 75,
            event: "none"|"wedding"|"conference",
            available_staff: [list of staff with skills]
        }
        """
        occupancy = params.get("predicted_occupancy", 70) / 100
        event = params.get("event", "none")
        date_str = params.get("date", datetime.now().strftime("%Y-%m-%d"))
        
        # Calculate department needs
        needs = self._calculate_needs(occupancy, event)
        
        # Generate staff if not provided
        available = params.get("available_staff", self._generate_mock_staff(30))
        
        # Greedy assignment
        roster = self._greedy_assign(available, needs)
        
        return {
            "date": date_str,
            "occupancy_forecast": int(occupancy * 100),
            "event": event,
            "department_needs": needs,
            "roster": roster,
            "summary": {
                "total_assigned": sum(len(shift_list) for dept_data in roster.values() for shift_list in dept_data.values()),
                "total_shifts": sum(sum(len(s) for s in dept_data.values()) if isinstance(dept_data, dict) else 0 for dept_data in roster.values()),
                "estimated_cost": self._calculate_cost(roster),
                "coverage_score": self._calculate_coverage(roster, needs)
            },
            "alerts": self._generate_alerts(roster, needs)
        }
    
    def _calculate_needs(self, occupancy, event):
        rooms = int(150 * occupancy)
        guests = int(rooms * 1.8)
        
        needs = {
            "housekeeping": {
                "morning": max(4, int(rooms / 10)),
                "afternoon": max(2, int(rooms / 20)),
                "night": max(1, int(rooms / 50))
            },
            "fnb": {
                "morning": max(3, int(guests / 12)),
                "afternoon": max(2, int(guests / 18)),
                "night": max(3, int(guests / 10))
            },
            "front_desk": {
                "morning": max(2, int(rooms / 35)),
                "afternoon": max(2, int(rooms / 40)),
                "night": max(1, 1)
            },
            "maintenance": {
                "morning": max(2, int(rooms / 50)),
                "afternoon": max(1, int(rooms / 60)),
                "night": max(1, 1)
            }
        }
        
        # Event boost
        if event == "wedding":
            needs["fnb"]["afternoon"] += 3
            needs["fnb"]["night"] += 4
            needs["housekeeping"]["morning"] += 2
        elif event == "conference":
            needs["front_desk"]["morning"] += 2
            needs["fnb"]["morning"] += 2
            needs["fnb"]["afternoon"] += 2
        
        return needs
    
    def _generate_mock_staff(self, count):
        names = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Anita", "Raj", "Meena", 
                 "Sanjay", "Kavita", "Deepak", "Pooja", "Arjun", "Neha", "Suresh",
                 "Ritu", "Manoj", "Sapna", "Rakesh", "Divya", "Kiran", "Ajay",
                 "Sunita", "Vinod", "Shweta", "Ramesh", "Anjali", "Gaurav", "Lakshmi", "Nitin"]
        
        skills_map = {
            "housekeeping": 0.4,
            "fnb": 0.35,
            "front_desk": 0.15,
            "maintenance": 0.1
        }
        
        staff = []
        for i in range(min(count, len(names))):
            primary = str(np.random.choice(list(skills_map.keys()), p=list(skills_map.values())))
            secondary = str(np.random.choice([s for s in skills_map.keys() if s != primary]))
            staff.append({
                "id": f"STAFF-{i+1:03d}",
                "name": names[i],
                "primary_skill": primary,
                "secondary_skill": secondary,
                "max_hours": 8,
                "cost_per_hour": int(np.random.choice([150, 175, 200, 225])),
                "preference": str(np.random.choice(["morning", "afternoon", "night"], p=[0.5, 0.3, 0.2]))
            })
        
        return staff
    
    def _greedy_assign(self, staff, needs):
        roster = {}
        assigned = set()
        
        for dept, shifts in needs.items():
            roster[dept] = {}
            for shift, count_needed in shifts.items():
                roster[dept][shift] = []
                
                # First pass: assign by primary skill and preference
                for s in staff:
                    if len(roster[dept][shift]) >= count_needed:
                        break
                    if s["id"] in assigned:
                        continue
                    if s["primary_skill"] == dept and s["preference"] == shift:
                        roster[dept][shift].append(s)
                        assigned.add(s["id"])
                
                # Second pass: primary skill any shift
                for s in staff:
                    if len(roster[dept][shift]) >= count_needed:
                        break
                    if s["id"] in assigned:
                        continue
                    if s["primary_skill"] == dept:
                        roster[dept][shift].append(s)
                        assigned.add(s["id"])
                
                # Third pass: secondary skill
                for s in staff:
                    if len(roster[dept][shift]) >= count_needed:
                        break
                    if s["id"] in assigned:
                        continue
                    if s["secondary_skill"] == dept:
                        roster[dept][shift].append(s)
                        assigned.add(s["id"])
        
        return roster
    
    def _calculate_cost(self, roster):
        total = 0
        for dept in roster.values():
            if isinstance(dept, dict):
                for shift_staff in dept.values():
                    if isinstance(shift_staff, list):
                        for s in shift_staff:
                            total += s.get("cost_per_hour", 175) * 8
        return total
    
    def _calculate_coverage(self, roster, needs):
        total_needed = 0
        total_filled = 0
        for dept, shifts in needs.items():
            for shift, count in shifts.items():
                total_needed += count
                if dept in roster and shift in roster[dept]:
                    total_filled += min(count, len(roster[dept][shift]))
        return round((total_filled / max(1, total_needed)) * 100, 1)
    
    def _generate_alerts(self, roster, needs):
        alerts = []
        for dept, shifts in needs.items():
            for shift, count in shifts.items():
                actual = len(roster.get(dept, {}).get(shift, []))
                if actual < count:
                    alerts.append({
                        "department": dept,
                        "shift": shift,
                        "needed": count,
                        "assigned": actual,
                        "gap": count - actual,
                        "severity": "critical" if (count - actual) > 2 else "warning"
                    })
        return alerts

staff_optimizer = StaffOptimizer()
