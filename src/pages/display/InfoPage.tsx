import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Search, User, Trophy, Table2 } from "lucide-react";
import {
  getPublicTournament,
  getPublicMatches,
  getPublicStandings,
} from "@/api/display";
import { getPhases, getPhaseMatches } from "@/api/phases";
import { BracketView } from "@/components/tournament/BracketView";
import { MatchStatus } from "@/types/match";
import type { MatchDto } from "@/types/match";
import type { GroupStandings } from "@/types/standings";
import { cn } from "@/lib/utils";
import { isGroupPhase } from "@/types/phase";
import { isEliminationBracket } from "@/types/bracket";
import type { EliminationBracketResponse, GroupMatchesResponse } from "@/types/bracket";

const STATUS_LABELS: Record<string, string> = {
  Scheduled: "Geplant",
  InProgress: "Laufend",
  Completed: "Abgeschlossen",
  Cancelled: "Abgesagt",
};

interface PhaseGroup {
  phaseId: string;
  phaseName: string;
  group: GroupStandings;
}

interface MatchMeta {
  phaseId: string;
  phaseName: string;
  roundLabel: string;
}

interface KoPhaseEntry {
  phaseId: string;
  phaseName: string;
  data: EliminationBracketResponse | null;
}

type TabId = "search" | "standings" | "ko";

function displayPhaseName(name: string): string {
  return name.replace(/^Group\s*/i, "Gruppe ").trim();
}

function bracketRoundLabel(roundName: string, matchCount: number): string {
  if (roundName === "Final") return "Finale";
  if (roundName === "Semifinal") return "Halbfinale";
  if (roundName === "Quarterfinal") return "Viertelfinale";
  const players = matchCount * 2;
  if (players === 16) return "Achtelfinale";
  if (players === 32) return "Runde der letzten 32";
  if (players === 64) return "Runde der letzten 64";
  return `Runde der letzten ${players}`;
}

