import { useState } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getMatches, submitResult } from "@/api/matches";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MatchStatus } from "@/types/match";
import type { MatchDto } from "@/types/match";

const resultSchema = z.object({
  homePoints: z.coerce.number().min(0),
  awayPoints: z.coerce.number().min(0),
});

type ResultForm = z.infer<typeof resultSchema>;

const statusLabels: Record<MatchStatus, string> = {
  [MatchStatus.Scheduled]: "Geplant",
  [MatchStatus.InProgress]: "Läuft",
  [MatchStatus.Completed]: "Beendet",
  [MatchStatus.Cancelled]: "Abgesagt",
};

const statusVariant: Record<
  MatchStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  [MatchStatus.Scheduled]: "secondary",
  [MatchStatus.InProgress]: "default",
  [MatchStatus.Completed]: "outline",
  [MatchStatus.Cancelled]: "destructive",
};

export function MatchesPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const queryClient = useQueryClient();
  const [selectedMatch, setSelectedMatch] = useState<MatchDto | null>(null);

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches", tournamentId],
    queryFn: () => getMatches(tournamentId!),
    enabled: !!tournamentId,
  });

  const submitMutation = useMutation({
    mutationFn: (data: ResultForm) =>
      submitResult(tournamentId!, selectedMatch!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["standings", tournamentId] });
      setSelectedMatch(null);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResultForm>({
    resolver: zodResolver(resultSchema),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Spiele ({matches?.length ?? 0})</h2>

      {matches?.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Noch keine Spiele vorhanden. Erstelle Phasen und generiere Spiele.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Runde</TableHead>
              <TableHead>Heim</TableHead>
              <TableHead className="text-center">Ergebnis</TableHead>
              <TableHead>Auswärts</TableHead>
              <TableHead>Platz</TableHead>
              <TableHead>Zeit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches?.map((match) => (
              <TableRow key={match.id}>
                <TableCell>R{match.roundNumber}</TableCell>
                <TableCell className="font-medium">
                  {match.homeParticipantName ?? "TBD"}
                </TableCell>
                <TableCell className="text-center font-bold">
                  {match.status === MatchStatus.Completed ||
                  match.status === MatchStatus.InProgress
                    ? `${match.homePoints ?? 0} : ${match.awayPoints ?? 0}`
                    : "- : -"}
                </TableCell>
                <TableCell className="font-medium">
                  {match.awayParticipantName ?? "TBD"}
                </TableCell>
                <TableCell>{match.courtName ?? "-"}</TableCell>
                <TableCell>
                  {match.scheduledTime
                    ? format(new Date(match.scheduledTime), "HH:mm", {
                        locale: de,
                      })
                    : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[match.status]}>
                    {match.status === MatchStatus.InProgress && (
                      <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    )}
                    {statusLabels[match.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {(match.status === MatchStatus.Scheduled ||
                    match.status === MatchStatus.InProgress) &&
                    match.homeParticipantId &&
                    match.awayParticipantId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedMatch(match)}
                      >
                        Ergebnis
                      </Button>
                    )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={selectedMatch !== null}
        onOpenChange={(open) => !open && setSelectedMatch(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ergebnis eintragen</DialogTitle>
          </DialogHeader>
          {selectedMatch && (
            <form
              onSubmit={handleSubmit((data) => submitMutation.mutate(data))}
              className="space-y-4"
            >
              {submitMutation.isError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {getApiErrorMessage(submitMutation.error)}
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
                <div className="space-y-2">
                  <Label>{selectedMatch.homeParticipantName}</Label>
                  <Input
                    type="number"
                    min={0}
                    {...register("homePoints")}
                    className="text-center text-lg"
                  />
                  {errors.homePoints && (
                    <p className="text-sm text-destructive">
                      {errors.homePoints.message}
                    </p>
                  )}
                </div>
                <span className="pb-2 text-xl font-bold">:</span>
                <div className="space-y-2">
                  <Label>{selectedMatch.awayParticipantName}</Label>
                  <Input
                    type="number"
                    min={0}
                    {...register("awayPoints")}
                    className="text-center text-lg"
                  />
                  {errors.awayPoints && (
                    <p className="text-sm text-destructive">
                      {errors.awayPoints.message}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitMutation.isPending}>
                  {submitMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Ergebnis speichern
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
