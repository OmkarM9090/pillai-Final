// ============================================================
// FEATURE 2 — GEOSPATIAL MAP VISUALISATION
// Real Leaflet/OpenStreetMap canvas showing the resort estate, every
// operational zone, live weather exposure, storm position + impact
// propagation rings, and geo-located public social signals.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Polyline, Popup, Tooltip, LayersControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Radio, Waves, Building2, Navigation } from 'lucide-react';

export interface MapZone {
  id: string; name: string; type: string; lat: number; lon: number; radiusM: number;
  status: string; impact: number; department?: string; rooms?: number; capacity?: number;
  criticalAssets?: string[]; actions?: string[]; guestsAffected?: number; revenueAtRisk?: number;
}

export interface MapSocialMarker {
  id: string; lat: number; lon: number; place: string; platform: string; text: string;
  sentiment: string; minutesAgo: number; distanceKm?: number; url?: string;
}

export interface MapStorm { distanceKm: number; bearing: number; severity: number; label?: string }

const STATUS_COLOR: Record<string, string> = {
  NORMAL: '#34d399', WATCH: '#fbbf24', AT_RISK: '#fb923c', CRITICAL: '#f87171',
};

const sentimentColor = (s: string) => (s === 'NEGATIVE' ? '#f87171' : s === 'POSITIVE' ? '#34d399' : '#94a3b8');

function destinationPoint(lat: number, lon: number, distanceKm: number, bearingDeg: number) {
  const R = 6371;
  const brng = (bearingDeg * Math.PI) / 180;
  const la1 = (lat * Math.PI) / 180;
  const lo1 = (lon * Math.PI) / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(distanceKm / R) + Math.cos(la1) * Math.sin(distanceKm / R) * Math.cos(brng));
  const lo2 = lo1 + Math.atan2(Math.sin(brng) * Math.sin(distanceKm / R) * Math.cos(la1), Math.cos(distanceKm / R) - Math.sin(la1) * Math.sin(la2));
  return [(la2 * 180) / Math.PI, (lo2 * 180) / Math.PI] as [number, number];
}

/** Keeps the viewport sensible when the scenario (and therefore the storm) changes. */
function ViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [center[0], center[1], zoom]);
  return null;
}

