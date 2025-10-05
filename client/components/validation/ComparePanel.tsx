import type { ValidationResponse } from "@shared/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

function toRows(map: any) {
  if (!map) return [] as any[];
  return Object.values(map).map((p: any) => ({ name: String(p.parameter).toUpperCase(), value: p.value ?? 0 }));
}

export function ComparePanel({ data }: { data: ValidationResponse }) {
  const groundRows = toRows(data.ground);
  const satRows = toRows(data.satellite);
  const highDevs = (data.deviations || []).filter((d) => d.pct >= 25);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Ground (OpenAQ)</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={{ value: { label: "µg/m³", color: "hsl(var(--accent))" } }} className="aspect-[16/6]">
            <BarChart data={groundRows}>
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
        <CardHeader><CardTitle>Satellite (TEMPO)</CardTitle></CardHeader>
        <CardContent>
          {data.available && satRows.length > 0 ? (
            <ChartContainer config={{ value: { label: "µg/m³", color: "hsl(var(--secondary))" } }} className="aspect-[16/6]">
              <BarChart data={satRows}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis />
                <Bar dataKey="value" fill="hsl(var(--secondary))" radius={6} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          ) : (
            <Alert>
              <AlertTitle>Satellite data unavailable</AlertTitle>
              <AlertDescription>
                {data.note || "TEMPO integration not configured. Connect NASA TEMPO to enable satellite validation."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {highDevs.length > 0 && (
        <div className="md:col-span-2">
          <Alert variant="destructive">
            <AlertTitle>Large deviations detected</AlertTitle>
            <AlertDescription>
              {highDevs.map((d) => `${d.parameter.toUpperCase()}: ${d.delta.toFixed(2)} (${d.pct.toFixed(1)}%)`).join(" • ")}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
