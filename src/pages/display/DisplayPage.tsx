import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  getPublicTournament,
  getPublicSchedule,
  getPublicStandings,
  getPublicMatches,
} from "@/api/display";
import { useSignalR } from "@/hooks/useSignalR";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { MatchStatus } from "@/types/match";
import type { MatchDto } from "@/types/match";
import type { ScheduleBoardDto } from "@/types/display";
import type { PublicStandingsDto } from "@/types/display";

type ViewMode = "schedule" | "standings" | "matches";

const ROTATION_VIEWS: ViewMode[] = ["schedule", "standings", "matches"];

export function DisplayPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [searchParams] = useSearchParams();

  const viewParam = searchParams.get("view") ?? "auto";
  const intervalParam = parseInt(searchParams.get("interval") ?? "15", 10);

  const [currentView, setCurrentView] = useState<ViewMode>(
    viewParam === "auto" ? "schedule" : (viewParam as ViewMode),
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const rotateView = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentView((prev) => {
        const idx = ROTATION_VIEWS.indexOf(prev);
        return ROTATION_VIEWS[(idx + 1) % ROTATION_VIEWS.length]!;
      });
      setIsTransitioning(false);
    }, 500);
  }, []);

  useEffect(() => {
    if (viewParam !== "auto") return;
    const timer = setInterval(rotateView, intervalParam * 1000);
    return () => clearInterval(timer);
  }, [viewParam, intervalParam, rotateView]);

  const { data: tournament } = useQuery({
    queryKey: ["display", tournamentId],
    queryFn: () => getPublicTournament(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 60000,
  });

  useSignalR({
    hubUrl: "/hubs/display",
    tournamentId: tournamentId!,
    queryClient,
  });

  return (
    <div className="dark flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-8 py-4">
        <h1 className="text-3xl font-bold">
          {tournament?.name ?? "Turnier"}
        </h1>
        <div className="text-3xl font-mono tabular-nums">
          {format(clock, "HH:mm:ss")}
        </div>
      </header>

      <main
        className={cn(
          "flex-1 overflow-auto p-8 transition-opacity duration-500",
          isTransitioning ? "opacity-0" : "opacity-100",
        )}
      >
        {currentView === "schedule" && (
          <ScheduleView tournamentId={tournamentId!} />
        )}
        {currentView === "standings" && (
          <StandingsView tournamentId={tournamentId!} />
        )}
        {currentView === "matches" && (
          <MatchesView tournamentId={tournamentId!} />
        )}
      </main>

      <footer className="flex items-center justify-between border-t border-border px-8 py-2 text-sm text-muted-foreground">
        <span>
          {format(clock, "EEEE, dd. MMMM yyyy", { locale: de })}
        </span>
        <span className="uppercase tracking-wider">
          {currentView === "schedule" && "Spielplan"}
          {currentView === "standings" && "Tabellen"}
          {currentView === "matches" && "Live Spiele"}
        </span>
      </footer>
    </div>
  );
}

function ScheduleView({ tournamentId }: { tournamentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["display", tournamentId, "schedule"],
    queryFn: () => getPublicSchedule(tournamentId),
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">
        Spielplan wird geladen...
      </div>
    );
  }

  return <ScheduleBoard data={data} />;
}

