import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Play, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  assignedPlayers,
  canStartMatch,
  paschenMatchLabel,
  validatePaschenScores,
  type PaschenMatchDto,
  type PaschenPlayerScoreRequest,
} from "@/types/paschen";

interface PaschenResultDialogProps {
  match: PaschenMatchDto | null;
  /** Überschreibt die Standardbezeichnung im Titel (z. B. "Halbfinale 1"). */
  label?: string;
  advancersPerMatch: number;
  eliminationScore: number;
  submitting: boolean;
  serverError?: string | null;
  onClose: () => void;
  onSubmit: (scores: PaschenPlayerScoreRequest[]) => void;
  /** Optional – ohne Handler wird kein Starten-Button angezeigt. */
  onStart?: (match: PaschenMatchDto) => void;
  starting?: boolean;
}

export function PaschenResultDialog({
  match,
  label,
  advancersPerMatch,
  eliminationScore,
  submitting,
  serverError,
  onClose,
  onSubmit,
  onStart,
  starting = false,
}: PaschenResultDialogProps) {
  const players = useMemo(
    () => (match ? assignedPlayers(match) : []),
    [match],
  );

  // participantId → Eingabewert (als String, damit das Feld leer sein darf)
  const [points, setPoints] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!match) return;
    const initial: Record<string, string> = {};
    for (const player of assignedPlayers(match)) {
      initial[player.participantId!] =
        player.points !== null ? String(player.points) : "";
    }
    setPoints(initial);
    // Nur bei Match-Wechsel zurücksetzen – ein Statuswechsel (Starten) soll
    // bereits eingetippte Punkte nicht verwerfen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id]);

  const allFilled = players.every(
    (p) => (points[p.participantId!] ?? "").trim() !== "",
  );

  const scores: PaschenPlayerScoreRequest[] = players.map((p) => ({
    participantId: p.participantId!,
    points: Number.parseInt(points[p.participantId!] ?? "", 10),
  }));

  const validationError = allFilled
    ? validatePaschenScores(scores, advancersPerMatch, eliminationScore)
    : null;

  // Vorschau: Wer würde mit den aktuellen Eingaben aufsteigen?
  const advancingIds = useMemo(() => {
    if (!allFilled || validationError) return new Set<string>();
    return new Set(
      [...scores]
        .sort((a, b) => a.points - b.points)
        .slice(0, advancersPerMatch)
        .map((s) => s.participantId),
    );
  }, [allFilled, validationError, scores, advancersPerMatch]);

  const canSubmit = allFilled && !validationError && !submitting;

  return (
    <Dialog
      open={match !== null}
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ergebnis erfassen{match ? ` – ${label ?? paschenMatchLabel(match)}` : ""}
            {match?.status === "InProgress" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-victora-secondary/15 px-2 py-0.5 text-xs font-semibold text-victora-secondary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-victora-secondary" />
                Läuft
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1.5 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <TrendingDown className="h-3.5 w-3.5 shrink-0" />
          <span>
            Weniger Punkte = besser. Die {advancersPerMatch} mit den wenigsten
            Punkten steigen auf, {eliminationScore} Punkte bedeuten das Aus.
          </span>
        </div>

        <div className="space-y-3">
          {players.map((player) => {
            const value = points[player.participantId!] ?? "";
            const willAdvance = advancingIds.has(player.participantId!);
            return (
              <div
                key={player.participantId}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                  allFilled &&
                    !validationError &&
                    (willAdvance
                      ? "border-victora-success/40 bg-[rgba(63,169,123,0.08)]"
                      : "opacity-60"),
                )}
              >
                <Label
                  htmlFor={`points-${player.participantId}`}
                  className="flex-1 truncate font-medium"
                >
                  {player.participantName ?? "Unbekannt"}
                </Label>
                {allFilled && !validationError && (
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-semibold uppercase tracking-wide",
                      willAdvance
                        ? "text-victora-success"
                        : "text-muted-foreground",
                    )}
                  >
                    {willAdvance ? "Aufstieg" : "Aus"}
                  </span>
                )}
                <Input
                  id={`points-${player.participantId}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={eliminationScore}
                  className="w-20 shrink-0 text-center tabular-nums"
                  value={value}
                  disabled={submitting}
                  onChange={(e) =>
                    setPoints((prev) => ({
                      ...prev,
                      [player.participantId!]: e.target.value,
                    }))
                  }
                />
              </div>
            );
          })}
        </div>

        {validationError && (
          <div className="flex items-start gap-2 rounded-md border border-[#F3A83B]/30 bg-[rgba(243,168,59,0.08)] p-3 text-sm text-[#c47e00]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {serverError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Abbrechen
          </Button>
          {match && onStart && canStartMatch(match) && (
            <Button
              variant="secondary"
              onClick={() => onStart(match)}
              disabled={starting || submitting}
            >
              {starting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Starten
            </Button>
          )}
          <Button
            disabled={!canSubmit}
            onClick={() => onSubmit(scores)}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
