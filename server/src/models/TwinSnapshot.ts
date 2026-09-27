import mongoose, { Document, Schema } from 'mongoose';

export interface ITwinSnapshot extends Document {
  timestamp: Date;
  rooms: any;
  bookings: any;
  staff: any;
  guestRequests: any;
  operationalTickets: any;
  incidents: any;
  inventory: any;
  metrics: {
    occupancy: number;
    resilienceScore: number;
    activeRequests: number;
    completedToday: number;
    criticalIncidents: number;
    departmentPressure: any;
  };
}

const TwinSnapshotSchema = new Schema<ITwinSnapshot>({
  timestamp: { type: Date, default: Date.now },
  rooms: { type: Schema.Types.Mixed },
  bookings: { type: Schema.Types.Mixed },
  staff: { type: Schema.Types.Mixed },
  guestRequests: { type: Schema.Types.Mixed },
  operationalTickets: { type: Schema.Types.Mixed },
  incidents: { type: Schema.Types.Mixed },
  inventory: { type: Schema.Types.Mixed },
  metrics: { type: Schema.Types.Mixed }
});

export const TwinSnapshot = mongoose.model<ITwinSnapshot>('TwinSnapshot', TwinSnapshotSchema);