function ScheduleBoard({ data }: { data: ScheduleBoardDto }) {
  if (data.courts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">
        Kein Spielplan vorhanden
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-border bg-muted p-3 text-left text-xl font-bold">
              Zeit
            </th>
            {data.courts.map((court) => (
              <th
                key={court.courtId}
                className="border border-border bg-muted p-3 text-center text-xl font-bold"
              >
                {court.courtName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.timeSlots.map((slot) => (
            <tr key={slot}>
              <td className="border border-border p-3 text-xl font-mono">
                {format(new Date(slot), "HH:mm")}
              </td>
              {data.courts.map((court) => {
                const match = court.matches.find(
                  (m) => m.scheduledTime === slot,
                );
                return (
                  <td
                    key={court.courtId}
                    className={cn(
                      "border border-border p-3 text-center",
                      match?.status === MatchStatus.InProgress &&
                        "bg-green-500/10",
                    )}
                  >
                    {match ? (
                      <div>
                        <div className="flex items-center justify-center gap-2 text-xl">
                          {match.status === MatchStatus.InProgress && (
                            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />
                          )}
                          <span>{match.homeParticipantName ?? "TBD"}</span>
                          <span className="text-3xl font-bold">
                            {match.homePoints ?? 0} : {match.awayPoints ?? 0}
                          </span>
                          <span>{match.awayParticipantName ?? "TBD"}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StandingsView({ tournamentId }: { tournamentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["display", tournamentId, "standings"],
    queryFn: () => getPublicStandings(tournamentId),
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">
        Tabellen werden geladen...
      </div>
    );
  }

  return <StandingsBoard data={data} />;
}

function StandingsBoard({ data }: { data: PublicStandingsDto }) {
  if (data.phases.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">
        Keine Tabellendaten vorhanden
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {data.phases.flatMap((phase) =>
        phase.groups.map((group) => (
          <div
            key={`${phase.phaseId}-${group.groupName}`}
            className="rounded-lg border border-border"
          >
            <div className="border-b border-border bg-muted px-4 py-3">
              <h3 className="text-2xl font-bold">{group.groupName}</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xl">
                  <th className="p-3 text-left">#</th>
                  <th className="p-3 text-left">Team</th>
                  <th className="p-3 text-center">Sp</th>
                  <th className="p-3 text-center">S</th>
                  <th className="p-3 text-center">U</th>
                  <th className="p-3 text-center">N</th>
                  <th className="p-3 text-center">Diff</th>
                  <th className="p-3 text-center font-bold">Pkt</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map((entry) => (
                  <tr
                    key={entry.participantId}
                    className="border-b border-border/50 text-xl"
                  >
                    <td className="p-3 font-bold">{entry.rank}</td>
                    <td className="p-3 font-medium">
                      {entry.participantName}
                    </td>
                    <td className="p-3 text-center">{entry.played}</td>
                    <td className="p-3 text-center">{entry.won}</td>
                    <td className="p-3 text-center">{entry.drawn}</td>
                    <td className="p-3 text-center">{entry.lost}</td>
                    <td className="p-3 text-center">
                      {entry.goalDifference > 0
                        ? `+${entry.goalDifference}`
                        : entry.goalDifference}
                    </td>
                    <td className="p-3 text-center text-2xl font-bold">
                      {entry.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )),
      )}
    </div>
  );
}

function MatchesView({ tournamentId }: { tournamentId: string }) {
  const { data: matches, isLoading } = useQuery({
    queryKey: ["display", tournamentId, "matches"],
    queryFn: () => getPublicMatches(tournamentId),
    refetchInterval: 15000,
  });

  if (isLoading || !matches) {
    return (
      <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">
        Spiele werden geladen...
      </div>
    );
  }

  const liveMatches = matches.filter(
    (m) => m.status === MatchStatus.InProgress,
  );
  const upcomingMatches = matches
    .filter((m) => m.status === MatchStatus.Scheduled)
    .slice(0, 8);
  const recentMatches = matches
    .filter((m) => m.status === MatchStatus.Completed)
    .slice(-4)
    .reverse();

  return (
    <div className="space-y-8">
      {liveMatches.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
            <span className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
            Laufende Spiele
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {liveMatches.map((match) => (
              <LiveMatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {upcomingMatches.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Nächste Spiele</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {upcomingMatches.map((match) => (
              <UpcomingMatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {recentMatches.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Letzte Ergebnisse</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {recentMatches.map((match) => (
              <CompletedMatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {liveMatches.length === 0 &&
        upcomingMatches.length === 0 &&
        recentMatches.length === 0 && (
          <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">
            Keine Spieldaten vorhanden
          </div>
        )}
    </div>
  );
}

function LiveMatchCard({ match }: { match: MatchDto }) {
  return (
    <div className="rounded-lg border-2 border-green-500/50 bg-green-500/5 p-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />
        <span className="text-sm font-medium text-green-400">LIVE</span>
        {match.courtName && (
          <span className="ml-auto text-xl text-muted-foreground">
            {match.courtName}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-medium">
          {match.homeParticipantName ?? "TBD"}
        </span>
        <span className="text-4xl font-bold tabular-nums">
          {match.homePoints ?? 0} : {match.awayPoints ?? 0}
        </span>
        <span className="text-2xl font-medium">
          {match.awayParticipantName ?? "TBD"}
        </span>
      </div>
    </div>
  );
}

function UpcomingMatchCard({ match }: { match: MatchDto }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between text-xl">
        <span className="font-medium">{match.homeParticipantName ?? "TBD"}</span>
        <div className="flex flex-col items-center">
          <span className="text-sm text-muted-foreground">
            {match.scheduledTime
              ? format(new Date(match.scheduledTime), "HH:mm")
              : "-"}
          </span>
          {match.courtName && (
            <span className="text-sm text-muted-foreground">
              {match.courtName}
            </span>
          )}
        </div>
        <span className="font-medium">{match.awayParticipantName ?? "TBD"}</span>
      </div>
    </div>
  );
}

function CompletedMatchCard({ match }: { match: MatchDto }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between text-xl">
        <span className="font-medium">{match.homeParticipantName ?? "TBD"}</span>
        <span className="text-3xl font-bold tabular-nums">
          {match.homePoints} : {match.awayPoints}
        </span>
        <span className="font-medium">{match.awayParticipantName ?? "TBD"}</span>
      </div>
    </div>
  );
}
