import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Swords, MapPin, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getTournament } from "@/api/tournaments";
import { getParticipants } from "@/api/participants";
import { getMatches } from "@/api/matches";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchStatus } from "@/types/match";

export function TournamentDashboardPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();

  const { data: tournament, isLoading: loadingTournament } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => getTournament(tournamentId!),
    enabled: !!tournamentId,
  });

  const { data: participantsData } = useQuery({
    queryKey: ["participants"],
    queryFn: () => getParticipants(),
  });

  const { data: matches } = useQuery({
    queryKey: ["matches", tournamentId],
    queryFn: () => getMatches(tournamentId!),
    enabled: !!tournamentId,
  });

  const liveMatches =
    matches?.filter((m) => m.status === MatchStatus.InProgress) ?? [];
  const completedMatches =
    matches?.filter((m) => m.status === MatchStatus.Completed) ?? [];

  if (loadingTournament) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Teilnehmer</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {participantsData?.totalCount ?? 0}
            </div>
            {tournament?.maxParticipants && (
              <p className="text-xs text-muted-foreground">
                von {tournament.maxParticipants} max.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Spiele</CardTitle>
            <Swords className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matches?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {completedMatches.length} abgeschlossen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Live</CardTitle>
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{liveMatches.length}</div>
            <p className="text-xs text-muted-foreground">laufende Spiele</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Zeitraum</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">
              {tournament &&
                format(new Date(tournament.startDate), "dd. MMM", {
                  locale: de,
                })}{" "}
              -{" "}
              {tournament &&
                format(new Date(tournament.endDate), "dd. MMM yyyy", {
                  locale: de,
                })}
            </div>
            {tournament?.location && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {tournament.location}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {liveMatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Laufende Spiele
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {liveMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-medium">
                      {match.homeParticipantName ?? "TBD"}
                    </span>
                    <span className="text-xl font-bold">
                      {match.homePoints ?? 0} : {match.awayPoints ?? 0}
                    </span>
                    <span className="font-medium">
                      {match.awayParticipantName ?? "TBD"}
                    </span>
                  </div>
                  {match.courtName && (
                    <Badge variant="outline">{match.courtName}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <Link
          to="participants"
          className="text-sm text-primary hover:underline"
        >
          Teilnehmer verwalten
        </Link>
        <Link to="matches" className="text-sm text-primary hover:underline">
          Alle Spiele anzeigen
        </Link>
        <Link to="standings" className="text-sm text-primary hover:underline">
          Tabellen anzeigen
        </Link>
      </div>
    </div>
  );
}
