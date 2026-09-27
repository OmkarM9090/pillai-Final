import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  action_id?: string;
  user_name: string;
  user_role?: string;
  action_type: string;
  entity_type?: string;
  entity_id?: string;
  original_state?: Record<string, any>;
  new_state?: Record<string, any>;
  decision?: string;
  reason?: string;
  model_version?: string;
  confidence?: number;
}

const AuditLogSchema = new Schema<IAuditLog>({
  action_id: { type: String },
  user_name: { type: String, required: true },
  user_role: { type: String },
  action_type: { type: String, required: true },
  entity_type: { type: String },
  entity_id: { type: String },
  original_state: { type: Schema.Types.Mixed },
  new_state: { type: Schema.Types.Mixed },
  decision: { type: String },
  reason: { type: String },
  model_version: { type: String },
  confidence: { type: Number }
}, { timestamps: true });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
