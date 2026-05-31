import { useParams, Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Swords,
  MapPin,
  BarChart3,
  LayoutGrid,
  GitMerge,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getTournament } from "@/api/tournaments";
import { getRegistrations } from "@/api/registrations";
import { getMatches } from "@/api/matches";
import { getPhases } from "@/api/phases";
import { isGroupPhase } from "@/types/phase";
import type { PhaseResponse } from "@/types/phase";
import { TournamentStatusTimeline } from "@/components/tournament/TournamentStatusTimeline";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { MatchStatus } from "@/types/match";

const phaseStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  Pending: { label: "Ausstehend", className: "bg-[rgba(243,168,59,0.15)] text-[#c47e00] border-transparent" },
  Generated: { label: "Generiert", className: "bg-[rgba(87,25,75,0.08)] text-[#57194B] border-transparent" },
  Active: { label: "Laufend", className: "bg-[#AF5574] text-white border-transparent" },
  InProgress: { label: "Laufend", className: "bg-[#AF5574] text-white border-transparent" },
  Completed: { label: "Abgeschlossen", className: "bg-[#3FA97B] text-white border-transparent" },
};

function pendingReason(phase: PhaseResponse, allPhases: PhaseResponse[]): string {
  const prev = [...allPhases]
    .filter((p) => p.phaseOrder < phase.phaseOrder)
    .sort((a, b) => b.phaseOrder - a.phaseOrder)[0];
  if (prev && prev.status !== "Completed") return `Wartet auf ${prev.name}`;
  return "Noch nicht generiert";
}

function PhaseProgressBar({
  completed,
  total,
  status,
}: {
  completed: number;
  total: number;
  status: string;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barColor =
    status === "Completed"
      ? "bg-victora-success"
      : status === "InProgress" || status === "Active"
      ? "bg-primary"
      : "bg-muted-foreground/25";

  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {completed} / {total} Spiele abgeschlossen
      </p>
    </div>
  );
}

export function TournamentDashboardPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();

  const { data: tournament, isLoading: loadingTournament } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => getTournament(tournamentId!),
    enabled: !!tournamentId,
  });

  const { data: registrationsData } = useQuery({
    queryKey: ["registrations", tournamentId],
    queryFn: () => getRegistrations(tournamentId!),
    enabled: !!tournamentId,
  });

  const { data: matches } = useQuery({
    queryKey: ["matches", tournamentId],
    queryFn: () => getMatches(tournamentId!),
    enabled: !!tournamentId,
  });

  const { data: phasesData, isLoading: loadingPhases } = useQuery({
    queryKey: ["phases", tournamentId],
    queryFn: () => getPhases(tournamentId!),
    enabled: !!tournamentId,
  });

  const liveMatches =
    matches?.filter((m) => m.status === MatchStatus.InProgress) ?? [];
  const completedMatches =
    matches?.filter((m) => m.status === MatchStatus.Completed) ?? [];

  const phases = phasesData?.phases ?? [];
  const hasPendingPhase = phases.some((p) => p.status === "Pending");
  const hasInProgressPhase =
    tournament?.status === "InProgress" ||
    phases.some((p) => p.status === "InProgress" || p.status === "Active");

  const matchProgress =
    matches && matches.length > 0
      ? { completed: completedMatches.length, total: matches.length }
      : undefined;

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
        <Link to="participants" className="block">
          <Card className="cursor-pointer border-t-[3px] border-t-[#57194B] transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Teilnehmer</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#57194B]">
                {registrationsData?.registrations.length ?? 0}
              </div>
              <p className="text-xs text-[#AF5574]">
                {registrationsData?.totalConfirmed ?? 0} bestätigt
                {tournament?.maxParticipants
                  ? ` · max. ${tournament.maxParticipants}`
                  : ""}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="matches" className="block">
          <Card className="cursor-pointer border-t-[3px] border-t-[#AF5574] transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Spiele</CardTitle>
              <Swords className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#57194B]">{matches?.length ?? 0}</div>
              <p className="text-xs text-[#AF5574]">
                {completedMatches.length} abgeschlossen
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="matches" className="block">
          <Card className="cursor-pointer border-t-[3px] border-t-[#F75F61] transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Live</CardTitle>
              <div className="h-2 w-2 animate-pulse rounded-full bg-victora-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#57194B]">{liveMatches.length}</div>
              <p className="text-xs text-[#AF5574]">laufende Spiele</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="settings" className="block">
          <Card className="cursor-pointer border-t-[3px] border-t-[#FCB45A] transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Zeitraum</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold text-[#57194B]">
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
                <p className="flex items-center gap-1 text-xs text-[#AF5574]">
                  <MapPin className="h-3 w-3" />
                  {tournament.location}
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Tournament progress section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Turnier-Fortschritt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {tournament && (
            <TournamentStatusTimeline
              status={tournament.status}
              matchProgress={matchProgress}
            />
          )}

          <Separator />

          {/* Phase rows */}
          {loadingPhases ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : phases.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Noch keine Phasen konfiguriert.
              </p>
              <Link
                to={`/t/${tournamentId}/phases`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Phasen konfigurieren →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {phases.map((phase) => {
                const isGroup = isGroupPhase(phase);
                const PhaseIcon = isGroup ? LayoutGrid : GitMerge;
                const typeLabel = isGroup ? "Gruppenphase" : "K.O.-Phase";
                const statusCfg = phaseStatusConfig[phase.status] ?? {
                  label: phase.status,
                  className: "bg-[rgba(87,25,75,0.1)] text-[#57194B] border-transparent",
                };
                const isPending = phase.status === "Pending";
                const hasMatchData =
                  phase.totalMatches !== undefined &&
                  phase.totalMatches > 0;

                let metaLine: string | null = null;
                if (!isPending) {
                  if (isGroup) {
                    const parts = [
                      `${phase.numberOfGroups} Gruppen`,
                      `${phase.participantCount} Teilnehmer`,
                    ];
                    if (phase.totalMatches) parts.push(`${phase.totalMatches} Spiele`);
                    metaLine = parts.join(" · ");
                  } else {
                    const parts = [
                      `${phase.participantCount} Teilnehmer`,
                      `${phase.rounds} Runden`,
                    ];
                    if (phase.totalMatches) parts.push(`${phase.totalMatches} Spiele`);
                    metaLine = parts.join(" · ");
                  }
                }

                return (
                  <div key={phase.id} className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
                      <PhaseIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium leading-none">{phase.name}</span>
                        <Badge variant="outline" className="text-xs font-normal">
                          {typeLabel}
                        </Badge>
                        <Badge className={cn("text-xs", statusCfg.className)}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                      {isPending ? (
                        <p className="text-xs text-muted-foreground">
                          {pendingReason(phase, phases)}
                        </p>
                      ) : (
                        <>
                          {metaLine && (
                            <p className="text-xs text-muted-foreground">{metaLine}</p>
                          )}
                          {hasMatchData && (
                            <PhaseProgressBar
                              completed={phase.completedMatches ?? 0}
                              total={phase.totalMatches!}
                              status={phase.status}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick actions */}
          {(hasPendingPhase || hasInProgressPhase) && phases.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {hasPendingPhase && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/t/${tournamentId}/phases`)}
                  >
                    <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                    Phasen generieren
                  </Button>
                )}
                {hasInProgressPhase && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/t/${tournamentId}/matches`)}
                  >
                    <Swords className="mr-1.5 h-3.5 w-3.5" />
                    Ergebnisse eintragen
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {liveMatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-victora-success" />
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
    </div>
  );
}
