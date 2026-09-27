from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from services.staff_optimizer import staff_optimizer

router = APIRouter(prefix="/api/staff", tags=["Staff Scheduling"])

class RosterInput(BaseModel):
    date: str = "2025-01-15"
    predicted_occupancy: float = 75
    event: str = "none"

@router.post("/generate-roster")
async def generate_roster(input_data: RosterInput):
    """Generate optimized staff roster using GASA algorithm"""
    result = staff_optimizer.generate_roster(input_data.dict())
    return result

@router.get("/dashboard")
async def staff_dashboard():
    """Get staff overview for dashboard"""
    return {
        "total_staff": 32,
        "on_duty_today": 24,
        "departments": {
            "housekeeping": {"total": 12, "on_duty": 9, "utilization": 85},
            "fnb": {"total": 10, "on_duty": 8, "utilization": 78},
            "front_desk": {"total": 5, "on_duty": 4, "utilization": 70},
            "maintenance": {"total": 5, "on_duty": 3, "utilization": 65}
        },
        "overtime_hours_this_week": 18,
        "burnout_risk_staff": [
            {"name": "Rahul K.", "department": "housekeeping", "hours_this_week": 52, "risk": "high"},
            {"name": "Priya S.", "department": "fnb", "hours_this_week": 48, "risk": "medium"}
        ],
        "upcoming_leaves": [
            {"name": "Amit P.", "department": "maintenance", "dates": "Jan 16-18"},
            {"name": "Sneha D.", "department": "front_desk", "dates": "Jan 17"}
        ]
    }
