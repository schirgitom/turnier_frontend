import { Fragment, useState, useMemo, useRef, useEffect } from "react";
import { useParams, useOutletContext } from "react-router";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, FlaskConical, Plus, Trash2, ChevronDown, ChevronUp, Trophy } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MatchStatus } from "@/types/match";
import type { MatchDto } from "@/types/match";
import { cn } from "@/lib/utils";
import { isGroupPhase } from "@/types/phase";
import { isEliminationBracket } from "@/types/bracket";
import type { GroupMatchesResponse } from "@/types/bracket";
import type { PhaseMatchesResponse } from "@/types/bracket";

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

function groupCodeFromName(name: string): string {
  const normalized = toGermanGroup(name).trim();
  if (normalized.toLowerCase().startsWith("gruppe ")) {
    return normalized.slice("Gruppe ".length).trim();
  }
  if (normalized.toLowerCase().startsWith("group ")) {
    return normalized.slice("Group ".length).trim();
  }
  return normalized;
}

function isAlreadyStartedMatchError(error: unknown): boolean {
  const maybeResponse = error as {
    response?: {
      data?: {
        detail?: string;
        message?: string;
        title?: string;
      };
    };
  };
  const detail = maybeResponse?.response?.data?.detail ?? "";
  const message = maybeResponse?.response?.data?.message ?? "";
  const title = maybeResponse?.response?.data?.title ?? "";
  const combined = `${detail} ${message} ${title}`.toLowerCase();

  return (
    combined.includes("cannot start a match with status") &&
    combined.includes("inprogress") &&
    combined.includes("must be scheduled")
  );
}

function getSetRowsFromPhaseMatchResponse(
  response: PhaseMatchesResponse,
  matchId: string,
): { rows: SetRow[]; fromAggregate: boolean } {
  if (isEliminationBracket(response)) {
    const allMatches = [
      ...response.rounds.flatMap((round) => round.matches),
      ...(response.thirdPlaceMatch ? [response.thirdPlaceMatch] : []),
    ];
    const match = allMatches.find((m) => m.matchId === matchId);
    const sets = match?.score?.sets ?? match?.sets;
    if (sets && sets.length > 0) {
      return {
        rows: sets.map((set) => ({ homeScore: set.homeScore, awayScore: set.awayScore })),
        fromAggregate: false,
      };
    }
    if (match?.score) {
      return {
        rows: [{ homeScore: match.score.homePoints, awayScore: match.score.awayPoints }],
        fromAggregate: true,
      };
    }
    return { rows: [], fromAggregate: false };
  }

  for (const group of response as GroupMatchesResponse[]) {
    const match = group.matches.find((m) => m.id === matchId);
    const sets = match?.score?.sets;
    if (sets && sets.length > 0) {
      return {
        rows: sets.map((set) => ({ homeScore: set.homeScore, awayScore: set.awayScore })),
        fromAggregate: false,
      };
    }
    if (match?.score) {
      return {
        rows: [{ homeScore: match.score.homePoints, awayScore: match.score.awayPoints }],
        fromAggregate: true,
      };
    }
  }

  return { rows: [], fromAggregate: false };
}

type FilterTab = "all" | "inprogress" | "scheduled" | "notcompleted" | "completed";

interface MatchMeta {
  phaseId: string;
  roundLabel: string;
  groupName?: string;
}

function randomSets(setsToWin: number, pointsToWin: number): SetScore[] {
  const homeWins = Math.random() > 0.5;
  const loserSets = Math.floor(Math.random() * setsToWin);

  const winSet = (): { winnerScore: number; loserScore: number } => {
    // Occasionally simulate a deuce: both reach pointsToWin-1, then win by exactly 2
    const hasDeuced = Math.random() < 0.15;
    if (hasDeuced) {
      // deuceRounds = extra vollständige Gleichstands-Runden nach erstem Deuce
      const deuceRounds = Math.floor(Math.random() * 4); // 0-3 extra rounds
      return {
        winnerScore: pointsToWin - 1 + deuceRounds + 2, // e.g. 13, 14, 15 ...
        loserScore:  pointsToWin - 1 + deuceRounds,     // e.g. 11, 12, 13 ...
      };
    }
    // Normal win: loser can have at most pointsToWin - 2 (min 2-point gap)
    const maxLoserScore = pointsToWin - 2;
    const loserScore = Math.floor(Math.random() * (maxLoserScore + 1));
    return { winnerScore: pointsToWin, loserScore };
  };

  const sets: SetScore[] = [];

  // Winner's sets
  for (let i = 0; i < setsToWin; i++) {
    const { winnerScore, loserScore } = winSet();
    sets.push(
      homeWins
        ? { homeScore: winnerScore, awayScore: loserScore }
        : { homeScore: loserScore, awayScore: winnerScore },
    );
  }

  // Loser's sets
  for (let i = 0; i < loserSets; i++) {
    const { winnerScore, loserScore } = winSet();
    sets.push(
      homeWins
        ? { homeScore: loserScore, awayScore: winnerScore }
        : { homeScore: winnerScore, awayScore: loserScore },
    );
  }

  return sets.sort(() => Math.random() - 0.5);
}

