import { Outlet, NavLink, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
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
import { getAppConfig } from "@/lib/runtimeConfig";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TournamentStatus } from "@/types/tournament";

function simplifiedLabel(status: TournamentStatus): string {
  if (status === TournamentStatus.InProgress) return "Laufend";
  if (status === TournamentStatus.Completed) return "Abgeschlossen";
  if (status === TournamentStatus.Cancelled) return "Abgesagt";
  return "Entwurf";
}

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
  const hubUrl = getAppConfig().hubUrl;

  const { data: tournament, isLoading } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => getTournament(tournamentId!),
    enabled: !!tournamentId,
  });

  useSignalR({
    hubUrl,
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
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{tournament?.name}</h1>
              {tournament && (
                <Badge variant="outline">
                  {simplifiedLabel(tournament.status)}
                </Badge>
              )}
              <a
                href={`/public/${tournamentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Öffentliche Ansicht
              </a>
            </div>
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
