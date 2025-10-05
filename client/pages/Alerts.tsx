import { useEffect, useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export default function Alerts() {
  const [cfg, setCfg] = useLocalStorage("airsight:alerts", { push: false, email: false, inapp: true, tts: false, threshold: 100 });

  const update = (patch: Partial<typeof cfg>) => setCfg({ ...cfg, ...patch });

  useEffect(() => {
    if (cfg.push && "Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, [cfg.push]);

  const preview = useMemo(() => `Alert when AQI > ${cfg.threshold}. Channels: ${[cfg.inapp && "in-app", cfg.push && "push", cfg.email && "email", cfg.tts && "tts"].filter(Boolean).join(", ")}.`, [cfg]);

  const testAlert = () => {
    if (cfg.tts && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(`Air quality alert. AQI threshold ${cfg.threshold} reached.`);
      window.speechSynthesis.speak(u);
    }
    if (cfg.inapp) alert(preview);
    if (cfg.push && "Notification" in window && Notification.permission === "granted") new Notification("AirSight Alert", { body: preview });
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <label className="flex items-center justify-between">Push Notifications <Switch checked={cfg.push} onCheckedChange={(v)=>update({push: v})} /></label>
          <label className="flex items-center justify-between">Email Alerts <Switch checked={cfg.email} onCheckedChange={(v)=>update({email: v})} /></label>
          <label className="flex items-center justify-between">In-App Alerts <Switch checked={cfg.inapp} onCheckedChange={(v)=>update({inapp: v})} /></label>
          <label className="flex items-center justify-between">Text-to-Speech <Switch checked={cfg.tts} onCheckedChange={(v)=>update({tts: v})} /></label>
          <div className="grid grid-cols-[auto,1fr] items-center gap-2">AQI Threshold <Input type="number" value={cfg.threshold} onChange={(e)=>update({threshold: Number(e.target.value)})} /></div>
          <div className="text-xs text-muted-foreground">{preview}</div>
          <Button onClick={testAlert}>Send Test Alert</Button>
        </CardContent>
      </Card>
    </div>
  );
}
