import { useState } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Loader2, Trash2, Play } from "lucide-react";
import { getPhases, createPhase, deletePhase, generateMatches } from "@/api/phases";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhaseType } from "@/types/phase";

const phaseSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  type: z.nativeEnum(PhaseType),
  order: z.coerce.number().min(1),
  groupCount: z.coerce.number().min(1).optional(),
  teamsPerGroup: z.coerce.number().min(2).optional(),
  advancingPerGroup: z.coerce.number().min(1).optional(),
  thirdPlaceMatch: z.boolean().optional(),
});

type PhaseForm = z.infer<typeof phaseSchema>;

const phaseTypeLabels: Record<PhaseType, string> = {
  [PhaseType.Group]: "Gruppenphase",
  [PhaseType.SingleElimination]: "K.O.-System",
  [PhaseType.DoubleElimination]: "Doppeltes K.O.",
  [PhaseType.Swiss]: "Schweizer System",
  [PhaseType.RoundRobin]: "Jeder gegen Jeden",
};

export function PhasesPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: phases, isLoading } = useQuery({
    queryKey: ["phases", tournamentId],
    queryFn: () => getPhases(tournamentId!),
    enabled: !!tournamentId,
  });

  const createMutation = useMutation({
    mutationFn: (data: PhaseForm) => {
      const config: Record<string, unknown> =
        data.type === PhaseType.Group
          ? {
              type: "Group",
              groupCount: data.groupCount ?? 2,
              teamsPerGroup: data.teamsPerGroup ?? 4,
              advancingPerGroup: data.advancingPerGroup ?? 2,
              pointsForWin: 3,
              pointsForDraw: 1,
              pointsForLoss: 0,
            }
          : {
              type: data.type,
              thirdPlaceMatch: data.thirdPlaceMatch ?? false,
            };

      return createPhase(tournamentId!, {
        name: data.name,
        type: data.type,
        order: data.order,
        config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      setDialogOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (phaseId: string) => deletePhase(tournamentId!, phaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: (phaseId: string) => generateMatches(tournamentId!, phaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PhaseForm>({
    resolver: zodResolver(phaseSchema),
    defaultValues: { order: (phases?.length ?? 0) + 1 },
  });

  const selectedType = watch("type");

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
        <h2 className="text-lg font-semibold">Phasen ({phases?.length ?? 0})</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Phase hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Phase</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit((data) => createMutation.mutate(data))}
              className="space-y-4"
            >
              {createMutation.isError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {getApiErrorMessage(createMutation.error)}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="z.B. Vorrunde"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select
                  onValueChange={(v) => setValue("type", v as PhaseType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Phasentyp wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(phaseTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-destructive">
                    {errors.type.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="order">Reihenfolge</Label>
                <Input
                  id="order"
                  type="number"
                  min={1}
                  {...register("order")}
                />
              </div>
              {selectedType === PhaseType.Group && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label>Gruppen</Label>
                      <Input
                        type="number"
                        min={1}
                        {...register("groupCount")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Pro Gruppe</Label>
                      <Input
                        type="number"
                        min={2}
                        {...register("teamsPerGroup")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Aufsteiger</Label>
                      <Input
                        type="number"
                        min={1}
                        {...register("advancingPerGroup")}
                      />
                    </div>
                  </div>
                </>
              )}
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Erstellen
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {phases?.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Noch keine Phasen definiert.
        </p>
      ) : (
        <div className="space-y-4">
          {phases
            ?.sort((a, b) => a.order - b.order)
            .map((phase) => (
              <Card key={phase.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{phase.name}</CardTitle>
                    <CardDescription>
                      <Badge variant="secondary">
                        {phaseTypeLabels[phase.type]}
                      </Badge>
                      <span className="ml-2">Phase {phase.order}</span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateMutation.mutate(phase.id)}
                      disabled={generateMutation.isPending}
                    >
                      {generateMutation.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-3 w-3" />
                      )}
                      Spiele generieren
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`${phase.name} wirklich löschen?`)) {
                          deleteMutation.mutate(phase.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                {phase.config && (
                  <CardContent>
                    {"groupCount" in phase.config && (
                      <p className="text-sm text-muted-foreground">
                        {phase.config.groupCount} Gruppen,{" "}
                        {phase.config.teamsPerGroup} Teams pro Gruppe,{" "}
                        {phase.config.advancingPerGroup} steigen auf
                      </p>
                    )}
                    {"thirdPlaceMatch" in phase.config &&
                      phase.config.thirdPlaceMatch && (
                        <p className="text-sm text-muted-foreground">
                          Mit Spiel um Platz 3
                        </p>
                      )}
                  </CardContent>
                )}
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
