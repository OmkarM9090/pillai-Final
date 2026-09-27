import mongoose, { Document, Schema } from 'mongoose';

export interface ISimulation extends Document {
  scenarioType: string;
  parameters: any;
  currentState: any;
  projectedState: any;
  constraints: any[];
  bottlenecks: any[];
  recommendation: any;
  createdBy: string;
  createdAt: Date;
  decision: string; // 'PENDING', 'APPROVED', 'REJECTED'
}

const SimulationSchema = new Schema<ISimulation>({
  scenarioType: { type: String, required: true },
  parameters: { type: Schema.Types.Mixed },
  currentState: { type: Schema.Types.Mixed },
  projectedState: { type: Schema.Types.Mixed },
  constraints: [{ type: Schema.Types.Mixed }],
  bottlenecks: [{ type: Schema.Types.Mixed }],
  recommendation: { type: Schema.Types.Mixed },
  createdBy: { type: String },
  decision: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' }
}, { timestamps: true });

export const Simulation = mongoose.model<ISimulation>('Simulation', SimulationSchema);
