import mongoose, { Document, Schema } from 'mongoose';

export interface IGuestConversation extends Document {
  guest_id: string;
  room_number: string;
  message: string;
  response: string;
  intent: string;
  category: string;
  priority: string;
  autonomy_level: string;
  request_id: string;
  status: string;
  estimated_minutes: number;
  created_at: Date;
}

const GuestConversationSchema = new Schema<IGuestConversation>({
  guest_id: { type: String, required: true },
  room_number: { type: String, required: true },
  message: { type: String, required: true },
  response: { type: String, required: true },
  intent: { type: String, required: true },
  category: { type: String, required: true },
  priority: { type: String, required: true },
  autonomy_level: { type: String, required: true },
  request_id: { type: String },
  status: { type: String, required: true },
  estimated_minutes: { type: Number, required: true },
  created_at: { type: Date, default: Date.now }
});

export const GuestConversation = mongoose.model<IGuestConversation>('GuestConversation', GuestConversationSchema);
