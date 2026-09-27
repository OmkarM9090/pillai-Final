import mongoose, { Document, Schema } from 'mongoose';

export type IncidentStatus = 'DETECTED' | 'ACKNOWLEDGED' | 'RESPONDING' | 'RESOLVED' | 'CLOSED';

export interface IIncident extends Document {
  incident_id: string;
  incident_type: string;
  severity: 'HIGH' | 'CRITICAL';
  location: string;
  description: string;
  detected_by: string;
  status: IncidentStatus;
  assigned_roles: string[];
  acknowledged_by?: string;
  acknowledged_at?: Date;
  response_started_at?: Date;
  resolved_at?: Date;
  closed_at?: Date;
  actions: Array<{ actor: string; status: IncidentStatus | 'NOTE'; note: string; at: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema = new Schema<IIncident>({
  incident_id: { type: String, unique: true, required: true },
  incident_type: { type: String, required: true, trim: true },
  severity: { type: String, enum: ['HIGH', 'CRITICAL'], default: 'HIGH' },
  location: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  detected_by: { type: String, required: true },
  status: { type: String, enum: ['DETECTED', 'ACKNOWLEDGED', 'RESPONDING', 'RESOLVED', 'CLOSED'], default: 'DETECTED', index: true },
  assigned_roles: [{ type: String }],
  acknowledged_by: { type: String },
  acknowledged_at: { type: Date },
  response_started_at: { type: Date },
  resolved_at: { type: Date },
  closed_at: { type: Date },
  actions: [{ _id: false, actor: String, status: String, note: String, at: Date }],
}, { timestamps: true });

IncidentSchema.index({ status: 1, severity: 1, createdAt: -1 });

export const Incident = mongoose.model<IIncident>('Incident', IncidentSchema);
