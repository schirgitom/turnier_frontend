import { Outlet, NavLink, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Settings,
  Users,
  MapPin,
  Layers,
  Swords,
  BarChart3,
} from "lucide-react";
import { getTournament } from "@/api/tournaments";
import { useSignalR } from "@/hooks/useSignalR";
import { useAuthStore } from "@/store/authStore";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "participants", label: "Teilnehmer", icon: Users },
  { to: "venues", label: "Spielstätten", icon: MapPin },
  { to: "phases", label: "Phasen", icon: Layers },
  { to: "matches", label: "Spiele", icon: Swords },
  { to: "standings", label: "Tabellen", icon: BarChart3 },
  { to: "settings", label: "Einstellungen", icon: Settings },
];

export function TournamentLayout() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: tournament, isLoading } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => getTournament(tournamentId!),
    enabled: !!tournamentId,
  });

  useSignalR({
    hubUrl: "/hubs/tournament",
    tournamentId: tournamentId!,
    queryClient,
    accessToken,
  });

  return (
    <div>
      <div className="border-b bg-background">
        <div className="px-6 py-4">
          {isLoading ? (
            <Skeleton className="h-7 w-64" />
          ) : (
            <h1 className="text-xl font-bold">{tournament?.name}</h1>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="p-6">
        <Outlet context={{ tournament }} />
      </div>
    </div>
  );
}
