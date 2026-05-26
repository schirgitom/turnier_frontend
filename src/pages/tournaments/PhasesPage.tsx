import { useState } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  Users,
  Swords,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPhases,
  addGroupPhase,
  addEliminationPhase,
  removePhase,
  generatePhase,
  generateAllPhases,
  reassignParticipant,
} from "@/api/phases";
import { isGroupPhase } from "@/types/phase";
import type {
  PhaseResponse,
  GroupPhaseResponse,
  EliminationPhaseResponse,
  GroupParticipant,
  ReassignParticipantRequest,
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
  Generated: "Generiert",
  Completed: "Abgeschlossen",
};

function cleanName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 3 && parts[1] === parts[2]) return `${parts[0]} ${parts[1]}`;
  return name;
}

function germanGroupName(name: string): string {
  return name.replace("Group", "Gruppe");
}

function GroupPhaseCard({
  phase,
  tournamentId,
  onDelete,
  deleting,
  onGenerate,
  generating,
}: {
  phase: GroupPhaseResponse;
  tournamentId: string;
  onDelete: () => void;
  deleting: boolean;
  onGenerate: () => void;
  generating: boolean;
}) {
  const queryClient = useQueryClient();
  const canGenerate =
    phase.status !== "Generated" && phase.status !== "Completed";
  const hasGroups = (phase.groups?.length ?? 0) > 0;

  const [expanded, setExpanded] = useState(hasGroups);
  const [reassignTarget, setReassignTarget] = useState<{
    participant: GroupParticipant;
    sourceGroupId: string;
    sourceGroupName: string;
  } | null>(null);
  const [targetGroupId, setTargetGroupId] = useState("");

  const reassignMutation = useMutation({
    mutationFn: (data: ReassignParticipantRequest) =>
      reassignParticipant(tournamentId, phase.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      toast.success("Teilnehmer verschoben");
      setReassignTarget(null);
    },
  });

  const openReassign = (
    participant: GroupParticipant,
    sourceGroupId: string,
    sourceGroupName: string,
  ) => {
    setTargetGroupId("");
    reassignMutation.reset();
    setReassignTarget({ participant, sourceGroupId, sourceGroupName });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{phase.name}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Gruppenphase</Badge>
              <Badge variant="outline">
                {statusLabels[phase.status] ?? phase.status}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onGenerate}
              disabled={!canGenerate || generating}
            >
              {generating ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="mr-1.5 h-3.5 w-3.5" />
              )}
              Generieren
            </Button>
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
              aria-label={expanded ? "Zuklappen" : "Aufklappen"}
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
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>{phase.numberOfGroups} Gruppen</span>
              <span>{phase.qualifiersPerGroup} Aufsteiger</span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {phase.participantCount} Teilnehmer
              </span>
            </div>

            {hasGroups ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(phase.groups ?? []).map((group) => (
                  <div
                    key={group.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {germanGroupName(group.name)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {group.participants.length} Teilnehmer
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {group.participants.map((p) => (
                        <li
                          key={p.participantId}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>{cleanName(p.displayName)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={reassignMutation.isPending}
                            onClick={() =>
                              openReassign(
                                p,
                                group.id,
                                germanGroupName(group.name),
                              )
                            }
                          >
                            {reassignMutation.isPending &&
                            reassignTarget?.participant.participantId ===
                              p.participantId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ArrowLeftRight className="h-3 w-3" />
                            )}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Phase noch nicht generiert.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <Dialog
        open={reassignTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReassignTarget(null);
            reassignMutation.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teilnehmer verschieben</DialogTitle>
          </DialogHeader>
          {reassignTarget && (
            <div className="space-y-4">
              {reassignMutation.isError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {getApiErrorMessage(reassignMutation.error)}
                </div>
              )}
              <div className="space-y-2">
                <Label>Teilnehmer</Label>
                <p className="rounded-md border bg-muted px-3 py-2 text-sm">
                  {cleanName(reassignTarget.participant.displayName)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Von Gruppe</Label>
                <p className="rounded-md border bg-muted px-3 py-2 text-sm">
                  {reassignTarget.sourceGroupName}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Nach Gruppe</Label>
                <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Gruppe auswählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(phase.groups ?? [])
                      .filter((g) => g.id !== reassignTarget.sourceGroupId)
                      .map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {germanGroupName(g.name)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setReassignTarget(null)}
                  disabled={reassignMutation.isPending}
                >
                  Abbrechen
                </Button>
                <Button
                  disabled={!targetGroupId || reassignMutation.isPending}
                  onClick={() =>
                    reassignMutation.mutate({
                      participantId: reassignTarget.participant.participantId,
                      sourceGroupId: reassignTarget.sourceGroupId,
                      targetGroupId,
                    })
                  }
                >
                  {reassignMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Verschieben
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EliminationPhaseCard({
  phase,
  onDelete,
  deleting,
  onGenerate,
  generating,
}: {
  phase: EliminationPhaseResponse;
  onDelete: () => void;
  deleting: boolean;
  onGenerate: () => void;
  generating: boolean;
}) {
  const canGenerate =
    phase.status !== "Generated" && phase.status !== "Completed";
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">{phase.name}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">K.O.-Phase</Badge>
            <Badge variant="outline">
              {statusLabels[phase.status] ?? phase.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onGenerate}
            disabled={!canGenerate || generating}
          >
            {generating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="mr-1.5 h-3.5 w-3.5" />
            )}
            Generieren
          </Button>
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
            aria-label={expanded ? "Zuklappen" : "Aufklappen"}
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
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>
              {eliminationFormatLabels[phase.eliminationFormat] ??
                phase.eliminationFormat}
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
      )}
    </Card>
  );
}

export function PhasesPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const queryClient = useQueryClient();
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [elimDialogOpen, setElimDialogOpen] = useState(false);
  const [generatingPhaseId, setGeneratingPhaseId] = useState<string | null>(
    null,
  );

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

  const generateAllMutation = useMutation({
    mutationFn: () => generateAllPhases(tournamentId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      toast.success("Alle Phasen generiert");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const handleGeneratePhase = async (phaseId: string) => {
    setGeneratingPhaseId(phaseId);
    try {
      await generatePhase(tournamentId!, phaseId);
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      toast.success("Phase generiert");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setGeneratingPhaseId(null);
    }
  };

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

  const configInvalid =
    data !== undefined &&
    !data.isConfigurationValid &&
    data.validationErrors.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Phasen ({phases.length})</h2>
          {data && phases.length > 0 && data.isConfigurationValid && (
            <Badge
              variant="outline"
              className="border-green-500 text-green-600"
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Konfiguration gültig
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => generateAllMutation.mutate()}
            disabled={configInvalid || generateAllMutation.isPending}
          >
            {generateAllMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Alle Phasen generieren
          </Button>
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

      {configInvalid && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-500/30 dark:bg-yellow-500/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-500" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                Konfiguration ungültig:
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
                  tournamentId={tournamentId!}
                  onDelete={() => handleDelete(phase)}
                  deleting={deleteMutation.isPending}
                  onGenerate={() => handleGeneratePhase(phase.id)}
                  generating={generatingPhaseId === phase.id}
                />
              ) : (
                <EliminationPhaseCard
                  key={phase.id}
                  phase={phase}
                  onDelete={() => handleDelete(phase)}
                  deleting={deleteMutation.isPending}
                  onGenerate={() => handleGeneratePhase(phase.id)}
                  generating={generatingPhaseId === phase.id}
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
              <Button type="submit" disabled={createGroupMutation.isPending}>
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
              <Button type="submit" disabled={createElimMutation.isPending}>
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
