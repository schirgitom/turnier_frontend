import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronRight } from "lucide-react";
import {
  getPublicTournament,
  getPublicMatches,
  getPublicStandings,
} from "@/api/display";
import { getPhases, getPhaseMatches } from "@/api/phases";
import { cn } from "@/lib/utils";
import { MatchStatus } from "@/types/match";
import type { MatchDto } from "@/types/match";
import type { GroupStandings } from "@/types/standings";
import { isGroupPhase } from "@/types/phase";
import { isEliminationBracket } from "@/types/bracket";
import type { BracketRound } from "@/types/bracket";

type ViewMode = "standings" | "matches";

const ROTATION_VIEWS: ViewMode[] = ["standings", "matches"];

type StandingsSlide =
  | {
      kind: "group";
      key: string;
      title: string;
      group: GroupStandings;
    }
  | {
      kind: "ko-round";
      key: string;
      title: string;
      phaseTitle: string;
      round: BracketRound;
    };

function toGermanPhaseName(name: string): string {
  return name.replace(/^Group\s*/, "Gruppe ");
}

function formatKoSetScores(roundMatch: BracketRound["matches"][number]): string | null {
  const sets = roundMatch.score?.sets ?? roundMatch.sets ?? [];
  if (!Array.isArray(sets) || sets.length === 0) return null;

  return sets
    .slice()
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((set) => `${set.homeScore}:${set.awayScore}`)
    .join(" | ");
}

