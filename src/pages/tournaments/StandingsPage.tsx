import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getPhases, getPhaseMatches } from "@/api/phases";
import { getStandings, recalculateStandings } from "@/api/standings";
import { BracketView } from "@/components/tournament/BracketView";
import { isGroupPhase } from "@/types/phase";
import { isEliminationBracket } from "@/types/bracket";
import type { GroupMatchesResponse } from "@/types/bracket";
import { getApiErrorMessage } from "@/api/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GroupStandings } from "@/types/standings";

const MATCH_STATUS_LABELS: Record<string, string> = {
  Scheduled: "Geplant",
  InProgress: "Laufend",
  Completed: "Abgeschlossen",
  Cancelled: "Abgesagt",
};

const MATCH_STATUS_CLASSES: Record<string, string> = {
  Scheduled: "bg-[rgba(87,25,75,0.08)] text-[#57194B] border-transparent",
  InProgress: "bg-[#AF5574] text-white border-transparent",
  Completed: "bg-[#3FA97B] text-white border-transparent",
  Cancelled: "bg-[#D94E5F] text-white border-transparent",
};

function toGerman(name: string) {
  return name.replace(/^Group\s/, "Gruppe ");
}

export function StandingsPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();

  const { data: phasesData, isLoading: phasesLoading } = useQuery({
    queryKey: ["phases", tournamentId],
    queryFn: () => getPhases(tournamentId!),
    enabled: !!tournamentId,
  });

  const phases = phasesData?.phases ?? [];

  if (phasesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Noch keine Phasen vorhanden.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tabellen</h2>
      <Tabs defaultValue={phases[0]!.id}>
        <TabsList>
          {phases.map((phase) => (
            <TabsTrigger key={phase.id} value={phase.id}>
              {toGerman(phase.name)}
            </TabsTrigger>
          ))}
        </TabsList>
        {phases.map((phase) => (
          <TabsContent key={phase.id} value={phase.id}>
            {isGroupPhase(phase) ? (
              <GroupPhaseView tournamentId={tournamentId!} phaseId={phase.id} />
            ) : (
              <EliminationPhaseView
                tournamentId={tournamentId!}
                phaseId={phase.id}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ─── Group phase: Tabelle + Spielplan sub-tabs ────────────────────────────────

function GroupPhaseView({
  tournamentId,
  phaseId,
}: {
  tournamentId: string;
  phaseId: string;
}) {
  return (
    <Tabs defaultValue="tabelle">
      <TabsList className="mt-2">
        <TabsTrigger value="tabelle">Tabelle</TabsTrigger>
        <TabsTrigger value="spielplan">Spielplan</TabsTrigger>
      </TabsList>
      <TabsContent value="tabelle">
        <PhaseStandings tournamentId={tournamentId} phaseId={phaseId} />
      </TabsContent>
      <TabsContent value="spielplan">
        <GroupMatchesPlan tournamentId={tournamentId} phaseId={phaseId} />
      </TabsContent>
    </Tabs>
  );
}

function GroupMatchesPlan({
  tournamentId,
  phaseId,
}: {
  tournamentId: string;
  phaseId: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["phaseMatches", tournamentId, phaseId],
    queryFn: () => getPhaseMatches(tournamentId, phaseId),
    enabled: !!tournamentId && !!phaseId,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data || isEliminationBracket(data)) return null;

  const groups = data as GroupMatchesResponse[];
  const allEmpty = groups.every((g) => g.matches.length === 0);

  if (allEmpty) {
    return (
      <p className="py-4 text-center text-muted-foreground">
        Noch keine Spiele generiert.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.groupId} className="overflow-hidden rounded-lg border">
          <div className="border-b bg-muted/40 px-4 py-2.5">
            <h3 className="font-semibold">{toGerman(group.groupName)}</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Runde</TableHead>
                <TableHead>Heim</TableHead>
                <TableHead className="text-center">Ergebnis</TableHead>
                <TableHead>Auswärts</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.matches.map((match) => {
                const isCompleted = match.status === "Completed";
                const homeWon =
                  isCompleted &&
                  match.score !== null &&
                  match.score.homePoints > match.score.awayPoints;
                const awayWon =
                  isCompleted &&
                  match.score !== null &&
                  match.score.awayPoints > match.score.homePoints;

                return (
                  <TableRow key={match.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      Runde {match.round}
                    </TableCell>
                    <TableCell
                      className={cn(
                        homeWon
                          ? "font-semibold"
                          : isCompleted
                            ? "text-muted-foreground"
                            : "font-medium",
                      )}
                    >
                      {match.homeParticipantName ?? "TBD"}
                    </TableCell>
                    <TableCell className="text-center">
                      {match.score ? (
                        <div className="inline-flex items-stretch overflow-hidden rounded border text-sm">
                          <span
                            className={cn(
                              "px-2 py-0.5 font-bold",
                              homeWon
                                ? "bg-[rgba(63,169,123,0.1)] text-victora-success"
                                : "text-muted-foreground",
                            )}
                          >
                            {match.score.homePoints}
                          </span>
                          <span className="flex items-center border-x px-1 text-xs text-muted-foreground">
                            :
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 font-bold",
                              awayWon
                                ? "bg-[rgba(63,169,123,0.1)] text-victora-success"
                                : "text-muted-foreground",
                            )}
                          >
                            {match.score.awayPoints}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">– : –</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        awayWon
                          ? "font-semibold"
                          : isCompleted
                            ? "text-muted-foreground"
                            : "font-medium",
                      )}
                    >
                      {match.awayParticipantName ?? "TBD"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          MATCH_STATUS_CLASSES[match.status] ?? "bg-[rgba(87,25,75,0.08)] text-[#57194B] border-transparent"
                        }
                      >
                        {MATCH_STATUS_LABELS[match.status] ?? match.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}

// ─── Elimination phase: bracket view ─────────────────────────────────────────

function EliminationPhaseView({
  tournamentId,
  phaseId,
}: {
  tournamentId: string;
  phaseId: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["phaseMatches", tournamentId, phaseId],
    queryFn: () => getPhaseMatches(tournamentId, phaseId),
    enabled: !!tournamentId && !!phaseId,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data || !isEliminationBracket(data)) return null;

  return <BracketView data={data} />;
}

// ─── Group standings table ────────────────────────────────────────────────────

function PhaseStandings({
  tournamentId,
  phaseId,
}: {
  tournamentId: string;
  phaseId: string;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["standings", tournamentId, phaseId],
    queryFn: () => getStandings(tournamentId, phaseId),
    enabled: !!tournamentId && !!phaseId,
  });

  const recalculateMutation = useMutation({
    mutationFn: () => recalculateStandings(tournamentId, phaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["standings", tournamentId, phaseId],
      });
      toast.success("Tabelle neu berechnet");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const groups = data?.groups ?? [];
  const isEmpty =
    groups.length === 0 || groups.every((g) => g.standings.length === 0);

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => recalculateMutation.mutate()}
          disabled={recalculateMutation.isPending}
        >
          {recalculateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Tabelle neu berechnen
        </Button>
      </div>

      {isEmpty ? (
        <p className="py-4 text-center text-muted-foreground">
          Noch keine Ergebnisse erfasst.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <GroupTable key={group.groupId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupTable({ group }: { group: GroupStandings }) {
  const lastQualifiedIdx = group.standings.reduce(
    (last, e, i) => (e.isQualified ? i : last),
    -1,
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-2.5">
        <h3 className="font-semibold">{toGerman(group.groupName)}</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Teilnehmer</TableHead>
            <TableHead className="text-center">Sp</TableHead>
            <TableHead className="text-center text-victora-success">
              S
            </TableHead>
            <TableHead className="text-center text-victora-error">
              N
            </TableHead>
            <TableHead className="text-center">U</TableHead>
            <TableHead className="text-center">Sätze</TableHead>
            <TableHead className="text-center">Diff</TableHead>
            <TableHead className="text-center font-bold">Pkt</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.standings.map((entry, idx) => (
            <TableRow
              key={entry.participantId}
              className={cn(
                entry.isQualified && "bg-[rgba(63,169,123,0.08)]",
                idx === lastQualifiedIdx &&
                  "border-b-2 border-b-[#3FA97B]/40",
              )}
            >
              <TableCell className="font-medium">{entry.rank}</TableCell>
              <TableCell className="font-medium">
                {entry.participantName}
              </TableCell>
              <TableCell className="text-center">
                {entry.matchesPlayed}
              </TableCell>
              <TableCell className="text-center text-victora-success">
                {entry.wins}
              </TableCell>
              <TableCell className="text-center text-victora-error">
                {entry.losses}
              </TableCell>
              <TableCell className="text-center">{entry.draws}</TableCell>
              <TableCell className="text-center">
                {entry.setsWon}:{entry.setsLost}
              </TableCell>
              <TableCell className="text-center">
                {entry.setDifference > 0
                  ? `+${entry.setDifference}`
                  : entry.setDifference}
              </TableCell>
              <TableCell className="text-center text-base font-bold">
                {entry.points}
              </TableCell>
              <TableCell className="text-center">
                {entry.isQualified ? (
                  <Badge className="bg-[rgba(63,169,123,0.15)] text-[#3FA97B] hover:bg-[rgba(63,169,123,0.15)]">
                    Qualifiziert
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Ausgeschieden
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
