import { Check, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BracketMatchDto, EliminationBracketResponse } from "@/types/bracket";

// TODO: Add SVG connector lines between rounds for a proper bracket look.
// Requires tracking each match card's DOM position and drawing bezier paths
// between the vertical midpoints of parent → child match cards across rounds.

function getRoundName(roundName: string, matchCount: number): string {
  if (roundName === "Final") return "Finale";
  if (roundName === "Semifinal") return "Halbfinale";
  if (roundName === "Quarterfinal") return "Viertelfinale";
  const players = matchCount * 2;
  if (players === 16) return "Achtelfinale";
  if (players === 32) return "Runde der letzten 32";
  if (players === 64) return "Runde der letzten 64";
  return `Runde der letzten ${players}`;
}

function MatchCard({ match }: { match: BracketMatchDto }) {
  const isCompleted = match.status === "Completed";
  const isLive = match.status === "InProgress";

  const homeWon =
    isCompleted &&
    match.score !== null &&
    match.score.homePoints > match.score.awayPoints;
  const awayWon =
    isCompleted &&
    match.score !== null &&
    match.score.awayPoints > match.score.homePoints;

  const homeName =
    match.isBye && match.homeParticipantId === null
      ? "Freilos"
      : (match.homeParticipantName ?? "TBD");
  const awayName =
    match.isBye && match.awayParticipantId === null
      ? "Freilos"
      : (match.awayParticipantName ?? "TBD");

  const isByeHome = match.isBye && match.homeParticipantId === null;
  const isByeAway = match.isBye && match.awayParticipantId === null;

  return (
    <div
      className={cn(
        "w-52 overflow-hidden rounded-lg border bg-card text-sm shadow-sm",
        isLive && "ring-2 ring-victora-secondary",
      )}
    >
      {/* Home row */}
      <div
        className={cn(
          "flex items-center gap-1.5 border-b px-3 py-2",
          homeWon && "bg-[rgba(63,169,123,0.1)]",
        )}
      >
        {homeWon && (
          <Check className="h-3 w-3 shrink-0 text-victora-success" />
        )}
        <span
          className={cn(
            "flex-1 truncate",
            homeWon ? "font-semibold" : isCompleted ? "text-muted-foreground" : "font-medium",
            isByeHome && "italic text-muted-foreground font-normal",
          )}
        >
          {homeName}
        </span>
        {isLive && (
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-victora-secondary" />
        )}
        {match.score !== null && (
          <span
            className={cn(
              "shrink-0 font-bold tabular-nums",
              homeWon ? "text-victora-success" : "text-muted-foreground",
            )}
          >
            {match.score.homePoints}
          </span>
        )}
      </div>

      {/* Away row */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-2",
          awayWon && "bg-[rgba(63,169,123,0.1)]",
        )}
      >
        {awayWon && (
          <Check className="h-3 w-3 shrink-0 text-victora-success" />
        )}
        <span
          className={cn(
            "flex-1 truncate",
            awayWon ? "font-semibold" : isCompleted ? "text-muted-foreground" : "font-medium",
            isByeAway && "italic text-muted-foreground font-normal",
          )}
        >
          {awayName}
        </span>
        {match.score !== null && (
          <span
            className={cn(
              "shrink-0 font-bold tabular-nums",
              awayWon ? "text-victora-success" : "text-muted-foreground",
            )}
          >
            {match.score.awayPoints}
          </span>
        )}
      </div>
    </div>
  );
}

export function BracketView({ data }: { data: EliminationBracketResponse }) {
  const { rounds, thirdPlaceMatch, winner } = data;

  if (rounds.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Noch keine Spiele generiert.
      </p>
    );
  }

  // Each first-round slot gets a fixed height. Later rounds divide the same
  // total height among fewer matches, naturally centering each card at the
  // midpoint of its two predecessors – no explicit connector lines needed.
  const firstRoundCount = rounds[0]!.matches.length;
  const slotHeight = 120; // px per first-round match slot
  const totalHeight = firstRoundCount * slotHeight;

  return (
    <div className="space-y-8">
      {/* Main bracket ─ stacked on mobile, horizontal scroll on sm+ */}
      <div className="overflow-x-auto">
        <div className="flex flex-col gap-8 sm:flex-row sm:min-w-max sm:items-start">

          {rounds.map((round) => {
            const perSlot = totalHeight / round.matches.length;
            return (
              <div key={round.roundNumber} className="flex flex-col">
                {/* Round header */}
                <div className="mb-3 px-3 text-center">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {getRoundName(round.roundName, round.matches.length)}
                  </span>
                </div>

                {/* Mobile: natural flow */}
                <div className="flex flex-col gap-3 sm:hidden">
                  {round.matches.map((match) => (
                    <div key={match.matchId} className="flex justify-center px-3">
                      <MatchCard match={match} />
                    </div>
                  ))}
                </div>

                {/* Desktop: fixed-height column so cards align with predecessors */}
                <div
                  className="hidden sm:flex sm:flex-col"
                  style={{ height: `${totalHeight}px` }}
                >
                  {round.matches.map((match) => (
                    <div
                      key={match.matchId}
                      className="flex items-center justify-center px-3"
                      style={{ height: `${perSlot}px` }}
                    >
                      <MatchCard match={match} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Winner banner – shown inline after the Finale column on desktop */}
          {winner && (
            <div
              className="hidden sm:flex sm:flex-col sm:items-center sm:justify-center sm:px-8"
              style={{ height: `${totalHeight}px` }}
            >
              <Trophy className="h-10 w-10 text-[#FCB45A]" />
              <p className="mt-2 text-center text-lg font-bold text-[#57194B]">
                {winner.participantName}
              </p>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#57194B]">
                Sieger
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Winner banner for mobile – shown below the bracket */}
      {winner && (
        <div className="flex flex-col items-center gap-1 sm:hidden">
          <Trophy className="h-8 w-8 text-[#FCB45A]" />
          <p className="text-lg font-bold text-[#57194B]">
            {winner.participantName}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#57194B]">
            Sieger
          </p>
        </div>
      )}

      {/* Third-place match */}
      {thirdPlaceMatch && (
        <div className="border-t pt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Spiel um Platz 3
          </p>
          <MatchCard match={thirdPlaceMatch} />
        </div>
      )}
    </div>
  );
}
