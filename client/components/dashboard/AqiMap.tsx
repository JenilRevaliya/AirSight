import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MapPin, RotateCcw } from "lucide-react";
import { categoryColor } from "@/lib/aqi";
import type { AqiMapResponse } from "@shared/api";

type PollutantKey = import("@shared/api").PollutantKey;

type FilterKey = PollutantKey | "aqi";

interface AqiMapProps {
  center: { lat: number; lon: number } | null;
  filter: FilterKey;
}

// Component to handle map center updates without forcing re-renders
function MapCenterController({ center, shouldUpdate }: { center: [number, number]; shouldUpdate: boolean }) {
  const map = useMap();
  
  useEffect(() => {
    if (shouldUpdate) {
      map.setView(center, map.getZoom());
    }
  }, [map, center, shouldUpdate]);
  
  return null;
}

// Component to handle map events
function MapEventHandler({ onMoveStart }: { onMoveStart: () => void }) {
  const map = useMap();
  
  useEffect(() => {
    map.on('movestart', onMoveStart);
    return () => {
      map.off('movestart', onMoveStart);
    };
  }, [map, onMoveStart]);
  
  return null;
}

const pollutantColors: Record<PollutantKey, string> = {
  pm25: "#34C759",
  pm10: "#A3E635",
  o3: "#0EA5E9",
  no2: "#F97316",
  co: "#737373",
  so2: "#A855F7",
};

const pollutantLabels: Record<FilterKey, string> = {
  aqi: "Overall AQI",
  pm25: "PM2.5",
  pm10: "PM10",
  o3: "Ozone",
  no2: "Nitrogen Dioxide",
  co: "Carbon Monoxide",
  so2: "Sulfur Dioxide",
};

function getMarkerColor(
  filter: FilterKey,
  point: AqiMapResponse["points"][number],
) {
  if (filter === "aqi") {
    return categoryColor(point.category) ?? "#0EA5E9";
  }
  return pollutantColors[filter];
}

function getMarkerRadius(
  filter: FilterKey,
  point: AqiMapResponse["points"][number],
) {
  if (filter === "aqi") {
    return Math.max(6, Math.min(18, point.aqi / 12));
  }
  const value = point.pollutants[filter]?.value ?? 0;
  return Math.max(6, Math.min(16, value / 5));
}

export function AqiMap({ center, filter }: AqiMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.7128, -74.0060]); // Default to NYC
  const [shouldUpdateCenter, setShouldUpdateCenter] = useState(true);
  const [userHasPanned, setUserHasPanned] = useState(false);
  
  const query = useQuery<AqiMapResponse>({
    queryKey: ["aqi-map", center?.lat, center?.lon],
    enabled: !!center,
    staleTime: 60_000,
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: String(center!.lat),
        lon: String(center!.lon),
        radius: "40",
        limit: "80",
      });
      const response = await fetch(`/api/aqi-map?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load map data");
      return (await response.json()) as AqiMapResponse;
    },
  });
  
  // Update map center only when explicitly requested or on first load
  useEffect(() => {
    if (center && !userHasPanned) {
      setMapCenter([center.lat, center.lon]);
      setShouldUpdateCenter(true);
    } else {
      setShouldUpdateCenter(false);
    }
  }, [center, userHasPanned]);
  
  const handleRecenterMap = () => {
    if (center) {
      setMapCenter([center.lat, center.lon]);
      setShouldUpdateCenter(true);
      setUserHasPanned(false);
    }
  };
  
  const handleMapMove = () => {
    setUserHasPanned(true);
    setShouldUpdateCenter(false);
  };

  const points = query.data?.points ?? [];
  const hasData = points.length > 0;

  if (!center) {
    return <Skeleton className="h-[360px] w-full rounded-lg" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{pollutantLabels[filter]}</span>
        <div className="flex items-center gap-2">
          {userHasPanned && center && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecenterMap}
              className="h-7 px-2 text-xs"
            >
              <MapPin className="mr-1 h-3 w-3" />
              Recenter
            </Button>
          )}
          {query.isFetching && <span>Refreshing…</span>}
        </div>
      </div>
      <div className="relative h-[360px] w-full overflow-hidden rounded-xl border bg-background/80">
        {query.isError && (
          <Alert variant="destructive" className="absolute inset-4 z-10">
            <AlertDescription>
              Unable to load nearby monitoring sites.
            </AlertDescription>
          </Alert>
        )}
        <MapContainer
          center={mapCenter}
          zoom={10}
          className="h-full w-full"
          zoomControl={false}
          scrollWheelZoom
        >
          <MapCenterController center={mapCenter} shouldUpdate={shouldUpdateCenter} />
          <MapEventHandler onMoveStart={handleMapMove} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((point) => {
            const position: [number, number] = [
              point.coordinates.lat,
              point.coordinates.lon,
            ];
            const color = getMarkerColor(filter, point);
            const radius = getMarkerRadius(filter, point);
            const value =
              filter === "aqi"
                ? point.aqi
                : (point.pollutants[filter]?.value ?? null);
            return (
              <CircleMarker
                key={point.id}
                center={position}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.65 }}
                radius={radius}
                stroke
              >
                <Popup>
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold">{point.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[point.city, point.country].filter(Boolean).join(", ")}
                    </div>
                    <div className="mt-2 grid gap-1 text-xs">
                      <div>
                        <span className="font-medium">AQI:</span> {point.aqi} (
                        {point.category})
                      </div>
                      {value !== null && filter !== "aqi" && (
                        <div>
                          <span className="font-medium">
                            {pollutantLabels[filter]}:
                          </span>{" "}
                          {value?.toFixed?.(1) ?? value}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Dominant pollutant:</span>{" "}
                        {point.dominantPollutant?.toUpperCase() ?? "--"}
                      </div>
                      <div>
                        <span className="font-medium">Last updated:</span>{" "}
                        {new Date(point.lastUpdated).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      {!hasData && !query.isLoading && !query.isError && (
        <Alert className="bg-muted/50">
          <AlertDescription>
            No monitoring sites found nearby. Try increasing the search radius
            or selecting another region.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
