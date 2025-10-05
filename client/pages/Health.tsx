import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const rows = [
  { cat: "Good", advice: "Air quality is satisfactory.", audience: "All" },
  { cat: "Moderate", advice: "Unusually sensitive individuals should reduce prolonged exertion.", audience: "Sensitive" },
  { cat: "Unhealthy for Sensitive Groups", advice: "Sensitive groups (kids, elderly, asthma) limit outdoor time.", audience: "Sensitive" },
  { cat: "Unhealthy", advice: "Everyone reduce prolonged outdoor exertion.", audience: "All" },
  { cat: "Very Unhealthy", advice: "Avoid outdoor activities; wear a mask if necessary.", audience: "All" },
  { cat: "Hazardous", advice: "Remain indoors; use air purifiers; follow official guidance.", audience: "All" },
];

export default function Health() {
  const [profile, setProfile] = useLocalStorage("airsight:healthProfile", "General");
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Health Guidance</CardTitle>
          <Select value={profile} onValueChange={setProfile}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Profile" /></SelectTrigger>
            <SelectContent>
              {(["Kids","Elderly","Asthmatic","Outdoor Worker","General"]).map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2">AQI Category</th>
                  <th className="py-2">Guidance</th>
                  <th className="py-2">Applies To</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.cat} className="border-t">
                    <td className="py-2 font-medium">{r.cat}</td>
                    <td className="py-2">{r.advice}</td>
                    <td className="py-2">{r.audience}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">Profile: {profile}. Always consult local advisories.</div>
        </CardContent>
      </Card>
    </div>
  );
}
