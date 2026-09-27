import mongoose, { Document, Schema } from 'mongoose';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface INotification extends Document {
  recipient_user_id: mongoose.Types.ObjectId;
  recipient_role: string;
  department?: string;
  type: string;
  priority: NotificationPriority;
  title: string;
  message: string;
  source_type: string;
  source_id?: string;
  metadata?: Record<string, unknown>;
  read_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  recipient_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipient_role: { type: String, required: true, index: true },
  department: { type: String, index: true },
  type: { type: String, required: true },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  source_type: { type: String, required: true },
  source_id: { type: String },
  metadata: { type: Schema.Types.Mixed },
  read_at: { type: Date },
}, { timestamps: true });

NotificationSchema.index({ recipient_user_id: 1, read_at: 1, createdAt: -1 });
NotificationSchema.index({ source_type: 1, source_id: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
