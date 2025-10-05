import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type {
  AqiCategory,
  AqiPredictResponse,
  PollutantKey,
  ValidationResponse,
} from "@shared/api";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
import { categoryColor } from "@/lib/aqi";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AqiDial } from "@/components/AqiDial";
import { ComparePanel } from "@/components/validation/ComparePanel";
import { LocationPanel } from "@/components/dashboard/LocationPanel";
import { AqiMap } from "@/components/dashboard/AqiMap";
import {
  useDashboardRegions,
  type DashboardRegion,
} from "@/hooks/useDashboardRegions";

function categoryFromValue(value: number): AqiCategory {
  if (value <= 50) return "Good";
  if (value <= 100) return "Moderate";
  if (value <= 150) return "Unhealthy for Sensitive Groups";
  if (value <= 200) return "Unhealthy";
  if (value <= 300) return "Very Unhealthy";
  return "Hazardous";
}

type FilterKey = "aqi" | PollutantKey;

const FILTER_OPTIONS: { value: FilterKey; label: string }[] = [
  { value: "aqi", label: "Overall AQI" },
  { value: "pm25", label: "PM2.5" },
  { value: "pm10", label: "PM10" },
  { value: "o3", label: "Ozone" },
  { value: "no2", label: "NO₂" },
  { value: "so2", label: "SO₂" },
  { value: "co", label: "CO" },
];

const HEALTH_RECOMMENDATIONS: Record<
  AqiCategory,
  { summary: string; actions: string[] }
> = {
  Good: {
    summary: "Air quality is excellent.",
    actions: ["Enjoy outdoor activities without restrictions."],
  },
  Moderate: {
    summary: "Air quality is acceptable.",
    actions: [
      "Sensitive groups should monitor symptoms during prolonged outdoor exertion.",
    ],
  },
  "Unhealthy for Sensitive Groups": {
    summary: "Sensitive individuals should reduce prolonged or heavy exertion.",
    actions: [
      "Limit outdoor exercise if you have asthma or heart/lung disease.",
      "Keep medication and rescue inhalers nearby.",
    ],
  },
  Unhealthy: {
    summary: "Reduce outdoor activity and seek cleaner air indoors.",
    actions: [
      "Close windows and use air purifiers if available.",
      "Wear a properly fitted mask when air quality is poor outdoors.",
      "Check on children, seniors, and those with respiratory conditions.",
    ],
  },
  "Very Unhealthy": {
    summary: "Health warnings for everyone.",
    actions: [
      "Avoid outdoor exertion; remain indoors with filtered air.",
      "Use N95 masks if you must travel outside.",
      "Monitor symptoms such as coughing, shortness of breath, or chest pain.",
    ],
  },
  Hazardous: {
    summary: "Emergency conditions for the entire population.",
    actions: [
      "Stay indoors with HEPA filtration or relocate to a cleaner area if possible.",
      "Follow local public health advisories and evacuation guidance.",
      "Seek medical attention if breathing becomes difficult.",
    ],
  },
};

const ALERT_LEVELS: AqiCategory[] = [
  "Unhealthy for Sensitive Groups",
  "Unhealthy",
  "Very Unhealthy",
  "Hazardous",
];

const NYC_COORDINATES = { lat: 40.7128, lon: -74.006 };

function formatCoordinate(value: number) {
  return value.toFixed(2);
}

function regionFromCoordinates(
  lat: number,
  lon: number,
  label = `Current location (${formatCoordinate(lat)}, ${formatCoordinate(lon)})`,
): DashboardRegion {
  return {
    id: `geo:${lat.toFixed(3)},${lon.toFixed(3)}`,
    name: "Current location",
    label,
    lat,
    lon,
    country: null,
    admin: null,
  };
}

function useCurrentLocation() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setCoords(NYC_COORDINATES);
      setLocating(false);
      return Promise.resolve(NYC_COORDINATES);
    }
    setLocating(true);
    return new Promise<{ lat: number; lon: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          setCoords(next);
          setLocating(false);
          resolve(next);
        },
        () => {
          setCoords(NYC_COORDINATES);
          setLocating(false);
          resolve(NYC_COORDINATES);
        },
        { enableHighAccuracy: true, timeout: 8_000 },
      );
    });
  }, []);

  // Don't automatically request location on page load since we default to NYC
  // useEffect(() => {
  //   request();
  // }, [request]);

  return { coords, locating, request };
}

