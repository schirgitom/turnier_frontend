import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
});

type UpdateForm = z.infer<typeof updateSchema>;

const statusTransitions: Record<TournamentStatus, TournamentStatus[]> = {
  [TournamentStatus.Draft]: [TournamentStatus.Published],
  [TournamentStatus.Published]: [TournamentStatus.RegistrationOpen, TournamentStatus.Cancelled],
  [TournamentStatus.RegistrationOpen]: [TournamentStatus.RegistrationClosed, TournamentStatus.Cancelled],
  [TournamentStatus.RegistrationClosed]: [TournamentStatus.InProgress, TournamentStatus.Cancelled],
  [TournamentStatus.InProgress]: [TournamentStatus.Completed, TournamentStatus.Cancelled],
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
    mutationFn: (status: string) =>
      updateTournamentStatus(tournamentId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
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
        }
      : undefined,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const allowedTransitions = tournament
    ? statusTransitions[tournament.status] ?? []
    : [];

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
            <div className="space-y-2">
              <Label htmlFor="maxParticipants">Max. Teilnehmer</Label>
              <Input
                id="maxParticipants"
                type="number"
                min={2}
                {...register("maxParticipants")}
              />
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

      {allowedTransitions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Status ändern</CardTitle>
            <CardDescription>
              Aktueller Status:{" "}
              <span className="font-medium">
                {statusLabels[tournament!.status]}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              onValueChange={(value) => statusMutation.mutate(value)}
              disabled={statusMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Neuen Status wählen..." />
              </SelectTrigger>
              <SelectContent>
                {allowedTransitions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusMutation.isError && (
              <p className="mt-2 text-sm text-destructive">
                {getApiErrorMessage(statusMutation.error)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
