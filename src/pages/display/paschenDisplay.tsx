import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { getDisplayPaschenPhase, getDisplayPaschenRanking } from "@/api/display";
import { PaschenRankingTable } from "@/components/tournament/PaschenRankingTable";
import type { MatchDto } from "@/types/match";
import { cn } from "@/lib/utils";
import { isPaschenPhase, type PhaseResponse } from "@/types/phase";
import {
  buildPaschenMatchLabels,
  isMatchDone,
  type PaschenMatchDto,
  type PaschenMatchPlayer,
  type PaschenPhaseResponse,
} from "@/types/paschen";

/** Minimal gemeinsame Form von MatchDto (öffentliche Liste) und PaschenMatchDto. */
export interface PaschenLikeMatch {
  id: string;
  round: number;
  matchNumber: number | string;
  status: string;
  matchCode?: string | null;
  courtName?: string | null;
  players?: PaschenMatchPlayer[] | null;
}

export interface ResolvedPlayer {
  participantId: string;
  name: string;
  points: number | null;
  advances: boolean | null;
}

/** Lädt alle Paschen-Phasen anonym (Bäume inkl. aufgelöster Spielernamen). */
export function usePaschenDisplayData(
  tournamentId: string | undefined,
  phases: PhaseResponse[],
  keyPrefix: string,
) {
  const paschenPhaseIds = useMemo(
    () => phases.filter(isPaschenPhase).map((p) => p.id),
    [phases],
  );

  const queries = useQueries({
    queries: paschenPhaseIds.map((phaseId) => ({
      queryKey: [keyPrefix, tournamentId, "paschenPhase", phaseId],
      queryFn: () => getDisplayPaschenPhase(tournamentId!, phaseId),
      enabled: !!tournamentId,
      refetchInterval: 15000,
      retry: false,
    })),
  });

  const paschenPhases = queries
    .map((q) => q.data)
    .filter((d): d is PaschenPhaseResponse => d !== undefined);

  const dataKey = queries.map((q) => q.dataUpdatedAt).join(",");
  const nameMap = useMemo(
    () => buildPaschenNameMap(paschenPhases),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataKey],
  );
  // matchId → "Baum 1 · Runde 2 · Spiel 3" bzw. "Halbfinale 1" / "Finale"
  const matchLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const phase of paschenPhases) {
      for (const [id, label] of buildPaschenMatchLabels(phase)) map.set(id, label);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  return {
    paschenPhaseIds: new Set(paschenPhaseIds),
    paschenPhases,
    nameMap,
    matchLabels,
    isLoading: queries.some((q) => q.isLoading),
  };
}

export function allPaschenMatches(phase: PaschenPhaseResponse): PaschenMatchDto[] {
  return [...phase.brackets.flatMap((b) => b.matches), ...phase.finalMatches];
}

/**
 * Ergänzt die öffentliche Match-Liste um alle Paschen-Spiele aus den Phasen-Bäumen.
 * Der öffentliche /matches-Endpunkt liefert Paschen-Spiele nicht (zuverlässig) mit.
 */
export function mergePaschenMatches(
  matches: MatchDto[] | undefined,
  paschenPhases: PaschenPhaseResponse[],
): MatchDto[] {
  const base = matches ?? [];
  const byId = new Map<string, MatchDto>();
  for (const m of base) byId.set(m.id, m);
  for (const phase of paschenPhases) {
    for (const pm of allPaschenMatches(phase)) {
      const existing = byId.get(pm.id);
      // Paschen-Daten aus dem Baum haben Vorrang (enthalten players inkl. Namen)
      byId.set(pm.id, {
        ...(existing ?? {}),
        ...pm,
        phaseId: phase.id,
      } as unknown as MatchDto);
    }
  }
  return [...byId.values()];
}

/** Paschen-Rangliste(n) je Phase – anonym abrufbar. */
export function PaschenRankingsSection({
  tournamentId,
  phases,
  keyPrefix,
}: {
  tournamentId: string;
  phases: { id: string; name: string }[];
  keyPrefix: string;
}) {
  const queries = useQueries({
    queries: phases.map((phase) => ({
      queryKey: [keyPrefix, tournamentId, "paschenRanking", phase.id],
      queryFn: () => getDisplayPaschenRanking(tournamentId, phase.id),
      refetchInterval: 30000,
      retry: false,
    })),
  });

  if (phases.length === 0) return null;

  return (
    <div className="space-y-6">
      {phases.map((phase, i) => (
        <div key={phase.id} className="space-y-3">
          <div className="border-b bg-muted/50 px-4 py-2.5">
            <h3 className="font-semibold">{phase.name} · Rangliste</h3>
          </div>
          <PaschenRankingTable
            data={queries[i]?.data}
            isLoading={queries[i]?.isLoading ?? false}
          />
        </div>
      ))}
    </div>
  );
}

export function buildPaschenNameMap(phases: PaschenPhaseResponse[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const phase of phases) {
    for (const match of allPaschenMatches(phase)) {
      for (const p of match.players) {
        const name = p.participantName?.trim();
        if (p.participantId && name && name.toUpperCase() !== "TBD") {
          map.set(p.participantId, name);
        }
      }
    }
    for (const bracket of phase.brackets) {
      for (const f of bracket.finalists) {
        if (f.participantName) map.set(f.participantId, f.participantName);
      }
    }
  }
  return map;
}

