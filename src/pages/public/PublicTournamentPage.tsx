import { useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  Calendar,
  MapPin,
  ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  getPublicTournament,
  getPublicMatches,
  getPublicStandings,
} from "@/api/display";
import { getPhases, getPhaseMatches } from "@/api/phases";
import { BracketView } from "@/components/tournament/BracketView";
import { MatchStatus } from "@/types/match";
import type { MatchDto } from "@/types/match";
import { isGroupPhase } from "@/types/phase";
import { isEliminationBracket } from "@/types/bracket";
import type { PhaseResponse } from "@/types/phase";
import type { GroupStandings } from "@/types/standings";
import { cn } from "@/lib/utils";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatSetScores(match: MatchDto): string | null {
  const sets = match.score?.sets;
  if (!sets || sets.length === 0) return null;

  return sets
    .slice()
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((set) => `${set.homeScore}:${set.awayScore}`)
    .join(" | ");
}

function isByeMatch(match: MatchDto): boolean {
  if (String(match.status) === "Bye") return true;

  const hasHome = Boolean(match.homeParticipantName || match.homeParticipantId);
  const hasAway = Boolean(match.awayParticipantName || match.awayParticipantId);
  return hasHome !== hasAway;
}

function compareMatches(a: MatchDto, b: MatchDto): number {
  const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;

  if (a.round !== b.round) return a.round - b.round;

  const aMatchNumber = Number.parseInt(String(a.matchNumber), 10);
  const bMatchNumber = Number.parseInt(String(b.matchNumber), 10);
  if (!Number.isNaN(aMatchNumber) && !Number.isNaN(bMatchNumber) && aMatchNumber !== bMatchNumber) {
    return aMatchNumber - bMatchNumber;
  }

  return String(a.matchNumber).localeCompare(String(b.matchNumber), "de", { numeric: true });
}

const STATUS_LABELS: Record<string, string> = {
  Preparation: "In Vorbereitung",
  InProgress: "Laufend",
  Completed: "Abgeschlossen",
  Cancelled: "Abgesagt",
};

const STATUS_CLASSES: Record<string, string> = {
  Preparation: "bg-[rgba(87,25,75,0.1)] text-[#57194B] border-transparent",
  InProgress: "bg-[#AF5574] text-white border-transparent",
  Completed: "bg-[#3FA97B] text-white border-transparent",
  Cancelled: "bg-[#D94E5F] text-white border-transparent",
};

const MATCH_STATUS_CLASSES: Record<string, string> = {
  Scheduled: "bg-[rgba(87,25,75,0.08)] text-[#57194B] border-transparent",
  InProgress: "bg-[#AF5574] text-white border-transparent",
  Completed: "bg-[#3FA97B] text-white border-transparent",
  Cancelled: "bg-[#D94E5F] text-white border-transparent",
};

const MATCH_STATUS_LABELS: Record<string, string> = {
  Scheduled: "Geplant",
  InProgress: "Laufend",
  Completed: "Abgeschlossen",
  Cancelled: "Abgesagt",
};

