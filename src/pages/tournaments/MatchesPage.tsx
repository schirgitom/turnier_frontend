import { Fragment, useState } from "react";
import { useParams, useOutletContext } from "react-router";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, FlaskConical, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getMatches, startMatch, submitResult } from "@/api/matches";
import { getPhases, getPhaseMatches } from "@/api/phases";
import { getPhaseVenues } from "@/api/phaseVenues";
import { getApiErrorMessage } from "@/api/client";
import type { TournamentDto } from "@/types/tournament";
import { TournamentStatus } from "@/types/tournament";
import type { SetScore } from "@/types/match";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MatchStatus } from "@/types/match";
import type { MatchDto } from "@/types/match";
import { cn } from "@/lib/utils";
import { isGroupPhase } from "@/types/phase";
import { isEliminationBracket } from "@/types/bracket";
import type { GroupMatchesResponse } from "@/types/bracket";

const statusLabels: Record<MatchStatus, string> = {
  [MatchStatus.Scheduled]: "Geplant",
  [MatchStatus.InProgress]: "Laufend",
  [MatchStatus.Completed]: "Abgeschlossen",
  [MatchStatus.Cancelled]: "Abgesagt",
};

const statusClasses: Record<MatchStatus, string> = {
  [MatchStatus.Scheduled]: "bg-[rgba(87,25,75,0.08)] text-[#57194B] border-transparent",
  [MatchStatus.InProgress]: "bg-[#AF5574] text-white border-transparent",
  [MatchStatus.Completed]: "bg-[#3FA97B] text-white border-transparent",
  [MatchStatus.Cancelled]: "bg-[#D94E5F] text-white border-transparent",
};

function elimRoundShort(roundName: string, matchCount: number): string {
  if (roundName === "Final") return "F";
  if (roundName === "Semifinal") return "HF";
  if (roundName === "Quarterfinal") return "VF";
  const players = matchCount * 2;
  if (players === 16) return "AF";
  if (players === 32) return "L32";
  if (players === 64) return "L64";
  return `L${players}`;
}

function phaseAbbrev(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return words.map((w) => w[0]!.toUpperCase()).join("").slice(0, 3);
  return name.slice(0, 2).toUpperCase();
}

function toGermanGroup(name: string): string {
  return name.replace(/^Group\s/, "Gruppe ");
}

type FilterTab = "all" | "inprogress" | "scheduled" | "completed";

interface MatchMeta {
  phaseId: string;
  roundLabel: string;
  groupName?: string;
}

function randomSets(): SetScore[] {
  const setsToWin = 4;
  const homeWins = Math.random() > 0.5;
  const loserSets = Math.floor(Math.random() * setsToWin);

  const sets: SetScore[] = [];

  for (let i = 0; i < setsToWin; i++) {
    const loserScore = Math.floor(Math.random() * 10);
    sets.push(
      homeWins
        ? { homeScore: 11, awayScore: loserScore }
        : { homeScore: loserScore, awayScore: 11 },
    );
  }

  for (let i = 0; i < loserSets; i++) {
    const loserScore = Math.floor(Math.random() * 10);
    sets.push(
      homeWins
        ? { homeScore: loserScore, awayScore: 11 }
        : { homeScore: 11, awayScore: loserScore },
    );
  }

  return sets.sort(() => Math.random() - 0.5);
}

type SetRow = { homeScore: number | ""; awayScore: number | "" };

function emptySet(): SetRow {
  return { homeScore: "", awayScore: "" };
}

