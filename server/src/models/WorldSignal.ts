import mongoose, { Document, Schema } from 'mongoose';

export interface IWorldSignal extends Document {
  signal_type: string;
  source: string;
  data?: Record<string, any>;
  severity?: number;
  affected_departments: string[];
  expected_impact?: string;
  is_active: boolean;
}

const WorldSignalSchema = new Schema<IWorldSignal>({
  signal_type: { type: String, enum: ['weather', 'demand_shock', 'local_event'], required: true },
  source: { type: String, default: 'synthetic' },
  data: { type: Schema.Types.Mixed },
  severity: { type: Number, min: 0, max: 1 },
  affected_departments: [{ type: String }],
  expected_impact: { type: String },
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

export const WorldSignal = mongoose.model<IWorldSignal>('WorldSignal', WorldSignalSchema);
