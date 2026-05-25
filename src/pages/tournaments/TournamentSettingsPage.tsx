import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { getTournament, updateTournament, deleteTournament, updateTournamentStatus } from "@/api/tournaments";
import type { UpdateTournamentRequest } from "@/types/tournament";
import { getApiErrorMessage } from "@/api/client";
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

function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  }, []);
  return { message, show };
}

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

interface StatusAction {
  action: string;
  label: string;
  variant?: "default" | "outline" | "destructive";
}

const statusActions: Record<TournamentStatus, StatusAction[]> = {
  [TournamentStatus.Draft]: [
    { action: "Publish", label: "Veröffentlichen" },
  ],
  [TournamentStatus.Published]: [
    { action: "OpenRegistration", label: "Anmeldung öffnen" },
    { action: "Cancel", label: "Abbrechen", variant: "destructive" },
  ],
  [TournamentStatus.RegistrationOpen]: [
    { action: "CloseRegistration", label: "Anmeldung schließen" },
    { action: "Cancel", label: "Abbrechen", variant: "destructive" },
  ],
  [TournamentStatus.RegistrationClosed]: [
    { action: "Start", label: "Starten" },
    { action: "Cancel", label: "Abbrechen", variant: "destructive" },
  ],
  [TournamentStatus.InProgress]: [
    { action: "Complete", label: "Abschließen" },
    { action: "Cancel", label: "Abbrechen", variant: "destructive" },
  ],
  [TournamentStatus.Completed]: [],
  [TournamentStatus.Cancelled]: [],
};

const statusLabels: Record<TournamentStatus, string> = {
  [TournamentStatus.Draft]: "Entwurf",
  [TournamentStatus.Published]: "Veröffentlicht",
  [TournamentStatus.RegistrationOpen]: "Anmeldung offen",
  [TournamentStatus.RegistrationClosed]: "Anmeldung geschlossen",
  [TournamentStatus.InProgress]: "Läuft",
  [TournamentStatus.Completed]: "Abgeschlossen",
  [TournamentStatus.Cancelled]: "Abgesagt",
};

export function TournamentSettingsPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

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

  const statusMutation = useMutation({
    mutationFn: (action: string) =>
      updateTournamentStatus(tournamentId!, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.show("Status erfolgreich geändert");
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

  const actions = tournament
    ? statusActions[tournament.status] ?? []
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {toast.message && (
        <div className="flex items-center gap-2 rounded-md border bg-muted px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          {toast.message}
        </div>
      )}
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
              {statusLabels[tournament!.status]}
            </Badge>
          </CardDescription>
        </CardHeader>
        {actions.length > 0 && (
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Button
                  key={a.action}
                  variant={a.variant ?? "outline"}
                  onClick={() => statusMutation.mutate(a.action)}
                  disabled={statusMutation.isPending}
                >
                  {statusMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {a.label}
                </Button>
              ))}
            </div>
            {statusMutation.isError && (
              <p className="text-sm text-destructive">
                {getApiErrorMessage(statusMutation.error)}
              </p>
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
