import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AirVent, Bell, HeartPulse, Map, Settings, Sparkles, Activity, Home } from "lucide-react";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/prediction", label: "Prediction", icon: Activity },
  { to: "/health", label: "Health", icon: HeartPulse },
  { to: "/explorer", label: "Explorer", icon: Map },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const location = useLocation();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[18rem,1fr]">
      <aside className="hidden md:flex flex-col gap-4 p-4 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-2 text-xl font-bold">
          <Sparkles className="text-accent" /> AirSight
        </div>
        <nav className="mt-4 grid gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-ring"
                    : "hover:bg-sidebar-accent/60",
                )
              }
            >
              <l.icon className="size-4" /> {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto text-xs text-muted-foreground">
          Sources: NASA TEMPO, OpenAQ, OpenWeather
        </div>
      </aside>

      <main className="relative w-full min-h-dvh flex flex-col pb-16">
        <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/70 bg-background/90 border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AirVent className="text-primary" />
            <span>Clean air starts with insight.</span>
          </div>
        </header>
        <div className="p-4 md:p-6 grow">
          <Outlet />
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-6 gap-1 bg-background/90 backdrop-blur border-t p-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.25rem)' }}>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => cn("flex flex-col items-center gap-1 rounded-md py-2 text-[10px]", isActive ? "text-accent" : "text-muted-foreground") }>
            <l.icon className="size-5" />
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