export function PublicTournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();

  const { data: tournament, isLoading: loadingTournament } = useQuery({
    queryKey: ["public-tournament", tournamentId],
    queryFn: () => getPublicTournament(tournamentId!),
    enabled: !!tournamentId,
  });

  const { data: matches } = useQuery({
    queryKey: ["public-matches", tournamentId],
    queryFn: () => getPublicMatches(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  const { data: phasesData } = useQuery({
    queryKey: ["public-phases", tournamentId],
    queryFn: () => getPhases(tournamentId!),
    enabled: !!tournamentId,
    retry: false,
  });

  const phases = phasesData?.phases ?? [];

  if (loadingTournament) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="mt-8 h-96 w-full" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <p className="text-lg text-muted-foreground">Turnier nicht gefunden.</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Alle Turniere
      </Link>

      <div className="mb-6 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <Badge className={STATUS_CLASSES[tournament.status] ?? STATUS_CLASSES.Preparation}>
            {STATUS_LABELS[tournament.status] ?? tournament.status}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {tournament.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {tournament.location}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {format(new Date(tournament.startDate), "dd. MMM", { locale: de })}
            {" – "}
            {format(new Date(tournament.endDate), "dd. MMM yyyy", { locale: de })}
          </span>
        </div>
        {tournament.description && (
          <p className="text-sm text-muted-foreground">{tournament.description}</p>
        )}
      </div>

      <Tabs defaultValue="matches">
        <TabsList>
          <TabsTrigger value="matches">Spielplan</TabsTrigger>
          <TabsTrigger value="standings">Tabellen</TabsTrigger>
          {phases.some((p) => !isGroupPhase(p)) && (
            <TabsTrigger value="bracket">K.O.-Phase</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="matches" className="mt-4">
          <MatchesTab matches={matches ?? []} />
        </TabsContent>

        <TabsContent value="standings" className="mt-4">
          <StandingsTab tournamentId={tournamentId!} phases={phases} />
        </TabsContent>

        <TabsContent value="bracket" className="mt-4">
          <BracketTab tournamentId={tournamentId!} phases={phases} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Matches tab ─────────────────────────────────────────────────────────────

function MatchesTab({ matches }: { matches: MatchDto[] }) {
  const [filter, setFilter] = useState<"all" | "live" | "scheduled" | "completed">("all");
  const [participantFilter, setParticipantFilter] = useState("");

  const participants = useMemo(() => {
    const names = new Set<string>();
    for (const match of matches) {
      if (isByeMatch(match)) continue;
      if (match.homeParticipantName) names.add(match.homeParticipantName);
      if (match.awayParticipantName) names.add(match.awayParticipantName);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "de"));
  }, [matches]);

  const filtered = useMemo(() => {
    const visibleMatches = matches.filter((m) => !isByeMatch(m));
    const statusFiltered = (() => {
      switch (filter) {
        case "live":
          return visibleMatches.filter((m) => m.status === MatchStatus.InProgress);
        case "scheduled":
          return visibleMatches.filter((m) => m.status === MatchStatus.Scheduled);
        case "completed":
          return visibleMatches.filter((m) => m.status === MatchStatus.Completed);
        default:
          return visibleMatches;
      }
    })();

    const query = participantFilter.trim().toLowerCase();
    const participantFiltered = !query
      ? statusFiltered
      : statusFiltered.filter(
      (m) =>
        m.homeParticipantName?.toLowerCase().includes(query) ||
        m.awayParticipantName?.toLowerCase().includes(query),
    );

    return [...participantFiltered].sort(compareMatches);
  }, [matches, filter, participantFilter]);

  const liveCount = matches.filter((m) => !isByeMatch(m) && m.status === MatchStatus.InProgress).length;

  if (matches.filter((m) => !isByeMatch(m)).length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Noch keine Spiele vorhanden.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        {([
          { id: "all", label: "Alle" },
          { id: "live", label: "Live", count: liveCount },
          { id: "scheduled", label: "Geplant" },
          { id: "completed", label: "Abgeschlossen" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 -mb-px px-3 py-1.5 text-sm font-medium transition-colors",
              filter === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {"count" in tab && tab.count > 0 && (
              <span className="rounded-full bg-[rgba(63,169,123,0.15)] px-1.5 py-0.5 text-xs text-[#3FA97B]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground" htmlFor="participantFilter">
          Teilnehmer:
        </label>
        <input
          id="participantFilter"
          value={participantFilter}
          onChange={(e) => setParticipantFilter(e.target.value)}
          list="participantFilterOptions"
          placeholder="Name eingeben..."
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm"
        />
        <datalist id="participantFilterOptions">
          {participants.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {participantFilter && (
          <button
            type="button"
            onClick={() => setParticipantFilter("")}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Zurucksetzen
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Keine Spiele in dieser Kategorie.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Zeit</TableHead>
              <TableHead>Heim</TableHead>
              <TableHead className="w-28 text-center">Ergebnis</TableHead>
              <TableHead>Auswärts</TableHead>
              <TableHead className="w-36">Spielstatte</TableHead>
              <TableHead className="w-24">Platz</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((match) => {
              const isCompleted = match.status === MatchStatus.Completed;
              const homeWon =
                isCompleted &&
                match.score != null &&
                match.score.homePoints > match.score.awayPoints;
              const awayWon =
                isCompleted &&
                match.score != null &&
                match.score.awayPoints > match.score.homePoints;
              const setScores = formatSetScores(match);

              return (
                <TableRow key={match.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {match.scheduledAt
                      ? format(new Date(match.scheduledAt), "HH:mm")
                      : "–"}
                  </TableCell>
                  <TableCell
                    className={cn(homeWon ? "font-semibold" : isCompleted ? "text-muted-foreground" : "font-medium")}
                  >
                    {match.homeParticipantName ?? "TBD"}
                  </TableCell>
                  <TableCell className="text-center">
                    {match.score ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-bold tabular-nums">
                          {match.score.homePoints} : {match.score.awayPoints}
                        </span>
                        {setScores && (
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {setScores}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">– : –</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(awayWon ? "font-semibold" : isCompleted ? "text-muted-foreground" : "font-medium")}
                  >
                    {match.awayParticipantName ?? "TBD"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {match.venueName ?? "–"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {match.courtName ?? "–"}
                  </TableCell>
                  <TableCell>
                    <Badge className={MATCH_STATUS_CLASSES[match.status] ?? ""}>
                      {MATCH_STATUS_LABELS[match.status] ?? match.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─── Standings tab ───────────────────────────────────────────────────────────

function StandingsTab({
  tournamentId,
  phases,
}: {
  tournamentId: string;
  phases: PhaseResponse[];
}) {
  const groupPhaseIds = useMemo(
    () => phases.filter((p) => isGroupPhase(p)).map((p) => p.id),
    [phases],
  );

  const standingsQueries = useQueries({
    queries: groupPhaseIds.map((phaseId) => ({
      queryKey: ["public-standings", tournamentId, phaseId],
      queryFn: () => getPublicStandings(tournamentId, phaseId),
      refetchInterval: 60000,
    })),
  });

  const allGroups: GroupStandings[] = [];
  for (const q of standingsQueries) {
    if (q.data?.groups) {
      for (const g of q.data.groups) allGroups.push(g);
    }
  }

  const isLoading = standingsQueries.some((q) => q.isLoading);

  if (isLoading && allGroups.length === 0) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (allGroups.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Keine Tabellendaten vorhanden.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {allGroups.map((group) => (
        <div key={group.groupId} className="overflow-hidden rounded-lg border">
          <div className="border-b bg-muted/40 px-4 py-2.5">
            <h3 className="font-semibold">
              {group.groupName.replace("Group", "Gruppe")}
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Teilnehmer</TableHead>
                <TableHead className="text-center">Sp</TableHead>
                <TableHead className="text-center">S</TableHead>
                <TableHead className="text-center">N</TableHead>
                <TableHead className="text-center">Diff</TableHead>
                <TableHead className="text-center font-bold">Pkt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.standings.map((entry) => (
                <TableRow key={entry.participantId}>
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
                  <TableCell className="text-center">
                    {entry.setDifference > 0
                      ? `+${entry.setDifference}`
                      : entry.setDifference}
                  </TableCell>
                  <TableCell className="text-center text-base font-bold">
                    {entry.points}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}

// ─── Bracket tab ─────────────────────────────────────────────────────────────

function BracketTab({
  tournamentId,
  phases,
}: {
  tournamentId: string;
  phases: PhaseResponse[];
}) {
  const elimPhases = useMemo(
    () => phases.filter((p) => !isGroupPhase(p)),
    [phases],
  );

  const bracketQueries = useQueries({
    queries: elimPhases.map((phase) => ({
      queryKey: ["public-bracket", tournamentId, phase.id],
      queryFn: () => getPhaseMatches(tournamentId, phase.id),
      retry: false,
    })),
  });

  if (elimPhases.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Keine K.O.-Phase vorhanden.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {elimPhases.map((phase, i) => {
        const data = bracketQueries[i]?.data;
        const loading = bracketQueries[i]?.isLoading;

        if (loading) return <Skeleton key={phase.id} className="h-48 w-full" />;
        if (!data || !isEliminationBracket(data)) return null;

        return (
          <div key={phase.id}>
            {elimPhases.length > 1 && (
              <h3 className="mb-3 text-lg font-semibold">{phase.name}</h3>
            )}
            <BracketView data={data} />
          </div>
        );
      })}
    </div>
  );
}
