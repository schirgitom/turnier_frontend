import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  GitMerge,
  Loader2,
  RotateCcw,
  Shuffle,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  assignRandomPaschenPhase,
  generatePaschenPhase,
  getPaschenPhase,
  mergePaschenPhase,
  recordPaschenResult,
} from "@/api/paschen";
import { getApiErrorMessage } from "@/api/client";
import { PaschenParticipantPicker } from "./PaschenParticipantPicker";
import { PaschenPhaseView } from "./PaschenPhaseView";
import { PaschenResultDialog } from "./PaschenResultDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  PaschenMatchDto,
  PaschenPhaseResponse,
  PaschenPhaseSummaryResponse,
  PaschenPlayerScoreRequest,
} from "@/types/paschen";

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
}

export function PaschenPhaseCard({
  phase: summary,
  tournamentId,
  onDelete,
  deleting,
  onReset,
  resetting,
}: PaschenPhaseCardProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recordMatch, setRecordMatch] = useState<PaschenMatchDto | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  // Vollständige Phasendaten (mit Spielen) werden erst beim Aufklappen geladen.
  const { data: phase, isLoading: phaseLoading } = useQuery({
    queryKey: ["paschenPhase", tournamentId, summary.id],
    queryFn: () => getPaschenPhase(tournamentId, summary.id),
    enabled: expanded,
  });

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

  const canGenerate = summary.bracketCount === 0;
  const canMerge = summary.allBracketsComplete && !summary.isMerged;
  // Reset über den generischen Endpunkt – möglich, sobald Bäume existieren.
  const canReset = onReset !== undefined && summary.bracketCount > 0;

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
                {STATUS_LABELS[summary.status] ?? summary.status}
              </Badge>
              <Badge variant="outline">
                <Users className="mr-1 h-3 w-3" />
                {summary.participantCount} TN
              </Badge>
              <Badge variant="outline">
                {summary.treeCount} Bäume
              </Badge>
              {summary.allBracketsComplete && !summary.isMerged && (
                <Badge className="border-[#F3A83B] text-[#c47e00]" variant="outline">
                  Bereit zum Mergen
                </Badge>
              )}
              {summary.isMerged && (
                <Badge className="border-transparent bg-[rgba(63,169,123,0.15)] text-victora-success hover:bg-[rgba(63,169,123,0.15)]">
                  Finalbaum aktiv
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
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
        />
      )}
    </>
  );
}

