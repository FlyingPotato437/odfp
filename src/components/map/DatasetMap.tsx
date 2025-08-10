"use client";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Rectangle } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  bbox?: [number, number, number, number];
  height?: number;
};

export function DatasetMap({ bbox, height = 260 }: Props) {
  const [mounted, setMounted] = useState(false);
  const [basemap, setBasemap] = useState<"osm" | "sat">("osm");
  useEffect(() => setMounted(true), []);

  const rect: LatLngBoundsExpression | undefined = useMemo(() => {
    if (!bbox) return undefined;
    const [minX, minY, maxX, maxY] = bbox;
    if ([minX, minY, maxX, maxY].some(v => v == null || !Number.isFinite(v))) return undefined;
    if (minX >= maxX || minY >= maxY) return undefined;
    if (
      minY < -90 || minY > 90 ||
      maxY < -90 || maxY > 90 ||
      minX < -180 || minX > 180 ||
      maxX < -180 || maxX > 180
    ) return undefined;
    return [
      [minY, minX],
      [maxY, maxX],
    ] as [[number, number], [number, number]];
  }, [bbox]);

  const center = useMemo(() => {
    if (!bbox) return [20, 0] as [number, number];
    const [minX, minY, maxX, maxY] = bbox;
    if ([minX, minY, maxX, maxY].some(v => v == null || !Number.isFinite(v))) return [20, 0];
    const lat = (minY + maxY) / 2;
    const lon = (minX + maxX) / 2;
    return [lat, lon] as [number, number];
  }, [bbox]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      {mounted ? (
        <MapContainer center={center} zoom={bbox ? 3 : 2} style={{ height, width: "100%" }} scrollWheelZoom={false} dragging={true} zoomControl={true}>
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
          {rect && <Rectangle bounds={rect} pathOptions={{ color: "#2563eb", weight: 2 }} />}
        </MapContainer>
      ) : (
        <div style={{ height }} className="flex w-full items-center justify-center bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          Loading map…
        </div>
      )}
      <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <label className="mr-2">Basemap</label>
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
  );
}

