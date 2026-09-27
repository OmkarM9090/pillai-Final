from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services.simulator import simulator

router = APIRouter(prefix="/api/simulation", tags=["Simulation"])

class ScenarioInput(BaseModel):
    occupancy_pct: float = 70
    weather_condition: str = "sunny"
    event_type: str = "none"
    season: str = "shoulder"
    ingredient_cost_change_pct: float = 0
    staff_availability_pct: float = 100

class CompareInput(BaseModel):
    scenario_a: ScenarioInput
    scenario_b: ScenarioInput

@router.post("/run")
async def run_simulation(scenario: ScenarioInput):
    """Run a what-if simulation scenario"""
    result = simulator.run_scenario(scenario.dict())
    return result

@router.post("/compare")
async def compare_scenarios(data: CompareInput):
    """Compare two what-if scenarios side by side"""
    result = simulator.compare_scenarios(data.scenario_a.dict(), data.scenario_b.dict())
    return result

@router.get("/presets")
async def get_presets():
    """Get pre-built simulation scenarios"""
    return {
        "presets": [
            {
                "name": "Normal Operations",
                "description": "Regular day with average occupancy",
                "params": {"occupancy_pct": 70, "weather_condition": "sunny", "event_type": "none", "season": "shoulder", "ingredient_cost_change_pct": 0, "staff_availability_pct": 100}
            },
            {
                "name": "Peak Weekend",
                "description": "High occupancy weekend during peak season",
                "params": {"occupancy_pct": 92, "weather_condition": "sunny", "event_type": "none", "season": "peak", "ingredient_cost_change_pct": 5, "staff_availability_pct": 90}
            },
            {
                "name": "Wedding Event",
                "description": "Large wedding event with moderate occupancy",
                "params": {"occupancy_pct": 85, "weather_condition": "sunny", "event_type": "wedding", "season": "peak", "ingredient_cost_change_pct": 10, "staff_availability_pct": 85}
            },
            {
                "name": "Storm Crisis",
                "description": "Stormy weather with reduced staff",
                "params": {"occupancy_pct": 60, "weather_condition": "stormy", "event_type": "none", "season": "offpeak", "ingredient_cost_change_pct": 20, "staff_availability_pct": 70}
            },
            {
                "name": "Conference Week",
                "description": "Corporate conference driving midweek occupancy",
                "params": {"occupancy_pct": 80, "weather_condition": "sunny", "event_type": "conference", "season": "shoulder", "ingredient_cost_change_pct": 0, "staff_availability_pct": 95}
            },
            {
                "name": "Festival Rush",
                "description": "Festival season with maximum demand",
                "params": {"occupancy_pct": 95, "weather_condition": "sunny", "event_type": "festival", "season": "peak", "ingredient_cost_change_pct": 15, "staff_availability_pct": 80}
            }
        ]
    }
