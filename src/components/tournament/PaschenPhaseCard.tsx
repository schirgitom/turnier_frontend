import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  GitMerge,
  LayoutGrid,
  Loader2,
  Lock,
  RotateCcw,
  Shuffle,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  assignRandomPaschenPhase,
  finalizePaschenDraw,
  generatePaschenPhase,
  getPaschenPhase,
  initializePaschenBrackets,
  mergePaschenPhase,
  recordPaschenResult,
} from "@/api/paschen";
import { getApiErrorMessage } from "@/api/client";
import { startMatch } from "@/api/matches";
import { PaschenParticipantPicker } from "./PaschenParticipantPicker";
import { PaschenPhaseView } from "./PaschenPhaseView";
import { PaschenResultDialog } from "./PaschenResultDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  PaschenMatchDto,
  PaschenPhaseResponse,
  PaschenPhaseSummaryResponse,
  PaschenPlayerScoreRequest,
} from "@/types/paschen";
import { buildPaschenMatchLabels } from "@/types/paschen";

const STATUS_LABELS: Record<string, string> = {
  Pending: "Ausstehend",
  InProgress: "Laufend",
  Completed: "Abgeschlossen",
};

interface PaschenPhaseCardProps {
  /** Summary aus der Phasenliste – enthält keine Spieldaten */
  phase: PaschenPhaseSummaryResponse;
  tournamentId: string;
  onDelete: () => void;
  deleting: boolean;
  /** Werden für Paschen nicht benötigt, aber PhasesPage übergibt sie einheitlich */
  onGenerate?: () => void;
  generating?: boolean;
  onReset?: () => void;
  resetting?: boolean;
  onSchedule?: () => void;
  scheduling?: boolean;
  /** Einzige Phase ⇒ immer aufgeklappt, kein Zuklappen. */
  alwaysExpanded?: boolean;
}

