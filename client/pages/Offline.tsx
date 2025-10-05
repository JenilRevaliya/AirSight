import { useEffect, useState } from "react";
import type { AqiResponse } from "@shared/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Offline() {
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [cached, setCached] = useState<AqiResponse | null>(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    try {
      const raw = localStorage.getItem("airsight:lastAqi");
      if (raw) setCached(JSON.parse(raw));
    } catch {}
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  return (
    <div className="grid gap-6">
      {!online && (
        <div className="rounded-md border p-3 text-sm bg-yellow-500/10 border-yellow-500/40">You are offline, showing saved data.</div>
      )}

      <Card>
        <CardHeader><CardTitle>Cached AQI & Weather</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {cached ? (
            <div className="grid gap-2">
              <div>AQI: <span className="font-mono">{cached.aqi}</span> ({cached.category})</div>
              <div>Dominant: {cached.dominantPollutant?.toUpperCase()}</div>
              <div>Temp: {cached.weather.temperatureC ?? "--"}°C, Humidity: {cached.weather.humidity ?? "--"}%</div>
              <div className="text-xs text-muted-foreground">Last updated: {new Date(cached.lastUpdated).toLocaleString()}</div>
            </div>
          ) : (
            <div className="text-muted-foreground">No cached data yet. Visit Dashboard while online.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
