import { useState } from "react";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2 } from "lucide-react";
import { getTournament, updateTournament, deleteTournament, updateTournamentStatus } from "@/api/tournaments";
import { getMatches } from "@/api/matches";
import { TournamentStatusTimeline } from "@/components/tournament/TournamentStatusTimeline";
import type { UpdateTournamentRequest } from "@/types/tournament";
import { TournamentStatus } from "@/types/tournament";
import { MatchStatus } from "@/types/match";
import { getApiErrorMessage } from "@/api/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const updateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().min(1, "Startdatum ist erforderlich"),
  endDate: z.string().min(1, "Enddatum ist erforderlich"),
  maxParticipants: z.string().optional(),
  minParticipants: z.string().optional(),
  matchSetsToWinOverride: z
    .string()
    .optional()
    .refine(
      (v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1),
      "Mindestens 1",
    ),
  visibility: z.enum(["Private", "Public"]),
});

type UpdateForm = z.infer<typeof updateSchema>;

const STATUS_LABELS: Record<TournamentStatus, string> = {
  [TournamentStatus.Preparation]: "In Vorbereitung",
  [TournamentStatus.InProgress]: "Laufend",
  [TournamentStatus.Completed]: "Abgeschlossen",
  [TournamentStatus.Cancelled]: "Abgesagt",
};