export function PaschenPhaseCard({
  phase: summary,
  tournamentId,
  onDelete,
  deleting,
  onReset,
  resetting,
  alwaysExpanded = false,
}: PaschenPhaseCardProps) {
  const queryClient = useQueryClient();
  const [expandedState, setExpanded] = useState(false);
  const expanded = alwaysExpanded || expandedState;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recordMatch, setRecordMatch] = useState<PaschenMatchDto | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [rebalance, setRebalance] = useState(true);

  // Vollständige Phasendaten (mit Spielen) werden erst beim Aufklappen geladen.
  // Liefert die Phasenliste kein `bracketCount`, laden wir die Details sofort,
  // um zu wissen, ob bereits Bäume existieren.
  const bracketCountKnown = typeof summary.bracketCount === "number";
  const { data: phase, isLoading: phaseLoading } = useQuery({
    queryKey: ["paschenPhase", tournamentId, summary.id],
    queryFn: () => getPaschenPhase(tournamentId, summary.id),
    enabled: expanded || !bracketCountKnown,
  });
  const matchLabels = useMemo(
    () => (phase ? buildPaschenMatchLabels(phase) : new Map<string, string>()),
    [phase],
  );

  const invalidatePhaseList = () => {
    queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
  };

  // Generate/Merge/Record liefern die komplette Phase zurück – wir setzen sie
  // direkt in den Cache, ein Nachladen entfällt. Spielernamen sind bereits
  // aufgelöst. Die Rangliste kann sich geändert haben, daher invalidieren.
  const applyPhase = (updated: PaschenPhaseResponse) => {
    queryClient.setQueryData(
      ["paschenPhase", tournamentId, summary.id],
      updated,
    );
    queryClient.invalidateQueries({
      queryKey: ["paschenRanking", tournamentId, summary.id],
    });
    invalidatePhaseList();
  };

  const generateMutation = useMutation({
    mutationFn: (participantIds: string[]) =>
      generatePaschenPhase(tournamentId, summary.id, participantIds),
    onSuccess: (updated) => {
      applyPhase(updated);
      setPickerOpen(false);
      toast.success("Bäume generiert – Runde 1 ist besetzt.");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  // Zufällige Auslosung: leerer Body → alle bestätigten Registrierungen, der
  // Server erzeugt den Seed. Der Seed wird im Toast angezeigt, damit die
  // Auslosung bei Bedarf nachvollzogen/wiederholt werden kann.
  const assignRandomMutation = useMutation({
    mutationFn: () => assignRandomPaschenPhase(tournamentId, summary.id),
    onSuccess: (result) => {
      applyPhase(result.phase);
      toast.success(
        `Bäume ausgelost – Runde 1 ist besetzt. (Seed: ${result.seed})`,
      );
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  // Gestaffelter Ablauf: erst leere Bäume anlegen, danach werden die Starts
  // einzeln (Teilnehmerseite) zufällig in freie Slots gelost.
  const initializeMutation = useMutation({
    mutationFn: () => initializePaschenBrackets(tournamentId, summary.id),
    onSuccess: (result) => {
      applyPhase(result.phase);
      toast.success(
        result.created
          ? "Leere Bäume angelegt – Starts können jetzt einzeln ausgelost werden."
          : "Bäume existierten bereits – nichts geändert.",
      );
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const mergeMutation = useMutation({
    mutationFn: () => mergePaschenPhase(tournamentId, summary.id),
    onSuccess: (updated) => {
      applyPhase(updated);
      toast.success("Bäume zusammengeführt – Finalbaum bereit.");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const resultMutation = useMutation({
    mutationFn: ({
      matchId,
      scores,
    }: {
      matchId: string;
      scores: PaschenPlayerScoreRequest[];
    }) =>
      recordPaschenResult(tournamentId, matchId, { playerScores: scores }),
    onSuccess: (updated) => {
      applyPhase(updated);
      setRecordMatch(null);
      setRecordError(null);
      toast.success("Ergebnis gespeichert.");
    },
    onError: (e) => {
      setRecordError(getApiErrorMessage(e));
    },
  });

  // Start über den allgemeinen Match-Endpunkt (Scheduled → InProgress).
  // Optional – beim Ergebnis-Erfassen startet das Backend automatisch.
  const startMutation = useMutation({
    mutationFn: (match: PaschenMatchDto) => startMatch(tournamentId, match.id),
    onSuccess: (_data, match) => {
      // Offenen Dialog sofort auf "Läuft" setzen, bis die Phase neu geladen ist.
      setRecordMatch((current) =>
        current?.id === match.id ? { ...current, status: "InProgress" } : current,
      );
      queryClient.invalidateQueries({
        queryKey: ["paschenPhase", tournamentId, summary.id],
      });
      queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
      toast.success("Spiel gestartet.");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  const startingMatchId = startMutation.isPending
    ? (startMutation.variables?.id ?? null)
    : null;

  // Auslosung abschließen: Phase wechselt auf "InProgress". Durch `rebalance`
  // können sich Slot-Positionen der Runde 1 ändern – daher die Bäume komplett
  // aus response.phase neu setzen.
  const finalizeMutation = useMutation({
    mutationFn: () =>
      finalizePaschenDraw(tournamentId, summary.id, { rebalance }),
    onSuccess: (result) => {
      applyPhase(result.phase);
      setFinalizeOpen(false);
      setExpanded(true);
      const details = [
        `${result.assignedParticipants} Spieler`,
        `${result.freeSlots} Freiplätze`,
        result.byeMatches > 0 ? `${result.byeMatches} Freilos-Spiele` : null,
        result.cancelledMatches > 0
          ? `${result.cancelledMatches} entfallene Spiele`
          : null,
      ]
        .filter(Boolean)
        .join(", ");
      toast.success(`Auslosung abgeschlossen (${details}).`);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const hasBrackets = phase
    ? phase.brackets.length > 0
    : bracketCountKnown
      ? summary.bracketCount > 0
      : false;
  const detailsKnown = phase !== undefined || bracketCountKnown;
  // Aktueller Status: Detaildaten sind nach Mutationen aktueller als die Liste.
  const phaseStatus = phase?.status ?? summary.status;
  const isPending = phaseStatus === "Pending";
  const canGenerate = detailsKnown && !hasBrackets && isPending;
  const canInitialize = canGenerate;
  const canFinalize = isPending && hasBrackets;
  const allBracketsComplete = phase?.allBracketsComplete ?? summary.allBracketsComplete;
  const isMerged = phase?.isMerged ?? summary.isMerged;
  const canMerge = allBracketsComplete && !isMerged;
  // Reset über den generischen Endpunkt – möglich, sobald Bäume existieren.
  const canReset = onReset !== undefined && hasBrackets;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="space-y-1">
            <p className="text-base font-semibold">{summary.name}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-victora-primary/15 text-victora-primary border-transparent hover:bg-victora-primary/15">
                Paschen
              </Badge>
              <Badge variant="outline">
                {STATUS_LABELS[phaseStatus] ?? phaseStatus}
              </Badge>
              <Badge variant="outline">
                <Users className="mr-1 h-3 w-3" />
                {summary.participantCount} TN
              </Badge>
              <Badge variant="outline">
                {summary.treeCount} Bäume
              </Badge>
              {allBracketsComplete && !isMerged && (
                <Badge className="border-[#F3A83B] text-[#c47e00]" variant="outline">
                  Bereit zum Mergen
                </Badge>
              )}
              {isMerged && (
                <Badge className="border-transparent bg-[rgba(63,169,123,0.15)] text-victora-success hover:bg-[rgba(63,169,123,0.15)]">
                  Finalbaum aktiv
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canInitialize && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setExpanded(true);
                  initializeMutation.mutate();
                }}
                disabled={initializeMutation.isPending}
                title="Legt alle Bäume mit Runden, Matches und leeren Slots an. Die Starts werden danach einzeln zufällig ausgelost (Teilnehmer-Seite)."
              >
                {initializeMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                )}
                Leeren Turnierbaum anlegen
              </Button>
            )}
            {canGenerate && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setExpanded(true);
                  setPickerOpen(true);
                }}
              >
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                Generieren
              </Button>
            )}
            {canGenerate && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setExpanded(true);
                  assignRandomMutation.mutate();
                }}
                disabled={assignRandomMutation.isPending}
              >
                {assignRandomMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Shuffle className="mr-1.5 h-3.5 w-3.5" />
                )}
                Zufällig auslosen
              </Button>
            )}
            {canFinalize && (
              <Button
                size="sm"
                onClick={() => {
                  setRebalance(true);
                  setFinalizeOpen(true);
                }}
                disabled={finalizeMutation.isPending}
                title="Schließt die Auslosung ab. Danach sind keine weiteren Zuordnungen mehr möglich."
              >
                {finalizeMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Lock className="mr-1.5 h-3.5 w-3.5" />
                )}
                Auslosung abschließen
              </Button>
            )}
            {canMerge && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => mergeMutation.mutate()}
                disabled={mergeMutation.isPending}
              >
                {mergeMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <GitMerge className="mr-1.5 h-3.5 w-3.5" />
                )}
                Finalbaum erstellen
              </Button>
            )}
            {canReset && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                disabled={resetting}
              >
                {resetting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Zurücksetzen
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            {!alwaysExpanded && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>

        {expanded && (
          <CardContent>
            {phaseLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : phase ? (
              <PaschenPhaseView
                tournamentId={tournamentId}
                phase={phase}
                onRecord={(match) => {
                  setRecordError(null);
                  setRecordMatch(match);
                }}
                onStart={(match) => startMutation.mutate(match)}
                startingMatchId={startingMatchId}
              />
            ) : null}
          </CardContent>
        )}
      </Card>

      <PaschenParticipantPicker
        open={pickerOpen}
        tournamentId={tournamentId}
        treeCount={summary.treeCount}
        submitting={generateMutation.isPending}
        serverError={
          generateMutation.isError
            ? getApiErrorMessage(generateMutation.error)
            : null
        }
        onClose={() => setPickerOpen(false)}
        onSubmit={(ids) => generateMutation.mutate(ids)}
      />

      {phase && (
        <PaschenResultDialog
          match={recordMatch}
          label={recordMatch ? matchLabels.get(recordMatch.id) : undefined}
          advancersPerMatch={phase.advancersPerMatch}
          eliminationScore={phase.eliminationScore}
          submitting={resultMutation.isPending}
          serverError={recordError}
          onClose={() => {
            setRecordMatch(null);
            setRecordError(null);
          }}
          onSubmit={(scores) => {
            if (!recordMatch) return;
            resultMutation.mutate({ matchId: recordMatch.id, scores });
          }}
          onStart={(match) => startMutation.mutate(match)}
          starting={startMutation.isPending}
        />
      )}

      <Dialog
        open={finalizeOpen}
        onOpenChange={(open) => {
          if (!finalizeMutation.isPending) setFinalizeOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auslosung abschließen?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Die Phase wird gestartet. <strong className="text-foreground">Danach ist keine
              Auslosung mehr möglich</strong> – weitere Starts können nicht mehr in
              die Bäume gelost werden.
            </p>
            <p>
              Leere Plätze werden zu Freilosen, Spiele ohne ausreichend Spieler
              entfallen. Rückgängig machen geht nur über „Zurücksetzen“ – das
              löscht die komplette Auslosung samt Bäumen.
            </p>
            <div className="flex items-start gap-2">
              <input
                id={`rebalance-${summary.id}`}
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-input"
                checked={rebalance}
                onChange={(e) => setRebalance(e.target.checked)}
              />
              <Label
                htmlFor={`rebalance-${summary.id}`}
                className="font-normal leading-snug"
              >
                Runde 1 ausgleichen (rebalance) – verteilt die Spieler so, dass
                möglichst wenige Freilose entstehen. Positionen in Runde 1 können
                sich dadurch ändern.
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setFinalizeOpen(false)}
              disabled={finalizeMutation.isPending}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => finalizeMutation.mutate()}
              disabled={finalizeMutation.isPending}
            >
              {finalizeMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Auslosung abschließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