export default function Dashboard() {
  const { coords: currentCoords, locating, request } = useCurrentLocation();
  const {
    regions,
    activeRegion,
    isTemporary,
    activateRegion,
    selectExisting,
    removeRegion,
    persistTemporary,
  } = useDashboardRegions();
  const [mapFilter, setMapFilter] = useState<FilterKey>("aqi");

  useEffect(() => {
    if (currentCoords && !activeRegion) {
      activateRegion(regionFromCoordinates(currentCoords.lat, currentCoords.lon), {
        persist: false,
      });
    }
  }, [currentCoords, activeRegion, activateRegion]);

  const focus = activeRegion
    ? { lat: activeRegion.lat, lon: activeRegion.lon }
    : currentCoords;

  const { data: combo, error: comboError, isLoading: comboLoading } = useQuery<AqiPredictResponse>({
    queryKey: ["aqi-predict", focus?.lat, focus?.lon],
    enabled: !!focus,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/aqi-predict?lat=${focus!.lat}&lon=${focus!.lon}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch AQI data: ${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as AqiPredictResponse;
      try {
        localStorage.setItem("airsight:lastAqi", JSON.stringify(json.aqi));
      } catch {}
      return json;
    },
    placeholderData: (previous) => previous,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const aqi = combo?.aqi;
  const pred = combo?.predict;

  const { data: validation, error: validationError, isLoading: validationLoading } = useQuery<ValidationResponse>({
    queryKey: ["validate", focus?.lat, focus?.lon],
    enabled: !!focus,
    queryFn: async () => {
      const res = await fetch(`/api/validate?lat=${focus!.lat}&lon=${focus!.lon}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch validation data: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as ValidationResponse;
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const trend24h = useMemo(() => {
    if (!pred) return [] as { time: string; aqi: number }[];
    const now = Date.now();
    return pred.series
      .filter((point) => {
        const diff = (new Date(point.ts).getTime() - now) / 3_600_000;
        return diff >= 0 && diff <= 24;
      })
      .map((point) => ({
        time: new Date(point.ts).toLocaleTimeString([], { hour: "numeric" }),
        aqi: point.aqi,
      }));
  }, [pred]);

  const forecast72h = useMemo(() => {
    if (!pred) return [] as { label: string; aqi: number; category: AqiCategory }[];
    const now = Date.now();
    return pred.series
      .filter((point) => {
        const diff = (new Date(point.ts).getTime() - now) / 3_600_000;
        return diff >= 0 && diff <= 72;
      })
      .map((point) => ({
        label: new Date(point.ts).toLocaleString([], {
          weekday: "short",
          hour: "numeric",
        }),
        aqi: point.aqi,
        category: categoryFromValue(point.aqi),
      }));
  }, [pred]);

  const pollutants = useMemo(() => {
    if (!aqi) return [] as { name: string; key: PollutantKey; value: number; fill: string }[];
    const readings = aqi.pollutants;
    return [
      { name: "PM2.5", key: "pm25", value: readings.pm25.value || 0, fill: "var(--color-pm25)" },
      { name: "PM10", key: "pm10", value: readings.pm10.value || 0, fill: "var(--color-pm10)" },
      { name: "Ozone", key: "o3", value: readings.o3.value || 0, fill: "var(--color-o3)" },
      { name: "NO₂", key: "no2", value: readings.no2.value || 0, fill: "var(--color-no2)" },
      { name: "CO", key: "co", value: readings.co.value || 0, fill: "var(--color-co)" },
      { name: "SO₂", key: "so2", value: readings.so2.value || 0, fill: "var(--color-so2)" },
    ];
  }, [aqi]);

  const healthAdvice = aqi ? HEALTH_RECOMMENDATIONS[aqi.category] : null;
  const showAlert = aqi ? ALERT_LEVELS.includes(aqi.category) : false;
  const alertVariant = aqi?.category === "Unhealthy for Sensitive Groups" ? "default" : "destructive";
  const alertClassName =
    aqi?.category === "Unhealthy for Sensitive Groups"
      ? "border-amber-400/70 bg-amber-500/10 text-amber-100"
      : undefined;

  const handleUseCurrent = useCallback(async () => {
    const next = await request();
    if (!next) return;
    activateRegion(regionFromCoordinates(next.lat, next.lon), { persist: false });
  }, [request, activateRegion]);

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>Regional explorer</CardTitle>
          <CardDescription>
            Search for any location to compare satellite and ground readings, then explore nearby monitoring sites on the live map.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LocationPanel
            activeRegion={activeRegion}
            savedRegions={regions}
            isTemporary={isTemporary}
            coordinates={currentCoords}
            locating={locating}
            onRegionSelect={activateRegion}
            onSavedSelect={selectExisting}
            onRemoveRegion={removeRegion}
            onUseCurrent={handleUseCurrent}
            onPersistTemporary={persistTemporary}
          />

          {/* API Error Alerts */}
          {comboError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Failed to load air quality data</AlertTitle>
              <AlertDescription>
                {comboError.message}. Please check your connection and try again.
              </AlertDescription>
            </Alert>
          )}
          
          {validationError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Failed to load validation data</AlertTitle>
              <AlertDescription>
                {validationError.message}. Validation features may not be available.
              </AlertDescription>
            </Alert>
          )}

          {/* Loading States */}
          {(comboLoading || validationLoading) && focus && (
            <Alert>
              <AlertTitle>Loading air quality data...</AlertTitle>
              <AlertDescription>
                Fetching the latest measurements for {activeRegion?.name || 'your location'}.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
              type="single"
              value={mapFilter}
              onValueChange={(value) => value && setMapFilter(value as FilterKey)}
              variant="outline"
              size="sm"
              className="flex flex-wrap gap-2"
            >
              {FILTER_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={option.label}
                  className="min-w-[88px] justify-center"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              Pins reflect the latest measurements for the selected pollutant.
            </p>
          </div>

          <AqiMap center={focus ?? null} filter={mapFilter} />
        </CardContent>
      </Card>

      {showAlert && aqi && (
        <Alert variant={alertVariant} className={alertClassName}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Air quality alert — {aqi.category}</AlertTitle>
          <AlertDescription>
            {aqi.category === "Unhealthy for Sensitive Groups"
              ? "Sensitive individuals should limit prolonged outdoor activity and monitor symptoms."
              : "Air quality is deteriorating. Reduce outdoor exposure, use filtered indoor air, and check on vulnerable groups."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Air Quality Index</CardTitle>
            <CardDescription>Live AQI level for the selected region.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <AqiDial value={aqi?.aqi} category={aqi?.category} />
            <div className="text-sm text-muted-foreground">
              Dominant pollutant: {aqi?.dominantPollutant?.toUpperCase() ?? "--"}
            </div>
            <div className="text-xs text-muted-foreground">
              Last updated: {aqi ? new Date(aqi.lastUpdated).toLocaleString() : "--"}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Next 24 hours</CardTitle>
            <CardDescription>Projected hourly AQI trend over the next day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                aqi: { label: "AQI", color: "hsl(var(--primary))" },
              }}
              className="aspect-[16/6]"
            >
              <AreaChart data={trend24h}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="time" tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 500]} />
                <Area
                  dataKey="aqi"
                  type="monotone"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary)/.2)"
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>72-hour outlook</CardTitle>
            <CardDescription>A dynamic forecast for the next three days.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                aqi: { label: "AQI", color: "hsl(var(--accent))" },
              }}
              className="aspect-[16/6]"
            >
              <LineChart data={forecast72h}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis hide domain={[0, 500]} />
                <Line
                  type="monotone"
                  dataKey="aqi"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  dot={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => [`AQI ${value}`, "72h forecast"]}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Health guidance</CardTitle>
            <CardDescription>
              Personalized recommendations based on the current AQI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {healthAdvice ? (
              <>
                <p className="font-medium text-primary">{healthAdvice.summary}</p>
                <ul className="space-y-2 text-muted-foreground">
                  {healthAdvice.actions.map((action) => (
                    <li key={action} className="flex gap-2">
                      <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-primary/80" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-muted-foreground">Select a region to view tailored guidance.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Pollutant breakdown</CardTitle>
            <CardDescription>Concentrations by pollutant in µg/m³.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                pm25: { label: "PM2.5", color: "#34C759" },
                pm10: { label: "PM10", color: "#ADFF2F" },
                o3: { label: "Ozone", color: "#5AC8FA" },
                no2: { label: "NO₂", color: "#FF9500" },
                co: { label: "CO", color: "#8E8E93" },
                so2: { label: "SO₂", color: "#AF52DE" },
              }}
              className="aspect-square"
            >
              <RadialBarChart
                innerRadius="35%"
                outerRadius="80%"
                data={pollutants}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, Math.max(1, ...pollutants.map((p) => p.value))]}
                  tick={false}
                />
                <RadialBar background dataKey="value" cornerRadius={6} />
                <ChartLegend content={<ChartLegendContent />} />
                <ChartTooltip content={<ChartTooltipContent />} />
              </RadialBarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weather snapshot</CardTitle>
            <CardDescription>Conditions influencing local dispersion.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              Temp: <span className="font-mono">{aqi?.weather.temperatureC ?? "--"}°C</span>
            </div>
            <div>
              Humidity: <span className="font-mono">{aqi?.weather.humidity ?? "--"}%</span>
            </div>
            <div>
              Wind: <span className="font-mono">{aqi?.weather.windKph ?? "--"} kph</span>
            </div>
            <div>
              Pressure: <span className="font-mono">{aqi?.weather.pressureHpa ?? "--"} hPa</span>
            </div>
            <div className="col-span-2 text-xs text-muted-foreground">
              Source: {aqi?.weather.source ?? "--"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Satellite vs ground validation</CardTitle>
            <CardDescription>Cross-check satellite retrievals with sensors.</CardDescription>
          </CardHeader>
          <CardContent>
            {validation ? (
              <ComparePanel data={validation} />
            ) : (
              <div className="text-sm text-muted-foreground">Loading validation…</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
