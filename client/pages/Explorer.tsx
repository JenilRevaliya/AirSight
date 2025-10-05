import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AqiResponse } from "@shared/api";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Bar, BarChart } from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Explorer() {
  const [q, setQ] = useState<{ lat: number; lon: number } | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Array<{ name: string; country?: string; admin1?: string; latitude: number; longitude: number }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setQ({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setQ({ lat: 40.7128, lon: -74.006 }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const { data: aqi, error: aqiError, isLoading: aqiLoading } = useQuery<AqiResponse>({
    queryKey: ["aqi", q?.lat, q?.lon],
    enabled: !!q,
    queryFn: async () => {
      const res = await fetch(`/api/aqi?lat=${q!.lat}&lon=${q!.lon}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch AQI data: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as AqiResponse;
    },
  });

  const table = useMemo(() => {
    if (!aqi) return [] as any[];
    return Object.values(aqi.pollutants).map((p) => ({ name: p.parameter.toUpperCase(), value: p.value ?? 0, unit: p.unit, source: p.source, updated: p.lastUpdated ? new Date(p.lastUpdated).toLocaleString() : "--" }));
  }, [aqi]);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!search.trim()) return;
    try {
      setSearching(true);
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(search.trim())}&count=5&language=en&format=json`;
      const json = await (await fetch(url)).json();
      const list = (json.results || []).map((r: any) => ({ name: r.name, country: r.country, admin1: r.admin1, latitude: r.latitude, longitude: r.longitude }));
      setResults(list);
      if (list.length === 1) {
        setQ({ lat: list[0].latitude, lon: list[0].longitude });
        setResults([]);
      }
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (p) => setQ({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setQ({ lat: 40.7128, lon: -74.006 }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const breakdownConfig = useMemo(() => ({ value: { label: "µg/m³", color: "hsl(var(--accent))" } }), []);
  const trendConfig = useMemo(() => ({ AQI: { label: "AQI", color: "hsl(var(--primary))" } }), []);

  return (
    <div className="grid gap-6">
      {/* API Error Alert */}
      {aqiError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load air quality data</AlertTitle>
          <AlertDescription>
            {aqiError.message}. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {aqiLoading && q && (
        <Alert>
          <AlertTitle>Loading air quality data...</AlertTitle>
          <AlertDescription>
            Fetching measurements for the selected location.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Data Explorer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-[1fr,auto,auto] gap-2">
            <div className="relative">
              <Input placeholder="Search city, address, or place" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            </div>
            <Button type="submit" disabled={searching}>Search</Button>
            <Button type="button" variant="secondary" onClick={useMyLocation}><MapPin className="mr-2 size-4" /> Use my location</Button>
          </form>

          {results.length > 0 && (
            <div className="rounded-md border p-2 text-sm grid gap-1">
              {results.map((r) => (
                <button
                  key={`${r.name}-${r.latitude}-${r.longitude}`}
                  className="text-left px-2 py-1 rounded hover:bg-muted"
                  onClick={() => {
                    setQ({ lat: r.latitude, lon: r.longitude });
                    setResults([]);
                  }}
                >
                  {r.name}{r.admin1 ? `, ${r.admin1}` : ""}{r.country ? `, ${r.country}` : ""}
                </button>
              ))}
            </div>
          )}

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2">Pollutant</th>
                  <th className="py-2">Value</th>
                  <th className="py-2">Unit</th>
                  <th className="py-2">Source</th>
                  <th className="py-2">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.name} className="border-t">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td className="py-2 font-mono">{r.value}</td>
                    <td className="py-2">{r.unit}</td>
                    <td className="py-2">{r.source}</td>
                    <td className="py-2">{r.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Current Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={breakdownConfig} className="aspect-[16/6]">
                  <BarChart data={table}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis />
                    <Bar dataKey="value" fill="hsl(var(--accent))" radius={6} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>AQI Trend (predicted)</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={trendConfig} className="aspect-[16/6]">
                  <LineChart data={[{ t: "Now", aqi: aqi?.aqi ?? 0 }, { t: "+6h", aqi: Math.round((aqi?.aqi ?? 0) * 0.85) }, { t: "+12h", aqi: Math.round((aqi?.aqi ?? 0) * 0.8) }, { t: "+24h", aqi: Math.round((aqi?.aqi ?? 0) * 0.75) }]}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="t" tickLine={false} axisLine={false} />
                    <YAxis hide domain={[0, 500]} />
                    <Line type="monotone" dataKey="aqi" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="text-xs text-muted-foreground">Sources: NASA TEMPO, OpenAQ, OpenWeather/Open-Meteo.</div>
        </CardContent>
      </Card>
    </div>
  );
}
