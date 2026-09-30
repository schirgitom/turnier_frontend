import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ListOrdered, Loader2, Shuffle } from "lucide-react";
import { getRegistrations } from "@/api/registrations";
import { buildStartNumbers, withStartSuffix } from "@/lib/multiStart";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PickerEntry {
  participantId: string;
  displayName: string;
  seedNumber: number | null;
  selected: boolean;
}

function bySeed(a: PickerEntry, b: PickerEntry): number {
  const seedA = a.seedNumber ?? Number.MAX_SAFE_INTEGER;
  const seedB = b.seedNumber ?? Number.MAX_SAFE_INTEGER;
  if (seedA !== seedB) return seedA - seedB;
  return a.displayName.localeCompare(b.displayName, "de");
}

/**
 * Auswahl und Reihenfolge der Teilnehmer für POST /generate.
 * ⚠️ Die Reihenfolge bestimmt die Setzung – die Spieler werden reihum auf
 * die Bäume verteilt (Platz 1 → Baum 1, Platz 2 → Baum 2, …).
 */
export function PaschenParticipantPicker({
  open,
  tournamentId,
  treeCount,
  submitting,
  serverError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  tournamentId: string;
  treeCount: number;
  submitting: boolean;
  serverError?: string | null;
  onClose: () => void;
  onSubmit: (participantIds: string[]) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["registrations", tournamentId],
    queryFn: () => getRegistrations(tournamentId),
    enabled: open && !!tournamentId,
  });

  const [entries, setEntries] = useState<PickerEntry[]>([]);

  const confirmed = useMemo(
    () =>
      (data?.registrations ?? []).filter(
        (registration) => registration.status === "Confirmed",
      ),
    [data?.registrations],
  );

  // Mehrere Starts einer Person unterscheidbar machen ("(Start N)").
  const startNumbers = useMemo(
    () => buildStartNumbers(data?.registrations ?? []),
    [data?.registrations],
  );

  useEffect(() => {
    if (!open) return;
    setEntries(
      confirmed
        .map((registration) => ({
          participantId: registration.participantId,
          displayName: withStartSuffix(
            registration.participantDisplayName,
            registration.participantId,
            startNumbers,
          ),
          seedNumber: registration.seedNumber,
          selected: true,
        }))
        .sort(bySeed),
    );
  }, [open, confirmed, startNumbers]);

  const move = (index: number, delta: number) => {
    setEntries((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const moved = next[index]!;
      next[index] = next[target]!;
      next[target] = moved;
      return next;
    });
  };

  const shuffle = () => {
    setEntries((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const current = next[i]!;
        next[i] = next[j]!;
        next[j] = current;
      }
      return next;
    });
  };

  const selected = entries.filter((entry) => entry.selected);
  const perTree = Math.floor(selected.length / Math.max(1, treeCount));
  const remainder = selected.length % Math.max(1, treeCount);
  const canSubmit = selected.length >= 2 && !submitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bäume generieren</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Die Reihenfolge bestimmt die Setzung – die Teilnehmer werden reihum
          auf die {treeCount} Bäume verteilt.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => setEntries((prev) => [...prev].sort(bySeed))}
          >
            <ListOrdered className="mr-1.5 h-3.5 w-3.5" />
            Nach Setzliste
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={shuffle}
          >
            <Shuffle className="mr-1.5 h-3.5 w-3.5" />
            Zufällig mischen
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {selected.length} ausgewählt
            {selected.length >= treeCount && (
              <>
                {" "}
                · {perTree}
                {remainder > 0 ? `–${perTree + 1}` : ""} pro Baum
              </>
            )}
          </span>
        </div>

        <div className="max-h-[45vh] space-y-1 overflow-y-auto rounded-md border p-2">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Keine bestätigten Teilnehmer vorhanden.
            </p>
          ) : (
            entries.map((entry, index) => (
              <div
                key={entry.participantId}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1 text-sm",
                  !entry.selected && "opacity-45",
                )}
              >
                <span className="w-7 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {entry.selected ? index + 1 : "–"}
                </span>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                  checked={entry.selected}
                  disabled={submitting}
                  onChange={(event) =>
                    setEntries((prev) =>
                      prev.map((item) =>
                        item.participantId === entry.participantId
                          ? { ...item, selected: event.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                <span className="flex-1 truncate">{entry.displayName}</span>
                {entry.seedNumber !== null && (
                  <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                    Setz {entry.seedNumber}
                  </span>
                )}
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === 0 || submitting}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === entries.length - 1 || submitting}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {serverError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Abbrechen
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() =>
              onSubmit(selected.map((entry) => entry.participantId))
            }
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

