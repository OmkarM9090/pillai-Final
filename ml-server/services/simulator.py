import numpy as np
from .model_loader import model_store

class ResortSimulator:
    """What-If Simulation Engine - The core differentiator"""
    
    # Resort constants
    TOTAL_ROOMS = 150
    BASE_ROOM_RATE = 8500  # INR
    STAFF_COST_PER_SHIFT = 1200  # INR
    FNB_COST_PER_GUEST = 950  # INR
    HOUSEKEEPING_TIME_PER_ROOM = 45  # minutes
    
    def run_scenario(self, params: dict) -> dict:
        """
        Run a what-if simulation with given parameters.
        params: {
            occupancy_pct: 0-100,
            weather_condition: "sunny"|"rainy"|"stormy",
            event_type: "none"|"wedding"|"conference"|"festival",
            season: "peak"|"offpeak"|"shoulder",
            ingredient_cost_change_pct: -20 to +50,
            staff_availability_pct: 50-100
        }
        """
        occupancy = params.get("occupancy_pct", 70) / 100
        weather = params.get("weather_condition", "sunny")
        event = params.get("event_type", "none")
        season = params.get("season", "shoulder")
        ingredient_change = params.get("ingredient_cost_change_pct", 0) / 100
        staff_avail = params.get("staff_availability_pct", 100) / 100
        
        occupied_rooms = int(self.TOTAL_ROOMS * occupancy)
        total_guests = int(occupied_rooms * 1.8)  # avg 1.8 guests per room
        
        # --- REVENUE SIMULATION ---
        rate_multiplier = self._get_rate_multiplier(occupancy, season, event)
        dynamic_rate = self.BASE_ROOM_RATE * rate_multiplier
        room_revenue = occupied_rooms * dynamic_rate
        fnb_revenue = total_guests * self.FNB_COST_PER_GUEST * self._get_fnb_multiplier(event, weather)
        other_revenue = total_guests * 450 * self._get_activity_multiplier(weather)
        total_revenue = room_revenue + fnb_revenue + other_revenue
        
        # --- STAFFING SIMULATION ---
        housekeeping_staff_needed = max(5, int(np.ceil(occupied_rooms / 12)))
        fnb_staff_needed = max(3, int(np.ceil(total_guests / 15)))
        front_desk_needed = max(2, int(np.ceil(occupied_rooms / 40)))
        maintenance_needed = max(2, int(np.ceil(occupied_rooms / 50)) + (1 if weather == "stormy" else 0))
        total_staff_needed = housekeeping_staff_needed + fnb_staff_needed + front_desk_needed + maintenance_needed
        available_staff = int(total_staff_needed * staff_avail)
        staff_gap = max(0, total_staff_needed - available_staff)
        staff_cost = available_staff * self.STAFF_COST_PER_SHIFT
        overtime_cost = staff_gap * self.STAFF_COST_PER_SHIFT * 1.5
        
        # --- F&B SIMULATION ---
        base_fnb_cost = total_guests * 380
        fnb_cost = base_fnb_cost * (1 + ingredient_change)
        breakfast_covers = int(total_guests * 0.85)
        lunch_covers = int(total_guests * 0.45)
        dinner_covers = int(total_guests * 0.70)
        
        # --- HOUSEKEEPING SIMULATION ---
        total_cleaning_minutes = occupied_rooms * self.HOUSEKEEPING_TIME_PER_ROOM
        available_cleaning_minutes = housekeeping_staff_needed * 480  # 8hr shift
        cleaning_utilization = min(1, total_cleaning_minutes / max(1, available_cleaning_minutes))
        
        # --- GUEST EXPERIENCE SCORE ---
        base_score = 8.5
        if staff_gap > 3:
            base_score -= 1.5
        elif staff_gap > 0:
            base_score -= 0.5 * staff_gap
        if weather == "stormy":
            base_score -= 0.5
        if event != "none":
            base_score += 0.3
        if cleaning_utilization > 0.9:
            base_score -= 0.8
        guest_experience_score = max(1, min(10, round(base_score, 1)))
        
        # --- RISK ASSESSMENT ---
        risks = []
        if occupancy > 0.9:
            risks.append({"type": "OVERBOOKING_RISK", "level": "high", "message": "Occupancy above 90% - high risk of service degradation"})
        if staff_gap > 2:
            risks.append({"type": "UNDERSTAFFING", "level": "critical", "message": f"Short by {staff_gap} staff members - guest experience will suffer"})
        if cleaning_utilization > 0.85:
            risks.append({"type": "HOUSEKEEPING_OVERLOAD", "level": "medium", "message": "Housekeeping at near-max capacity"})
        if ingredient_change > 0.2:
            risks.append({"type": "COST_SPIKE", "level": "high", "message": f"Ingredient costs up {int(ingredient_change*100)}% - review menu pricing"})
        if weather == "stormy":
            risks.append({"type": "WEATHER_IMPACT", "level": "medium", "message": "Stormy weather - outdoor activities affected, more indoor staff needed"})
        
        # --- ACTION RECOMMENDATIONS ---
        actions = self._generate_actions(
            occupancy, staff_gap, cleaning_utilization, 
            ingredient_change, weather, event, dynamic_rate
        )
        
        # --- GOPPAR (Gross Operating Profit Per Available Room) ---
        total_cost = staff_cost + overtime_cost + fnb_cost + (occupied_rooms * 200)  # 200 per room ops cost
        gross_profit = total_revenue - total_cost
        goppar = gross_profit / self.TOTAL_ROOMS
        
        return {
            "scenario_input": params,
            "revenue": {
                "room_revenue": round(room_revenue),
                "fnb_revenue": round(fnb_revenue),
                "other_revenue": round(other_revenue),
                "total_revenue": round(total_revenue),
                "dynamic_room_rate": round(dynamic_rate),
                "goppar": round(goppar)
            },
            "staffing": {
                "housekeeping": housekeeping_staff_needed,
                "fnb": fnb_staff_needed,
                "front_desk": front_desk_needed,
                "maintenance": maintenance_needed,
                "total_needed": total_staff_needed,
                "available": available_staff,
                "gap": staff_gap,
                "staff_cost": round(staff_cost),
                "overtime_cost": round(overtime_cost)
            },
            "fnb": {
                "total_covers": breakfast_covers + lunch_covers + dinner_covers,
                "breakfast": breakfast_covers,
                "lunch": lunch_covers,
                "dinner": dinner_covers,
                "food_cost": round(fnb_cost),
                "ingredient_impact": f"{'+' if ingredient_change > 0 else ''}{int(ingredient_change*100)}%"
            },
            "housekeeping": {
                "rooms_to_clean": occupied_rooms,
                "utilization_pct": round(cleaning_utilization * 100, 1),
                "estimated_completion_hrs": round(total_cleaning_minutes / 60, 1)
            },
            "guest_experience": {
                "predicted_score": guest_experience_score,
                "max_score": 10,
                "factors": self._get_experience_factors(staff_gap, cleaning_utilization, weather)
            },
            "risks": risks,
            "recommended_actions": actions,
            "summary": {
                "profit_margin_pct": round((gross_profit / max(1, total_revenue)) * 100, 1),
                "overall_status": "healthy" if len([r for r in risks if r["level"] in ["high", "critical"]]) == 0 else "at_risk"
            }
        }
    
    def compare_scenarios(self, scenario_a: dict, scenario_b: dict) -> dict:
        """Compare two scenarios side by side"""
        result_a = self.run_scenario(scenario_a)
        result_b = self.run_scenario(scenario_b)
        
        return {
            "scenario_a": result_a,
            "scenario_b": result_b,
            "comparison": {
                "revenue_diff": result_b["revenue"]["total_revenue"] - result_a["revenue"]["total_revenue"],
                "staff_diff": result_b["staffing"]["total_needed"] - result_a["staffing"]["total_needed"],
                "experience_diff": result_b["guest_experience"]["predicted_score"] - result_a["guest_experience"]["predicted_score"],
                "goppar_diff": result_b["revenue"]["goppar"] - result_a["revenue"]["goppar"],
                "recommendation": self._compare_recommendation(result_a, result_b)
            }
        }
    
    def _get_rate_multiplier(self, occupancy, season, event):
        base = 1.0
        if season == "peak": base = 1.4
        elif season == "shoulder": base = 1.1
        elif season == "offpeak": base = 0.8
        
        if occupancy > 0.85: base *= 1.2
        elif occupancy > 0.7: base *= 1.1
        elif occupancy < 0.4: base *= 0.85
        
        if event == "wedding": base *= 1.15
        elif event == "conference": base *= 1.1
        elif event == "festival": base *= 1.25
        
        return base
    
    def _get_fnb_multiplier(self, event, weather):
        mult = 1.0
        if event == "wedding": mult = 1.5
        elif event == "conference": mult = 1.3
        elif event == "festival": mult = 1.4
        if weather == "rainy": mult *= 1.15  # more indoor dining
        return mult
    
    def _get_activity_multiplier(self, weather):
        if weather == "sunny": return 1.2
        if weather == "rainy": return 0.6
        if weather == "stormy": return 0.2
        return 1.0
    
    def _generate_actions(self, occupancy, staff_gap, clean_util, ing_change, weather, event, rate):
        actions = []
        
        if occupancy > 0.85:
            actions.append({
                "id": f"ACT-{np.random.randint(1000,9999)}",
                "type": "PRICING",
                "title": "Increase room rates",
                "description": f"High demand detected. Recommend increasing rate from ₹{int(rate)} to ₹{int(rate * 1.12)}",
                "impact": "high",
                "confidence": 0.87,
                "risk": "low",
                "estimated_revenue_impact": f"+₹{int(rate * 0.12 * self.TOTAL_ROOMS * occupancy)}"
            })
        
        if staff_gap > 0:
            actions.append({
                "id": f"ACT-{np.random.randint(1000,9999)}",
                "type": "STAFFING",
                "title": f"Call in {staff_gap} additional staff",
                "description": f"Current gap of {staff_gap} staff members. Recommend calling part-time workers for critical shifts",
                "impact": "critical",
                "confidence": 0.92,
                "risk": "medium",
                "estimated_cost": f"₹{int(staff_gap * self.STAFF_COST_PER_SHIFT * 1.5)}"
            })
        
        if clean_util > 0.8:
            actions.append({
                "id": f"ACT-{np.random.randint(1000,9999)}",
                "type": "HOUSEKEEPING",
                "title": "Stagger checkout cleaning schedule",
                "description": "Housekeeping near capacity. Spread cleaning across shifts and prioritize VIP rooms",
                "impact": "medium",
                "confidence": 0.78,
                "risk": "low",
                "estimated_time_saving": "45 mins"
            })
        
        if ing_change > 0.15:
            actions.append({
                "id": f"ACT-{np.random.randint(1000,9999)}",
                "type": "F&B",
                "title": "Adjust menu pricing and specials",
                "description": f"Ingredient costs up {int(ing_change*100)}%. Recommend promoting high-margin dishes and adjusting buffet portions",
                "impact": "medium",
                "confidence": 0.81,
                "risk": "low",
                "estimated_savings": f"₹{int(ing_change * 15000)}"
            })
        
        if event != "none":
            actions.append({
                "id": f"ACT-{np.random.randint(1000,9999)}",
                "type": "OPERATIONS",
                "title": f"Activate {event} event protocol",
                "description": f"Deploy additional resources for {event}. Setup dedicated event coordinator and increase F&B prep by 30%",
                "impact": "high",
                "confidence": 0.90,
                "risk": "low"
            })
        
        if weather == "stormy":
            actions.append({
                "id": f"ACT-{np.random.randint(1000,9999)}",
                "type": "MAINTENANCE",
                "title": "Activate storm preparation protocol",
                "description": "Secure outdoor furniture, check drainage, prepare backup generators, increase indoor activity staff",
                "impact": "high",
                "confidence": 0.95,
                "risk": "medium"
            })
        
        # Always add a monitoring action
        actions.append({
            "id": f"ACT-{np.random.randint(1000,9999)}",
            "type": "MONITORING",
            "title": "Continue real-time monitoring",
            "description": "Keep monitoring occupancy trends and guest feedback for any sudden changes",
            "impact": "low",
            "confidence": 0.99,
            "risk": "low"
        })
        
        return actions
    
    def _get_experience_factors(self, staff_gap, clean_util, weather):
        factors = []
        if staff_gap > 0:
            factors.append({"factor": "Staff shortage", "impact": "negative", "weight": -0.5 * staff_gap})
        if clean_util > 0.85:
            factors.append({"factor": "Housekeeping overload", "impact": "negative", "weight": -0.8})
        if weather == "stormy":
            factors.append({"factor": "Bad weather", "impact": "negative", "weight": -0.5})
        if weather == "sunny":
            factors.append({"factor": "Good weather", "impact": "positive", "weight": 0.3})
        if not factors:
            factors.append({"factor": "Normal operations", "impact": "positive", "weight": 0})
        return factors
    
    def _compare_recommendation(self, a, b):
        a_score = a["revenue"]["goppar"] + (a["guest_experience"]["predicted_score"] * 100)
        b_score = b["revenue"]["goppar"] + (b["guest_experience"]["predicted_score"] * 100)
        if b_score > a_score:
            return "Scenario B is recommended - better GOPPAR and guest experience"
        elif a_score > b_score:
            return "Scenario A is recommended - better GOPPAR and guest experience"
        return "Both scenarios are comparable"

simulator = ResortSimulator()
