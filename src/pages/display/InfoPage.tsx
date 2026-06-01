import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Search, User } from "lucide-react";
import {
  getPublicTournament,
  getPublicMatches,
  getPublicStandings,
} from "@/api/display";
import { MatchStatus } from "@/types/match";
import type { MatchDto } from "@/types/match";
import type { PublicStandingsDto } from "@/types/display";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  Scheduled: "Geplant",
  InProgress: "Laufend",
  Completed: "Abgeschlossen",
  Cancelled: "Abgesagt",
};

export function InfoPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const { data: tournament } = useQuery({
    queryKey: ["info", tournamentId, "tournament"],
    queryFn: () => getPublicTournament(tournamentId!),
    enabled: !!tournamentId,
  });

  const { data: matches } = useQuery({
    queryKey: ["info", tournamentId, "matches"],
    queryFn: () => getPublicMatches(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  const { data: standings } = useQuery({
    queryKey: ["info", tournamentId, "standings"],
    queryFn: () => getPublicStandings(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 60000,
  });

  const allParticipants = useMemo(() => {
    const names = new Set<string>();
    standings?.phases.forEach((phase) =>
      phase.groups.forEach((group) =>
        group.entries.forEach((e) => names.add(e.participantName)),
      ),
    );
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
  }, [standings, matches]);

  const filteredParticipants = useMemo(() => {
    if (!search.trim()) return allParticipants;
    const q = search.toLowerCase();
    return allParticipants.filter((n) => n.toLowerCase().includes(q));
  }, [allParticipants, search]);

  const infoUrl = window.location.href;

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
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {selectedName ? (
          <ParticipantView
            name={selectedName}
            matches={matches ?? []}
            standings={standings ?? null}
            onBack={() => setSelectedName(null)}
          />
        ) : (
          <SearchView
            search={search}
            onSearch={setSearch}
            participants={filteredParticipants}
            onSelect={setSelectedName}
          />
        )}
      </div>
    </div>
  );
}

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
              className="flex min-h-[44px] items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left text-base font-medium transition-colors hover:bg-muted/50 active:bg-muted"
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
  standings,
  onBack,
}: {
  name: string;
  matches: MatchDto[];
  standings: PublicStandingsDto | null;
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
    if (!standings) return null;
    for (const phase of standings.phases) {
      for (const group of phase.groups) {
        if (group.entries.some((e) => e.participantName === name)) {
          return { phase, group };
        }
      }
    }
    return null;
  }, [standings, name]);

  return (
    <div className="space-y-6">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border bg-card transition-colors hover:bg-muted/50"
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
                        <span>Runde {match.round}</span>
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
              {myGroup.group.groupName} · {myGroup.phase.phaseName}
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
                  <th className="px-3 py-2 text-center font-medium font-bold">Pkt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {myGroup.group.entries.map((entry) => {
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
                      <td className="px-3 py-2.5 text-center">{entry.played}</td>
                      <td className="px-3 py-2.5 text-center">{entry.won}</td>
                      <td className="px-3 py-2.5 text-center">{entry.lost}</td>
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
            {myGroup.group.entries.map((entry) => (
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
