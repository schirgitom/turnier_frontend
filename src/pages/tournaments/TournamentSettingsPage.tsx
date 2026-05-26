import { useState } from "react";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2 } from "lucide-react";
import { getTournament, updateTournament, deleteTournament, updateTournamentStatus } from "@/api/tournaments";
import { getRegistrations } from "@/api/registrations";
import { getPhases } from "@/api/phases";
import { getMatches } from "@/api/matches";
import { TournamentStatusTimeline } from "@/components/tournament/TournamentStatusTimeline";
import type { UpdateTournamentRequest } from "@/types/tournament";
import { MatchStatus } from "@/types/match";
import { getApiErrorMessage } from "@/api/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { TournamentStatus } from "@/types/tournament";

const updateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().min(1, "Startdatum ist erforderlich"),
  endDate: z.string().min(1, "Enddatum ist erforderlich"),
  maxParticipants: z.string().optional(),
  minParticipants: z.string().optional(),
  visibility: z.enum(["Private", "Public"]),
});

type UpdateForm = z.infer<typeof updateSchema>;

const preStartStatuses = new Set([
  TournamentStatus.Draft,
  TournamentStatus.RegistrationOpen,
  TournamentStatus.RegistrationClosed,
]);

const terminalStatuses = new Set([TournamentStatus.Completed, TournamentStatus.Cancelled]);

function simplifiedLabel(status: TournamentStatus): string {
  if (preStartStatuses.has(status)) return "Entwurf";
  if (status === TournamentStatus.InProgress) return "Laufend";
  if (status === TournamentStatus.Completed) return "Abgeschlossen";
  return "Abgesagt";
}

