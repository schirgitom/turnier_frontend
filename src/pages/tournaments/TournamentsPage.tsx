import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Calendar, MapPin, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getTournaments } from "@/api/tournaments";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentStatus } from "@/types/tournament";

const statusLabels: Record<TournamentStatus, string> = {
  [TournamentStatus.Draft]: "Entwurf",
  [TournamentStatus.Published]: "Veröffentlicht",
  [TournamentStatus.RegistrationOpen]: "Anmeldung offen",
  [TournamentStatus.RegistrationClosed]: "Anmeldung geschlossen",
  [TournamentStatus.InProgress]: "Läuft",
  [TournamentStatus.Completed]: "Abgeschlossen",
  [TournamentStatus.Cancelled]: "Abgesagt",
};

const statusVariant: Record<
  TournamentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  [TournamentStatus.Draft]: "secondary",
  [TournamentStatus.Published]: "outline",
  [TournamentStatus.RegistrationOpen]: "default",
  [TournamentStatus.RegistrationClosed]: "secondary",
  [TournamentStatus.InProgress]: "default",
  [TournamentStatus.Completed]: "secondary",
  [TournamentStatus.Cancelled]: "destructive",
};

export function TournamentsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["tournaments", page],
    queryFn: () => getTournaments({ page }),
  });

  const tournaments = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Turniere</h1>
          <p className="text-muted-foreground">
            {data
              ? `${data.total ?? 0} Turnier${(data.total ?? 0) !== 1 ? "e" : ""}`
              : "Verwalte deine Turniere und Veranstaltungen."}
          </p>
        </div>
        <Button asChild>
          <Link to="/tournaments/new">
            <Plus className="mr-2 h-4 w-4" />
            Neues Turnier
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-muted-foreground">
              Noch keine Turniere vorhanden.
            </p>
            <Button asChild>
              <Link to="/tournaments/new">
                <Plus className="mr-2 h-4 w-4" />
                Erstes Turnier erstellen
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <Link key={tournament.id} to={`/t/${tournament.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">
                        {tournament.name}
                      </CardTitle>
                      <Badge variant={statusVariant[tournament.status]}>
                        {statusLabels[tournament.status]}
                      </Badge>
                    </div>
                    {tournament.description && (
                      <CardDescription className="line-clamp-2">
                        {tournament.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(
                          new Date(tournament.startDate),
                          "dd. MMM yyyy",
                          { locale: de },
                        )}
                      </span>
                    </div>
                    {tournament.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{tournament.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>
                        {tournament.participantCount} Teilnehmer
                        {tournament.maxParticipants &&
                          ` / ${tournament.maxParticipants}`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Zurück
              </Button>
              <span className="text-sm text-muted-foreground">
                Seite {page} von {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Weiter
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
