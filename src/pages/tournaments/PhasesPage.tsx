import { useState } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, CheckCircle2, Loader2, Trash2, Users, Swords } from "lucide-react";
import {
  getPhases,
  addGroupPhase,
  addEliminationPhase,
  removePhase,
} from "@/api/phases";
import { isGroupPhase } from "@/types/phase";
import type {
  PhaseResponse,
  GroupPhaseResponse,
  EliminationPhaseResponse,
} from "@/types/phase";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const groupSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  phaseOrder: z.coerce.number().min(1),
  numberOfGroups: z.coerce.number().min(1),
  qualifiersPerGroup: z.coerce.number().min(1),
  groupFormat: z.string().min(1),
});

type GroupForm = z.infer<typeof groupSchema>;

const eliminationSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  phaseOrder: z.coerce.number().min(1),
  eliminationFormat: z.string().min(1),
  hasThirdPlaceMatch: z.boolean(),
});

type EliminationForm = z.infer<typeof eliminationSchema>;

const eliminationFormatLabels: Record<string, string> = {
  SingleElimination: "Einfache Ausscheidung",
  DoubleElimination: "Doppelte Ausscheidung",
};

const statusLabels: Record<string, string> = {
  Pending: "Ausstehend",
  Active: "Aktiv",
  Completed: "Abgeschlossen",
};

