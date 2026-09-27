import joblib
import os
from pathlib import Path

MODEL_DIR = Path(__file__).parent.parent / "models"

class ModelStore:
    """Singleton to load all ML models once at startup"""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._loaded = False
        return cls._instance
    
    def load_all(self):
        if self._loaded:
            return
        
        print("🔄 Loading all ML models...")
        
        try:
            self.occupancy_model = self._load("occupancy_forecast_model.joblib")
            self.staff_demand_model = self._load("staff_demand_model.joblib")
            self.fnb_demand_model = self._load("fnb_demand_model.joblib")
            self.inventory_demand_model = self._load("inventory_demand_model.joblib")
            self.sentiment_model = self._load("sentiment_fallback_model.joblib")
            self.maintenance_anomaly_model = self._load("maintenance_isolationforest_model.joblib")
            self.maintenance_classifier = self._load("maintenance_randomforest_model.joblib")
            self.guest_segmentation_model = self._load("guest_segmentation_kmeans_model.joblib")
            self.ticket_urgency_model = self._load("ticket_urgency_model.joblib")
            
            # Load preprocessing artifacts if they exist
            self.tfidf_vectorizer = self._load("sentiment_tfidf_vectorizer.joblib")
            self.scaler = self._load("guest_segmentation_scaler.joblib")
            
            self._loaded = True
            print("✅ All models loaded successfully!")
            
        except Exception as e:
            print(f"⚠️ Some models failed to load: {e}")
            self._loaded = True  # Don't retry, use fallbacks
    
    def _load(self, filename):
        filepath = MODEL_DIR / filename
        if filepath.exists():
            model = joblib.load(filepath)
            print(f"  ✅ Loaded {filename}")
            return model
        else:
            print(f"  ⚠️ {filename} not found, will use fallback")
            return None

# Global instance
model_store = ModelStore()