type SetRow = { homeScore: number | ""; awayScore: number | "" };

function emptySet(): SetRow {
  return { homeScore: "", awayScore: "" };
}

function getMatchState(sets: SetRow[], setsToWin: number) {
  let homeSets = 0;
  let awaySets = 0;
  for (const set of sets) {
    const h = typeof set.homeScore === "number" ? set.homeScore : NaN;
    const a = typeof set.awayScore === "number" ? set.awayScore : NaN;
    if (!isNaN(h) && !isNaN(a)) {
      if (h > a) homeSets++;
      else if (a > h) awaySets++;
    }
    if (homeSets >= setsToWin || awaySets >= setsToWin) break;
  }
  return { homeSets, awaySets, isComplete: homeSets >= setsToWin || awaySets >= setsToWin };
}

export function MatchesPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { tournament } = useOutletContext<{ tournament: TournamentDto | undefined }>();
  const queryClient = useQueryClient();

  const [selectedMatch, setSelectedMatch] = useState<MatchDto | null>(null);
  const [sets, setSets] = useState<SetRow[]>([emptySet()]);
  const [setsToWinOverride, setSetsToWinOverride] = useState<string>("");
  const [pointsToWinOverride, setPointsToWinOverride] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [setValidationError, setSetValidationError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [matchNumberFilter, setMatchNumberFilter] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [selectedCourt, setSelectedCourt] = useState("");
  const [hideByes, setHideByes] = useState(true);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillFromAggregate, setPrefillFromAggregate] = useState(false);

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
  const phaseMatchStatusById = new Map<string, string>();
  const phaseMatchSetsById = new Map<string, SetRow[]>();
  phases.forEach((phase, i) => {
    const result = phaseMatchQueries[i]?.data;
    if (!result) return;

    if (isEliminationBracket(result)) {
      result.rounds.forEach((round) => {
        const label = elimRoundShort(round.roundName, round.matches.length);
        round.matches.forEach((match) => {
          matchMeta.set(match.matchId, { phaseId: phase.id, roundLabel: label });
          phaseMatchStatusById.set(match.matchId, match.status);
          const sets = match.score?.sets ?? match.sets;
          if (sets && sets.length > 0) {
            phaseMatchSetsById.set(
              match.matchId,
              sets.map((set) => ({ homeScore: set.homeScore, awayScore: set.awayScore })),
            );
          }
        });
      });
      if (result.thirdPlaceMatch) {
        matchMeta.set(result.thirdPlaceMatch.matchId, { phaseId: phase.id, roundLabel: "P3" });
        phaseMatchStatusById.set(result.thirdPlaceMatch.matchId, result.thirdPlaceMatch.status);
        const sets = result.thirdPlaceMatch.score?.sets ?? result.thirdPlaceMatch.sets;
        if (sets && sets.length > 0) {
          phaseMatchSetsById.set(
            result.thirdPlaceMatch.matchId,
            sets.map((set) => ({ homeScore: set.homeScore, awayScore: set.awayScore })),
          );
        }
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
          phaseMatchStatusById.set(match.id, match.status);
          const sets = match.score?.sets;
          if (sets && sets.length > 0) {
            phaseMatchSetsById.set(
              match.id,
              sets.map((set) => ({ homeScore: set.homeScore, awayScore: set.awayScore })),
            );
          }
        });
      });
    }
  });

  const getEffectiveStatus = (match: MatchDto): string =>
    phaseMatchStatusById.get(match.id) ?? match.status ?? MatchStatus.Scheduled;

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

  const getVenueNameForMatch = (match: MatchDto): string | null => {
    if (match.venueName) return match.venueName;
    if (!match.courtId) return null;
    return courtToVenue.get(match.courtId) ?? null;
  };

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchText(searchInput), 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchInput]);

  const allParticipants = useMemo(() => {
    const names = new Set<string>();
    matches?.forEach((m) => {
      if (m.homeParticipantName) names.add(m.homeParticipantName);
      if (m.awayParticipantName) names.add(m.awayParticipantName);
    });
    return Array.from(names).sort((a, b) => {
      const numA = parseInt(a.split(" ").pop() ?? "");
      const numB = parseInt(b.split(" ").pop() ?? "");
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, "de");
    });
  }, [matches]);

  const venueOptions = useMemo(() => {
    const names = new Set<string>();
    matches?.forEach((match) => {
      const venueName = getVenueNameForMatch(match);
      if (venueName) names.add(venueName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "de"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, phases]);

  const courtOptions = useMemo(() => {
    const names = new Set<string>();
    matches?.forEach((match) => {
      if (!match.courtName) return;
      if (selectedVenue) {
        const venueName = getVenueNameForMatch(match);
        if (venueName !== selectedVenue) return;
      }
      names.add(match.courtName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "de"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, selectedVenue, phases]);

  useEffect(() => {
    if (selectedCourt && !courtOptions.includes(selectedCourt)) {
      setSelectedCourt("");
    }
  }, [selectedCourt, courtOptions]);

  const participantGroupCodeById = useMemo(() => {
    const map = new Map<string, string>();
    phases.forEach((phase) => {
      if (!isGroupPhase(phase)) return;
      phase.groups.forEach((group) => {
        const baseCode = groupCodeFromName(group.name);
        group.participants.forEach((participant, index) => {
          if (!participant.participantId || map.has(participant.participantId)) return;
          map.set(participant.participantId, `${baseCode}${index + 1}`);
        });
      });
    });
    return map;
  }, [phases]);

  const submitMutation = useMutation({
    mutationFn: async (data: {
      sets: SetScore[];
      setsToWinOverride?: number;
      pointsToWinOverride?: number;
    }) => {
      if (selectedMatch && getEffectiveStatus(selectedMatch) === MatchStatus.Scheduled) {
        try {
          await startMatch(tournamentId!, selectedMatch.id);
        } catch (error) {
          // Another client may have started the match in the meantime.
          if (!isAlreadyStartedMatchError(error)) {
            throw error;
          }
        }
      }
      await submitResult(tournamentId!, selectedMatch!.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["standings", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["phaseMatches", tournamentId] });
      setSelectedMatch(null);
      setSets([emptySet()]);
      setSetsToWinOverride("");
      setPointsToWinOverride("");
      setShowAdvanced(false);
      setSetValidationError(null);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const allScheduledMatches =
    matches?.filter((m) => getEffectiveStatus(m) === MatchStatus.Scheduled) ?? [];
  const allInProgressMatches =
    matches?.filter((m) => getEffectiveStatus(m) === MatchStatus.InProgress) ?? [];

  const showDemoButton =
    tournament?.status === TournamentStatus.InProgress &&
    (allScheduledMatches.length > 0 || allInProgressMatches.length > 0);

  // Phase-filtered base list (status tabs count against this)
  const phaseFilteredBase = (() => {
    if (!matches) return [];
    if (selectedPhase === "all") return matches;
    return matches.filter((m) => matchMeta.get(m.id)?.phaseId === selectedPhase);
  })();

  const statusFilteredMatches = (() => {
    switch (filterTab) {
      case "inprogress":
        return phaseFilteredBase.filter(
          (m) => getEffectiveStatus(m) === MatchStatus.InProgress,
        );
      case "scheduled":
        return phaseFilteredBase.filter(
          (m) => getEffectiveStatus(m) === MatchStatus.Scheduled,
        );
      case "notcompleted":
        return phaseFilteredBase.filter(
          (m) => getEffectiveStatus(m) !== MatchStatus.Completed,
        );
      case "completed":
        return phaseFilteredBase.filter(
          (m) => getEffectiveStatus(m) === MatchStatus.Completed,
        );
      default: return phaseFilteredBase;
    }
  })();

  const filteredMatches = useMemo(() => {
    let result = statusFilteredMatches;
    const normalizedMatchNumberFilter = matchNumberFilter.trim().toLowerCase();

    if (normalizedMatchNumberFilter) {
      result = result.filter((m) => m.matchNumber?.toLowerCase().includes(normalizedMatchNumberFilter));
    }

    if (hideByes) {
      result = result.filter((m) => m.homeParticipantName && m.awayParticipantName);
    }
    if (selectedParticipant) {
      result = result.filter(
        (m) => m.homeParticipantName === selectedParticipant || m.awayParticipantName === selectedParticipant,
      );
    }
    if (selectedVenue) {
      result = result.filter((m) => getVenueNameForMatch(m) === selectedVenue);
    }
    if (selectedCourt) {
      result = result.filter((m) => m.courtName === selectedCourt);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (m) =>
          m.homeParticipantName?.toLowerCase().includes(q) ||
          m.awayParticipantName?.toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;

      if (a.round !== b.round) return a.round - b.round;

      const aNum = Number.parseInt(String(a.matchNumber), 10);
      const bNum = Number.parseInt(String(b.matchNumber), 10);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) return aNum - bNum;

      return String(a.matchNumber).localeCompare(String(b.matchNumber), "de", { numeric: true });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilteredMatches, matchNumberFilter, hideByes, selectedParticipant, selectedVenue, selectedCourt, searchText]);

  const inProgressInPhase = phaseFilteredBase.filter(
    (m) => getEffectiveStatus(m) === MatchStatus.InProgress,
  );

  const handleOpenResult = async (match: MatchDto) => {
    const existingSetsFromMatch =
      match.score?.sets?.map((set) => ({
        homeScore: set.homeScore,
        awayScore: set.awayScore,
      })) ?? [];

    setSelectedMatch(match);
    setSets([emptySet()]);
    setSetsToWinOverride("");
    setPointsToWinOverride("");
    setShowAdvanced(false);
    setSetValidationError(null);
    setPrefillFromAggregate(false);
    submitMutation.reset();

    const meta = matchMeta.get(match.id);
    const fallbackSetsFromCache = phaseMatchSetsById.get(match.id) ?? existingSetsFromMatch;
    const fallbackSets =
      fallbackSetsFromCache.length > 0
        ? fallbackSetsFromCache
        : (match.score
          ? [{ homeScore: match.score.homePoints, awayScore: match.score.awayPoints }]
          : []);

    if (!meta?.phaseId) {
      setSets(fallbackSets.length > 0 ? fallbackSets : [emptySet()]);
      setPrefillFromAggregate(fallbackSetsFromCache.length === 0 && !!match.score);
      return;
    }

    setPrefillLoading(true);
    try {
      const freshPhaseMatches = await getPhaseMatches(tournamentId!, meta.phaseId);
      const fresh = getSetRowsFromPhaseMatchResponse(freshPhaseMatches, match.id);
      const prefills = fresh.rows.length > 0 ? fresh.rows : fallbackSets;
      setSets(prefills.length > 0 ? prefills : [emptySet()]);
      setPrefillFromAggregate(
        fresh.rows.length > 0
          ? fresh.fromAggregate
          : fallbackSetsFromCache.length === 0 && !!match.score,
      );
    } catch {
      setSets(fallbackSets.length > 0 ? fallbackSets : [emptySet()]);
      setPrefillFromAggregate(fallbackSetsFromCache.length === 0 && !!match.score);
    } finally {
      setPrefillLoading(false);
    }
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
    const parsedPointsOverride =
      pointsToWinOverride.trim() === ""
        ? undefined
        : Number.parseInt(pointsToWinOverride, 10);

    if (parsedOverride !== undefined && (!Number.isInteger(parsedOverride) || parsedOverride < 1)) {
      return;
    }
    if (
      parsedPointsOverride !== undefined &&
      (!Number.isInteger(parsedPointsOverride) || parsedPointsOverride < 1)
    ) {
      return;
    }

    const hasIncompleteSet = sets.some(
      (s) => typeof s.homeScore !== "number" || typeof s.awayScore !== "number",
    );
    if (hasIncompleteSet) {
      setSetValidationError("Bitte in jedem Satz beide Punktzahlen eintragen.");
      return;
    }

    if (hasAnyDrawError) {
      setSetValidationError("Ein Satz kann nicht unentschieden enden.");
      return;
    }

    if (hasAnyMinPointsError) {
      setSetValidationError(
        `Jeder Satz braucht mindestens ${dialogPointsToWin} Punkte für den Sieger (Turnier/Override).`,
      );
      return;
    }

    if (!matchState.isComplete) {
      setSetValidationError(
        `Das Spiel ist noch nicht entschieden. Einer der Spieler muss ${dialogSetsToWin} Sätze gewonnen haben.`,
      );
      return;
    }

    const parsed: SetScore[] = sets.map((s) => ({
      homeScore: s.homeScore as number,
      awayScore: s.awayScore as number,
    }));
    if (parsed.length === 0) return;
    submitMutation.mutate({
      sets: parsed,
      setsToWinOverride: parsedOverride,
      pointsToWinOverride: parsedPointsOverride,
    });
  };

  const setsToWinOverrideError = (() => {
    if (setsToWinOverride.trim() === "") return null;
    const parsed = Number.parseInt(setsToWinOverride, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return "Mindestens 1";
    return null;
  })();

  const pointsToWinOverrideError = (() => {
    if (pointsToWinOverride.trim() === "") return null;
    const parsed = Number.parseInt(pointsToWinOverride, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return "Mindestens 1";
    return null;
  })();

  const dialogSetsToWin = (() => {
    const override = setsToWinOverride.trim() !== "" ? Number.parseInt(setsToWinOverride, 10) : null;
    if (override !== null && Number.isInteger(override) && override >= 1) return override;
    return tournament?.matchSetsToWinOverride ?? tournament?.sport?.defaultRules?.setsToWin ?? 4;
  })();
  const dialogPointsToWin = (() => {
    const override =
      pointsToWinOverride.trim() !== ""
        ? Number.parseInt(pointsToWinOverride, 10)
        : null;
    if (override !== null && Number.isInteger(override) && override >= 1) {
      return override;
    }
    return (
      tournament?.matchPointsToWinOverride ??
      tournament?.sport?.defaultRules?.pointsToWinSet ??
      11
    );
  })();
  const maxSets = dialogSetsToWin * 2 - 1;
  const matchState = getMatchState(sets, dialogSetsToWin);
  const setDrawErrors = sets.map(
    (s) => typeof s.homeScore === "number" && typeof s.awayScore === "number" && s.homeScore === s.awayScore,
  );
  const setMinPointsErrors = sets.map((s) => {
    if (typeof s.homeScore !== "number" || typeof s.awayScore !== "number") return false;
    return Math.max(s.homeScore, s.awayScore) < dialogPointsToWin;
  });
  const hasAnyDrawError = setDrawErrors.some(Boolean);
  const hasAnyMinPointsError = setMinPointsErrors.some(Boolean);
  const winnerName = matchState.homeSets >= dialogSetsToWin
    ? (selectedMatch?.homeParticipantName ?? "Heim")
    : matchState.awaySets >= dialogSetsToWin
    ? (selectedMatch?.awayParticipantName ?? "Auswärts")
    : null;

  const handleGenerateResults = async () => {
    setGenerating(true);
    setDemoProgress(null);
    let succeeded = 0;
    let failCount = 0;

    const setsToWin =
      tournament?.matchSetsToWinOverride ??
      tournament?.sport?.defaultRules?.setsToWin ??
      4;
    const pointsToWin =
      tournament?.matchPointsToWinOverride ??
      tournament?.sport?.defaultRules?.pointsToWinSet ??
      11;

    try {
      const freshMatches = await getMatches(tournamentId!);
      const targets = freshMatches.filter(
        (m) =>
          getEffectiveStatus(m) === MatchStatus.Scheduled ||
          getEffectiveStatus(m) === MatchStatus.InProgress,
      );
      for (let i = 0; i < targets.length; i++) {
        const match = targets[i]!;
        setDemoProgress(`Generiere Ergebnisse... (${i + 1}/${targets.length})`);
        try {
          if (getEffectiveStatus(match) === MatchStatus.Scheduled) {
            await startMatch(tournamentId!, match.id);
          }
          await submitResult(tournamentId!, match.id, {
            sets: randomSets(setsToWin, pointsToWin),
            setsToWinOverride: setsToWin,
          });
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

  const activeFilterCount =
    (searchText.trim() ? 1 : 0) +
    (matchNumberFilter.trim() ? 1 : 0) +
    (selectedParticipant ? 1 : 0) +
    (selectedVenue ? 1 : 0) +
    (selectedCourt ? 1 : 0) +
    (hideByes ? 1 : 0);

  const resetAdvancedFilters = () => {
    setSearchInput("");
    setSearchText("");
    setMatchNumberFilter("");
    setSelectedParticipant("");
    setSelectedVenue("");
    setSelectedCourt("");
    setHideByes(true);
  };

  const PHASE_TABS = [
    { id: "all", label: "Alle Phasen", count: matches?.length ?? 0 },
    ...phases.map((phase) => ({
      id: phase.id,
      label: phase.name,
      count: matchCountByPhase.get(phase.id) ?? 0,
    })),
  ];

  const notCompletedInPhase = phaseFilteredBase.filter(
    (m) => getEffectiveStatus(m) !== MatchStatus.Completed,
  );

  const STATUS_TABS: { id: FilterTab; label: string; count?: number }[] = [
    { id: "all", label: "Alle", count: phaseFilteredBase.length },
    {
      id: "inprogress",
      label: "Laufend",
      count: inProgressInPhase.length || undefined,
    },
    { id: "scheduled", label: "Geplant" },
    { id: "notcompleted", label: "Nicht abgeschlossen", count: notCompletedInPhase.length || undefined },
    { id: "completed", label: "Abgeschlossen" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {filteredMatches.length < (matches?.length ?? 0)
            ? `Zeige ${filteredMatches.length} von ${matches?.length ?? 0} Spielen`
            : `Spiele (${matches?.length ?? 0})`}
        </h2>
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

      {/* Advanced filter bar */}
      {(matches?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Teilnehmer suchen..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-8 w-48 text-sm"
          />
          <Input
            placeholder="Matchnummer (z. B. A1)"
            value={matchNumberFilter}
            onChange={(e) => setMatchNumberFilter(e.target.value)}
            className="h-8 w-48 text-sm"
          />
          <Select
            value={selectedParticipant || "__all__"}
            onValueChange={(v) => setSelectedParticipant(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-48 text-sm">
              <SelectValue placeholder="Teilnehmer wählen..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Teilnehmer</SelectItem>
              {allParticipants.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedVenue || "__all__"}
            onValueChange={(v) => {
              const nextVenue = v === "__all__" ? "" : v;
              setSelectedVenue(nextVenue);
              setSelectedCourt("");
            }}
          >
            <SelectTrigger className="h-8 w-48 text-sm">
              <SelectValue placeholder="Spielstätte wählen..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Spielstätten</SelectItem>
              {venueOptions.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedCourt || "__all__"}
            onValueChange={(v) => setSelectedCourt(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-48 text-sm">
              <SelectValue placeholder="Platz wählen..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Plätze</SelectItem>
              {courtOptions.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideByes}
              onChange={(e) => setHideByes(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Freilose ausblenden
          </label>
          {activeFilterCount > 0 && (
            <>
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount} Filter aktiv
              </Badge>
              <button
                type="button"
                onClick={resetAdvancedFilters}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Filter zurücksetzen
              </button>
            </>
          )}
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
              const effectiveStatus = getEffectiveStatus(match);
              const meta = matchMeta.get(match.id);
              const isLive = effectiveStatus === MatchStatus.InProgress;
              const isCompleted = effectiveStatus === MatchStatus.Completed;
              const homeWon = isCompleted && match.score != null && match.score.homePoints > match.score.awayPoints;
              const awayWon = isCompleted && match.score != null && match.score.awayPoints > match.score.homePoints;
              const isExpanded = expandedIds.has(match.id);
              const homeGroupCode = match.homeParticipantId
                ? participantGroupCodeById.get(match.homeParticipantId)
                : undefined;
              const awayGroupCode = match.awayParticipantId
                ? participantGroupCodeById.get(match.awayParticipantId)
                : undefined;

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
                        {match.matchNumber && (
                          <span className="text-xs text-muted-foreground/70">
                            Match {match.matchNumber}
                          </span>
                        )}
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
                        {match.homeParticipantName != null ? (
                          <span className={cn(
                            homeWon ? "font-semibold" : isCompleted ? "text-muted-foreground" : "font-medium",
                          )}>
                            {match.homeParticipantName}
                            {homeGroupCode ? ` (${homeGroupCode})` : ""}
                          </span>
                        ) : (
                          <span style={{ fontStyle: "italic", color: "var(--color-text-secondary)" }}>TBD</span>
                        )}
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
                        {match.awayParticipantName != null ? (
                          <span className={cn(
                            awayWon ? "font-semibold" : isCompleted ? "text-muted-foreground" : "font-medium",
                          )}>
                            {match.awayParticipantName}
                            {awayGroupCode ? ` (${awayGroupCode})` : ""}
                          </span>
                        ) : (
                          <span style={{ fontStyle: "italic", color: "var(--color-text-secondary)" }}>TBD</span>
                        )}
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
                      <Badge className={cn("gap-1.5", statusClasses[effectiveStatus as MatchStatus] ?? "bg-muted text-muted-foreground border-transparent")}>
                        {isLive && (
                          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
                        )}
                        {statusLabels[effectiveStatus as MatchStatus] ?? effectiveStatus ?? "-"}
                      </Badge>
                    </TableCell>

                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isCompleted ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenResult(match);
                            }}
                          >
                            Korrigieren
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(match.id);
                            }}
                          >
                            {isExpanded
                              ? <ChevronUp className="h-4 w-4" />
                              : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenResult(match)}
                        >
                          {effectiveStatus === MatchStatus.Scheduled
                            ? "Ergebnis (startet automatisch)"
                            : "Ergebnis"}
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
            setPointsToWinOverride("");
            setShowAdvanced(false);
            setSetValidationError(null);
            setPrefillLoading(false);
            setPrefillFromAggregate(false);
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
            {prefillLoading && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="mr-2 inline h-3 w-3 animate-spin" />
                Lade vorhandenes Ergebnis...
              </div>
            )}
            {!prefillLoading && prefillFromAggregate && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Nur Gesamtergebnis vorhanden; Satzdetails wurden daraus vorbelegt.
              </div>
            )}

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

                  <label className="text-sm font-medium" htmlFor="pointsToWinOverride">
                    Punkte pro Satz für dieses Match überschreiben
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Turnier-Default: {tournament?.matchPointsToWinOverride ?? "Sport-Default"} (aktuell {dialogPointsToWin})
                  </p>
                  <Input
                    id="pointsToWinOverride"
                    type="number"
                    min={1}
                    placeholder="Leer lassen = Turnier-/Sport-Default"
                    value={pointsToWinOverride}
                    onChange={(e) => setPointsToWinOverride(e.target.value)}
                  />
                  {pointsToWinOverrideError && (
                    <p className="text-sm text-destructive">{pointsToWinOverrideError}</p>
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
                <div key={idx} className="space-y-1">
                  <div className="grid grid-cols-[3rem_1fr_1rem_1fr_2rem] items-center gap-2">
                    <span className="text-xs text-muted-foreground text-right">
                      Satz {idx + 1}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      value={set.homeScore}
                      onChange={(e) => handleSetChange(idx, "homeScore", e.target.value)}
                      className={cn(
                        "text-center",
                        (setDrawErrors[idx] || setMinPointsErrors[idx]) && "border-destructive",
                      )}
                    />
                    <span className="text-center font-bold">:</span>
                    <Input
                      type="number"
                      min={0}
                      value={set.awayScore}
                      onChange={(e) => handleSetChange(idx, "awayScore", e.target.value)}
                      className={cn(
                        "text-center",
                        (setDrawErrors[idx] || setMinPointsErrors[idx]) && "border-destructive",
                      )}
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
                  {setDrawErrors[idx] && (
                    <p className="pl-14 text-xs text-destructive">Kein Unentschieden möglich</p>
                  )}
                  {!setDrawErrors[idx] && setMinPointsErrors[idx] && (
                    <p className="pl-14 text-xs text-destructive">
                      Sieger in Satz {idx + 1} braucht mindestens {dialogPointsToWin} Punkte.
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Match decided indicator */}
            {matchState.isComplete && winnerName && (
              <div className="flex items-center gap-2 rounded-md bg-victora-success/10 px-3 py-2 text-sm text-victora-success">
                <Trophy className="h-4 w-4 shrink-0" />
                <span>
                  Spiel entschieden: <strong>{winnerName}</strong> gewinnt{" "}
                  {matchState.homeSets}:{matchState.awaySets}
                </span>
              </div>
            )}

            {sets.length < maxSets && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleAddSet}
                        disabled={matchState.isComplete}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Satz hinzufügen
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {matchState.isComplete && (
                    <TooltipContent>
                      Spiel bereits entschieden ({matchState.homeSets}:{matchState.awaySets})
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleSubmitResult}
              disabled={
                submitMutation.isPending ||
                sets.length === 0 ||
                !!setsToWinOverrideError ||
                !!pointsToWinOverrideError ||
                hasAnyDrawError ||
                hasAnyMinPointsError
              }
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
