import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, Play, TrendingDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { withStartSuffix } from "@/lib/multiStart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  canStartMatch,
  hasResult,
  isMatchDone,
  orderedPlayers,
  paschenMatchLabel,
  roundProgress,
  type PaschenMatchDto,
} from "@/types/paschen";

const SLOT_HEIGHT = 168; // px pro Erstrunden-Slot

function groupByRound(matches: PaschenMatchDto[]): [number, PaschenMatchDto[]][] {
  const byRound = new Map<number, PaschenMatchDto[]>();
  for (const match of matches) {
    const bucket = byRound.get(match.round);
    if (bucket) bucket.push(match);
    else byRound.set(match.round, [match]);
  }
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, list]) => [
      round,
      list.sort((a, b) => a.matchNumber - b.matchNumber),
    ]);
}

function resolveParticipantName(
  participantName: string | null,
  participantId: string | null,
  participantNames?: Map<string, string>,
): string {
  const name = participantName?.trim();
  if (name && name.toUpperCase() !== "TBD") return name;
  if (!participantId) return "offen";
  return (
    participantNames?.get(participantId) ??
    `Teilnehmer ${participantId.slice(0, 8)}`
  );
}

export function PaschenMatchCard({
  match,
  playersPerMatch,
  canRecord,
  onRecord,
  onStart,
  startingMatchId,
  startNumbers,
  participantNames,
  label,
}: {
  match: PaschenMatchDto;
  playersPerMatch: number;
  canRecord: boolean;
  onRecord?: (match: PaschenMatchDto) => void;
  onStart?: (match: PaschenMatchDto) => void;
  startingMatchId?: string | null;
  /** participantId → Start-Nummer, um mehrere Starts einer Person zu unterscheiden. */
  startNumbers?: Map<string, number>;
  participantNames?: Map<string, string>;
  /** Überschreibt die Standardbezeichnung (z. B. "Halbfinale 1"). */
  label?: string;
}) {
  const players = orderedPlayers(match);
  const done = hasResult(match);
  const isLive = match.status === "InProgress";
  const isBye = match.status === "Bye";
  const isCancelled = match.status === "Cancelled";
  const isWaiting = match.status === "Scheduled" && players.length === 0;
  // Ergebnis-Eingabe nur für spielbare (oder zur Korrektur bereits erfasste) Matches.
  const isPlayable =
    (match.status === "Scheduled" ||
      match.status === "InProgress" ||
      match.status === "Completed") &&
    players.length >= 2;
  const emptySlots =
    isCancelled || isWaiting || isBye
      ? 0
      : Math.max(0, playersPerMatch - players.length);
  // Leere Plätze in Runde 1 sind Freilose; in späteren Runden warten sie auf Aufsteiger.
  const emptySlotLabel = match.round === 1 ? "Freilos" : "offen";
  const showStart = canRecord && onStart !== undefined && canStartMatch(match);
  const isStarting = startingMatchId === match.id;

  const displayName = (participantId: string | null, participantName: string | null) => {
    const name = resolveParticipantName(participantName, participantId, participantNames);
    return startNumbers && participantId
      ? withStartSuffix(name, participantId, startNumbers)
      : name;
  };

  return (
    <div
      className={cn(
        "w-60 overflow-hidden rounded-lg border bg-card text-sm shadow-sm",
        isLive && "ring-2 ring-victora-secondary",
        isBye && "opacity-70",
        isCancelled && "bg-muted/40 opacity-50",
      )}
    >
      <div className="flex items-center justify-between border-b bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground">
        <span className="font-semibold tabular-nums">{label ?? paschenMatchLabel(match)}</span>
        <div className="flex items-center gap-1.5">
          {isLive && (
            <span className="inline-flex items-center gap-1 font-semibold text-victora-secondary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-victora-secondary" />
              Läuft
            </span>
          )}
          {isBye && <span className="italic">Freilos</span>}
          {isCancelled && <span className="italic">Entfällt</span>}
          {showStart && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              title="Spiel starten"
              disabled={isStarting}
              onClick={() => onStart!(match)}
            >
              {isStarting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </Button>
          )}
          {canRecord && onRecord && isPlayable && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              title={done ? "Ergebnis korrigieren" : "Ergebnis erfassen"}
              onClick={() => onRecord(match)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {isCancelled && (
        <div className="px-2.5 py-3 text-center italic text-muted-foreground">
          Entfällt
        </div>
      )}

      {isWaiting && (
        <div className="px-2.5 py-3 text-center italic text-muted-foreground/70">
          Noch offen – wartet auf die Vorrunde
        </div>
      )}

      {isBye && (
        <div className="px-2.5 py-3 text-center italic text-muted-foreground">
          {players.length > 0
            ? `Freilos – ${players
                .map((p) => displayName(p.participantId, p.participantName))
                .join(", ")} ${players.length === 1 ? "kommt" : "kommen"} weiter`
            : "Freilos"}
        </div>
      )}

      {!isCancelled && !isBye && players.map((player) => {
        const advances = player.advances === true;
        const eliminated = done && player.advances === false;
        return (
          <div
            key={player.participantId}
            className={cn(
              "flex items-center gap-1.5 border-b px-2.5 py-1.5 last:border-b-0",
              advances && "bg-[rgba(63,169,123,0.1)]",
            )}
          >
            {advances && (
              <Check className="h-3 w-3 shrink-0 text-victora-success" />
            )}
            <span
              className={cn(
                "flex-1 truncate",
                advances
                  ? "font-semibold"
                  : eliminated
                    ? "text-muted-foreground line-through decoration-muted-foreground/40"
                    : "font-medium",
              )}
            >
              {displayName(player.participantId, player.participantName)}
            </span>
            {player.points !== null && (
              <span
                className={cn(
                  "shrink-0 font-bold tabular-nums",
                  advances ? "text-victora-success" : "text-muted-foreground",
                )}
              >
                {player.points}
              </span>
            )}
          </div>
        );
      })}

      {Array.from({ length: emptySlots }).map((_, index) => (
        <div
          key={`empty-${index}`}
          className="border-b px-2.5 py-1.5 text-muted-foreground/50 last:border-b-0"
        >
          <span className="italic">{emptySlotLabel}</span>
        </div>
      ))}
    </div>
  );
}

function RoundProgressBar({
  matches,
  label,
}: {
  matches: PaschenMatchDto[];
  label?: (round: number) => string;
}) {
  const progress = roundProgress(matches);
  return (
    <div className="flex flex-wrap gap-1.5">
      {progress.map((round) => (
        <Badge
          key={round.round}
          variant="outline"
          className={cn(
            "text-[11px] font-normal",
            round.isComplete
              ? "border-victora-success/40 text-victora-success"
              : "text-muted-foreground",
          )}
        >
          {label ? label(round.round) : `Runde ${round.round}`}: {round.done} von {round.total} erfasst
        </Badge>
      ))}
    </div>
  );
}

export function PaschenRoundColumns({
  matches,
  playersPerMatch,
  canRecord,
  onRecord,
  onStart,
  startingMatchId,
  roundLabel,
  matchLabel,
  startNumbers,
  participantNames,
}: {
  matches: PaschenMatchDto[];
  playersPerMatch: number;
  canRecord: boolean;
  onRecord?: (match: PaschenMatchDto) => void;
  onStart?: (match: PaschenMatchDto) => void;
  startingMatchId?: string | null;
  roundLabel?: (round: number, isLast: boolean) => string;
  /** Optionale Bezeichnung je Spiel (z. B. "Halbfinale 1"). */
  matchLabel?: (match: PaschenMatchDto) => string | undefined;
  startNumbers?: Map<string, number>;
  participantNames?: Map<string, string>;
}) {
  const rounds = groupByRound(matches);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [rounds.length]);

  if (rounds.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Noch keine Spiele vorhanden.
      </p>
    );
  }

  const firstRoundCount = rounds[0]![1].length;
  const totalHeight = firstRoundCount * SLOT_HEIGHT;
  const active = rounds[activeIndex] ?? rounds[0]!;

  const labelFor = (round: number, index: number) =>
    roundLabel?.(round, index === rounds.length - 1) ?? `Runde ${round}`;
  const labelForRound = (round: number) =>
    labelFor(round, rounds.findIndex(([r]) => r === round));

  return (
    <div className="space-y-4">
      <RoundProgressBar matches={matches} label={labelForRound} />

      {/* Kompaktmodus: eine Runde nach der anderen */}
      <div className="space-y-4 xl:hidden">
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs disabled:opacity-50"
            onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
            disabled={activeIndex === 0}
          >
            Zurück
          </button>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {labelFor(active[0], activeIndex)} ({activeIndex + 1}/{rounds.length})
          </span>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs disabled:opacity-50"
            onClick={() =>
              setActiveIndex((i) => Math.min(rounds.length - 1, i + 1))
            }
            disabled={activeIndex >= rounds.length - 1}
          >
            Weiter
          </button>
        </div>
        <div className="space-y-3">
          {active[1].map((match) => (
            <div key={match.id} className="flex justify-center px-1">
              <PaschenMatchCard
                match={match}
                playersPerMatch={playersPerMatch}
                canRecord={canRecord}
                onRecord={onRecord}
                onStart={onStart}
                startingMatchId={startingMatchId}
                startNumbers={startNumbers}
                participantNames={participantNames}
                label={matchLabel?.(match)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Vollansicht ab xl */}
      <div className="hidden overflow-x-auto xl:block">
        <div className="flex min-w-max items-start gap-8">
          {rounds.map(([round, roundMatches], index) => {
            const perSlot = totalHeight / roundMatches.length;
            const allDone = roundMatches.every(isMatchDone);
            return (
              <div key={round} className="flex flex-col">
                <div className="mb-3 px-3 text-center">
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      allDone ? "text-victora-success" : "text-muted-foreground",
                    )}
                  >
                    {labelFor(round, index)}
                  </span>
                </div>
                <div
                  className="flex flex-col"
                  style={{ height: `${totalHeight}px` }}
                >
                  {roundMatches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-center px-3"
                      style={{ height: `${perSlot}px` }}
                    >
                      <PaschenMatchCard
                        match={match}
                        playersPerMatch={playersPerMatch}
                        canRecord={canRecord}
                        onRecord={onRecord}
                        onStart={onStart}
                        startingMatchId={startingMatchId}
                        startNumbers={startNumbers}
                        participantNames={participantNames}
                        label={matchLabel?.(match)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PaschenScoringHint() {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-victora-secondary/30 bg-victora-secondary/5 px-3 py-2 text-xs text-muted-foreground">
      <TrendingDown className="h-3.5 w-3.5 shrink-0 text-victora-secondary" />
      <span>
        <strong className="text-foreground">Weniger Punkte = besser.</strong>{" "}
        Der Spieler mit 0 Punkten ist der Beste. Aufsteiger erscheinen erst,
        wenn die gesamte Runde erfasst ist.
      </span>
    </div>
  );
}

export function PaschenFinalistsList({
  finalists,
  bracketIndex,
  startNumbers,
  participantNames,
}: {
  finalists: { participantId: string; participantName: string }[];
  bracketIndex: number;
  startNumbers?: Map<string, number>;
  participantNames?: Map<string, string>;
}) {
  if (finalists.length === 0) return null;
  return (
    <div className="rounded-md border border-victora-success/30 bg-[rgba(63,169,123,0.06)] p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Trophy className="h-3.5 w-3.5 text-victora-success" />
        <span className="text-xs font-semibold uppercase tracking-wide text-victora-success">
          Finalisten Baum {bracketIndex + 1}
        </span>
      </div>
      <ul className="space-y-0.5 text-sm">
        {finalists.map((finalist) => (
          <li key={finalist.participantId} className="truncate">
            {(() => {
              const name = resolveParticipantName(
                finalist.participantName,
                finalist.participantId,
                participantNames,
              );
              return startNumbers
                ? withStartSuffix(name, finalist.participantId, startNumbers)
                : name;
            })()}
          </li>
        ))}
      </ul>
    </div>
  );
}

