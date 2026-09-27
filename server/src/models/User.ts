import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, ALL_ROLES, DEPARTMENTS, BCRYPT_SALT_ROUNDS, type Role } from '../config/constants';

// ============================================================
// Interface for typed document
// ============================================================
export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  department?: string;
  staffId?: mongoose.Types.ObjectId;
  guestId?: mongoose.Types.ObjectId;
  guestRoomNumber?: string;
  bookingReference?: string;
  vendorId?: mongoose.Types.ObjectId;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  toSafeJSON(): Record<string, unknown>;
}

// ============================================================
// Schema
// ============================================================
const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must not exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Never return passwordHash by default
    },
    role: {
      type: String,
      enum: {
        values: ALL_ROLES,
        message: `Role must be one of: ${ALL_ROLES.join(', ')}`,
      },
      required: [true, 'Role is required'],
      default: ROLES.MANAGER,
    },
    department: {
      type: String,
      enum: {
        values: DEPARTMENTS,
        message: `Department must be one of: ${DEPARTMENTS.join(', ')}`,
      },
      trim: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'StaffRoster',
    },
    guestId: {
      type: Schema.Types.ObjectId,
      ref: 'Guest',
    },
    // Guest portal identity is tied to the authenticated account and an active
    // booking reference; room number is never used as the only credential.
    guestRoomNumber: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    bookingReference: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[+\d\s\-().]{7,20}$/, 'Please provide a valid phone number'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc: Document, ret: Record<string, unknown>) => {
        ret['passwordHash'] = undefined;
        ret['__v'] = undefined;
        return ret;
      },
    },
  }
);

// ============================================================
// Indexes
// ============================================================
// role and isActive indexes (email unique index is already defined via unique:true in field)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// ============================================================
// Pre-save hook: hash password if modified
// ============================================================
userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) {
    return;
  }
  const doc = this as unknown as IUserDocument;
  doc.passwordHash = await bcrypt.hash(doc.passwordHash, BCRYPT_SALT_ROUNDS);
});

// ============================================================
// Instance methods
// ============================================================
userSchema.methods['comparePassword'] = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this['passwordHash'] as string);
};

userSchema.methods['toSafeJSON'] = function (): Record<string, unknown> {
  const obj = this.toObject() as Record<string, unknown>;
  obj['passwordHash'] = undefined;
  obj['__v'] = undefined;
  return obj;
};

export const User = mongoose.model<IUserDocument>('User', userSchema);