export function MatchesPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { tournament } = useOutletContext<{ tournament: TournamentDto | undefined }>();
  const queryClient = useQueryClient();

  const [selectedMatch, setSelectedMatch] = useState<MatchDto | null>(null);
  const [sets, setSets] = useState<SetRow[]>([emptySet()]);
  const [setsToWinOverride, setSetsToWinOverride] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [setValidationError, setSetValidationError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [demoProgress, setDemoProgress] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches", tournamentId],
    queryFn: () => getMatches(tournamentId!),
    enabled: !!tournamentId,
  });

  const { data: phasesData } = useQuery({
    queryKey: ["phases", tournamentId],
    queryFn: () => getPhases(tournamentId!),
    enabled: !!tournamentId,
  });
  const phases = phasesData?.phases ?? [];

  const phaseMatchQueries = useQueries({
    queries: phases.map((phase) => ({
      queryKey: ["phaseMatches", tournamentId, phase.id],
      queryFn: () => getPhaseMatches(tournamentId!, phase.id),
      enabled: !!tournamentId,
    })),
  });

  // Build match metadata map from phase match queries: matchId → { phaseId, roundLabel, groupName? }
  const matchMeta = new Map<string, MatchMeta>();
  phases.forEach((phase, i) => {
    const result = phaseMatchQueries[i]?.data;
    if (!result) return;

    if (isEliminationBracket(result)) {
      result.rounds.forEach((round) => {
        const label = elimRoundShort(round.roundName, round.matches.length);
        round.matches.forEach((match) => {
          matchMeta.set(match.matchId, { phaseId: phase.id, roundLabel: label });
        });
      });
      if (result.thirdPlaceMatch) {
        matchMeta.set(result.thirdPlaceMatch.matchId, { phaseId: phase.id, roundLabel: "P3" });
      }
    } else {
      const abbrev = isGroupPhase(phase) ? phaseAbbrev(phase.name) : "?";
      (result as GroupMatchesResponse[]).forEach((group) => {
        const groupName = toGermanGroup(group.groupName);
        group.matches.forEach((match) => {
          matchMeta.set(match.id, {
            phaseId: phase.id,
            roundLabel: `${abbrev} R${match.round}`,
            groupName,
          });
        });
      });
    }
  });

  // Match counts per phase (derived from flat matches list + metadata map)
  const matchCountByPhase = new Map<string, number>();
  matches?.forEach((m) => {
    const meta = matchMeta.get(m.id);
    if (meta) {
      matchCountByPhase.set(meta.phaseId, (matchCountByPhase.get(meta.phaseId) ?? 0) + 1);
    }
  });

  const phaseVenueQueries = useQueries({
    queries: phases.map((phase) => ({
      queryKey: ["phaseVenues", tournamentId, phase.id],
      queryFn: () => getPhaseVenues(tournamentId!, phase.id),
      enabled: !!tournamentId,
    })),
  });

  const courtToVenue = new Map<string, string>();
  phaseVenueQueries.forEach((q) => {
    if (!q.data) return;
    for (const venue of q.data.venues) {
      for (const court of venue.activeCourts) {
        courtToVenue.set(court.id, venue.venueName);
      }
    }
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { sets: SetScore[]; setsToWinOverride?: number }) => {
      if (selectedMatch?.status === MatchStatus.Scheduled) {
        await startMatch(tournamentId!, selectedMatch.id);
      }
      await submitResult(tournamentId!, selectedMatch!.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["standings", tournamentId] });
      setSelectedMatch(null);
      setSets([emptySet()]);
      setSetsToWinOverride("");
      setShowAdvanced(false);
      setSetValidationError(null);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const allScheduledMatches = matches?.filter((m) => m.status === MatchStatus.Scheduled) ?? [];
  const allInProgressMatches = matches?.filter((m) => m.status === MatchStatus.InProgress) ?? [];

  const showDemoButton =
    tournament?.status === TournamentStatus.InProgress &&
    (allScheduledMatches.length > 0 || allInProgressMatches.length > 0);

  // Phase-filtered base list (status tabs count against this)
  const phaseFilteredBase = (() => {
    if (!matches) return [];
    if (selectedPhase === "all") return matches;
    return matches.filter((m) => matchMeta.get(m.id)?.phaseId === selectedPhase);
  })();

  const filteredMatches = (() => {
    switch (filterTab) {
      case "inprogress": return phaseFilteredBase.filter((m) => m.status === MatchStatus.InProgress);
      case "scheduled": return phaseFilteredBase.filter((m) => m.status === MatchStatus.Scheduled);
      case "completed": return phaseFilteredBase.filter((m) => m.status === MatchStatus.Completed);
      default: return phaseFilteredBase;
    }
  })();

  const inProgressInPhase = phaseFilteredBase.filter((m) => m.status === MatchStatus.InProgress);

  const handleOpenResult = (match: MatchDto) => {
    setSelectedMatch(match);
    setSets([emptySet()]);
    setSetsToWinOverride("");
    setShowAdvanced(false);
    setSetValidationError(null);
    submitMutation.reset();
  };

  const handleAddSet = () => {
    if (sets.length < 7) setSets((prev) => [...prev, emptySet()]);
  };

  const handleRemoveSet = (idx: number) => {
    setSets((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSetChange = (
    idx: number,
    field: "homeScore" | "awayScore",
    value: string,
  ) => {
    setSets((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, [field]: value === "" ? "" : parseInt(value) || 0 } : s,
      ),
    );
  };

  const handleSubmitResult = () => {
    setSetValidationError(null);

    const parsedOverride =
      setsToWinOverride.trim() === ""
        ? undefined
        : Number.parseInt(setsToWinOverride, 10);

    if (parsedOverride !== undefined && (!Number.isInteger(parsedOverride) || parsedOverride < 1)) {
      return;
    }

    const hasIncompleteSet = sets.some(
      (s) => typeof s.homeScore !== "number" || typeof s.awayScore !== "number",
    );
    if (hasIncompleteSet) {
      setSetValidationError("Bitte in jedem Satz beide Punktzahlen eintragen.");
      return;
    }

    const hasDrawnSet = sets.some((s) => s.homeScore === s.awayScore);
    if (hasDrawnSet) {
      setSetValidationError("Ein Satz kann nicht unentschieden enden.");
      return;
    }

    const parsed: SetScore[] = sets.map((s) => ({
      homeScore: s.homeScore as number,
      awayScore: s.awayScore as number,
    }));
    if (parsed.length === 0) return;
    submitMutation.mutate({ sets: parsed, setsToWinOverride: parsedOverride });
  };

  const setsToWinOverrideError = (() => {
    if (setsToWinOverride.trim() === "") return null;
    const parsed = Number.parseInt(setsToWinOverride, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return "Mindestens 1";
    return null;
  })();

  const handleGenerateResults = async () => {
    setGenerating(true);
    setDemoProgress(null);
    let succeeded = 0;
    let failCount = 0;
    try {
      const freshMatches = await getMatches(tournamentId!);
      const targets = freshMatches.filter(
        (m) => m.status === MatchStatus.Scheduled || m.status === MatchStatus.InProgress,
      );
      for (let i = 0; i < targets.length; i++) {
        const match = targets[i]!;
        setDemoProgress(`Generiere Ergebnisse... (${i + 1}/${targets.length})`);
        try {
          if (match.status === MatchStatus.Scheduled) {
            await startMatch(tournamentId!, match.id);
          }
          await submitResult(tournamentId!, match.id, { sets: randomSets() });
          succeeded++;
        } catch {
          failCount++;
        }
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setGenerating(false);
      setDemoProgress(null);
    }
    queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
    queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
    if (succeeded > 0) toast.success(`${succeeded} Ergebnisse generiert`);
    if (failCount > 0) toast.error(`${failCount} Spiele konnten nicht verarbeitet werden`);
    setDemoDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const PHASE_TABS = [
    { id: "all", label: "Alle Phasen", count: matches?.length ?? 0 },
    ...phases.map((phase) => ({
      id: phase.id,
      label: phase.name,
      count: matchCountByPhase.get(phase.id) ?? 0,
    })),
  ];

  const STATUS_TABS: { id: FilterTab; label: string; count?: number }[] = [
    { id: "all", label: "Alle", count: phaseFilteredBase.length },
    {
      id: "inprogress",
      label: "Laufend",
      count: inProgressInPhase.length || undefined,
    },
    { id: "scheduled", label: "Geplant" },
    { id: "completed", label: "Abgeschlossen" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Spiele ({matches?.length ?? 0})</h2>
        {showDemoButton && (
          <Button variant="outline" size="sm" onClick={() => setDemoDialogOpen(true)}>
            <FlaskConical className="mr-2 h-4 w-4" />
            Demo: Zufällige Ergebnisse
          </Button>
        )}
      </div>

      {/* Phase filter tabs */}
      {phases.length > 0 && (
        <div className="flex gap-1 border-b">
          {PHASE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedPhase(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                selectedPhase === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Status filter tabs */}
      {(matches?.length ?? 0) > 0 && (
        <div className="flex gap-1 border-b">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                filterTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs font-medium",
                    tab.id === "inprogress"
                      ? "bg-[rgba(63,169,123,0.15)] text-[#3FA97B]"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {filteredMatches.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          {matches?.length === 0
            ? "Noch keine Spiele vorhanden. Erstelle Phasen und generiere Spiele."
            : "Keine Spiele in dieser Kategorie."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Runde</TableHead>
              <TableHead>Heim</TableHead>
              <TableHead className="w-32 text-center">Ergebnis</TableHead>
              <TableHead>Auswärts</TableHead>
              <TableHead className="w-16">Zeit</TableHead>
              <TableHead className="w-20">Platz</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-20">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMatches.map((match) => {
              const meta = matchMeta.get(match.id);
              const isLive = match.status === MatchStatus.InProgress;
              const isCompleted = match.status === MatchStatus.Completed;
              const homeWon = isCompleted && match.score != null && match.score.homePoints > match.score.awayPoints;
              const awayWon = isCompleted && match.score != null && match.score.awayPoints > match.score.homePoints;
              const isExpanded = expandedIds.has(match.id);

              return (
                <Fragment key={match.id}>
                  <TableRow
                    className={cn(
                      isLive && "bg-[rgba(63,169,123,0.05)]",
                      isCompleted && "cursor-pointer select-none",
                    )}
                    onClick={isCompleted ? () => toggleExpand(match.id) : undefined}
                  >
                    <TableCell className="text-muted-foreground text-sm">
                      <div className="flex flex-col gap-0.5">
                        <span>{meta?.roundLabel ?? `Runde ${match.round}`}</span>
                        {meta?.groupName && (
                          <span className="text-xs text-muted-foreground/70">
                            {meta.groupName}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Home name */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          homeWon ? "font-semibold" : isCompleted ? "text-muted-foreground" : "font-medium",
                        )}>
                          {match.homeParticipantName ?? "TBD"}
                        </span>
                        {homeWon && <Check className="h-3.5 w-3.5 shrink-0 text-victora-success" />}
                      </div>
                    </TableCell>

                    {/* Score */}
                    <TableCell className="text-center">
                      {match.score ? (
                        <div className="inline-flex items-stretch overflow-hidden rounded border text-sm">
                          <span className={cn(
                            "px-2.5 py-1 font-bold",
                            homeWon
                              ? "bg-[rgba(63,169,123,0.1)] text-victora-success"
                              : "text-muted-foreground",
                          )}>
                            {match.score.homePoints}
                          </span>
                          <span className="flex items-center border-x px-1.5 text-xs text-muted-foreground">
                            :
                          </span>
                          <span className={cn(
                            "px-2.5 py-1 font-bold",
                            awayWon
                              ? "bg-[rgba(63,169,123,0.1)] text-victora-success"
                              : "text-muted-foreground",
                          )}>
                            {match.score.awayPoints}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">– : –</span>
                      )}
                    </TableCell>

                    {/* Away name */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          awayWon ? "font-semibold" : isCompleted ? "text-muted-foreground" : "font-medium",
                        )}>
                          {match.awayParticipantName ?? "TBD"}
                        </span>
                        {awayWon && <Check className="h-3.5 w-3.5 shrink-0 text-victora-success" />}
                      </div>
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {match.scheduledAt
                        ? format(new Date(match.scheduledAt), "HH:mm")
                        : "–"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(() => {
                        const vName = match.courtId ? courtToVenue.get(match.courtId) : null;
                        if (vName && match.courtName) return `${vName} – ${match.courtName}`;
                        return match.courtName ?? (match.courtId ? match.courtId.substring(0, 8) + "…" : "–");
                      })()}
                    </TableCell>

                    <TableCell>
                      <Badge className={cn("gap-1.5", statusClasses[match.status])}>
                        {isLive && (
                          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
                        )}
                        {statusLabels[match.status]}
                      </Badge>
                    </TableCell>

                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isCompleted ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(match.id); }}
                        >
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenResult(match)}
                        >
                          Ergebnis
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expandable set details */}
                  {isExpanded && isCompleted && match.score && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="bg-muted/30 py-3 pb-4">
                        <div className="pl-6 space-y-1 text-sm">
                          {/* TODO: Backend should include sets array in match response */}
                          {match.score.sets && match.score.sets.length > 0 ? (
                            <>
                              {match.score.sets.map((set) => (
                                <div key={set.setNumber} className="flex items-center gap-3">
                                  <span className="w-14 text-muted-foreground">
                                    Satz {set.setNumber}
                                  </span>
                                  <span className={cn(
                                    "w-6 text-right font-medium",
                                    set.homeScore > set.awayScore && "text-victora-success",
                                  )}>
                                    {set.homeScore}
                                  </span>
                                  <span className="text-muted-foreground">:</span>
                                  <span className={cn(
                                    "w-6 font-medium",
                                    set.awayScore > set.homeScore && "text-victora-success",
                                  )}>
                                    {set.awayScore}
                                  </span>
                                </div>
                              ))}
                              <div className="mt-1.5 flex items-center gap-3 border-t pt-1.5">
                                <span className="w-14 font-medium">Endstand</span>
                                <span className="w-6 text-right font-bold">{match.score.homePoints}</span>
                                <span className="text-muted-foreground">:</span>
                                <span className="w-6 font-bold">{match.score.awayPoints}</span>
                                <span className="text-xs text-muted-foreground">(Sätze)</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="w-14 font-medium">Endstand</span>
                              <span className="font-bold">
                                {match.score.homePoints} : {match.score.awayPoints}
                              </span>
                              <span className="text-xs text-muted-foreground">(Sätze)</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Sets-based result entry dialog */}
      <Dialog
        open={selectedMatch !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMatch(null);
            setSets([emptySet()]);
            setSetsToWinOverride("");
            setShowAdvanced(false);
            setSetValidationError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ergebnis eintragen</DialogTitle>
            {selectedMatch && (
              <p className="text-sm text-muted-foreground">
                {selectedMatch.homeParticipantName ?? "TBD"}
                {" vs "}
                {selectedMatch.awayParticipantName ?? "TBD"}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-3">
            {submitMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(submitMutation.error)}
              </div>
            )}

            <div className="rounded-md border p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-medium"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                Erweitert
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-2">
                  <label className="text-sm font-medium" htmlFor="setsToWinOverride">
                    Sätze zum Sieg für dieses Match überschreiben
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Turnier-Default: {tournament?.matchSetsToWinOverride ?? "Sport-Default"}
                  </p>
                  <Input
                    id="setsToWinOverride"
                    type="number"
                    min={1}
                    placeholder="Leer lassen = Turnier-/Sport-Default"
                    value={setsToWinOverride}
                    onChange={(e) => setSetsToWinOverride(e.target.value)}
                  />
                  {setsToWinOverrideError && (
                    <p className="text-sm text-destructive">{setsToWinOverrideError}</p>
                  )}
                </div>
              )}
            </div>

            {setValidationError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {setValidationError}
              </div>
            )}

            {/* Column headers */}
            <div className="grid grid-cols-[3rem_1fr_1rem_1fr_2rem] items-center gap-2 text-xs font-medium text-muted-foreground">
              <span />
              <span className="text-center truncate">
                {selectedMatch ? (selectedMatch.homeParticipantName ?? "TBD") : "Heim"}
              </span>
              <span />
              <span className="text-center truncate">
                {selectedMatch ? (selectedMatch.awayParticipantName ?? "TBD") : "Auswärts"}
              </span>
              <span />
            </div>

            {/* Set rows */}
            <div className="space-y-2">
              {sets.map((set, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[3rem_1fr_1rem_1fr_2rem] items-center gap-2"
                >
                  <span className="text-xs text-muted-foreground text-right">
                    Satz {idx + 1}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={set.homeScore}
                    onChange={(e) => handleSetChange(idx, "homeScore", e.target.value)}
                    className="text-center"
                  />
                  <span className="text-center font-bold">:</span>
                  <Input
                    type="number"
                    min={0}
                    value={set.awayScore}
                    onChange={(e) => handleSetChange(idx, "awayScore", e.target.value)}
                    className="text-center"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveSet(idx)}
                    disabled={sets.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {sets.length < 7 && (
              <Button variant="outline" size="sm" className="w-full" onClick={handleAddSet}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Satz hinzufügen
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleSubmitResult}
              disabled={submitMutation.isPending || sets.length === 0 || !!setsToWinOverrideError}
            >
              {submitMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Ergebnis speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Demo: random results dialog */}
      <Dialog
        open={demoDialogOpen}
        onOpenChange={(open) => {
          if (!generating) setDemoDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zufällige Ergebnisse generieren?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Alle offenen Spiele der aktuellen Phase erhalten zufällige Ergebnisse.
            Dies dient nur zum Testen und kann nicht rückgängig gemacht werden.
          </p>
          {demoProgress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {demoProgress}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDemoDialogOpen(false)}
              disabled={generating}
            >
              Abbrechen
            </Button>
            <Button onClick={handleGenerateResults} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generiere...
                </>
              ) : (
                <>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  Generieren
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
