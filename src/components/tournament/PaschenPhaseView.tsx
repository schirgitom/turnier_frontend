import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { getPaschenRanking } from "@/api/paschen";
import { getRegistrations } from "@/api/registrations";
import { buildStartNumbers } from "@/lib/multiStart";
import {
  PaschenFinalistsList,
  PaschenRoundColumns,
  PaschenScoringHint,
} from "./PaschenBracketView";
import { PaschenRankingTable } from "./PaschenRankingTable";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildPaschenFinalLabels,
  isMatchDone,
  isPaschenPhaseFinished,
  paschenFinalMaxRound,
  paschenFinalRoundName,
  type PaschenMatchDto,
  type PaschenPhaseResponse,
} from "@/types/paschen";

const FINAL_TAB = "final";
const RANKING_TAB = "ranking";

function treeRoundLabel(round: number): string {
  return `Baum-Runde ${round}`;
}

/**
 * Bäume als Tabs (bracketIndex), Finalbaum und Endtabelle.
 * `onRecord` weglassen ⇒ reine Leseansicht (z. B. Tabellenseite).
 */
export function PaschenPhaseView({
  tournamentId,
  phase,
  onRecord,
  onStart,
  startingMatchId,
}: {
  tournamentId: string;
  phase: PaschenPhaseResponse;
  onRecord?: (match: PaschenMatchDto) => void;
  onStart?: (match: PaschenMatchDto) => void;
  startingMatchId?: string | null;
}) {
  const brackets = [...phase.brackets].sort(
    (a, b) => a.bracketIndex - b.bracketIndex,
  );
  const finalMaxRound = paschenFinalMaxRound(phase.finalMatches);
  const finalLabels = useMemo(
    () => buildPaschenFinalLabels(phase.finalMatches),
    [phase.finalMatches],
  );
  const canRecord = onRecord !== undefined && phase.status !== "Pending";
  // Rangliste ergibt beim Paschen erst nach dem Finale Sinn.
  const showRanking = isPaschenPhaseFinished(phase);

  // Mehrere Starts pro Person: aus dem Roster (userId + registeredAt) eine
  // participantId → Start-Nummer Zuordnung bauen, um im Baum "(Start N)" zu zeigen.
  const { data: registrations } = useQuery({
    queryKey: ["registrations", tournamentId],
    queryFn: () => getRegistrations(tournamentId),
    enabled: !!tournamentId,
  });

  const startNumbers = useMemo(
    () => buildStartNumbers(registrations?.registrations ?? []),
    [registrations?.registrations],
  );
  const participantNames = useMemo(
    () =>
      new Map(
        (registrations?.registrations ?? []).map((registration) => [
          registration.participantId,
          registration.participantDisplayName,
        ]),
      ),
    [registrations?.registrations],
  );

  const [tab, setTab] = useState<string>(
    brackets[0] ? String(brackets[0].bracketIndex) : RANKING_TAB,
  );

  // Nach dem Merge direkt auf den Finalbaum springen.
  useEffect(() => {
    if (phase.isMerged) setTab(FINAL_TAB);
  }, [phase.isMerged]);

  // Nach dem Finale auf die Rangliste springen; ohne Rangliste nicht darauf stehen bleiben.
  useEffect(() => {
    if (showRanking) {
      setTab(RANKING_TAB);
    } else {
      setTab((current) =>
        current === RANKING_TAB
          ? phase.isMerged
            ? FINAL_TAB
            : String(brackets[0]?.bracketIndex ?? 0)
          : current,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRanking]);

  const { data: ranking, isLoading: rankingLoading } = useQuery({
    queryKey: ["paschenRanking", tournamentId, phase.id],
    queryFn: () => getPaschenRanking(tournamentId, phase.id),
    enabled: tab === RANKING_TAB && showRanking,
  });

  if (brackets.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Phase noch nicht generiert.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <PaschenScoringHint />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {brackets.map((bracket) => (
            <TabsTrigger
              key={bracket.id}
              value={String(bracket.bracketIndex)}
              className="gap-1.5"
            >
              Baum {bracket.bracketIndex + 1}
              {bracket.isComplete && (
                <Trophy className="h-3 w-3 text-victora-success" />
              )}
            </TabsTrigger>
          ))}
          {phase.isMerged && (
            <TabsTrigger value={FINAL_TAB}>Finalbaum</TabsTrigger>
          )}
          {showRanking && (
            <TabsTrigger value={RANKING_TAB}>Rangliste</TabsTrigger>
          )}
        </TabsList>

        {brackets.map((bracket) => (
          <TabsContent
            key={bracket.id}
            value={String(bracket.bracketIndex)}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                {bracket.startingPlayerCount} Startplätze
              </Badge>
              <Badge variant="outline">{bracket.rounds} Runden</Badge>
              {bracket.isComplete && (
                <Badge className="border-transparent bg-[rgba(63,169,123,0.15)] text-victora-success hover:bg-[rgba(63,169,123,0.15)]">
                  Baum abgeschlossen
                </Badge>
              )}
            </div>

            {bracket.isComplete && (
              <PaschenFinalistsList
                finalists={bracket.finalists}
                bracketIndex={bracket.bracketIndex}
                startNumbers={startNumbers}
                participantNames={participantNames}
              />
            )}

            <PaschenRoundColumns
              matches={bracket.matches}
              playersPerMatch={phase.playersPerMatch}
              canRecord={canRecord}
              onRecord={onRecord}
              onStart={onStart}
              startingMatchId={startingMatchId}
              roundLabel={treeRoundLabel}
              startNumbers={startNumbers}
              participantNames={participantNames}
            />
          </TabsContent>
        ))}

        {phase.isMerged && (
          <TabsContent value={FINAL_TAB} className="space-y-4">
            {phase.finalMatches.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Finalbaum ist noch leer.
              </p>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  {phase.finalMatches.filter(isMatchDone).length} von{" "}
                  {phase.finalMatches.length} Finalspielen erfasst
                </div>
                <PaschenRoundColumns
                  matches={phase.finalMatches}
                  playersPerMatch={phase.playersPerMatch}
                  canRecord={canRecord}
                  onRecord={onRecord}
                  onStart={onStart}
                  startingMatchId={startingMatchId}
                  roundLabel={(round) => paschenFinalRoundName(round, finalMaxRound)}
                  matchLabel={(match) => finalLabels.get(match.id)}
                  startNumbers={startNumbers}
                  participantNames={participantNames}
                />
              </>
            )}
          </TabsContent>
        )}

        {showRanking && (
          <TabsContent value={RANKING_TAB}>
            <PaschenRankingTable data={ranking} isLoading={rankingLoading} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