export function InfoPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("search");

  const { data: tournament, error: tournamentError } = useQuery({
    queryKey: ["info", tournamentId, "tournament"],
    queryFn: () => getPublicTournament(tournamentId!),
    enabled: !!tournamentId,
    retry: false,
  });

  const { data: matches } = useQuery({
    queryKey: ["info", tournamentId, "matches"],
    queryFn: () => getPublicMatches(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

    const { data: phasesData } = useQuery({
    queryKey: ["info", tournamentId, "phases"],
    queryFn: () => getPhases(tournamentId!),
    enabled: !!tournamentId,
    retry: false,
    refetchInterval: 60000,
  });

    const phases = phasesData?.phases ?? [];
    const groupPhases = useMemo(
      () => phases.filter((phase) => isGroupPhase(phase)),
      [phases],
    );
    const eliminationPhases = useMemo(
      () => phases.filter((phase) => !isGroupPhase(phase)),
      [phases],
    );

    const phaseMatchesQueries = useQueries({
      queries: phases.map((phase) => ({
        queryKey: ["info", tournamentId, "phaseMatches", phase.id],
        queryFn: () => getPhaseMatches(tournamentId!, phase.id),
        enabled: !!tournamentId,
        refetchInterval: 30000,
        retry: false,
      })),
    });

    const phaseById = useMemo(
      () => new Map(phases.map((phase) => [phase.id, phase])),
      [phases],
    );

  const phaseIds = useMemo(() => {
    const groupPhaseIds = groupPhases.map((phase) => phase.id);

    if (groupPhaseIds.length > 0) return groupPhaseIds;

    if (!matches) return [];
    const ids = new Set<string>();
    for (const m of matches) {
      if (m.phaseId) ids.add(m.phaseId);
    }
    return [...ids];
  }, [matches, groupPhases]);

  const standingsQueries = useQueries({
    queries: phaseIds.map((phaseId) => ({
      queryKey: ["info", tournamentId, "standings", phaseId],
      queryFn: () => getPublicStandings(tournamentId!, phaseId),
      refetchInterval: 60000,
    })),
  });

  const allPhaseGroups = useMemo(() => {
    const result: PhaseGroup[] = [];
    for (const q of standingsQueries) {
      if (!q.data?.groups) continue;
      const phase = phaseById.get(q.data.phaseId);
      for (const g of q.data.groups) {
        result.push({
          phaseId: q.data.phaseId,
          phaseName: phase ? displayPhaseName(phase.name) : "Phase",
          group: g,
        });
      }
    }
    return result;
  }, [standingsQueries, phaseById]);

  const matchMetaById = useMemo(() => {
    const meta = new Map<string, MatchMeta>();

    phases.forEach((phase, index) => {
      const result = phaseMatchesQueries[index]?.data;
      if (!result) return;

      if (isEliminationBracket(result)) {
        result.rounds.forEach((round) => {
          const label = bracketRoundLabel(round.roundName, round.matches.length);
          round.matches.forEach((match) => {
            meta.set(match.matchId, {
              phaseId: phase.id,
              phaseName: displayPhaseName(phase.name),
              roundLabel: label,
            });
          });
        });
        if (result.thirdPlaceMatch) {
          meta.set(result.thirdPlaceMatch.matchId, {
            phaseId: phase.id,
            phaseName: displayPhaseName(phase.name),
            roundLabel: "Spiel um Platz 3",
          });
        }
      } else {
        (result as GroupMatchesResponse[]).forEach((group) => {
          group.matches.forEach((match) => {
            meta.set(match.id, {
              phaseId: phase.id,
              phaseName: displayPhaseName(phase.name),
              roundLabel: `Runde ${match.round}`,
            });
          });
        });
      }
    });

    return meta;
  }, [phases, phaseMatchesQueries]);

  const koPhases = useMemo<KoPhaseEntry[]>(
    () =>
      eliminationPhases
        .map((phase) => {
          const phaseIndex = phases.findIndex((p) => p.id === phase.id);
          const data = phaseIndex >= 0 ? phaseMatchesQueries[phaseIndex]?.data : undefined;
          return {
            phaseId: phase.id,
            phaseName: displayPhaseName(phase.name),
            data: data && isEliminationBracket(data) ? data : null,
          };
        })
        .filter((entry): entry is KoPhaseEntry => entry !== null),
    [eliminationPhases, phaseMatchesQueries, phases],
  );

  const standingsPhaseIds = useMemo(
    () => new Set(standingsQueries.flatMap((q) => (q.data ? [q.data.phaseId] : []))),
    [standingsQueries],
  );

  const koMatchesFallback = useMemo(() => {
    if (!matches) return [];
    return matches
      .filter((m) => m.phaseId && !standingsPhaseIds.has(m.phaseId))
      .sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  }, [matches, standingsPhaseIds]);

  const allParticipants = useMemo(() => {
    const names = new Set<string>();
    for (const pg of allPhaseGroups) {
      for (const e of pg.group.standings) {
        names.add(e.participantName);
      }
    }
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
  }, [allPhaseGroups, matches]);

  const filteredParticipants = useMemo(() => {
    if (!search.trim()) return allParticipants;
    const q = search.toLowerCase();
    return allParticipants.filter((n) => n.toLowerCase().includes(q));
  }, [allParticipants, search]);

  const infoUrl = window.location.href;

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-8 text-center">
        <svg className="h-14 w-14 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h1 className="text-2xl font-bold">Turnier nicht verfügbar</h1>
        <p className="max-w-md text-muted-foreground">{msg}</p>
        <p className="text-sm text-muted-foreground/60">
          Bitte stelle sicher, dass das Turnier auf „Öffentlich" gesetzt ist.
        </p>
      </div>
    );
  }

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "search", label: "Spielplan", icon: <User className="h-4 w-4" /> },
    { id: "standings", label: "Tabellen", icon: <Table2 className="h-4 w-4" /> },
    ...(koPhases.length > 0 || koMatchesFallback.length > 0
      ? [{ id: "ko" as TabId, label: "K.O.-Phase", icon: <Trophy className="h-4 w-4" /> }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">
                {tournament?.name ?? "Turnier"}
              </h1>
              {tournament && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {format(new Date(tournament.startDate), "dd. MMMM", { locale: de })}
                  {" – "}
                  {format(new Date(tournament.endDate), "dd. MMMM yyyy", { locale: de })}
                  {tournament.location ? ` · ${tournament.location}` : ""}
                </p>
              )}
            </div>
            <div className="shrink-0">
              <QRCodeSVG value={infoUrl} size={72} />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 border-b -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedName(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Spielplan tab */}
        {activeTab === "search" && (
          selectedName ? (
            <ParticipantView
              name={selectedName}
              matches={matches ?? []}
              phaseGroups={allPhaseGroups}
              matchMetaById={matchMetaById}
              onBack={() => setSelectedName(null)}
            />
          ) : (
            <SearchView
              search={search}
              onSearch={setSearch}
              participants={filteredParticipants}
              onSelect={setSelectedName}
            />
          )
        )}

        {/* Tabellen tab */}
        {activeTab === "standings" && (
          <StandingsTabView phaseGroups={allPhaseGroups} />
        )}

        {/* KO-Phase tab */}
        {activeTab === "ko" && (
          <KoPhaseView phases={koPhases} fallbackMatches={koMatchesFallback} />
        )}
      </div>
    </div>
  );
}