export function TournamentSettingsPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tournament, isLoading } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => getTournament(tournamentId!),
    enabled: !!tournamentId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateTournamentRequest) =>
      updateTournament(tournamentId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });

  const [starting, setStarting] = useState(false);

  const statusMutation = useMutation({
    mutationFn: (action: string) =>
      updateTournamentStatus(tournamentId!, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Status erfolgreich geändert");
    },
  });

  const handleStart = async () => {
    if (!tournament) return;
    setStarting(true);
    try {
      let status = tournament.status;
      if (status === TournamentStatus.Draft) {
        await updateTournamentStatus(tournamentId!, "OpenRegistration");
        status = TournamentStatus.RegistrationOpen;
      }
      if (status === TournamentStatus.RegistrationOpen) {
        await updateTournamentStatus(tournamentId!, "CloseRegistration");
        status = TournamentStatus.RegistrationClosed;
      }
      if (status === TournamentStatus.RegistrationClosed) {
        await updateTournamentStatus(tournamentId!, "Start");
      }
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Turnier wurde gestartet");
    } catch (e) {
      toast.error(`Turnier konnte nicht gestartet werden: ${getApiErrorMessage(e)}`);
      // Reload so the status badge reflects where the sequence actually stopped.
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    } finally {
      setStarting(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteTournament(tournamentId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      navigate("/tournaments");
    },
  });

  const { data: registrationsData } = useQuery({
    queryKey: ["registrations", tournamentId],
    queryFn: () => getRegistrations(tournamentId!),
    enabled: !!tournamentId,
  });

  const { data: phasesData } = useQuery({
    queryKey: ["phases", tournamentId],
    queryFn: () => getPhases(tournamentId!),
    enabled: !!tournamentId,
  });

  const { data: matchesData } = useQuery({
    queryKey: ["matches", tournamentId],
    queryFn: () => getMatches(tournamentId!),
    enabled: !!tournamentId && tournament?.status === TournamentStatus.InProgress,
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

  const isPreStart = tournament ? preStartStatuses.has(tournament.status) : false;
  const isInProgress = tournament?.status === TournamentStatus.InProgress;
  const isTerminal = tournament ? terminalStatuses.has(tournament.status) : false;
  const canCancel = !isTerminal && !!tournament;

  const confirmedCount = registrationsData?.totalConfirmed ?? 0;
  const regCount = registrationsData?.registrations.length ?? 0;
  const minP = tournament?.minParticipants ?? 0;

  const timelineWarnings: Record<number, string[]> = {};
  if (tournament && !isTerminal) {
    if (tournament.status === TournamentStatus.Draft) {
      const w: string[] = [];
      if (registrationsData && regCount === 0)
        w.push("Keine Teilnehmer vorhanden. Füge Teilnehmer hinzu bevor du die Anmeldung öffnest.");
      if (w.length) timelineWarnings[0] = w;
    }
    if (tournament.status === TournamentStatus.RegistrationOpen) {
      const w: string[] = [];
      if (registrationsData && minP > 0 && confirmedCount < minP)
        w.push(`Zu wenige Teilnehmer. Mindestens ${minP} erforderlich, aktuell ${confirmedCount}.`);
      if (phasesData && phasesData.phases.length === 0)
        w.push("Keine Phasen konfiguriert. Gehe zu Phasen und füge mindestens eine Phase hinzu.");
      if (phasesData && !phasesData.isConfigurationValid && phasesData.phases.length > 0)
        w.push("Phasenkonfiguration ungültig. Prüfe die Phasen-Einstellungen.");
      if (w.length) timelineWarnings[1] = w;
    }
    if (tournament.status === TournamentStatus.RegistrationClosed) {
      const w: string[] = [];
      if (phasesData?.phases.some((p) => p.status === "Pending"))
        w.push("Matches noch nicht generiert. Gehe zu Phasen und generiere die Matches.");
      if (w.length) timelineWarnings[2] = w;
    }
  }

  const blockStart = isPreStart && minP > 0 && !!registrationsData && confirmedCount < minP;

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
        <form onSubmit={handleSubmit((data) => updateMutation.mutate({
          name: data.name,
          description: data.description,
          location: data.location,
          startDate: data.startDate,
          endDate: data.endDate,
          maxParticipants: data.maxParticipants ? Number(data.maxParticipants) : null,
          minParticipants: data.minParticipants ? Number(data.minParticipants) : null,
          visibility: data.visibility,
        }))}>
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
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
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
                  <p className="text-sm text-destructive">
                    {errors.startDate.message}
                  </p>
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
              <Label>Sichtbarkeit</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    className="h-4 w-4"
                    checked={currentVisibility === "Private"}
                    onChange={() => setValue("visibility", "Private")}
                  />
                  <span className="text-sm">Privat</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
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
              {tournament ? simplifiedLabel(tournament.status) : ""}
            </Badge>
          </CardDescription>
        </CardHeader>
        {tournament && (
          <CardContent className="pb-2">
            <TournamentStatusTimeline
              status={tournament.status}
              warnings={timelineWarnings}
              matchProgress={matchProgress}
            />
          </CardContent>
        )}
        {!isTerminal && (
          <CardContent className="space-y-4">
            {(isPreStart || isInProgress) && (
              <div className="space-y-2">
                {isPreStart && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="lg"
                      onClick={handleStart}
                      disabled={starting || statusMutation.isPending || blockStart}
                    >
                      {starting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Wird vorbereitet...
                        </>
                      ) : (
                        "Turnier starten"
                      )}
                    </Button>

                    {/* Backward transition: RegistrationOpen → Draft */}
                    {tournament?.status === TournamentStatus.RegistrationOpen && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0}>
                              {/* TODO: Enable when backend supports reverting RegistrationOpen → Draft (action: "Draft") */}
                              <Button variant="outline" size="sm" disabled>
                                ← Zurück zu Entwurf
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Noch nicht verfügbar (Backend ausstehend)</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {/* Backward transition: RegistrationClosed → RegistrationOpen */}
                    {tournament?.status === TournamentStatus.RegistrationClosed && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0}>
                              {/* TODO: Enable when backend supports RegistrationClosed → RegistrationOpen (action: "ReopenRegistration") */}
                              <Button variant="outline" size="sm" disabled>
                                ← Zurück zu Anmeldung
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Noch nicht verfügbar (Backend ausstehend)</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {blockStart && (
                      <p className="w-full text-sm text-destructive">
                        Nicht genug Teilnehmer um das Turnier zu starten.
                      </p>
                    )}
                  </div>
                )}
                {isInProgress && (
                  <Button
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={() => statusMutation.mutate("Complete")}
                    disabled={statusMutation.isPending}
                  >
                    {statusMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Turnier abschließen
                  </Button>
                )}
                {statusMutation.isError && (
                  <p className="text-sm text-destructive">
                    {getApiErrorMessage(statusMutation.error)}
                  </p>
                )}
              </div>
            )}
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
                      if (confirm("Turnier wirklich abbrechen? Diese Aktion kann nicht rückgängig gemacht werden.")) {
                        statusMutation.mutate("Cancel");
                      }
                    }}
                    disabled={statusMutation.isPending || starting}
                  >
                    {statusMutation.isPending
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Turnier abbrechen</>
                      : "Turnier abbrechen"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

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
