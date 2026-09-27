import mongoose, { Document, Schema } from 'mongoose';

export interface IOperationalTicket extends Document {
  ticket_id: string;
  title: string;
  description?: string;
  department: string;
  priority: string;
  status: string;
  source: string;
  room_number?: string;
  assigned_to?: string;
  sla_deadline?: Date;
  resolution_notes?: string;
  sentiment_score?: number;
  evidence_terms: string[];
  cluster_id?: string;
  is_systemic: boolean;
  guest_request_id?: string;
  compensation_offered?: string;
  relocation_offered?: string;
  completed_at?: Date;
}

const OperationalTicketSchema = new Schema<IOperationalTicket>({
  ticket_id: { type: String, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  department: { type: String, required: true },
  priority: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
  status: { type: String, enum: ['created', 'todo', 'assigned', 'notified', 'acknowledged', 'in_progress', 'blocked', 'completed', 'verified', 'closed', 'rejected', 'escalated', 'ACKNOWLEDGED'], default: 'created' },
  source: { type: String, enum: ['review', 'maintenance', 'guest_request', 'system', 'staff_observation', 'proactive'], default: 'system' },
  room_number: { type: String },
  assigned_to: { type: String },
  sla_deadline: { type: Date },
  resolution_notes: { type: String },
  sentiment_score: { type: Number },
  evidence_terms: [{ type: String }],
  cluster_id: { type: String },
  is_systemic: { type: Boolean, default: false },
  guest_request_id: { type: String },
  compensation_offered: { type: String },
  relocation_offered: { type: String }
}, { timestamps: true });

OperationalTicketSchema.pre('save', async function() {
  if (!this.ticket_id) {
    const count = await mongoose.model('OperationalTicket').countDocuments();
    this.ticket_id = `TKT-${String(count + 1).padStart(4, '0')}`;
  }
});

export const OperationalTicket = mongoose.model<IOperationalTicket>('OperationalTicket', OperationalTicketSchema);