export function DisplayPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [searchParams] = useSearchParams();

  const viewParam = searchParams.get("view") ?? "auto";
  const intervalParam = parseInt(searchParams.get("interval") ?? "15", 10);
  const slideIntervalParam = parseInt(
    searchParams.get("slideInterval") ?? String(intervalParam),
    10,
  );
  const slideDurationSec =
    Number.isFinite(slideIntervalParam) && slideIntervalParam > 0
      ? slideIntervalParam
      : 15;

  const [currentView, setCurrentView] = useState<ViewMode>(
    viewParam === "auto" ? "standings" : (viewParam as ViewMode),
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [manualStandingsAdvanceSignal, setManualStandingsAdvanceSignal] = useState(0);

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

  const handleManualAdvance = useCallback(() => {
    if (currentView === "standings") {
      setManualStandingsAdvanceSignal((prev) => prev + 1);
      return;
    }
    rotateView();
  }, [currentView, rotateView]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== " ") return;
      event.preventDefault();
      handleManualAdvance();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleManualAdvance]);

  const { data: tournament, error: tournamentError, isLoading: tournamentLoading } = useQuery({
    queryKey: ["display", tournamentId],
    queryFn: () => getPublicTournament(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 60000,
    retry: false,
  });

  if (tournamentLoading) {
    return (
      <div className="dark flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-2xl text-muted-foreground">Wird geladen…</p>
      </div>
    );
  }

  if (tournamentError) {
    const msg = (() => {
      const err = tournamentError as { response?: { data?: { detail?: string; message?: string; title?: string }; status?: number } };
      const data = err?.response?.data;
      if (data?.detail) return data.detail;
      if (data?.message) return data.message;
      if (data?.title) return data.title;
      if (err?.response?.status === 404) return "Dieses Turnier ist nicht öffentlich zugänglich.";
      return "Das Turnier konnte nicht geladen werden.";
    })();

    return (
      <div className="dark flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground px-8 text-center">
        <svg className="h-16 w-16 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h1 className="text-3xl font-bold">Turnier nicht verfügbar</h1>
        <p className="max-w-md text-xl text-muted-foreground">{msg}</p>
        <p className="text-sm text-muted-foreground/60">
          Bitte stelle sicher, dass das Turnier auf „Öffentlich" gesetzt ist.
        </p>
      </div>
    );
  }

  return (
    <div className="dark flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-8 py-4">
        <h1 className="text-3xl font-bold">
          {tournament?.name ?? "Turnier"}
        </h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleManualAdvance}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border/80 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Weiter
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="text-3xl font-mono tabular-nums">
            {format(clock, "HH:mm:ss")}
          </div>
        </div>
      </header>

      <main
        className={cn(
          "flex-1 overflow-auto p-8 transition-opacity duration-500",
          isTransitioning ? "opacity-0" : "opacity-100",
        )}
      >
        {currentView === "standings" && (
          <StandingsView
            tournamentId={tournamentId!}
            slideDurationSec={slideDurationSec}
            manualAdvanceSignal={manualStandingsAdvanceSignal}
          />
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
          {currentView === "standings" && "Tabellen"}
          {currentView === "matches" && "Live Spiele"}
        </span>
      </footer>
    </div>
  );
}

// ─── Standings view (per-phase fetch) ────────────────────────────────────────

function StandingsView({
  tournamentId,
  slideDurationSec,
  manualAdvanceSignal,
}: {
  tournamentId: string;
  slideDurationSec: number;
  manualAdvanceSignal: number;
}) {
  const { data: tournament } = useQuery({
    queryKey: ["display", tournamentId],
    queryFn: () => getPublicTournament(tournamentId),
    refetchInterval: 60000,
  });

  const { data: matches } = useQuery({
    queryKey: ["display", tournamentId, "matches"],
    queryFn: () => getPublicMatches(tournamentId),
    refetchInterval: 30000,
  });

  const { data: phasesData } = useQuery({
    queryKey: ["display", tournamentId, "phases"],
    queryFn: () => getPhases(tournamentId),
    refetchInterval: 60000,
    retry: false,
  });

  const phases = phasesData?.phases ?? [];
  const phaseMatchesQueries = useQueries({
    queries: phases.map((phase) => ({
      queryKey: ["display", tournamentId, "phaseMatches", phase.id],
      queryFn: () => getPhaseMatches(tournamentId, phase.id),
      refetchInterval: 30000,
      retry: false,
    })),
  });

  const phaseIds = useMemo(() => {
    const groupPhaseIds =
      phases
        .filter((phase) => isGroupPhase(phase))
        .map((phase) => phase.id) ?? [];

    if (groupPhaseIds.length > 0) return groupPhaseIds;

    if (!matches) return [];
    const ids = new Set<string>();
    for (const m of matches) {
      if (m.phaseId) ids.add(m.phaseId);
    }
    return [...ids];
  }, [matches, phases]);

  const standingsQueries = useQueries({
    queries: phaseIds.map((phaseId) => ({
      queryKey: ["display", tournamentId, "standings", phaseId],
      queryFn: () => getPublicStandings(tournamentId, phaseId),
      refetchInterval: 30000,
    })),
  });

  const allGroups: Array<{ group: GroupStandings; phaseName: string }> = [];
  for (const q of standingsQueries) {
    if (!q.data?.groups) continue;
    const phase = phases.find((p) => p.id === q.data?.phaseId);
    const phaseName = phase ? toGermanPhaseName(phase.name) : "Gruppenphase";
    for (const g of q.data.groups) {
      allGroups.push({ group: g, phaseName });
    }
  }

  const koSlides: Extract<StandingsSlide, { kind: "ko-round" }>[] = [];
  phases.forEach((phase, idx) => {
    const result = phaseMatchesQueries[idx]?.data;
    if (!result || !isEliminationBracket(result)) return;
    const phaseTitle = toGermanPhaseName(phase.name);
    result.rounds.forEach((round) => {
      koSlides.push({
        kind: "ko-round",
        key: `ko-${phase.id}-round-${round.roundNumber}`,
        title: `${phaseTitle} · ${round.roundName}`,
        phaseTitle,
        round,
      });
    });
  });

  const groupSlides = allGroups.map(({ group, phaseName }) => ({
    kind: "group" as const,
    key: `group-${group.groupId}`,
    title: `${phaseName} · ${group.groupName.replace("Group", "Gruppe")}`,
    group,
  } satisfies StandingsSlide));

  const slides = [...groupSlides, ...koSlides];
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(slideDurationSec);

  const advanceSlide = useCallback(() => {
    if (slides.length > 1) {
      setCurrentSlideIndex((idx) => (idx + 1) % slides.length);
    }
    setSecondsLeft(slideDurationSec);
  }, [slides.length, slideDurationSec]);

  useEffect(() => {
    if (manualAdvanceSignal === 0) return;
    advanceSlide();
  }, [manualAdvanceSignal, advanceSlide]);

  useEffect(() => {
    setCurrentSlideIndex(0);
    setSecondsLeft(slideDurationSec);
  }, [slides.length, slideDurationSec]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setCurrentSlideIndex((idx) => (idx + 1) % slides.length);
          return slideDurationSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [slides.length, slideDurationSec]);

  const currentSlide = slides[currentSlideIndex] ?? null;

  const isLoading = !tournament || standingsQueries.some((q) => q.isLoading);

  if (isLoading && slides.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">
        Tabellen werden geladen...
      </div>
    );
  }

  if (slides.length === 0 || !currentSlide) {
    return (
      <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">
        Keine Tabellendaten vorhanden
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/30 px-4 py-2 text-sm">
        <span className="font-medium">{currentSlide.title}</span>
        <span className="text-muted-foreground">
          Seite {currentSlideIndex + 1}/{slides.length} · noch {secondsLeft}s
        </span>
      </div>

      {currentSlide.kind === "group" ? (
        <div className="rounded-lg border border-border">
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
              {currentSlide.group.standings.map((entry) => (
                <tr
                  key={entry.participantId}
                  className="border-b border-border/50 text-xl"
                >
                  <td className="p-3 font-bold">{entry.rank}</td>
                  <td className="p-3 font-medium">{entry.participantName}</td>
                  <td className="p-3 text-center">{entry.matchesPlayed}</td>
                  <td className="p-3 text-center">{entry.wins}</td>
                  <td className="p-3 text-center">{entry.draws}</td>
                  <td className="p-3 text-center">{entry.losses}</td>
                  <td className="p-3 text-center">
                    {entry.setDifference > 0
                      ? `+${entry.setDifference}`
                      : entry.setDifference}
                  </td>
                  <td className="p-3 text-center text-2xl font-bold">
                    {entry.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium">{currentSlide.phaseTitle}</span>
            <span className="text-muted-foreground">{currentSlide.round.roundName}</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {currentSlide.round.matches.map((match) => {
              const score = match.score;
              const homeWon = score != null && score.homePoints > score.awayPoints;
              const awayWon = score != null && score.awayPoints > score.homePoints;
              const setScoresLabel = formatKoSetScores(match);
              const totalLabel = score
                ? `${score.homePoints}:${score.awayPoints}`
                : "-:-";

              return (
                <div key={match.matchId} className="rounded-md border border-border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Spiel {match.matchNumber}</span>
                    <span>{match.status}</span>
                  </div>

                  <div className="space-y-2 text-xl">
                    <div className={cn("flex items-center justify-between", homeWon && "font-bold")}>
                      <span>{match.homeParticipantName ?? "TBD"}</span>
                    </div>
                    <div className={cn("flex items-center justify-between", awayWon && "font-bold")}>
                      <span>{match.awayParticipantName ?? "TBD"}</span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm tabular-nums">
                    <span className="text-muted-foreground">Satze </span>
                    <span>{setScoresLabel ?? "-"}</span>
                    <span className="mx-2 text-muted-foreground">|</span>
                    <span className="font-semibold">Gesamt {totalLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Live matches view ───────────────────────────────────────────────────────

function germanizePhaseName(name: string): string {
  return name.replace(/^Group\s/, "Gruppe ").replace(/^Group$/, "Gruppe");
}

function MatchesView({ tournamentId }: { tournamentId: string }) {
  const { data: matches, isLoading } = useQuery({
    queryKey: ["display", tournamentId, "matches"],
    queryFn: () => getPublicMatches(tournamentId),
    refetchInterval: 15000,
  });

  const { data: phasesData } = useQuery({
    queryKey: ["display", tournamentId, "phases"],
    queryFn: () => getPhases(tournamentId),
    refetchInterval: 60000,
    retry: false,
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

  const phaseNameById = new Map(
    (phasesData?.phases ?? []).map((phase) => [phase.id, germanizePhaseName(phase.name)]),
  );

  const phaseLabelFor = (match: MatchDto) => {
    if (!match.phaseId) return "Phase unbekannt";
    return phaseNameById.get(match.phaseId) ?? "Phase";
  };

  return (
    <div className="space-y-8">
      {liveMatches.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
            <span className="h-3 w-3 animate-pulse rounded-full bg-victora-success" />
            Laufende Spiele
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {liveMatches.map((match) => (
              <LiveMatchCard key={match.id} match={match} phaseLabel={phaseLabelFor(match)} />
            ))}
          </div>
        </section>
      )}

      {upcomingMatches.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Nächste Spiele</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {upcomingMatches.map((match) => (
              <UpcomingMatchCard key={match.id} match={match} phaseLabel={phaseLabelFor(match)} />
            ))}
          </div>
        </section>
      )}

      {recentMatches.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Letzte Ergebnisse</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {recentMatches.map((match) => (
              <CompletedMatchCard key={match.id} match={match} phaseLabel={phaseLabelFor(match)} />
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

function LiveMatchCard({ match, phaseLabel }: { match: MatchDto; phaseLabel: string }) {
  const score = match.score;
  return (
    <div className="rounded-lg border-2 border-victora-success/50 bg-victora-success/5 p-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-victora-success" />
        <span className="text-sm font-medium text-victora-success">LIVE</span>
        <span className="rounded-full border border-victora-secondary/20 bg-background/70 px-2 py-0.5 text-xs text-muted-foreground">
          {phaseLabel}
        </span>
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
          {score ? `${score.homePoints} : ${score.awayPoints}` : "0 : 0"}
        </span>
        <span className="text-2xl font-medium">
          {match.awayParticipantName ?? "TBD"}
        </span>
      </div>
    </div>
  );
}

function UpcomingMatchCard({ match, phaseLabel }: { match: MatchDto; phaseLabel: string }) {
  const time = match.scheduledAt ?? match.scheduledTime;
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border bg-muted px-2 py-0.5">
          {phaseLabel}
        </span>
        {match.courtName ? <span>{match.courtName}</span> : <span />}
      </div>
      <div className="flex items-center justify-between text-xl">
        <span className="font-medium">{match.homeParticipantName ?? "TBD"}</span>
        <div className="flex flex-col items-center">
          <span className="text-sm text-muted-foreground">
            {time ? format(new Date(time), "HH:mm") : "-"}
          </span>
        </div>
        <span className="font-medium">{match.awayParticipantName ?? "TBD"}</span>
      </div>
    </div>
  );
}

function CompletedMatchCard({ match, phaseLabel }: { match: MatchDto; phaseLabel: string }) {
  const score = match.score;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border bg-background px-2 py-0.5">
          {phaseLabel}
        </span>
        {match.courtName ? <span>{match.courtName}</span> : <span />}
      </div>
      <div className="flex items-center justify-between text-xl">
        <span className="font-medium">{match.homeParticipantName ?? "TBD"}</span>
        <span className="text-3xl font-bold tabular-nums">
          {score ? `${score.homePoints} : ${score.awayPoints}` : "– : –"}
        </span>
        <span className="font-medium">{match.awayParticipantName ?? "TBD"}</span>
      </div>
    </div>
  );
}
