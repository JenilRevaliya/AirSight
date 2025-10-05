import type { AqiCategory } from "@shared/api";

export function categoryColor(category: AqiCategory) {
  switch (category) {
    case "Good":
      return "#34C759";
    case "Moderate":
      return "#FFCC00";
    case "Unhealthy for Sensitive Groups":
      return "#FF9500";
    case "Unhealthy":
      return "#FF3B30";
    case "Very Unhealthy":
      return "#AF52DE";
    case "Hazardous":
      return "#8E8E93";
  }
}
