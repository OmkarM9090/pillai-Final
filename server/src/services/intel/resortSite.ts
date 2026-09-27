// ============================================================
// Smart Resort 360 — Physical site model (geospatial digital twin base)
// Every zone below is a real coordinate on the resort estate and is used by:
//   • the map visualisation (Feature 2)
//   • the weather impact propagation engine (Feature 4)
//   • the AI copilot grounding context (Feature 5)
// ============================================================

export interface ResortZone {
  id: string;
  name: string;
  type: 'accommodation' | 'outdoor' | 'dining' | 'access' | 'utility' | 'wellness' | 'events';
  lat: number;
  lon: number;
  radiusM: number;
  /** Metres above mean sea level — drives flood exposure. */
  elevationM: number;
  /** 0 = fully sheltered/indoor, 1 = fully exposed to wind & rain. */
  exposure: number;
  /** Rooms served by this zone (accommodation only). */
  rooms?: number;
  /** Guest capacity of the zone. */
  capacity: number;
  /** Revenue per operating hour (INR ×100 units used for GOPPAR-style deltas). */
  revenuePerHour: number;
  department: string;
  criticalAssets: string[];
}

export const RESORT_SITE = {
  name: 'Smart Resort 360',
  city: 'Navi Mumbai',
  region: 'Maharashtra, India',
  lat: 19.033,
  lon: 73.029,
  timezone: 'Asia/Kolkata',
  totalRooms: 50,
  /** Climatological reference used by the offline physics fallback. */
  climate: 'tropical-monsoon',
};

export const RESORT_ZONES: ResortZone[] = [
  {
    id: 'main-tower',
    name: 'Main Tower (Rooms 101–330)',
    type: 'accommodation',
    lat: 19.0332,
    lon: 73.0292,
    radiusM: 90,
    elevationM: 11,
    exposure: 0.2,
    rooms: 30,
    capacity: 63,
    revenuePerHour: 1850,
    department: 'housekeeping',
    criticalAssets: ['Chiller Plant A', 'Lift Bank 1-2', 'Tower UPS'],
  },
  {
    id: 'beach-villas',
    name: 'Beachfront Villas (Rooms 401–420)',
    type: 'accommodation',
    lat: 19.0301,
    lon: 73.0331,
    radiusM: 110,
    elevationM: 3,
    exposure: 0.95,
    rooms: 20,
    capacity: 42,
    revenuePerHour: 2600,
    department: 'housekeeping',
    criticalAssets: ['Villa DG Set', 'Shoreline Retaining Wall', 'Villa AHU-3'],
  },
  {
    id: 'pool-deck',
    name: 'Infinity Pool Deck',
    type: 'outdoor',
    lat: 19.0324,
    lon: 73.0311,
    radiusM: 60,
    elevationM: 6,
    exposure: 0.9,
    capacity: 120,
    revenuePerHour: 900,
    department: 'fnb',
    criticalAssets: ['Pool Filtration Pump', 'Deck Lighting Circuit'],
  },
  {
    id: 'banquet-lawn',
    name: 'Grand Banquet Lawn',
    type: 'events',
    lat: 19.0345,
    lon: 73.0271,
    radiusM: 95,
    elevationM: 5,
    exposure: 1.0,
    capacity: 400,
    revenuePerHour: 4200,
    department: 'fnb',
    criticalAssets: ['Marquee Rigging', 'Stage Power Distribution'],
  },
  {
    id: 'shoreline-restaurant',
    name: 'Shoreline Restaurant & Bar',
    type: 'dining',
    lat: 19.0309,
    lon: 73.0318,
    radiusM: 55,
    elevationM: 4,
    exposure: 0.75,
    capacity: 180,
    revenuePerHour: 2100,
    department: 'fnb',
    criticalAssets: ['Kitchen Exhaust', 'Cold Room Compressor'],
  },
  {
    id: 'spa-wellness',
    name: 'Serenity Spa & Wellness',
    type: 'wellness',
    lat: 19.0338,
    lon: 73.0308,
    radiusM: 45,
    elevationM: 9,
    exposure: 0.25,
    capacity: 40,
    revenuePerHour: 1200,
    department: 'spa',
    criticalAssets: ['Steam Boiler', 'Spa Water Heater'],
  },
  {
    id: 'access-road',
    name: 'Palm Access Road & Porch',
    type: 'access',
    lat: 19.0356,
    lon: 73.0296,
    radiusM: 130,
    elevationM: 2,
    exposure: 0.85,
    capacity: 0,
    revenuePerHour: 0,
    department: 'front_desk',
    criticalAssets: ['Storm Drain Grid', 'Boom Barrier', 'Porch Canopy'],
  },
  {
    id: 'utility-block',
    name: 'Utility & Power Block',
    type: 'utility',
    lat: 19.0349,
    lon: 73.0316,
    radiusM: 40,
    elevationM: 7,
    exposure: 0.4,
    capacity: 0,
    revenuePerHour: 0,
    department: 'maintenance',
    criticalAssets: ['HT Panel', 'Diesel Generator 250kVA', 'Water Pump House'],
  },
];

/** Nearby real-world reference points shown on the map for context. */
export const CONTEXT_POINTS = [
  { id: 'jnpt', name: 'JNPT Port', lat: 18.9490, lon: 72.9520, kind: 'infrastructure' },
  { id: 'panvel', name: 'Panvel Junction', lat: 18.9894, lon: 73.1175, kind: 'transport' },
  { id: 'vashi', name: 'Vashi Bridge', lat: 19.0656, lon: 72.9990, kind: 'transport' },
  { id: 'airport', name: 'NMIA (Navi Mumbai Intl.)', lat: 18.9894, lon: 73.0700, kind: 'transport' },
  { id: 'belapur', name: 'CBD Belapur', lat: 19.0154, lon: 73.0374, kind: 'city' },
];

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return Number((2 * R * Math.asin(Math.sqrt(h))).toFixed(2));
}
