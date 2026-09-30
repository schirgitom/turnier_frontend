import { useEffect, useState } from "react";
import { Check, Pencil, TrendingDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { withStartSuffix } from "@/lib/multiStart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  hasResult,
  isMatchDone,
  orderedPlayers,
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

export function PaschenMatchCard({
  match,
  playersPerMatch,
  canRecord,
  onRecord,
  startNumbers,
}: {
  match: PaschenMatchDto;
  playersPerMatch: number;
  canRecord: boolean;
  onRecord?: (match: PaschenMatchDto) => void;
  /** participantId → Start-Nummer, um mehrere Starts einer Person zu unterscheiden. */
  startNumbers?: Map<string, number>;
}) {
  const players = orderedPlayers(match);
  const done = hasResult(match);
  const isLive = match.status === "InProgress";
  const isBye = match.status === "Bye";
  const emptySlots = Math.max(0, playersPerMatch - players.length);

  return (
    <div
      className={cn(
        "w-60 overflow-hidden rounded-lg border bg-card text-sm shadow-sm",
        isLive && "ring-2 ring-victora-secondary",
        isBye && "opacity-70",
      )}
    >
      <div className="flex items-center justify-between border-b bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground">
        <span className="font-semibold tabular-nums">{match.matchCode}</span>
        <div className="flex items-center gap-1.5">
          {isLive && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-victora-secondary" />
          )}
          {isBye && <span className="italic">Freilos</span>}
          {canRecord && onRecord && players.length >= 2 && !isBye && (
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

      {players.map((player) => {
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
              {player.participantName
                ? startNumbers && player.participantId
                  ? withStartSuffix(
                      player.participantName,
                      player.participantId,
                      startNumbers,
                    )
                  : player.participantName
                : "TBD"}
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
          <span className="italic">offen</span>
        </div>
      ))}
    </div>
  );
}

function RoundProgressBar({ matches }: { matches: PaschenMatchDto[] }) {
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
          Runde {round.round}: {round.done} von {round.total} erfasst
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
  roundLabel,
  startNumbers,
}: {
  matches: PaschenMatchDto[];
  playersPerMatch: number;
  canRecord: boolean;
  onRecord?: (match: PaschenMatchDto) => void;
  roundLabel?: (round: number, isLast: boolean) => string;
  startNumbers?: Map<string, number>;
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

  return (
    <div className="space-y-4">
      <RoundProgressBar matches={matches} />

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
                startNumbers={startNumbers}
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
                        startNumbers={startNumbers}
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
}: {
  finalists: { participantId: string; participantName: string }[];
  bracketIndex: number;
  startNumbers?: Map<string, number>;
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
            {startNumbers
              ? withStartSuffix(
                  finalist.participantName,
                  finalist.participantId,
                  startNumbers,
                )
              : finalist.participantName}
          </li>
        ))}
      </ul>
    </div>
  );
}

