import mongoose, { Document, Schema } from 'mongoose';

export interface IRoom extends Document {
  room_number: string;
  type: string;
  status: string;
  rate_per_night?: number;
  floor?: number;
  last_cleaned?: Date;
  maintenance_notes?: string;
}

const RoomSchema = new Schema<IRoom>({
  room_number: { type: String, unique: true, required: true },
  type: { type: String, enum: ['Standard', 'Deluxe', 'Suite'] },
  status: { type: String, enum: ['available', 'occupied', 'cleaning', 'maintenance', 'out-of-order'], default: 'available' },
  rate_per_night: { type: Number },
  floor: { type: Number },
  last_cleaned: { type: Date },
  maintenance_notes: { type: String }
}, { timestamps: true });

export const Room = mongoose.model<IRoom>('Room', RoomSchema);