export function TournamentSettingsPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [revertDialog, setRevertDialog] = useState<"toPreparation" | "toInProgress" | null>(null);

  const { data: tournament, isLoading } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => getTournament(tournamentId!),
    enabled: !!tournamentId,
  });

  const { data: matchesData } = useQuery({
    queryKey: ["matches", tournamentId],
    queryFn: () => getMatches(tournamentId!),
    enabled: !!tournamentId && tournament?.status === TournamentStatus.InProgress,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateTournamentRequest) =>
      updateTournament(tournamentId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });

  const STATUS_SUCCESS_MESSAGES: Record<string, string> = {
    Start: "Turnier wurde gestartet",
    Complete: "Turnier wurde abgeschlossen",
    Revert: "Turnier zurück in Vorbereitung",
    Cancel: "Turnier wurde abgebrochen",
  };

  const statusMutation = useMutation({
    mutationFn: (action: string) =>
      updateTournamentStatus(tournamentId!, action),
    onSuccess: (_data, action) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      setRevertDialog(null);
      toast.success(STATUS_SUCCESS_MESSAGES[action] ?? "Status erfolgreich geändert");
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTournament(tournamentId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      navigate("/tournaments");
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UpdateForm>({
    resolver: zodResolver(updateSchema),
    values: tournament
      ? {
          name: tournament.name,
          description: tournament.description,
          location: tournament.location,
          startDate: tournament.startDate.split("T")[0] ?? "",
          endDate: tournament.endDate.split("T")[0] ?? "",
          maxParticipants: tournament.maxParticipants?.toString(),
          minParticipants: (tournament.minParticipants ?? 2).toString(),
          matchSetsToWinOverride: tournament.matchSetsToWinOverride?.toString() ?? "",
          visibility: (tournament.visibility === "Public" ? "Public" : "Private") as "Public" | "Private",
        }
      : undefined,
  });

  const currentVisibility = watch("visibility");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isPreparation = tournament?.status === TournamentStatus.Preparation;
  const isInProgress = tournament?.status === TournamentStatus.InProgress;
  const isCompleted = tournament?.status === TournamentStatus.Completed;
  const isCancelled = tournament?.status === TournamentStatus.Cancelled;
  const canCancel = !isCompleted && !isCancelled && !!tournament;

  const matchProgress =
    isInProgress && matchesData
      ? {
          completed: matchesData.filter((m) => m.status === MatchStatus.Completed).length,
          total: matchesData.length,
        }
      : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Turnier bearbeiten</CardTitle>
        </CardHeader>
        <form
          onSubmit={handleSubmit((data) =>
            updateMutation.mutate({
              name: data.name,
              description: data.description,
              location: data.location,
              startDate: data.startDate,
              endDate: data.endDate,
              maxParticipants: data.maxParticipants ? Number(data.maxParticipants) : null,
              minParticipants: data.minParticipants ? Number(data.minParticipants) : null,
              matchSetsToWinOverride: data.matchSetsToWinOverride
                ? Number(data.matchSetsToWinOverride)
                : null,
              visibility: data.visibility,
            })
          )}
        >
          <CardContent className="space-y-4">
            {updateMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(updateMutation.error)}
              </div>
            )}
            {updateMutation.isSuccess && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">
                Änderungen gespeichert.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Input id="description" {...register("description")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Ort</Label>
              <Input id="location" {...register("location")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Startdatum</Label>
                <Input id="startDate" type="date" {...register("startDate")} />
                {errors.startDate && (
                  <p className="text-sm text-destructive">{errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Enddatum</Label>
                <Input id="endDate" type="date" {...register("endDate")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minParticipants">Min. Teilnehmer</Label>
                <Input
                  id="minParticipants"
                  type="number"
                  min={2}
                  {...register("minParticipants")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">Max. Teilnehmer</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  min={2}
                  {...register("maxParticipants")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="matchSetsToWinOverride">Sätze zum Sieg (optional)</Label>
              <Input
                id="matchSetsToWinOverride"
                type="number"
                min={1}
                placeholder="Sport-Default verwenden"
                {...register("matchSetsToWinOverride")}
              />
              {errors.matchSetsToWinOverride && (
                <p className="text-sm text-destructive">
                  {errors.matchSetsToWinOverride.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Sichtbarkeit</Label>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    className="h-4 w-4"
                    checked={currentVisibility === "Private"}
                    onChange={() => setValue("visibility", "Private")}
                  />
                  <span className="text-sm">Privat</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    className="h-4 w-4"
                    checked={currentVisibility === "Public"}
                    onChange={() => setValue("visibility", "Public")}
                  />
                  <span className="text-sm">Öffentlich</span>
                </label>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Speichern
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription className="flex items-center gap-2">
            Aktueller Status:{" "}
            <Badge variant="outline">
              {tournament ? STATUS_LABELS[tournament.status] : ""}
            </Badge>
          </CardDescription>
        </CardHeader>
        {tournament && (
          <CardContent className="pb-2">
            <TournamentStatusTimeline
              status={tournament.status}
              matchProgress={matchProgress}
            />
          </CardContent>
        )}

        {/* Action buttons — hidden only when Cancelled */}
        {!isCancelled && (
          <CardContent className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center gap-3">
              {isPreparation && (
                <Button
                  size="lg"
                  onClick={() => statusMutation.mutate("Start")}
                  disabled={statusMutation.isPending}
                >
                  {statusMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Turnier starten
                </Button>
              )}

              {isInProgress && (
                <>
                  <Button
                    size="lg"
                    onClick={() => statusMutation.mutate("Complete")}
                    disabled={statusMutation.isPending}
                  >
                    {statusMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Turnier abschließen
                  </Button>

                  {/* TODO: verify action string with backend — using "Revert" for now */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={statusMutation.isPending}
                    onClick={() => setRevertDialog("toPreparation")}
                  >
                    ← Zurück zu Vorbereitung
                  </Button>
                </>
              )}

              {isCompleted && (
                <>
                  {/* TODO: Enable when backend supports Completed → InProgress (action: "ReopenInProgress") */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button variant="outline" size="sm" disabled>
                            ← Zurück zu Laufend
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Zurücksetzen wird vom Backend noch nicht unterstützt
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>

            {canCancel && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Gefahrenbereich
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (
                        confirm(
                          "Turnier wirklich abbrechen? Diese Aktion kann nicht rückgängig gemacht werden.",
                        )
                      ) {
                        statusMutation.mutate("Cancel");
                      }
                    }}
                    disabled={statusMutation.isPending}
                  >
                    {statusMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Turnier abbrechen
                      </>
                    ) : (
                      "Turnier abbrechen"
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Confirmation dialog for backward transitions */}
      <Dialog open={revertDialog !== null} onOpenChange={(open) => !open && setRevertDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {revertDialog === "toPreparation"
                ? "Zurück zu Vorbereitung?"
                : "Zurück zu Laufend?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {revertDialog === "toPreparation"
              ? "Das Turnier wird pausiert. Laufende Ergebnisse bleiben erhalten. Gruppenverteilung und Phasen können wieder bearbeitet werden."
              : "Das Turnier wird wieder als laufend markiert. Ergebnisse bleiben erhalten."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertDialog(null)}>
              Abbrechen
            </Button>
            <Button
              onClick={() =>
                statusMutation.mutate(
                  revertDialog === "toPreparation" ? "Revert" : "ReopenInProgress",
                )
              }
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator />

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Turnier löschen</CardTitle>
          <CardDescription>
            Diese Aktion kann nicht rückgängig gemacht werden.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Turnier wirklich löschen?")) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Turnier löschen
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
