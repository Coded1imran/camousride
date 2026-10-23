"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  kind?: "pickup" | "destination" | "driver";
}

const COLORS: Record<string, string> = {
  pickup: "#059669",
  destination: "#2563eb",
  driver: "#f59e0b",
};

export default function MapView({ points, height = 280 }: { points: MapPoint[]; height?: number }) {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const center: [number, number] = valid.length
    ? [valid[0].lat, valid[0].lng]
    : [6.5158, 3.3898];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
      <MapContainer center={center} zoom={16} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {valid.map((p, i) => (
          <CircleMarker
            key={`${p.lat}-${p.lng}-${i}`}
            center={[p.lat, p.lng]}
            radius={10}
            pathOptions={{ color: COLORS[p.kind ?? "pickup"] ?? "#059669", fillOpacity: 0.85 }}
          >
            <Popup>
              <span className="text-sm font-medium">{p.label}</span>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
