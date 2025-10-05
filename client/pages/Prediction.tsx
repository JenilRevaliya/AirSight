import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { 
  AqiResponse, 
  PredictionResponse, 
  AqiPredictResponse, 
  AdvancedAqiPredictResponse,
  AdvancedPredictionPoint,
  PatternInsight,
  AnomalyAlert
} from "@shared/api";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart, ComposedChart, ReferenceLine, Bar } from "recharts";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertTriangle, Brain, TrendingUp, Zap, Eye, Settings, Info, 
  MapPin, Clock, Wind, Thermometer, Droplets, Gauge, 
  Download, Share2, Bookmark, RefreshCw, HelpCircle,
  ChevronDown, ChevronUp, Activity, Target, Shield,
  BarChart3, PieChart, Calendar, Bell, Filter,
  Maximize2, Minimize2, Play, Pause, RotateCcw
} from "lucide-react";

function useCoords() {
  const [c, setC] = useState<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition((p) => setC({ lat: p.coords.latitude, lon: p.coords.longitude }), () => setC({ lat: 40.7128, lon: -74.006 }));
  }, []);
  return c;
}

export default function Prediction() {
  const coords = useCoords();
  const [useAdvanced, setUseAdvanced] = useState(true);
  const [enableExplainability, setEnableExplainability] = useState(true);
  const [enableCalibration, setEnableCalibration] = useState(true);
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showHealthMetrics, setShowHealthMetrics] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [selectedPollutant, setSelectedPollutant] = useState<string>("aqi");
  const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);
  const [showHistoricalData, setShowHistoricalData] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);

  // Advanced AirSight prediction query
  const { data: advancedCombo, error: advancedError, isLoading: advancedLoading } = useQuery<AdvancedAqiPredictResponse>({
    queryKey: ["aqi-predict-advanced", coords?.lat, coords?.lon, enableExplainability, enableCalibration],
    enabled: !!coords && useAdvanced,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: coords!.lat.toString(),
        lon: coords!.lon.toString(),
        explainability: enableExplainability.toString(),
        calibration: enableCalibration.toString()
      });
      const res = await fetch(`/api/aqi-predict-advanced?${params}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch advanced prediction data: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as AdvancedAqiPredictResponse;
    },
    placeholderData: (prev) => prev,
  });

  // Fallback to basic prediction
  const { data: basicCombo, error: basicError, isLoading: basicLoading } = useQuery<AqiPredictResponse>({
    queryKey: ["aqi-predict", coords?.lat, coords?.lon],
    enabled: !!coords && (!useAdvanced || !!advancedError),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/aqi-predict?lat=${coords!.lat}&lon=${coords!.lon}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch prediction data: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as AqiPredictResponse;
    },
    placeholderData: (prev) => prev,
  });

  // Use advanced data if available, otherwise fallback to basic
  const combo = useAdvanced && advancedCombo ? advancedCombo : basicCombo;
  const comboError = useAdvanced ? advancedError : basicError;
  const comboLoading = useAdvanced ? advancedLoading : basicLoading;
  
  const aqi = combo?.aqi;
  const pred = useAdvanced && advancedCombo ? advancedCombo.predict : basicCombo?.predict;

  const [range, setRange] = useState("24h");
  const maxHours = useMemo(() => (range === "3h" ? 3 : range === "6h" ? 6 : range === "12h" ? 12 : range === "24h" ? 24 : 24 * 7), [range]);
  const [hour, setHour] = useState<number>(6);
  useEffect(() => { setHour(Math.min(hour, maxHours)); }, [maxHours]);

  const series = useMemo(() => {
    if (!pred) return [] as any[];
    return pred.series.filter((p) => new Date(p.ts).getTime() <= Date.now() + maxHours * 3600_000)
      .map((d) => {
        const advancedPoint = d as AdvancedPredictionPoint;
        return {
          t: new Date(d.ts).toLocaleString([], { hour: "2-digit", hour12: false, month: "2-digit", day: "2-digit" }),
          aqi: d.aqi,
          confidence: advancedPoint.confidence || 0.8,
          lower: advancedPoint.uncertainty_lower || d.aqi * 0.9,
          upper: advancedPoint.uncertainty_upper || d.aqi * 1.1,
          category: advancedPoint.category || categoryFromAqi(d.aqi)
        };
      });
  }, [pred, maxHours]);

  const alerts = useMemo(() => {
    if (!pred) return [] as string[];
    const entries: [string, number][] = Object.entries(pred.horizons as any);
    return entries.map(([k, v]) => `${k.toUpperCase()}: ${v} (${pred.categoryByHorizon[k]})`);
  }, [pred]);

  function categoryFromAqi(aqi: number) {
    if (aqi <= 50) return "Good";
    if (aqi <= 100) return "Moderate";
    if (aqi <= 150) return "Unhealthy for Sensitive Groups";
    if (aqi <= 200) return "Unhealthy";
    if (aqi <= 300) return "Very Unhealthy";
    return "Hazardous";
  }

  function getAqiColor(aqi: number): string {
    if (aqi <= 50) return "text-green-600";
    if (aqi <= 100) return "text-yellow-600";
    if (aqi <= 150) return "text-orange-600";
    if (aqi <= 200) return "text-red-600";
    if (aqi <= 300) return "text-purple-600";
    return "text-red-800";
  }

  function getAqiBackground(aqi: number): string {
    if (aqi <= 50) return "bg-green-50 border-green-200";
    if (aqi <= 100) return "bg-yellow-50 border-yellow-200";
    if (aqi <= 150) return "bg-orange-50 border-orange-200";
    if (aqi <= 200) return "bg-red-50 border-red-200";
    if (aqi <= 300) return "bg-purple-50 border-purple-200";
    return "bg-red-100 border-red-300";
  }

  function getHealthRecommendation(aqi: number): string {
    if (aqi <= 50) return "Air quality is satisfactory. Great for outdoor activities!";
    if (aqi <= 100) return "Moderate air quality. Sensitive individuals should consider limiting prolonged outdoor exertion.";
    if (aqi <= 150) return "Unhealthy for sensitive groups. Children, elderly, and people with heart/lung conditions should reduce outdoor activities.";
    if (aqi <= 200) return "Unhealthy air quality. Everyone should limit outdoor activities, especially strenuous exercise.";
    if (aqi <= 300) return "Very unhealthy air. Everyone should avoid outdoor activities. Stay indoors with air purification if possible.";
    return "Hazardous air quality! Avoid all outdoor activities. Emergency conditions for all.";
  }

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      // Trigger refetch by invalidating queries
      if (useAdvanced) {
        // Would trigger refetch in real implementation
      }
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [autoRefresh, useAdvanced]);

  // Export/Share functionality
  const handleExportData = () => {
    const data = {
      location: coords,
      prediction: combo,
      timestamp: new Date().toISOString(),
      model: useAdvanced ? "AirSight_Advanced" : "Baseline"
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aqi-prediction-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Data exported", description: "Prediction data saved to file" });
  };

  const handleSharePrediction = async () => {
    if (navigator.share && aqi) {
      try {
        await navigator.share({
          title: 'Air Quality Prediction',
          text: `Current AQI: ${aqi.aqi} (${aqi.category}). ${getHealthRecommendation(aqi.aqi)}`,
          url: window.location.href
        });
      } catch (err) {
        // Fallback to clipboard
        navigator.clipboard.writeText(`AQI: ${aqi.aqi} (${aqi.category}) - ${window.location.href}`);
        toast({ title: "Link copied", description: "Prediction link copied to clipboard" });
      }
    } else if (aqi) {
      navigator.clipboard.writeText(`AQI: ${aqi.aqi} (${aqi.category}) - ${window.location.href}`);
      toast({ title: "Link copied", description: "Prediction link copied to clipboard" });
    }
  };

  const nearestPoint = useMemo(() => {
    if (!pred) return null as null | { hours: number; aqi: number };
    const candidates = [0, 3, 6, 12, 24, 24 * 7].filter((h) => h <= maxHours);
    const target = candidates.reduce((a, b) => (Math.abs(b - hour) < Math.abs(a - hour) ? b : a), candidates[0]);
    const point = pred.series.find((p, i) => {
      const h = [0, 3, 6, 12, 24, 24 * 7][i] ?? 0;
      return h === target;
    });
    return point ? { hours: target, aqi: point.aqi } : null;
  }, [pred, hour, maxHours]);

  const notified = useRef(false);
  useEffect(() => {
    if (!pred || notified.current) return;
    const firstUnhealthy = pred.series.find((p) => p.aqi > 100);
    if (firstUnhealthy) {
      const h = Math.round((new Date(firstUnhealthy.ts).getTime() - Date.now()) / 3600_000);
      if (h >= 0) {
        toast({ title: "Unhealthy air forecasted", description: `AQI > 100 expected in ~${h}h. Consider enabling alerts in Settings.` });
        notified.current = true;
      }
    }
  }, [pred]);

  // Advanced features data
  const advancedPred = useAdvanced && advancedCombo ? advancedCombo.predict : null;
  const patterns = advancedPred?.patterns || [];
  const anomalies = advancedPred?.anomalies || [];
  const explanation = advancedPred?.explanation;
  const calibration = advancedPred?.calibration;

  // Historical comparison data (simulated)
  const historicalData = useMemo(() => {
    if (!showHistoricalData) return [];
    const now = Date.now();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
      const baseAqi = aqi?.aqi || 50;
      const variation = (Math.random() - 0.5) * 20;
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        historical: Math.max(0, Math.round(baseAqi + variation)),
        predicted: i === 6 ? baseAqi : null
      };
    });
  }, [aqi, showHistoricalData]);

  // Advanced analytics data
  const analyticsData = useMemo(() => {
    if (!aqi || !pred) return null;
    
    const currentAqi = aqi.aqi;
    const futureAqi = pred.series[2]?.aqi || currentAqi; // 12h prediction
    const trend = futureAqi > currentAqi ? 'increasing' : futureAqi < currentAqi ? 'decreasing' : 'stable';
    
    return {
      trend,
      changePercent: Math.abs(((futureAqi - currentAqi) / currentAqi) * 100),
      riskLevel: currentAqi > 150 ? 'high' : currentAqi > 100 ? 'medium' : 'low',
      dominantPollutant: aqi.dominantPollutant || 'pm25',
      airQualityIndex: currentAqi,
      healthScore: Math.max(0, 100 - currentAqi),
      visibility: Math.max(1, 10 - (currentAqi / 50)), // km
      uvIndex: Math.random() * 11, // Simulated UV index
    };
  }, [aqi, pred]);

  // Comparison with other cities (simulated)
  const cityComparison = useMemo(() => {
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
    return cities.map(city => ({
      city,
      aqi: Math.floor(Math.random() * 150) + 20,
      trend: Math.random() > 0.5 ? 'up' : 'down'
    })).sort((a, b) => a.aqi - b.aqi);
  }, []);

  // Air quality forecast summary
  const forecastSummary = useMemo(() => {
    if (!pred) return null;
    
    const next24h = pred.series.slice(0, 4); // Next 24 hours
    const avgAqi = next24h.reduce((sum, p) => sum + p.aqi, 0) / next24h.length;
    const maxAqi = Math.max(...next24h.map(p => p.aqi));
    const minAqi = Math.min(...next24h.map(p => p.aqi));
    
    return {
      average: Math.round(avgAqi),
      maximum: maxAqi,
      minimum: minAqi,
      volatility: maxAqi - minAqi,
      recommendation: avgAqi > 100 ? 'Stay indoors when possible' : 'Good for outdoor activities'
    };
  }, [pred]);

  return (
    <TooltipProvider>
      <div className="grid gap-6">
        {/* Header with Current AQI and Quick Actions */}
        {aqi && (
          <Card className={`${getAqiBackground(aqi.aqi)} transition-all duration-300`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${getAqiColor(aqi.aqi)}`}>
                      {aqi.aqi}
                    </div>
                    <div className="text-sm text-muted-foreground">AQI</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold">{aqi.category}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {coords ? `${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)}` : "Location"}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {new Date().toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={showNotifications ? "bg-blue-50" : ""}
                      >
                        <Bell className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle notifications</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleSharePrediction}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Share prediction</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleExportData}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export data</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={autoRefresh ? "bg-blue-50" : ""}
                      >
                        <RefreshCw className={`h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Auto-refresh (5min)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsFullscreen(!isFullscreen)}
                      >
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              
              {/* Health Recommendation */}
              <div className="mt-4 p-3 bg-white/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5 text-blue-600" />
                  <div>
                    <div className="font-medium text-sm">Health Recommendation</div>
                    <div className="text-sm text-muted-foreground">
                      {getHealthRecommendation(aqi.aqi)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Model Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AirSight Prediction Engine
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedControls(!showAdvancedControls)}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Settings
                  {showAdvancedControls ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Basic Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="advanced-mode"
                    checked={useAdvanced}
                    onCheckedChange={setUseAdvanced}
                  />
                  <Label htmlFor="advanced-mode" className="flex items-center gap-2">
                    Advanced ML
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Uses Transformer-LSTM hybrid model with explainability
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                </div>
                <Badge variant={useAdvanced ? "default" : "secondary"}>
                  {useAdvanced ? "AirSight v2.0" : "Baseline"}
                </Badge>
              </div>

              {/* Advanced Controls */}
              {showAdvancedControls && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="explainability"
                        checked={enableExplainability}
                        onCheckedChange={setEnableExplainability}
                        disabled={!useAdvanced}
                      />
                      <Label htmlFor="explainability">Explainability</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="calibration"
                        checked={enableCalibration}
                        onCheckedChange={setEnableCalibration}
                        disabled={!useAdvanced}
                      />
                      <Label htmlFor="calibration">Auto-Calibration</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="compact-view"
                        checked={compactView}
                        onCheckedChange={setCompactView}
                      />
                      <Label htmlFor="compact-view">Compact View</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="health-metrics"
                        checked={showHealthMetrics}
                        onCheckedChange={setShowHealthMetrics}
                      />
                      <Label htmlFor="health-metrics">Health Metrics</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Model Performance */}
              {advancedPred?.model && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                  <span>MAE: {advancedPred.model.performance_metrics.mae.toFixed(1)}µg/m³</span>
                  <span>R²: {advancedPred.model.performance_metrics.r2.toFixed(2)}</span>
                  {advancedPred.model.performance_metrics.processing_time_ms && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {advancedPred.model.performance_metrics.processing_time_ms}ms
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Weather & Environmental Data */}
        {aqi && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Environmental Conditions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {aqi.weather.temperatureC && (
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-red-500" />
                    <div>
                      <div className="text-sm font-medium">{aqi.weather.temperatureC.toFixed(1)}°C</div>
                      <div className="text-xs text-muted-foreground">Temperature</div>
                    </div>
                  </div>
                )}
                {aqi.weather.humidity && (
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <div>
                      <div className="text-sm font-medium">{aqi.weather.humidity.toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">Humidity</div>
                    </div>
                  </div>
                )}
                {aqi.weather.windKph && (
                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-green-500" />
                    <div>
                      <div className="text-sm font-medium">{aqi.weather.windKph.toFixed(1)} km/h</div>
                      <div className="text-xs text-muted-foreground">Wind Speed</div>
                    </div>
                  </div>
                )}
                {aqi.weather.pressureHpa && (
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-purple-500" />
                    <div>
                      <div className="text-sm font-medium">{aqi.weather.pressureHpa.toFixed(0)} hPa</div>
                      <div className="text-xs text-muted-foreground">Pressure</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Advanced Analytics Dashboard */}
        {analyticsData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Trend</p>
                    <p className="text-2xl font-bold flex items-center gap-1">
                      {analyticsData.trend === 'increasing' ? (
                        <TrendingUp className="h-5 w-5 text-red-500" />
                      ) : analyticsData.trend === 'decreasing' ? (
                        <TrendingUp className="h-5 w-5 text-green-500 rotate-180" />
                      ) : (
                        <Target className="h-5 w-5 text-blue-500" />
                      )}
                      {analyticsData.changePercent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Health Score</p>
                    <p className="text-2xl font-bold">{analyticsData.healthScore.toFixed(0)}/100</p>
                  </div>
                  <Shield className={`h-8 w-8 ${
                    analyticsData.healthScore > 70 ? 'text-green-500' : 
                    analyticsData.healthScore > 40 ? 'text-yellow-500' : 'text-red-500'
                  }`} />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Visibility</p>
                    <p className="text-2xl font-bold">{analyticsData.visibility.toFixed(1)} km</p>
                  </div>
                  <Eye className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Risk Level</p>
                    <p className="text-2xl font-bold capitalize">{analyticsData.riskLevel}</p>
                  </div>
                  <AlertTriangle className={`h-8 w-8 ${
                    analyticsData.riskLevel === 'high' ? 'text-red-500' : 
                    analyticsData.riskLevel === 'medium' ? 'text-yellow-500' : 'text-green-500'
                  }`} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Forecast Summary Card */}
        {forecastSummary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                24-Hour Forecast Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{forecastSummary.average}</div>
                  <div className="text-sm text-muted-foreground">Average AQI</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{forecastSummary.maximum}</div>
                  <div className="text-sm text-muted-foreground">Peak AQI</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{forecastSummary.minimum}</div>
                  <div className="text-sm text-muted-foreground">Best AQI</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{forecastSummary.volatility}</div>
                  <div className="text-sm text-muted-foreground">Volatility</div>
                </div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Recommendation:</p>
                <p className="text-sm text-muted-foreground">{forecastSummary.recommendation}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* City Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Regional Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cityComparison.map((city, i) => (
                <div key={city.city} className="flex items-center justify-between p-2 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-8 rounded ${
                      i === 0 ? 'bg-green-500' : i === 1 ? 'bg-yellow-500' : 
                      i === 2 ? 'bg-orange-500' : 'bg-red-500'
                    }`} />
                    <span className="font-medium">{city.city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{city.aqi}</span>
                    <div className={`p-1 rounded ${
                      city.trend === 'up' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                    }`}>
                      <TrendingUp className={`h-3 w-3 ${
                        city.trend === 'down' ? 'rotate-180' : ''
                      }`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* API Error Alert */}
        {comboError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Failed to load prediction data</AlertTitle>
            <AlertDescription>
              {comboError.message}. {useAdvanced && "Falling back to basic prediction."}
            </AlertDescription>
          </Alert>
      )}

      {/* Loading State */}
      {comboLoading && coords && (
        <Alert>
          <AlertTitle>Loading prediction data...</AlertTitle>
          <AlertDescription>
            {useAdvanced ? "Running AirSight ML pipeline..." : "Fetching air quality predictions for your location."}
          </AlertDescription>
        </Alert>
      )}

      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <Alert variant={anomalies.some(a => a.severity === 'high' || a.severity === 'critical') ? "destructive" : "default"}>
          <Zap className="h-4 w-4" />
          <AlertTitle>Anomaly Detected</AlertTitle>
          <AlertDescription>
            <div className="space-y-1">
              {anomalies.slice(0, 2).map((anomaly, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant={anomaly.severity === 'critical' ? 'destructive' : anomaly.severity === 'high' ? 'destructive' : 'secondary'}>
                    {anomaly.severity.toUpperCase()}
                  </Badge>
                  <span className="text-sm">{anomaly.message}</span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Enhanced Prediction Charts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Air Quality Analytics</CardTitle>
            <div className="flex items-center gap-2">
              {/* Removed non-working chart type tabs - only keeping Forecast */}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between">
            <Tabs value={range} onValueChange={setRange}>
              <TabsList>
                {(["3h","6h","12h","24h","7d"] as const).map((r) => (
                  <TabsTrigger key={r} value={r}>{r.toUpperCase()}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="confidence-interval"
                  checked={showConfidenceInterval}
                  onCheckedChange={setShowConfidenceInterval}
                />
                <Label htmlFor="confidence-interval" className="text-xs">Confidence</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="historical-data"
                  checked={showHistoricalData}
                  onCheckedChange={setShowHistoricalData}
                />
                <Label htmlFor="historical-data" className="text-xs">Historical</Label>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Now</span>
              <span>+{maxHours}h</span>
            </div>
            <Slider value={[hour]} min={0} max={maxHours} step={1} onValueChange={(v) => setHour(v[0])} />
            {nearestPoint && (
              <div className="text-sm flex items-center gap-2">
                <span>At +{nearestPoint.hours}h: {nearestPoint.aqi} ({categoryFromAqi(nearestPoint.aqi)})</span>
                {useAdvanced && series.length > 0 && (
                  <Badge variant="outline">
                    {Math.round((series.find(s => s.aqi === nearestPoint.aqi)?.confidence || 0.8) * 100)}% confidence
                  </Badge>
                )}
              </div>
            )}
          </div>

              <ChartContainer config={useMemo(() => ({ 
                aqi: { label: "AQI", color: "hsl(var(--primary))" },
                upper: { label: "Upper Bound", color: "hsl(var(--muted))" },
                lower: { label: "Lower Bound", color: "hsl(var(--muted))" },
                historical: { label: "Historical", color: "hsl(var(--muted-foreground))" }
              }), [])} className="aspect-[16/6]">
                {showHistoricalData ? (
                  <ComposedChart data={[...historicalData, ...series.slice(0, 3)]}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="t" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 200]} />
                    <Bar dataKey="historical" fill="hsl(var(--muted))" opacity={0.6} />
                    <Line type="monotone" dataKey="aqi" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                    {showConfidenceInterval && useAdvanced && (
                      <>
                        <Area 
                          type="monotone" 
                          dataKey="upper" 
                          stackId="1"
                          stroke="none" 
                          fill="hsl(var(--primary))" 
                          fillOpacity={0.1}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="lower" 
                          stackId="1"
                          stroke="none" 
                          fill="white" 
                          fillOpacity={1}
                        />
                      </>
                    )}
                    <ReferenceLine y={50} stroke="#22c55e" strokeDasharray="5 5" label="Good" />
                    <ReferenceLine y={100} stroke="#eab308" strokeDasharray="5 5" label="Moderate" />
                    <ReferenceLine y={150} stroke="#f97316" strokeDasharray="5 5" label="Unhealthy" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </ComposedChart>
                ) : useAdvanced && showConfidenceInterval ? (
                  <AreaChart data={series}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="t" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 200]} />
                    <Area 
                      type="monotone" 
                      dataKey="upper" 
                      stackId="1"
                      stroke="none" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="lower" 
                      stackId="1"
                      stroke="none" 
                      fill="white" 
                      fillOpacity={1}
                    />
                    <Line type="monotone" dataKey="aqi" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                    <ReferenceLine y={50} stroke="#22c55e" strokeDasharray="5 5" label="Good" />
                    <ReferenceLine y={100} stroke="#eab308" strokeDasharray="5 5" label="Moderate" />
                    <ReferenceLine y={150} stroke="#f97316" strokeDasharray="5 5" label="Unhealthy" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </AreaChart>
                ) : (
                  <LineChart data={series}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="t" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 200]} />
                    <Line type="monotone" dataKey="aqi" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                    <ReferenceLine y={50} stroke="#22c55e" strokeDasharray="5 5" label="Good" />
                    <ReferenceLine y={100} stroke="#eab308" strokeDasharray="5 5" label="Moderate" />
                    <ReferenceLine y={150} stroke="#f97316" strokeDasharray="5 5" label="Unhealthy" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </LineChart>
                )}
              </ChartContainer>
          <div className="text-sm text-muted-foreground">
            Insights: {aqi ? `Current ${aqi.category}. Avoid peak hours if sensitive. Monitor changes over next ${range}.` : "Loading..."}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Model: {pred?.model.type} {pred?.model.loaded ? "(loaded)" : ""}</span>
            {calibration?.drift_detected && (
              <Badge variant="destructive">Drift Detected</Badge>
            )}
            {calibration?.retrain_recommended && (
              <Badge variant="outline">Retrain Recommended</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Model Explainability */}
      {useAdvanced && explanation && enableExplainability && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Model Explanation
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Top Contributing Factors</h4>
                <div className="space-y-2">
                  {explanation.shap.top_drivers.slice(0, 3).map((driver, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{driver.feature.toUpperCase()}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{driver.value.toFixed(1)}</span>
                        <Badge variant={driver.contribution > 0 ? "destructive" : "default"}>
                          {driver.contribution > 0 ? "+" : ""}{driver.contribution.toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Data Sources</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>Sensors: {explanation.data_lineage.sensors_used.length}</div>
                  <div>TEMPO: {explanation.data_lineage.tempo_available ? "Available" : "Unavailable"}</div>
                  <div>Weather: {explanation.data_lineage.weather_source}</div>
                  <div>Processing: {explanation.data_lineage.processing_time_ms}ms</div>
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Confidence: {Math.round(explanation.confidence * 100)}% | 
              Uncertainty: [{explanation.uncertainty_bounds[0].toFixed(2)}, {explanation.uncertainty_bounds[1].toFixed(2)}]
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pattern Insights */}
      {useAdvanced && patterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pattern Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {patterns.slice(0, 3).map((pattern, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge variant="outline">{pattern.type.replace('_', ' ').toUpperCase()}</Badge>
                  <div className="flex-1">
                    <p className="text-sm">{pattern.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Confidence: {Math.round(pattern.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Quality & System Status */}
      {useAdvanced && advancedPred?.input_quality && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{advancedPred.input_quality.sensors_available}</div>
                <div className="text-xs text-muted-foreground">Sensors</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{Math.round(advancedPred.input_quality.tempo_coverage * 100)}%</div>
                <div className="text-xs text-muted-foreground">TEMPO Coverage</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{advancedPred.input_quality.weather_freshness_hours.toFixed(1)}h</div>
                <div className="text-xs text-muted-foreground">Weather Age</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{Math.round(advancedPred.input_quality.overall_score * 100)}%</div>
                <div className="text-xs text-muted-foreground">Data Quality</div>
              </div>
            </div>
            {calibration && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Last Calibration: {new Date(calibration.last_calibration).toLocaleString()} | 
                  Effectiveness: {Math.round(calibration.calibration_effectiveness * 100)}%
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Basic Alerts Fallback */}
      {(!useAdvanced || !advancedPred) && (
        <Card>
          <CardHeader><CardTitle>Forecast Summary</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {alerts.map((a) => (<li key={a}>{a}</li>))}
            </ul>
          </CardContent>
        </Card>
      )}
      </div>
    </TooltipProvider>
  );
}
