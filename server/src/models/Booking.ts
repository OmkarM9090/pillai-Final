import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  guest_name: string;
  room_number: string;
  check_in: Date;
  check_out: Date;
  status: string;
  guests_count: number;
  rate_locked?: number;
  source: string;
  special_requests?: string;
}

const BookingSchema = new Schema<IBooking>({
  guest_name: { type: String, required: true },
  room_number: { type: String, required: true },
  check_in: { type: Date, required: true },
  check_out: { type: Date, required: true },
  status: { type: String, enum: ['confirmed', 'checked-in', 'checked-out', 'cancelled'], default: 'confirmed' },
  guests_count: { type: Number, default: 2 },
  rate_locked: { type: Number },
  source: { type: String, default: 'direct' },
  special_requests: { type: String }
}, { timestamps: true });

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
