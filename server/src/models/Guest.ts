import mongoose, { Document, Schema } from 'mongoose';

// ============================================================
// Enums / Constants
// ============================================================
export const GUEST_TYPES = ['Regular', 'VIP', 'Corporate', 'Family'] as const;
export const GUEST_STATUSES = ['Reserved', 'Checked In', 'Checked Out', 'Cancelled'] as const;
export const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'] as const;
export const ID_TYPES = ['Passport', 'Aadhaar', 'PAN', 'Driving License', 'Voter ID', 'Other'] as const;
export const ROOM_PREFS = ['Non-Smoking', 'Smoking', 'High Floor', 'Low Floor', 'Pool View', 'Garden View', 'Sea View', 'No Preference'] as const;
export const FOOD_PREFS = ['Vegetarian', 'Vegan', 'Non-Vegetarian', 'Gluten-Free', 'Halal', 'Kosher', 'No Preference'] as const;
export const COMM_PREFS = ['Email', 'Phone', 'WhatsApp', 'In-Person', 'No Preference'] as const;

export type GuestType = (typeof GUEST_TYPES)[number];
export type GuestStatus = (typeof GUEST_STATUSES)[number];

// ============================================================
// Sub-document interfaces
// ============================================================
export interface IPreferences {
  roomPreference?: string;
  foodPreference?: string;
  communicationPreference?: string;
  specialRequests?: string;
}

export interface IEmergencyContact {
  name?: string;
  phone?: string;
  relationship?: string;
}

export interface ICurrentBooking {
  bookingId?: string;
  roomNumber?: string;
  checkIn?: Date;
  checkOut?: Date;
  numberOfGuests?: number;
}

// ============================================================
// Main interface
// ============================================================
export interface IGuest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
  gender?: string;
  idType?: string;
  idNumber?: string;
  guestType: GuestType;
  isVip: boolean;
  status: GuestStatus;
  preferences: IPreferences;
  emergencyContact: IEmergencyContact;
  currentBooking: ICurrentBooking;
  rating?: number;
  totalStays: number;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGuestDocument extends IGuest, Document {}

// ============================================================
// Schema
// ============================================================
const guestSchema = new Schema<IGuestDocument>(
  {
    firstName: { type: String, required: [true, 'First name is required'], trim: true, maxlength: 50 },
    lastName: { type: String, required: [true, 'Last name is required'], trim: true, maxlength: 50 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    phone: { type: String, required: [true, 'Phone is required'], trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: [...GENDER_OPTIONS, ''] },
    idType: { type: String, enum: [...ID_TYPES, ''] },
    idNumber: { type: String, trim: true },
    guestType: { type: String, enum: GUEST_TYPES, default: 'Regular' },
    isVip: { type: Boolean, default: false },
    status: { type: String, enum: GUEST_STATUSES, default: 'Reserved' },
    preferences: {
      roomPreference: { type: String },
      foodPreference: { type: String },
      communicationPreference: { type: String },
      specialRequests: { type: String, maxlength: 500 },
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relationship: { type: String, trim: true },
    },
    currentBooking: {
      bookingId: { type: String, trim: true },
      roomNumber: { type: String, trim: true },
      checkIn: { type: Date },
      checkOut: { type: Date },
      numberOfGuests: { type: Number, min: 1 },
    },
    rating: { type: Number, min: 1, max: 5 },
    totalStays: { type: Number, default: 0 },
    notes: { type: String, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Text index for search
guestSchema.index({ firstName: 'text', lastName: 'text', email: 'text', phone: 'text' });
guestSchema.index({ 'currentBooking.bookingId': 1 });
guestSchema.index({ 'currentBooking.roomNumber': 1 });
guestSchema.index({ status: 1 });
guestSchema.index({ guestType: 1 });

export const Guest = mongoose.model<IGuestDocument>('Guest', guestSchema);
