import mongoose, { Document, Schema } from 'mongoose';

/**
 * Staff on-site observation.
 * A worker visits a room for one task and discovers another issue
 * (e.g. delivering a towel, notices "AC leaking + sink blocked").
 * The observation is persisted beside the staff member, the task and the
 * room, is visible to managers immediately, and — when it describes an
 * actionable operational issue — spawns a routed OperationalTicket.
 */
export interface IObservation extends Document {
  observation_id: string;
  task_type: 'GuestRequest' | 'OperationalTicket' | 'NONE';
  task_id?: string;          // external id (GR-xxxx / TKT-xxxx)
  task_title?: string;
  staff_name: string;
  room_number?: string;
  department?: string;       // department the observation was routed to
  intent?: string;           // NLP-classified intent of the observation text
  priority?: string;
  note: string;
  routed_ticket_id?: string; // OperationalTicket created from this observation
  status: 'NEW' | 'ROUTED' | 'ACKNOWLEDGED';
  createdAt: Date;
  updatedAt: Date;
}

const ObservationSchema = new Schema<IObservation>({
  observation_id: { type: String, unique: true },
  task_type: { type: String, enum: ['GuestRequest', 'OperationalTicket', 'NONE'], default: 'NONE' },
  task_id: { type: String, index: true },
  task_title: { type: String },
  staff_name: { type: String, required: true, index: true },
  room_number: { type: String, index: true },
  department: { type: String },
  intent: { type: String },
  priority: { type: String },
  note: { type: String, required: true, maxlength: 1000 },
  routed_ticket_id: { type: String },
  status: { type: String, enum: ['NEW', 'ROUTED', 'ACKNOWLEDGED'], default: 'NEW', index: true },
}, { timestamps: true });

ObservationSchema.pre('save', async function (this: any) {
  if (!this.observation_id) {
    const count = await mongoose.model('Observation').countDocuments();
    this.observation_id = `OBS-${String(count + 1).padStart(4, '0')}`;
  }
});

export const Observation = mongoose.model<IObservation>('Observation', ObservationSchema);