function GroupPhaseCard({
  phase,
  onDelete,
  deleting,
}: {
  phase: GroupPhaseResponse;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">{phase.name}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Gruppenphase</Badge>
            <Badge variant="outline">{statusLabels[phase.status] ?? phase.status}</Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={deleting}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>{phase.numberOfGroups} Gruppen</span>
          <span>{phase.qualifiersPerGroup} Aufsteiger</span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {phase.participantCount} Teilnehmer
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EliminationPhaseCard({
  phase,
  onDelete,
  deleting,
}: {
  phase: EliminationPhaseResponse;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">{phase.name}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">K.O.-Phase</Badge>
            <Badge variant="outline">{statusLabels[phase.status] ?? phase.status}</Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={deleting}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            {eliminationFormatLabels[phase.eliminationFormat] ?? phase.eliminationFormat}
          </span>
          <span className="flex items-center gap-1">
            <Swords className="h-3.5 w-3.5" />
            Bracket {phase.bracketSize}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {phase.participantCount} Teilnehmer
          </span>
          {phase.hasThirdPlaceMatch && <span>Platz-3-Spiel</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function PhasesPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const queryClient = useQueryClient();
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [elimDialogOpen, setElimDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["phases", tournamentId],
    queryFn: () => getPhases(tournamentId!),
    enabled: !!tournamentId,
  });

  const phases = data?.phases ?? [];
  const nextOrder = phases.length + 1;

  const groupForm = useForm<GroupForm>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "Vorrunde",
      phaseOrder: nextOrder,
      numberOfGroups: 4,
      qualifiersPerGroup: 2,
      groupFormat: "RoundRobin",
    },
  });

  const elimForm = useForm<EliminationForm>({
    resolver: zodResolver(eliminationSchema),
    defaultValues: {
      name: "K.O.-Runde",
      phaseOrder: nextOrder,
      eliminationFormat: "SingleElimination",
      hasThirdPlaceMatch: false,
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: GroupForm) => addGroupPhase(tournamentId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      setGroupDialogOpen(false);
      groupForm.reset();
    },
  });

  const createElimMutation = useMutation({
    mutationFn: (data: EliminationForm) =>
      addEliminationPhase(tournamentId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      setElimDialogOpen(false);
      elimForm.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (phaseId: string) => removePhase(tournamentId!, phaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
    },
  });

  const handleDelete = (phase: PhaseResponse) => {
    if (confirm(`${phase.name} wirklich löschen?`)) {
      deleteMutation.mutate(phase.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">
            Phasen ({phases.length})
          </h2>
          {data && phases.length > 0 && (
            data.isConfigurationValid ? (
              <Badge variant="outline" className="border-green-500 text-green-600">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Konfiguration gültig
              </Badge>
            ) : null
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              groupForm.reset({
                name: "Vorrunde",
                phaseOrder: nextOrder,
                numberOfGroups: 4,
                qualifiersPerGroup: 2,
                groupFormat: "RoundRobin",
              });
              setGroupDialogOpen(true);
            }}
          >
            + Gruppenphase
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              elimForm.reset({
                name: "K.O.-Runde",
                phaseOrder: nextOrder,
                eliminationFormat: "SingleElimination",
                hasThirdPlaceMatch: false,
              });
              setElimDialogOpen(true);
            }}
          >
            + K.O.-Phase
          </Button>
        </div>
      </div>

      {data && !data.isConfigurationValid && data.validationErrors.length > 0 && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-500/30 dark:bg-yellow-500/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-500" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                Konfiguration ungültig
              </p>
              <ul className="list-inside list-disc text-sm text-yellow-700 dark:text-yellow-400/80">
                {data.validationErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {phases.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Noch keine Phasen definiert.
        </p>
      ) : (
        <div className="space-y-4">
          {[...phases]
            .sort((a, b) => a.phaseOrder - b.phaseOrder)
            .map((phase) =>
              isGroupPhase(phase) ? (
                <GroupPhaseCard
                  key={phase.id}
                  phase={phase}
                  onDelete={() => handleDelete(phase)}
                  deleting={deleteMutation.isPending}
                />
              ) : (
                <EliminationPhaseCard
                  key={phase.id}
                  phase={phase}
                  onDelete={() => handleDelete(phase)}
                  deleting={deleteMutation.isPending}
                />
              ),
            )}
        </div>
      )}

      {/* Group phase dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gruppenphase hinzufügen</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={groupForm.handleSubmit((data) =>
              createGroupMutation.mutate(data),
            )}
            className="space-y-4"
          >
            {createGroupMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(createGroupMutation.error)}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="group-name">Name</Label>
              <Input id="group-name" {...groupForm.register("name")} />
              {groupForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {groupForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-order">Reihenfolge</Label>
              <Input
                id="group-order"
                type="number"
                min={1}
                {...groupForm.register("phaseOrder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="group-count">Anzahl Gruppen</Label>
                <Input
                  id="group-count"
                  type="number"
                  min={1}
                  {...groupForm.register("numberOfGroups")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-qualifiers">Aufsteiger pro Gruppe</Label>
                <Input
                  id="group-qualifiers"
                  type="number"
                  min={1}
                  {...groupForm.register("qualifiersPerGroup")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gruppenformat</Label>
              <Select
                value={groupForm.watch("groupFormat")}
                onValueChange={(v) => groupForm.setValue("groupFormat", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RoundRobin">Jeder gegen Jeden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={createGroupMutation.isPending}
              >
                {createGroupMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Erstellen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Elimination phase dialog */}
      <Dialog open={elimDialogOpen} onOpenChange={setElimDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>K.O.-Phase hinzufügen</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={elimForm.handleSubmit((data) =>
              createElimMutation.mutate(data),
            )}
            className="space-y-4"
          >
            {createElimMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(createElimMutation.error)}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="elim-name">Name</Label>
              <Input id="elim-name" {...elimForm.register("name")} />
              {elimForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {elimForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="elim-order">Reihenfolge</Label>
              <Input
                id="elim-order"
                type="number"
                min={1}
                {...elimForm.register("phaseOrder")}
              />
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Select
                value={elimForm.watch("eliminationFormat")}
                onValueChange={(v) =>
                  elimForm.setValue("eliminationFormat", v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SingleElimination">
                    Einfache Ausscheidung
                  </SelectItem>
                  <SelectItem value="DoubleElimination">
                    Doppelte Ausscheidung
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="thirdPlace"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                {...elimForm.register("hasThirdPlaceMatch")}
              />
              <Label htmlFor="thirdPlace" className="font-normal">
                Spiel um Platz 3
              </Label>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={createElimMutation.isPending}
              >
                {createElimMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Erstellen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
