import mongoose, { Document, Schema } from 'mongoose';

export interface IGuestRequest extends Document {
  request_id: string;
  guest_name: string;
  room_number: string;
  request_text: string;
  intent: string;
  priority: string;
  autonomy_level: string;
  department: string;
  assigned_staff?: string;
  status: string;
  completion_note?: string;
  guest_feedback?: string;
  guest_rating?: number;
  created_at: Date;
  completed_at?: Date;
  sla_target_response_mins?: number;
  sla_target_resolution_mins?: number;
  priority_reason?: string;
  rejection_reason?: string;
  equipment_needed?: string[];
  is_emergency?: boolean;
  resolution_notes?: string;
  compensation_offered?: string;
}

const GuestRequestSchema = new Schema<IGuestRequest>({
  request_id: { type: String, unique: true },
  guest_name: { type: String, required: true },
  room_number: { type: String, required: true },
  request_text: { type: String, required: true },
  intent: { type: String, enum: ['TOWEL', 'PILLOW', 'LINENS', 'CLEANING', 'TOILETRIES', 'ROOM_SERVICE', 'FOOD', 'BEVERAGE', 'MAINTENANCE', 'AC', 'PLUMBING', 'ELECTRICAL', 'WIFI', 'ROOM_CHANGE', 'ACCESSIBILITY', 'MEDICAL', 'SAFETY', 'SECURITY', 'COMPLAINT', 'INFORMATION', 'OTHER'], required: true },
  priority: { type: String, enum: ['P0', 'P1', 'P2', 'P3', 'P4', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'P3' },
  autonomy_level: { type: String, enum: ['AUTO', 'SUPERVISOR', 'MANAGER', 'CRITICAL'], default: 'AUTO' },
  department: { type: String, required: true },
  assigned_staff: { type: String },
  status: { type: String, enum: ['CREATED', 'CLASSIFIED', 'ROUTED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'VERIFICATION_PENDING', 'VERIFIED', 'CANCELLED', 'REJECTED', 'ESCALATED', 'WAITING_FOR_PART', 'received', 'feedback_received'], default: 'CREATED' },
  completion_note: { type: String },
  guest_feedback: { type: String },
  guest_rating: { type: Number, min: 1, max: 5 },
  created_at: { type: Date, default: Date.now },
  completed_at: { type: Date },
  sla_target_response_mins: { type: Number },
  sla_target_resolution_mins: { type: Number },
  priority_reason: { type: String },
  rejection_reason: { type: String },
  equipment_needed: [{ type: String }],
  is_emergency: { type: Boolean, default: false },
  resolution_notes: { type: String },
  compensation_offered: { type: String }
}, { timestamps: true });

GuestRequestSchema.pre('save', async function() {
  if (!this.request_id) {
    const count = await mongoose.model('GuestRequest').countDocuments();
    this.request_id = `GR-${String(count + 1).padStart(4, '0')}`;
  }
});

export const GuestRequest = mongoose.model<IGuestRequest>('GuestRequest', GuestRequestSchema);
