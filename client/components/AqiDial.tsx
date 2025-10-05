import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import type { AqiCategory } from "@shared/api";
import { categoryColor } from "@/lib/aqi";

export function AqiDial({ value, category }: { value: number | null | undefined; category?: AqiCategory }) {
  const v = Math.max(0, Math.min(500, value ?? 0));
  const data = [{ name: "AQI", value: v, fill: category ? categoryColor(category) : "hsl(var(--primary))" }];
  return (
    <div className="relative w-full aspect-square">
      <RadialBarChart innerRadius="70%" outerRadius="95%" data={data} startAngle={225} endAngle={-45} className="w-full h-full">
        <PolarAngleAxis type="number" domain={[0, 500]} tick={false} />
        <RadialBar background dataKey="value" cornerRadius={12} />
      </RadialBarChart>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-4xl font-bold tabular-nums" style={{ color: category ? categoryColor(category) : undefined }}>{v}</div>
          <div className="text-xs text-muted-foreground">{category ?? "--"}</div>
        </div>
      </div>
    </div>
  );
}
