import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "./useLocalStorage";

export interface DashboardRegion {
  id: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  country?: string | null;
  admin?: string | null;
}

const STORAGE_KEY = "airsight:regions";
const ACTIVE_KEY = "airsight:regions:active";
const MAX_REGIONS = 6;

// Default location: New York City
const DEFAULT_REGION: DashboardRegion = {
  id: "default-nyc",
  name: "New York City",
  label: "New York City, NY",
  lat: 40.7128,
  lon: -74.0060,
  country: "US",
  admin: "NY"
};

export function useDashboardRegions() {
  const [regions, setRegions] = useLocalStorage<DashboardRegion[]>(STORAGE_KEY, []);
  const [activeId, setActiveId] = useLocalStorage<string | null>(ACTIVE_KEY, null);
  const [temporary, setTemporary] = useState<DashboardRegion | null>(null);

  useEffect(() => {
    if (temporary || activeId) return;
    if (regions.length > 0) {
      setActiveId(regions[0].id);
    } else {
      // Set NYC as default when no regions exist
      setActiveId(DEFAULT_REGION.id);
      setRegions([DEFAULT_REGION]);
    }
  }, [regions, temporary, activeId, setActiveId, setRegions]);

  const activeRegion = useMemo(() => {
    if (temporary) return temporary;
    if (!activeId) return null;
    return regions.find((region) => region.id === activeId) ?? null;
  }, [temporary, activeId, regions]);

  const isTemporary = !!temporary && (!activeId || temporary.id !== activeId);

  const upsertRegion = useCallback(
    (region: DashboardRegion) => {
      setRegions((prev) => {
        const filtered = prev.filter((item) => item.id !== region.id);
        return [region, ...filtered].slice(0, MAX_REGIONS);
      });
    },
    [setRegions],
  );

  const activateRegion = useCallback(
    (region: DashboardRegion, options?: { persist?: boolean }) => {
      if (options?.persist === false) {
        setTemporary(region);
        if (activeId) setActiveId(null);
        return;
      }
      setTemporary(null);
      upsertRegion(region);
      setActiveId(region.id);
    },
    [activeId, setActiveId, upsertRegion],
  );

  const selectExisting = useCallback(
    (id: string) => {
      const region = regions.find((item) => item.id === id);
      if (!region) return;
      setTemporary(null);
      setActiveId(id);
    },
    [regions, setActiveId],
  );

  const removeRegion = useCallback(
    (id: string) => {
      setRegions((prev) => {
        const next = prev.filter((item) => item.id !== id);
        if (activeId === id) {
          const fallback = next[0];
          setActiveId(fallback ? fallback.id : null);
        }
        return next;
      });
      if (temporary?.id === id) {
        setTemporary(null);
      }
    },
    [activeId, setActiveId, setRegions, temporary],
  );

  const persistTemporary = useCallback(() => {
    if (!temporary) return;
    setTemporary(null);
    upsertRegion(temporary);
    setActiveId(temporary.id);
  }, [temporary, upsertRegion, setActiveId]);

  const clearTemporary = useCallback(() => {
    setTemporary(null);
    if (!activeId && regions.length > 0) {
      setActiveId(regions[0].id);
    }
  }, [activeId, regions, setActiveId]);

  return {
    regions,
    activeRegion,
    isTemporary,
    activateRegion,
    selectExisting,
    removeRegion,
    persistTemporary,
    clearTemporary,
  };
}