// ─── Standings Tab ────────────────────────────────────────────────────────────

function StandingsTabView({ phaseGroups }: { phaseGroups: PhaseGroup[] }) {
  if (phaseGroups.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Noch keine Tabellendaten vorhanden.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {phaseGroups.map(({ phaseName, group }) => (
        <div key={group.groupId} className="rounded-lg border">
          <div className="border-b bg-muted/50 px-4 py-2.5">
            <h3 className="font-semibold">
              {phaseName} · {group.groupName.replace("Group", "Gruppe")}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-center font-medium">Sp</th>
                  <th className="px-3 py-2 text-center font-medium">S</th>
                  <th className="px-3 py-2 text-center font-medium">U</th>
                  <th className="px-3 py-2 text-center font-medium">N</th>
                  <th className="px-3 py-2 text-center font-medium">Diff</th>
                  <th className="px-3 py-2 text-center font-bold">Pkt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {group.standings.map((entry) => (
                  <tr key={entry.participantId} className={cn(entry.isQualified && "bg-[rgba(63,169,123,0.05)]")}>
                    <td className="px-3 py-2.5 font-bold">{entry.rank}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {entry.isQualified && (
                          <Trophy className="h-3 w-3 shrink-0 text-victora-success" />
                        )}
                        {entry.participantName}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">{entry.matchesPlayed}</td>
                    <td className="px-3 py-2.5 text-center">{entry.wins}</td>
                    <td className="px-3 py-2.5 text-center">{entry.draws}</td>
                    <td className="px-3 py-2.5 text-center">{entry.losses}</td>
                    <td className="px-3 py-2.5 text-center">
                      {entry.setDifference > 0 ? `+${entry.setDifference}` : entry.setDifference}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold">{entry.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── KO-Phase Tab ─────────────────────────────────────────────────────────────

function KoPhaseView({
  phases,
  fallbackMatches,
}: {
  phases: KoPhaseEntry[];
  fallbackMatches: MatchDto[];
}) {
  const fallbackRounds = useMemo(() => {
    const map = new Map<number, MatchDto[]>();
    for (const m of fallbackMatches) {
      const r = m.round ?? 0;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [fallbackMatches]);

  if (phases.length === 0 && fallbackRounds.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Noch keine K.O.-Phase vorhanden.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {phases.length > 0 ? (
        phases.map(({ phaseId, phaseName, data }) => (
          <div key={phaseId} className="space-y-3">
            <div className="border-b bg-muted/50 px-4 py-2.5">
              <h3 className="font-semibold">{phaseName}</h3>
            </div>
            {data ? (
              <BracketView data={data} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Noch keine K.O.-Spiele generiert.
              </p>
            )}
          </div>
        ))
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            K.O.-Spiele erkannt. Baumansicht wird geladen, sobald Phasendetails verfugbar sind.
          </p>
          {fallbackRounds.map(([round, matches]) => (
            <div key={round} className="rounded-lg border">
              <div className="border-b bg-muted/50 px-4 py-2.5">
                <h3 className="font-semibold">Runde {round}</h3>
              </div>
              <div className="divide-y">
                {matches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                    <span className="truncate">{match.homeParticipantName ?? "TBD"}</span>
                    <span className="text-muted-foreground">{match.score ? `${match.score.homePoints}:${match.score.awayPoints}` : "-:-"}</span>
                    <span className="truncate text-right">{match.awayParticipantName ?? "TBD"}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Search view ──────────────────────────────────────────────────────────────

function SearchView({
  search,
  onSearch,
  participants,
  onSelect,
}: {
  search: string;
  onSearch: (v: string) => void;
  participants: string[];
  onSelect: (name: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Deinen Namen eingeben..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-12 w-full rounded-lg border bg-background pl-10 pr-4 text-base outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
          autoFocus
        />
      </div>

      {participants.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          {search.trim() ? "Kein Teilnehmer gefunden." : "Keine Teilnehmer verfügbar."}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {participants.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onSelect(name)}
              className="flex min-h-11 items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left text-base font-medium transition-colors hover:bg-muted/50 active:bg-muted"
            >
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ParticipantView({
  name,
  matches,
  phaseGroups,
  matchMetaById,
  onBack,
}: {
  name: string;
  matches: MatchDto[];
  phaseGroups: PhaseGroup[];
  matchMetaById: Map<string, MatchMeta>;
  onBack: () => void;
}) {
  const myMatches = useMemo(
    () =>
      matches
        .filter(
          (m) => m.homeParticipantName === name || m.awayParticipantName === name,
        )
        .sort((a, b) => {
          const ta = a.scheduledAt ?? "";
          const tb = b.scheduledAt ?? "";
          return ta.localeCompare(tb);
        }),
    [matches, name],
  );

  const myGroup = useMemo(() => {
    for (const pg of phaseGroups) {
      if (pg.group.standings.some((e) => e.participantName === name)) {
        return pg;
      }
    }
    return null;
  }, [phaseGroups, name]);

  return (
    <div className="space-y-6">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-muted/50"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold">Dein Spielplan</h2>
          <p className="text-sm text-muted-foreground">{name}</p>
        </div>
      </div>

      {/* Matches table */}
      <div className="rounded-lg border">
        <div className="border-b bg-muted/50 px-4 py-2.5">
          <h3 className="font-semibold">Spiele</h3>
        </div>
        {myMatches.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted-foreground">
            Keine Spiele gefunden.
          </p>
        ) : (
          <div className="divide-y">
            {myMatches.map((match) => {
              const isHome = match.homeParticipantName === name;
              const opponent = isHome
                ? match.awayParticipantName
                : match.homeParticipantName;
              const isLive = match.status === MatchStatus.InProgress;
              const isCompleted = match.status === MatchStatus.Completed;
              const meta = matchMetaById.get(match.id);

              let scoreStr: string | null = null;
              if (isCompleted && match.score) {
                const myPts = isHome ? match.score.homePoints : match.score.awayPoints;
                const oppPts = isHome ? match.score.awayPoints : match.score.homePoints;
                scoreStr = `${myPts}:${oppPts}`;
              }

              return (
                <div
                  key={match.id}
                  className={cn(
                    "px-4 py-3",
                    isLive && "bg-victora-success/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isLive && (
                          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-victora-success" />
                        )}
                        <span className="font-medium">
                          vs. {opponent ?? "TBD"}
                        </span>
                        {scoreStr && (
                          <span className="text-sm font-bold text-victora-success">
                            {scoreStr}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                        <span className="rounded-full border border-input bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80">
                          {meta?.phaseName ?? "Phase"}
                        </span>
                        <span>{meta?.roundLabel ?? `Runde ${match.round}`}</span>
                        {match.scheduledAt && (
                          <span>
                            {format(new Date(match.scheduledAt), "HH:mm")}
                          </span>
                        )}
                        {match.courtName && <span>{match.courtName}</span>}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded px-2 py-0.5 text-xs font-medium",
                        isLive
                          ? "bg-victora-success/15 text-victora-success"
                          : isCompleted
                          ? "bg-muted text-muted-foreground"
                          : "bg-[rgba(87,25,75,0.08)] text-[#57194B]",
                      )}
                    >
                      {STATUS_LABELS[match.status] ?? match.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Group standings */}
      {myGroup && (
        <div className="rounded-lg border">
          <div className="border-b bg-muted/50 px-4 py-2.5">
            <h3 className="font-semibold">
              {myGroup.phaseName} · {myGroup.group.groupName.replace("Group", "Gruppe")}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-center font-medium">Sp</th>
                  <th className="px-3 py-2 text-center font-medium">S</th>
                  <th className="px-3 py-2 text-center font-medium">N</th>
                  <th className="px-3 py-2 text-center font-bold">Pkt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {myGroup.group.standings.map((entry) => {
                  const isMe = entry.participantName === name;
                  return (
                    <tr
                      key={entry.participantId}
                      className={cn(
                        isMe && "bg-primary/5 font-semibold",
                      )}
                    >
                      <td className="px-3 py-2.5">{entry.rank}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {isMe && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          )}
                          {entry.participantName}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">{entry.matchesPlayed}</td>
                      <td className="px-3 py-2.5 text-center">{entry.wins}</td>
                      <td className="px-3 py-2.5 text-center">{entry.losses}</td>
                      <td className="px-3 py-2.5 text-center font-bold">{entry.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Group members */}
      {myGroup && (
        <div className="rounded-lg border">
          <div className="border-b bg-muted/50 px-4 py-2.5">
            <h3 className="font-semibold">Gruppenmitglieder</h3>
          </div>
          <div className="divide-y">
            {myGroup.group.standings.map((entry) => (
              <div
                key={entry.participantId}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  entry.participantName === name && "bg-primary/5",
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {entry.rank}
                </span>
                <span className={cn("font-medium", entry.participantName === name && "text-primary")}>
                  {entry.participantName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