export default function ResortMap({
  site,
  zones,
  socialMarkers = [],
  contextPoints = [],
  storm,
  height = 460,
  title = 'Geospatial impact map',
  scenarioMode = false,
}: {
  site: { name: string; lat: number; lon: number; city?: string };
  zones: MapZone[];
  socialMarkers?: MapSocialMarker[];
  contextPoints?: Array<{ id: string; name: string; lat: number; lon: number; kind: string }>;
  storm?: MapStorm;
  height?: number;
  title?: string;
  scenarioMode?: boolean;
}) {
  const [showZones, setShowZones] = useState(true);
  const [showSocial, setShowSocial] = useState(true);
  const [showPropagation, setShowPropagation] = useState(true);
  const [tilesOk, setTilesOk] = useState(true);
  const [pulse, setPulse] = useState(0);

  // Animated propagation ring
  useEffect(() => {
    const i = setInterval(() => setPulse((p) => (p + 1) % 100), 90);
    return () => clearInterval(i);
  }, []);

  const center: [number, number] = [site.lat, site.lon];
  const stormPos = useMemo(
    () => (storm ? destinationPoint(site.lat, site.lon, Math.max(0.5, storm.distanceKm), storm.bearing ?? 245) : null),
    [storm?.distanceKm, storm?.bearing, site.lat, site.lon],
  );

  const zoom = storm && storm.distanceKm > 25 ? 11 : storm && storm.distanceKm > 8 ? 13 : 15;
  const worst = zones.reduce((a, z) => (z.impact > a ? z.impact : a), 0);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-cyan-300" />
          <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-200">{title}</h3>
          <span className="hidden md:inline text-[10px] text-slate-500">
            {site.lat.toFixed(4)}°N · {site.lon.toFixed(4)}°E · {zones.length} zones
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { on: showZones, set: setShowZones, label: 'Zones', icon: <Building2 size={12} /> },
            { on: showPropagation, set: setShowPropagation, label: scenarioMode ? 'Propagation' : 'Weather field', icon: <Waves size={12} /> },
            { on: showSocial, set: setShowSocial, label: `Social (${socialMarkers.length})`, icon: <Radio size={12} /> },
          ].map((t) => (
            <button
              key={t.label}
              onClick={() => t.set(!t.on)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                t.on ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200' : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height }} className="relative bg-[#0b1220]">
        {!tilesOk && (
          <div className="pointer-events-none absolute inset-0 z-[400] flex items-end justify-center pb-3">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">
              Offline basemap — vector overlays still live
            </span>
          </div>
        )}
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom
          style={{ height: '100%', width: '100%', background: '#0b1220' }}
          attributionControl={false}
        >
          <ViewController center={center} zoom={zoom} />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Dark">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                eventHandlers={{ tileerror: () => setTilesOk(false), tileload: () => setTilesOk(true) }}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Street">
              <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Weather field / propagation rings */}
          {showPropagation && (
            <>
              {[0.35, 0.65, 1].map((f, i) => (
                <Circle
                  key={`ring-${i}`}
                  center={center}
                  radius={(storm ? 900 + storm.severity * 2600 : 900 + worst * 2200) * f * (1 + ((pulse + i * 33) % 100) / 340)}
                  pathOptions={{
                    color: worst >= 0.7 || (storm?.severity ?? 0) >= 0.7 ? '#f87171' : worst >= 0.45 ? '#fb923c' : '#38bdf8',
                    weight: 1.2,
                    opacity: 0.55 - i * 0.14,
                    fillOpacity: 0.05 - i * 0.012,
                  }}
                />
              ))}
              {stormPos && (
                <>
                  <Polyline
                    positions={[stormPos, center]}
                    pathOptions={{ color: '#f43f5e', weight: 2, dashArray: '8 10', opacity: 0.8 }}
                  />
                  <CircleMarker center={stormPos} radius={11} pathOptions={{ color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.45, weight: 2 }}>
                    <Tooltip permanent direction="top" offset={[0, -8]} className="!bg-slate-900 !border-rose-500/40 !text-rose-200">
                      {storm?.label ?? 'Storm centre'} · {storm?.distanceKm} km
                    </Tooltip>
                    <Popup>
                      <div className="text-xs">
                        <strong>Storm centre</strong>
                        <br /> Distance {storm?.distanceKm} km · bearing {storm?.bearing}°
                        <br /> Severity {(100 * (storm?.severity ?? 0)).toFixed(0)}%
                      </div>
                    </Popup>
                  </CircleMarker>
                </>
              )}
            </>
          )}

          {/* Resort zones */}
          {showZones &&
            zones.map((z) => {
              const color = STATUS_COLOR[z.status] ?? '#38bdf8';
              return (
                <Circle
                  key={z.id}
                  center={[z.lat, z.lon]}
                  radius={z.radiusM}
                  pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.12 + z.impact * 0.35 }}
                >
                  <Tooltip direction="top" offset={[0, -4]}>
                    <span className="text-[11px] font-semibold">{z.name} · {z.status}</span>
                  </Tooltip>
                  <Popup>
                    <div style={{ minWidth: 220 }} className="text-[12px] leading-relaxed">
                      <div className="font-bold">{z.name}</div>
                      <div style={{ color }} className="font-semibold uppercase text-[10px] tracking-wider">
                        {z.status} · exposure {(z.impact * 100).toFixed(0)}%
                      </div>
                      <div className="mt-1 text-slate-600">
                        {z.rooms ? `${z.rooms} rooms · ` : ''}
                        {z.capacity ? `capacity ${z.capacity} · ` : ''}
                        {z.department}
                      </div>
                      {typeof z.guestsAffected === 'number' && z.guestsAffected > 0 && (
                        <div className="mt-1">Guests affected: <strong>{z.guestsAffected}</strong></div>
                      )}
                      {typeof z.revenueAtRisk === 'number' && z.revenueAtRisk > 0 && (
                        <div>Revenue at risk: <strong>₹{z.revenueAtRisk.toLocaleString('en-IN')}</strong></div>
                      )}
                      {!!z.criticalAssets?.length && <div className="mt-1">Assets: {z.criticalAssets.join(', ')}</div>}
                      {!!z.actions?.length && (
                        <ul className="mt-1 list-disc pl-4">
                          {z.actions.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      )}
                    </div>
                  </Popup>
                </Circle>
              );
            })}

          {/* Resort centre */}
          <CircleMarker center={center} radius={8} pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 0.9, weight: 3 }}>
            <Tooltip permanent direction="right" offset={[10, 0]} className="!bg-slate-900 !border-cyan-500/40 !text-cyan-200">
              {site.name}
            </Tooltip>
          </CircleMarker>

          {/* Public social signals */}
          {showSocial &&
            socialMarkers.map((m) => (
              <CircleMarker
                key={m.id}
                center={[m.lat, m.lon]}
                radius={6}
                pathOptions={{ color: sentimentColor(m.sentiment), fillColor: sentimentColor(m.sentiment), fillOpacity: 0.55, weight: 1.5 }}
              >
                <Popup>
                  <div style={{ maxWidth: 260 }} className="text-[12px]">
                    <div className="font-bold">{m.platform} · {m.place}</div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: sentimentColor(m.sentiment) }}>
                      {m.sentiment} · {m.minutesAgo} min ago{m.distanceKm !== undefined ? ` · ${m.distanceKm} km away` : ''}
                    </div>
                    <p className="mt-1">{m.text}</p>
                    {m.url && m.url !== '#' && (
                      <a href={m.url} target="_blank" rel="noreferrer" className="text-sky-600 underline">Open source</a>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}

          {/* Context infrastructure */}
          {contextPoints.map((p) => (
            <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={4} pathOptions={{ color: '#64748b', fillColor: '#94a3b8', fillOpacity: 0.7, weight: 1 }}>
              <Tooltip direction="top">{p.name}</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/5 px-4 py-2.5 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5"><Navigation size={11} className="text-cyan-300" /> Resort</span>
        {Object.entries(STATUS_COLOR).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: v }} /> {k.replace('_', ' ')}
          </span>
        ))}
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Storm centre / negative post</span>
        <span className="ml-auto hidden md:inline">Click any zone or signal for detail · scroll to zoom</span>
      </div>
    </div>
  );
}
