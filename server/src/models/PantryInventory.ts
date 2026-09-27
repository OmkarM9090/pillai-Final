import mongoose, { Document, Schema } from 'mongoose';

export interface IPantryInventory extends Document {
  item_name: string;
  category?: string;
  current_stock_kg: number;
  safety_threshold_kg: number;
  unit_cost?: number;
  supplier?: string;
  lead_time_days: number;
  last_replenished?: Date;
  daily_consumption_rate_kg: number;
}

const PantryInventorySchema = new Schema<IPantryInventory>({
  item_name: { type: String, unique: true, required: true },
  category: { type: String },
  current_stock_kg: { type: Number, required: true },
  safety_threshold_kg: { type: Number, required: true },
  unit_cost: { type: Number },
  supplier: { type: String },
  lead_time_days: { type: Number, default: 2 },
  last_replenished: { type: Date },
  daily_consumption_rate_kg: { type: Number, required: true }
}, { timestamps: true });

export const PantryInventory = mongoose.model<IPantryInventory>('PantryInventory', PantryInventorySchema);