export function isPaschenLikeMatch(match: { players?: unknown }): boolean {
  return Array.isArray(match.players);
}

/** Besetzte Slots mit aufgelöstem Namen – nach Punkten (falls vorhanden) sonst nach Slot. */
export function resolvePaschenPlayers(
  match: PaschenLikeMatch,
  nameMap: Map<string, string>,
): ResolvedPlayer[] {
  const players = (match.players ?? []).filter((p) => p.participantId);
  const hasPoints = players.some((p) => p.points !== null);
  return players
    .slice()
    .sort((a, b) =>
      hasPoints
        ? (a.points ?? 0) - (b.points ?? 0)
        : a.slotPosition - b.slotPosition,
    )
    .map((p) => ({
      participantId: p.participantId!,
      name:
        (p.participantName?.trim() && p.participantName.toUpperCase() !== "TBD"
          ? p.participantName
          : null) ??
        nameMap.get(p.participantId!) ??
        "Unbekannt",
      points: p.points,
      advances: p.advances,
    }));
}

export function paschenLabel(match: PaschenLikeMatch): string {
  const code = match.matchCode?.trim();
  if (code && code.toLowerCase() !== "null") return code;
  return `Runde ${match.round} · Spiel ${match.matchNumber}`;
}

/** Aktuelle Runde: erste noch nicht vollständig erledigte, sonst die letzte. */
export function currentRound(
  matches: PaschenMatchDto[],
): { round: number; matches: PaschenMatchDto[] } | null {
  const byRound = new Map<number, PaschenMatchDto[]>();
  for (const m of matches) {
    const list = byRound.get(m.round);
    if (list) list.push(m);
    else byRound.set(m.round, [m]);
  }
  const rounds = [...byRound.entries()].sort(([a], [b]) => a - b);
  if (rounds.length === 0) return null;
  const open = rounds.find(([, list]) => !list.every(isMatchDone));
  const [round, list] = open ?? rounds[rounds.length - 1]!;
  return {
    round,
    matches: list.slice().sort((a, b) => a.matchNumber - b.matchNumber),
  };
}

const STATUS_TEXT: Record<string, string> = {
  InProgress: "Läuft",
  Completed: "Beendet",
  Bye: "Freilos",
  Cancelled: "Entfällt",
  Walkover: "Kampflos",
};

/** Große Spielkarte für Beamer/Info-Seite. */
export function PaschenDisplayMatchCard({
  match,
  nameMap,
  size = "lg",
  highlightName,
  label,
}: {
  match: PaschenLikeMatch;
  nameMap: Map<string, string>;
  size?: "lg" | "sm";
  highlightName?: string;
  label?: string;
}) {
  const players = resolvePaschenPlayers(match, nameMap);
  const isLive = match.status === "InProgress";
  const isDone = players.some((p) => p.points !== null);
  const statusText = STATUS_TEXT[match.status];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card",
        isLive && "border-2 border-victora-success/60 bg-victora-success/5",
        (match.status === "Cancelled" || match.status === "Bye") && "opacity-60",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5 text-muted-foreground",
          size === "lg" ? "text-sm" : "text-xs",
        )}
      >
        <span className="font-semibold">{label ?? paschenLabel(match)}</span>
        <span className="flex items-center gap-2">
          {match.courtName && <span>{match.courtName}</span>}
          {isLive && (
            <span className="inline-flex items-center gap-1 font-semibold text-victora-success">
              <span className="h-2 w-2 animate-pulse rounded-full bg-victora-success" />
              LIVE
            </span>
          )}
          {!isLive && statusText && <span>{statusText}</span>}
        </span>
      </div>
      {players.length === 0 ? (
        <div
          className={cn(
            "px-3 py-3 text-center italic text-muted-foreground",
            size === "lg" ? "text-lg" : "text-sm",
          )}
        >
          Noch offen – wartet auf die Vorrunde
        </div>
      ) : (
        players.map((p) => (
          <div
            key={p.participantId}
            className={cn(
              "flex items-center gap-2 border-b px-3 last:border-b-0",
              size === "lg" ? "py-2 text-xl" : "py-1.5 text-sm",
              p.advances === true && "bg-[rgba(63,169,123,0.1)]",
              highlightName && p.name === highlightName && "bg-primary/5 font-semibold",
            )}
          >
            {p.advances === true && (
              <Check className="h-4 w-4 shrink-0 text-victora-success" />
            )}
            <span
              className={cn(
                "flex-1 truncate",
                p.advances === true && "font-semibold",
                isDone && p.advances === false && "text-muted-foreground line-through decoration-muted-foreground/40",
              )}
            >
              {p.name}
            </span>
            {p.points !== null && (
              <span
                className={cn(
                  "shrink-0 font-bold tabular-nums",
                  p.advances ? "text-victora-success" : "text-muted-foreground",
                )}
              >
                {p.points}
              </span>
            )}
          </div>
        ))
      )}
    </div>
  );
}
