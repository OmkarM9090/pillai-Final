import mongoose, { Document, Schema } from 'mongoose';

export interface IStaffRoster extends Document {
  name: string;
  department: string;
  role?: string;
  skills: string[];
  cross_trained: string[];
  shift_start: string;
  shift_end: string;
  max_hours_per_day: number;
  is_available: boolean;
  fatigue_score: number;
  overtime_hours_this_week: number;
  hourly_rate: number;
  current_task_id?: string;
  task_status: string;
}

const StaffRosterSchema = new Schema<IStaffRoster>({
  name: { type: String, required: true },
  department: { type: String, enum: ['housekeeping', 'front_desk', 'fnb', 'maintenance', 'spa', 'security'], required: true },
  role: { type: String },
  skills: [{ type: String }],
  cross_trained: [{ type: String }],
  shift_start: { type: String, default: "08:00" },
  shift_end: { type: String, default: "16:00" },
  max_hours_per_day: { type: Number, default: 8 },
  is_available: { type: Boolean, default: true },
  fatigue_score: { type: Number, default: 20, min: 0, max: 100 },
  overtime_hours_this_week: { type: Number, default: 0 },
  hourly_rate: { type: Number, default: 18 },
  current_task_id: { type: String },
  task_status: { type: String, enum: ['idle', 'assigned', 'in_progress', 'completed'], default: 'idle' }
}, { timestamps: true });

export const StaffRoster = mongoose.model<IStaffRoster>('StaffRoster', StaffRosterSchema);
