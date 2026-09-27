import mongoose, { Document, Schema } from 'mongoose';

export interface IActionCard extends Document {
  action_id: string;
  title: string;
  affected_departments: string[];
  trigger?: string;
  situation?: string;
  evidence: string[];
  current_state?: Record<string, any>;
  proposed_state?: Record<string, any>;
  predicted_benefit?: string;
  predicted_risk?: string;
  options: { label: string; description: string; impact: string }[];
  trade_offs: string[];
  recommendation?: string;
  confidence?: number;
  autonomy_level: string;
  auto_executed: boolean;
  approval_required: boolean;
  approval_status: string;
  approved_by?: string;
  approved_at?: Date;
  modifications?: string;
  implementation_steps: string[];
  rollback_plan?: string;
  agent_versions?: Record<string, any>;
  model_versions?: Record<string, any>;
}

const ActionCardSchema = new Schema<IActionCard>({
  action_id: { type: String, unique: true },
  title: { type: String, required: true },
  affected_departments: [{ type: String }],
  trigger: { type: String },
  situation: { type: String },
  evidence: [{ type: String }],
  current_state: { type: Schema.Types.Mixed },
  proposed_state: { type: Schema.Types.Mixed },
  predicted_benefit: { type: String },
  predicted_risk: { type: String },
  options: [{
    _id: false,
    label: { type: String },
    description: { type: String },
    impact: { type: String }
  }],
  trade_offs: [{ type: String }],
  recommendation: { type: String },
  confidence: { type: Number, min: 0, max: 1 },
  autonomy_level: { type: String, enum: ['AUTO', 'SUPERVISOR', 'MANAGER', 'CRITICAL'], default: 'MANAGER' },
  auto_executed: { type: Boolean, default: false },
  approval_required: { type: Boolean, default: true },
  approval_status: { type: String, enum: ['pending', 'approved', 'rejected', 'modified'], default: 'pending' },
  approved_by: { type: String },
  approved_at: { type: Date },
  modifications: { type: String },
  implementation_steps: [{ type: String }],
  rollback_plan: { type: String },
  agent_versions: { type: Schema.Types.Mixed },
  model_versions: { type: Schema.Types.Mixed }
}, { timestamps: true });

ActionCardSchema.pre('save', async function() {
  if (!this.action_id) {
    const count = await mongoose.model('ActionCard').countDocuments();
    this.action_id = `ACT-${String(count + 1).padStart(4, '0')}`;
  }
});

export const ActionCard = mongoose.model<IActionCard>('ActionCard', ActionCardSchema);
