"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMapEvent, Rectangle } from "react-leaflet";
import type { LatLngBounds, LatLngBoundsExpression, Map as LeafletMap, LeafletEvent } from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  bbox?: [number, number, number, number];
  onBbox: (bbox: [number, number, number, number]) => void;
};

function MoveEndCapture({ onBox }: { onBox: (bbox: [number, number, number, number]) => void }) {
  useMapEvent("moveend", (e: LeafletEvent & { target: LeafletMap }) => {
    const b: LatLngBounds = e.target.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    onBox([sw.lng, sw.lat, ne.lng, ne.lat]);
  });
  return null;
}

export function FilterMap({ bbox, onBbox }: Props) {
  const [mounted, setMounted] = useState(false);
  const [basemap, setBasemap] = useState<"osm" | "sat">("osm");
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('appendChild') || event.message?.includes('Leaflet')) {
        setHasError(true);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  const rects: LatLngBoundsExpression[] | undefined = (() => {
    if (!bbox) return undefined;
    let minX = bbox[0];
    const minY = bbox[1];
    let maxX = bbox[2];
    const maxY = bbox[3];
    // Validate numeric and geographic ranges for latitude
    if ([minX, minY, maxX, maxY].some((v) => v == null || !Number.isFinite(v))) return undefined;
    if (minY < -90 || minY > 90 || maxY < -90 || maxY > 90) return undefined;
    // Clamp longitudes to [-180, 180]
    minX = Math.max(-180, Math.min(180, minX));
    maxX = Math.max(-180, Math.min(180, maxX));
    if (minY >= maxY) return undefined;
    // If bbox crosses the anti-meridian, split into two rectangles
    if (minX > maxX) {
      return [
        [[minY, minX], [maxY, 180]] as [[number, number], [number, number]],
        [[minY, -180], [maxY, maxX]] as [[number, number], [number, number]],
      ];
    }
    return [
      [[minY, minX], [maxY, maxX]] as [[number, number], [number, number]],
    ];
  })();
  if (hasError) {
    return (
      <div style={{ height: 360 }} className="flex w-full items-center justify-center bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        <div className="text-center">
          <div>Map temporarily unavailable</div>
          <button 
            onClick={() => setHasError(false)}
            className="mt-2 text-blue-600 hover:text-blue-800"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      {mounted ? (
        <div style={{ height: 360, width: "100%" }}>
          <MapContainer 
            center={[20, 0]} 
            zoom={2} 
            style={{ height: "100%", width: "100%" }} 
            scrollWheelZoom
            key={mounted ? "mounted" : "not-mounted"}
            whenReady={() => {
              // Initial bbox setting handled by MoveEndCapture
            }}
          >
          {basemap === "osm" ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : (
            <TileLayer
              attribution='Imagery © <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          )}
          <MoveEndCapture onBox={onBbox} />
          {rects?.map((r, i) => (
            <Rectangle
              key={i}
              bounds={r}
              pathOptions={{ color: "#ef4444", weight: 3, dashArray: "6 4", fillOpacity: 0.12 }}
            />
          ))}
        </MapContainer>
        </div>
      ) : (
        <div style={{ height: 360 }} className="flex w-full items-center justify-center bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          Loading map…
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <div>Pan/zoom the map. We&apos;ll auto-apply the current view as bbox.</div>
        <div className="flex items-center gap-2">
          <label>Basemap</label>
          <select
            className="rounded border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900"
            value={basemap}
            onChange={(e) => setBasemap(e.target.value as "osm" | "sat")}
          >
            <option value="osm">OSM</option>
            <option value="sat">Satellite</option>
          </select>
        </div>
      </div>
    </div>
  );
}

