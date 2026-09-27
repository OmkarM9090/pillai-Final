import mongoose, { Document, Schema } from 'mongoose';

export interface IMaintenanceAsset extends Document {
  asset_id: string;
  name: string;
  location?: string;
  type?: string;
  install_date?: Date;
  last_maintenance?: Date;
  condition_score?: number;
  anomaly_score?: number;
  failure_risk: string;
  sensor_readings?: {
    vibration?: number;
    temperature?: number;
    pressure?: number;
    humidity?: number;
    power_consumption?: number;
  };
}

const MaintenanceAssetSchema = new Schema<IMaintenanceAsset>({
  asset_id: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  location: { type: String },
  type: { type: String, enum: ['HVAC', 'plumbing', 'electrical', 'elevator', 'kitchen'] },
  install_date: { type: Date },
  last_maintenance: { type: Date },
  condition_score: { type: Number, min: 0, max: 100 },
  anomaly_score: { type: Number, min: 0, max: 1 },
  failure_risk: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
  sensor_readings: {
    vibration: { type: Number },
    temperature: { type: Number },
    pressure: { type: Number },
    humidity: { type: Number },
    power_consumption: { type: Number }
  }
}, { timestamps: true });

export const MaintenanceAsset = mongoose.model<IMaintenanceAsset>('MaintenanceAsset', MaintenanceAssetSchema);
