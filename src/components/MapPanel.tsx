"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[280px] place-items-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

export function MapPanel({ points, height }: { points: MapPoint[]; height?: number }) {
  return <MapView points={points} height={height} />;
}
