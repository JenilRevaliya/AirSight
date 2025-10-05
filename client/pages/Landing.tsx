import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AqiResponse } from "@shared/api";
import { categoryColor } from "@/lib/aqi";
import { Sparkles, LocateFixed, MapPin, Search } from "lucide-react";

interface GeoResult {
  id: string;
  name: string;
  admin1?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
}

const STORAGE_KEY = "airsight:lastAqi";

export default function Landing() {
  const navigate = useNavigate();
  const [aqi, setAqi] = useState<AqiResponse | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeoResult[]>([]);

  useEffect(() => {
    if (aqi) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw) as AqiResponse;
      setAqi(cached);
      setLabel(
        `Recent location (${cached.location.lat.toFixed(2)}, ${cached.location.lon.toFixed(2)})`,
      );
    } catch {
      /* ignore corrupted cache */
    }
  }, [aqi]);

  async function loadAqi(lat: number, lon: number, nextLabel?: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/aqi?lat=${lat}&lon=${lon}`);
      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }
      const data = (await response.json()) as AqiResponse;
      setAqi(data);
      setLabel(
        nextLabel ??
          `Selected location (${data.location.lat.toFixed(2)}, ${data.location.lon.toFixed(2)})`,
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        /* storage unavailable */
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load air quality for that location");
    } finally {
      setLoading(false);
    }
  }

  async function handleUseMyLocation() {
    if (!("geolocation" in navigator)) {
      setError("Location services are not available in this browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLocating(false);
        loadAqi(lat, lon, "Your location");
      },
      () => {
        setLocating(false);
        setError(
          "We could not determine your location. Please try searching instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 8_000 },
    );
  }

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=6&language=en&format=json`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Unable to search places");
      const json = await response.json();
      const list: GeoResult[] = (json.results ?? []).map((item: any) => ({
        id: String(item.id ?? `${item.latitude},${item.longitude}`),
        name: item.name,
        admin1: item.admin1 ?? null,
        country: item.country ?? null,
        latitude: item.latitude,
        longitude: item.longitude,
      }));
      setResults(list);
      if (!list.length) {
        setError("No matching places found. Try a nearby city or ZIP code.");
      }
      if (list.length === 1) {
        const place = list[0];
        setResults([]);
        setQuery("");
        loadAqi(
          place.latitude,
          place.longitude,
          [place.name, place.admin1, place.country].filter(Boolean).join(", "),
        );
      }
    } catch (err: any) {
      setError(err?.message ?? "Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function handleResultSelect(result: GeoResult) {
    setResults([]);
    setQuery("");
    const labelParts = [result.name, result.admin1, result.country]
      .filter(Boolean)
      .join(", ");
    loadAqi(result.latitude, result.longitude, labelParts || result.name);
  }

  const showAqi = aqi && !loading;
  const cardColor = showAqi ? categoryColor(aqi.category) : undefined;

  return (
    <div className="min-h-[calc(100dvh-4rem)]">
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 p-8 md:p-12 border">
        <div className="absolute -inset-32 opacity-20 bg-[radial-gradient(circle_at_20%_20%,_hsl(var(--accent))_0,_transparent_40%),radial-gradient(circle_at_80%_0%,_hsl(var(--primary))_0,_transparent_30%),radial-gradient(circle_at_100%_100%,_hsl(var(--secondary))_0,_transparent_30%)]" />
        <div className="relative space-y-6">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="size-5" />
            <span className="uppercase tracking-wider text-xs">AirSight</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
              Real-time air quality, forecasts, and alerts
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Integrating NASA TEMPO, OpenAQ, and weather data to help you limit
              exposure to unhealthy pollution levels with timely alerts and
              clear visual insights.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate("/dashboard")}>
                Check Air Quality Now
              </Button>
              <NavLink
                to="/explorer"
                className="text-sm underline opacity-90 hover:opacity-100"
              >
                Explore data sources
              </NavLink>
            </div>
          </div>

          <form
            onSubmit={handleSearch}
            className="relative grid gap-3 rounded-lg border bg-background/70 p-4 shadow-sm md:grid-cols-[1fr_auto]"
          >
            <div className="relative">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for a city, neighborhood, or landmark"
                className="pl-9"
              />
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={searching}>
                {searching ? "Searching…" : "Search"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="whitespace-nowrap"
              >
                <MapPin className="mr-2 size-4" />{" "}
                {locating ? "Locating" : "Use my location"}
              </Button>
            </div>
          </form>

          {results.length > 0 && (
            <div className="rounded-lg border bg-background/80 p-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Select a location
              </div>
              <div className="space-y-1">
                {results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => handleResultSelect(result)}
                  >
                    <div className="font-medium">{result.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[result.admin1, result.country]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <Alert className="bg-destructive/10 text-destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm opacity-80">At-a-Glance</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LocateFixed className="size-4" />
                {label ?? "Quick demo"}
              </div>
            </div>

            {loading && (
              <div className="text-sm text-muted-foreground">
                Loading air quality…
              </div>
            )}

            {showAqi && (
              <div className="grid gap-3">
                <div
                  className="text-5xl font-extrabold tabular-nums"
                  style={{ color: cardColor }}
                >
                  {aqi.aqi}
                </div>
                <div className="text-sm">{aqi.category}</div>
                <div className="h-3 rounded-full bg-muted overflow-hidden ring-1 ring-border">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min(100, (aqi.aqi / 500) * 100)}%`,
                      background:
                        "linear-gradient(90deg, #34C759, #FFCC00, #FF3B30)",
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Dominant: {aqi.dominantPollutant?.toUpperCase() ?? "--"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Last updated: {new Date(aqi.lastUpdated).toLocaleString()}
                </div>
              </div>
            )}

            {!loading && !showAqi && (
              <div className="text-sm text-muted-foreground">
                Search for a place or use your location to preview real-time air
                quality.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-3 p-6">
            <div className="text-sm opacity-80">Daily Tip</div>
            <p className="text-sm text-muted-foreground">
              On days with elevated PM2.5, consider morning indoor workouts.
              Enable alerts to get notified when air quality worsens in your
              area.
            </p>
            <div className="text-xs text-muted-foreground">
              Source: WHO, EPA guidance
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
