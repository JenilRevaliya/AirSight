import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { MapPin, X, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardRegion } from "@/hooks/useDashboardRegions";
import type { LocationSearchResult, LocationSearchResponse } from "@shared/api";

interface LocationPanelProps {
  activeRegion: DashboardRegion | null;
  savedRegions: DashboardRegion[];
  isTemporary: boolean;
  coordinates: { lat: number; lon: number } | null;
  onRegionSelect: (region: DashboardRegion, options?: { persist?: boolean }) => void;
  onSavedSelect: (id: string) => void;
  onRemoveRegion: (id: string) => void;
  onUseCurrent: () => void;
  onPersistTemporary: () => void;
  locating: boolean;
}

export function LocationPanel(props: LocationPanelProps) {
  const {
    activeRegion,
    savedRegions,
    isTemporary,
    coordinates,
    onRegionSelect,
    onSavedSelect,
    onRemoveRegion,
    onUseCurrent,
    locating,
    onPersistTemporary,
  } = props;

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const resultsRef = useRef<HTMLDivElement>(null);

  function handleRemove(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    onRemoveRegion(id);
  }

  // Debounced search function
  const performSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/location-search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data: LocationSearchResponse = await response.json();
      setSearchResults(data.results);
      setShowResults(data.results.length > 0);
    } catch (error) {
      console.error('Location search error:', error);
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input changes with debouncing
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Handle location selection from search results
  const handleLocationSelect = (location: LocationSearchResult) => {
    const region: DashboardRegion = {
      id: `search-${location.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name: location.name,
      label: location.label,
      lat: location.lat,
      lon: location.lon,
      admin: location.state
    };
    
    onRegionSelect(region, { persist: false });
    setSearchQuery("");
    setShowResults(false);
    setSearchResults([]);
  };

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setTimeout(() => setShowResults(false), 150); // Small delay to allow clicks
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const activeLabel = activeRegion ? activeRegion.label : coordinates ? `${coordinates.lat.toFixed(3)}, ${coordinates.lon.toFixed(3)}` : "Locating...";

  return (
    <div className="space-y-3">
      {/* Search Section */}
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Search US Locations
        </div>
        <div className="relative" ref={resultsRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search cities, states..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 pr-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          
          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
              <div className="max-h-60 overflow-y-auto p-1">
                {searchResults.map((location, index) => (
                  <div
                    key={`${location.name}-${location.state}-${index}`}
                    className="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => handleLocationSelect(location)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{location.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {location.state}
                        {location.population && (
                          <span className="ml-2">• {(location.population / 1000000).toFixed(1)}M people</span>
                        )}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {location.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onUseCurrent}
          disabled={locating}
          className="whitespace-nowrap"
        >
          <MapPin className="mr-2 size-4" /> {locating ? "Locating" : "Use my location"}
        </Button>
      </div>

      <div className="rounded-md border bg-background/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active region</div>
          {isTemporary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPersistTemporary}
              className="h-7 px-2 text-xs">
              Save this region
            </Button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <MapPin className="size-4 text-muted-foreground" />
          <span>{activeLabel}</span>
        </div>
      </div>

      {savedRegions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved regions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedRegions.map((region) => {
              const isActive = activeRegion && region.id === activeRegion.id && !isTemporary;
              return (
                <Badge
                  key={region.id}
                  role="button"
                  tabIndex={0}
                  variant={isActive ? "default" : "outline"}
                  className="flex cursor-pointer select-none items-center gap-1 px-2 py-1 text-xs"
                  onClick={() => onSavedSelect(region.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSavedSelect(region.id);
                    }
                  }}
                >
                  <span>{region.name}</span>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full p-0.5",
                      isActive ? "hover:bg-background/20" : "hover:bg-muted",
                    )}
                    onClick={(event) => handleRemove(region.id, event)}
                    aria-label="Remove saved region"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <Separator />
    </div>
  );
}
