from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from services.model_loader import model_store

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting ResortSandbox 360 ML Server...")
    model_store.load_all()
    yield
    # Shutdown
    print("Shutting down ML Server")

app = FastAPI(
    title="ResortSandbox 360 - AI Engine",
    description="AI-powered decision intelligence for resort operations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers
from routers import forecast, simulation, nlp, staff

app.include_router(forecast.router)
app.include_router(simulation.router)
app.include_router(nlp.router)
app.include_router(staff.router)

@app.get("/")
async def root():
    return {
        "service": "ResortSandbox 360 - AI Engine",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "forecast": "/api/forecast/predict",
            "simulation": "/api/simulation/run",
            "nlp": "/api/nlp/analyze-review",
            "staff": "/api/staff/generate-roster",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "models_loaded": model_store._loaded,
        "models_available": {
            "occupancy": model_store.occupancy_model is not None,
            "staff_demand": model_store.staff_demand_model is not None,
            "fnb_demand": model_store.fnb_demand_model is not None,
            "sentiment": model_store.sentiment_model is not None,
            "maintenance": model_store.maintenance_anomaly_model is not None,
            "guest_segmentation": model_store.guest_segmentation_model is not None,
            "ticket_urgency": model_store.ticket_urgency_model is not None
        }
    }
