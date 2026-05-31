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
  GripVertical,
  Loader2,
  Plus,
  CalendarClock,
  RefreshCw,
  RotateCcw,
  Trash2,
  Users,
  Swords,
  Zap,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import {
  getPhases,
  addGroupPhase,
  addEliminationPhase,
  removePhase,
  generatePhase,
  generateAllPhases,
  resetPhase,
  reassignParticipant,
} from "@/api/phases";
import { getPhaseVenues, updatePhaseVenue } from "@/api/phaseVenues";
import { schedulePhase } from "@/api/scheduling";
import type { AddPhaseVenueRequest } from "@/types/phaseVenue";
import { getRegistrations } from "@/api/registrations";
import { isGroupPhase } from "@/types/phase";
import type {
  PhaseResponse,
  GroupPhaseResponse,
  GroupResponse,
  EliminationPhaseResponse,
  GroupParticipant,
  GenerateMatchesResponse,
  ReassignParticipantRequest,
} from "@/types/phase";
import { getApiErrorMessage } from "@/api/client";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  InProgress: "Laufend",
  Completed: "Abgeschlossen",
};

const NATIVE_SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function cleanName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 3 && parts[1] === parts[2]) return `${parts[0]} ${parts[1]}`;
  return name;
}

function germanGroupName(name: string): string {
  return name.replace("Group", "Gruppe");
}

interface DragData {
  participantId: string;
  sourceGroupId: string;
  displayName: string;
}

function DraggableParticipantRow({
  participant,
  sourceGroupId,
  onOpenReassign,
  reassigning,
  isActiveReassign,
}: {
  participant: GroupParticipant;
  sourceGroupId: string;
  onOpenReassign: () => void;
  reassigning: boolean;
  isActiveReassign: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${participant.participantId}::${sourceGroupId}`,
    data: {
      participantId: participant.participantId,
      sourceGroupId,
      displayName: participant.displayName,
    } satisfies DragData,
  });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-between text-sm",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground shrink-0"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="truncate">{cleanName(participant.displayName)}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        disabled={reassigning}
        onClick={onOpenReassign}
      >
        {isActiveReassign ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ArrowLeftRight className="h-3 w-3" />
        )}
      </Button>
    </li>
  );
}

function DroppableGroupCard({
  group,
  activeSrcGroupId,
  overGroupId,
  children,
}: {
  group: GroupResponse;
  activeSrcGroupId: string | null;
  overGroupId: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: group.id });
  const isOver = overGroupId === group.id;
  const isSameGroup = activeSrcGroupId === group.id;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border p-3 space-y-2 transition-colors",
        isOver && !isSameGroup &&
          "border-victora-secondary bg-victora-secondary/10",
        isOver && isSameGroup &&
          "border-victora-error bg-victora-error/10",
      )}
    >
      {children}
    </div>
  );
}

function GroupPhaseCard({
  phase,
  tournamentId,
  onDelete,
  deleting,
  onGenerate,
  generating,
  onReset,
  resetting,
  onSchedule,
  scheduling,
}: {
  phase: GroupPhaseResponse;
  tournamentId: string;
  onDelete: () => void;
  deleting: boolean;
  onGenerate: () => void;
  generating: boolean;
  onReset: () => void;
  resetting: boolean;
  onSchedule: () => void;
  scheduling: boolean;
}) {
  const queryClient = useQueryClient();
  const canGenerate =
    phase.status !== "Generated" && phase.status !== "Completed";
  const canReset = phase.status !== "Pending";
  const canSchedule = phase.status === "InProgress" || phase.status === "Generated";
  const hasGroups = (phase.groups?.length ?? 0) > 0;

  const [expanded, setExpanded] = useState(hasGroups);
  const [reassignTarget, setReassignTarget] = useState<{
    participant: GroupParticipant;
    sourceGroupId: string;
    sourceGroupName: string;
  } | null>(null);
  const [targetGroupId, setTargetGroupId] = useState("");
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const { data: registrationsData } = useQuery({
    queryKey: ["registrations", tournamentId],
    queryFn: () => getRegistrations(tournamentId),
    enabled: expanded && hasGroups,
  });

  const { data: phaseVenuesData } = useQuery({
    queryKey: ["phaseVenues", tournamentId, phase.id],
    queryFn: () => getPhaseVenues(tournamentId, phase.id),
  });
  const venuesList = phaseVenuesData?.venues ?? [];
  const venueCount = venuesList.length;

  const sortedVenues = [...venuesList].sort(
    (a, b) => new Date(a.availableFrom).getTime() - new Date(b.availableFrom).getTime(),
  );
  const firstVenue = sortedVenues[0] ?? null;
  const showRotation = venueCount >= 2;
  const existingRotation = firstVenue?.venueRotation;

  const [rotationEnabled, setRotationEnabled] = useState(
    existingRotation?.enabled ?? false,
  );
  const [rotateAfterRounds, setRotateAfterRounds] = useState(
    existingRotation?.rotateAfterRounds ?? 3,
  );
  const [groupVenueAssignments, setGroupVenueAssignments] = useState<
    Record<number, number>
  >(() => {
    const map: Record<number, number> = {};
    if (existingRotation?.groupAssignments) {
      for (const ga of existingRotation.groupAssignments) {
        map[ga.groupIndex] = ga.startVenueIndex;
      }
    }
    return map;
  });
  const [rotationDefaultsApplied, setRotationDefaultsApplied] = useState(
    !!existingRotation,
  );

  const groups = phase.groups ?? [];
  if (
    !rotationDefaultsApplied &&
    groups.length > 0 &&
    Object.keys(groupVenueAssignments).length === 0
  ) {
    const half = Math.ceil(groups.length / 2);
    const defaults: Record<number, number> = {};
    groups.forEach((_, i) => { defaults[i] = i < half ? 0 : 1; });
    setGroupVenueAssignments(defaults);
    setRotationDefaultsApplied(true);
  }

  const rotationMutation = useMutation({
    mutationFn: (data: AddPhaseVenueRequest) =>
      updatePhaseVenue(tournamentId, phase.id, firstVenue!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["phaseVenues", tournamentId, phase.id],
      });
      toast.success("Rotation gespeichert");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const handleSaveRotation = () => {
    if (!firstVenue) return;
    const venueRotation = rotationEnabled
      ? {
          enabled: true,
          rotateAfterRounds,
          groupAssignments: groups.map((_, index) => ({
            groupIndex: index,
            startVenueIndex: groupVenueAssignments[index] ?? 0,
          })),
        }
      : null;
    rotationMutation.mutate({
      venueId: firstVenue.venueId,
      availableFrom: firstVenue.availableFrom,
      matchDurationMinutes: firstVenue.matchDurationMinutes,
      breakBetweenMatchesMinutes: firstVenue.breakBetweenMatchesMinutes,
      schedulingStrategy: firstVenue.schedulingStrategy,
      activeCourtIds: firstVenue.activeCourts.map((c) => c.id),
      venueRotation,
    });
  };

  const assignedIds = new Set(
    (phase.groups ?? []).flatMap((g) =>
      g.participants.map((p) => p.participantId),
    ),
  );
  const unassigned = (registrationsData?.registrations ?? []).filter(
    (r) => r.status === "Confirmed" && !assignedIds.has(r.participantId),
  );

  const reassignMutation = useMutation({
    mutationFn: (data: ReassignParticipantRequest) =>
      reassignParticipant(tournamentId, phase.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      toast.success("Teilnehmer verschoben");
      setReassignTarget(null);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragData(event.active.data.current as DragData);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverGroupId(event.over?.id?.toString() ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;
    const drag = activeDragData;
    setActiveDragData(null);
    setOverGroupId(null);
    if (!over || !drag) return;
    const tgtGroupId = over.id.toString();
    if (tgtGroupId === drag.sourceGroupId) return;
    reassignMutation.mutate({
      participantId: drag.participantId,
      sourceGroupId: drag.sourceGroupId,
      targetGroupId: tgtGroupId,
    });
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
              {phaseVenuesData && (
                venueCount > 0 ? (
                  <Badge variant="secondary">
                    {venueCount} Spielstätte{venueCount !== 1 ? "n" : ""}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-[#F3A83B] text-[#F3A83B]"
                  >
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Keine Spielstätte
                  </Badge>
                )
              )}
              {existingRotation?.enabled && (
                <Badge className="bg-victora-secondary/15 text-victora-secondary border-transparent gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Rotation alle {existingRotation.rotateAfterRounds} Runden
                </Badge>
              )}
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
            {canSchedule && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSchedule}
                disabled={scheduling}
              >
                {scheduling ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                )}
                Spielplan neu generieren
              </Button>
            )}
            {canReset && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                disabled={resetting}
              >
                {resetting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Zurücksetzen
              </Button>
            )}
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(phase.groups ?? []).map((group) => (
                    <DroppableGroupCard
                      key={group.id}
                      group={group}
                      activeSrcGroupId={activeDragData?.sourceGroupId ?? null}
                      overGroupId={overGroupId}
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
                          <DraggableParticipantRow
                            key={p.participantId}
                            participant={p}
                            sourceGroupId={group.id}
                            onOpenReassign={() =>
                              openReassign(
                                p,
                                group.id,
                                germanGroupName(group.name),
                              )
                            }
                            reassigning={reassignMutation.isPending}
                            isActiveReassign={
                              reassignMutation.isPending &&
                              reassignTarget?.participant.participantId ===
                                p.participantId
                            }
                          />
                        ))}
                      </ul>
                    </DroppableGroupCard>
                  ))}
                </div>

                <DragOverlay>
                  {activeDragData && (
                    <div className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm shadow-lg">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                      {cleanName(activeDragData.displayName)}
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            ) : (
              <p className="text-sm text-muted-foreground">
                Phase noch nicht generiert.
              </p>
            )}

            {hasGroups && unassigned.length > 0 && (
              <div className="rounded-lg border border-dashed p-4 space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Nicht zugeordnet ({unassigned.length})
                </h4>
                <ul className="space-y-1.5">
                  {unassigned.map((r) => (
                    <li
                      key={r.participantId}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        <span className="truncate">
                          {cleanName(r.participantDisplayName)}
                        </span>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0}>
                              {/* TODO: backend needs endpoint to add an unassigned participant to a group after phase generation */}
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="shrink-0"
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Hinzufügen
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            Nachträgliches Hinzufügen wird vom Backend noch
                            nicht unterstützt
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {showRotation && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Venue Rotation</span>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-primary"
                      checked={rotationEnabled}
                      onChange={(e) => setRotationEnabled(e.target.checked)}
                    />
                    {rotationEnabled ? "Ein" : "Aus"}
                  </label>
                </div>

                {rotationEnabled && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`rot-rounds-${phase.id}`}>
                        Rotieren nach X Runden
                      </Label>
                      <Input
                        id={`rot-rounds-${phase.id}`}
                        type="number"
                        min={1}
                        className="w-32"
                        value={rotateAfterRounds}
                        onChange={(e) =>
                          setRotateAfterRounds(
                            Math.max(1, parseInt(e.target.value) || 1),
                          )
                        }
                      />
                    </div>

                    {groups.length > 0 && (
                      <div className="space-y-1.5">
                        <Label>Gruppen-Startzuweisung</Label>
                        <div className="space-y-1.5">
                          {groups.map((group, idx) => (
                            <div
                              key={group.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span className="w-24 shrink-0 truncate font-medium">
                                {germanGroupName(group.name)}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <select
                                className={cn(NATIVE_SELECT_CLASS, "w-auto flex-1")}
                                value={groupVenueAssignments[idx] ?? 0}
                                onChange={(e) =>
                                  setGroupVenueAssignments((prev) => ({
                                    ...prev,
                                    [idx]: parseInt(e.target.value),
                                  }))
                                }
                              >
                                {sortedVenues.map((v, vIdx) => (
                                  <option key={v.id} value={vIdx}>
                                    {v.venueName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end">
                  <Button
                    size="sm"
                    onClick={handleSaveRotation}
                    disabled={rotationMutation.isPending}
                  >
                    {rotationMutation.isPending && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    Speichern
                  </Button>
                </div>
              </div>
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
  tournamentId,
  onDelete,
  deleting,
  onGenerate,
  generating,
  onReset,
  resetting,
  onSchedule,
  scheduling,
}: {
  phase: EliminationPhaseResponse;
  tournamentId: string;
  onDelete: () => void;
  deleting: boolean;
  onGenerate: () => void;
  generating: boolean;
  onReset: () => void;
  resetting: boolean;
  onSchedule: () => void;
  scheduling: boolean;
}) {
  const canGenerate =
    phase.status !== "Generated" && phase.status !== "Completed";
  const canReset = phase.status !== "Pending";
  const canSchedule = phase.status === "InProgress" || phase.status === "Generated";
  const [expanded, setExpanded] = useState(false);

  const { data: phaseVenues } = useQuery({
    queryKey: ["phaseVenues", tournamentId, phase.id],
    queryFn: () => getPhaseVenues(tournamentId, phase.id),
  });
  const venueCount = phaseVenues?.venues.length ?? 0;

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
            {phaseVenues && (
              venueCount > 0 ? (
                <Badge variant="secondary">
                  {venueCount} Spielstätte{venueCount !== 1 ? "n" : ""}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-[#F3A83B] text-[#F3A83B]"
                >
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Keine Spielstätte
                </Badge>
              )
            )}
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
          {canSchedule && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSchedule}
              disabled={scheduling}
            >
              {scheduling ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
              )}
              Spielplan neu generieren
            </Button>
          )}
          {canReset && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              disabled={resetting}
            >
              {resetting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Zurücksetzen
            </Button>
          )}
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

function showSchedulingToasts(result: GenerateMatchesResponse) {
  if (result.autoScheduled) {
    let msg = `Phase generiert. ${result.scheduledMatchCount} Spiele automatisch eingeplant.`;
    if (result.estimatedEndTime) {
      const time = new Date(result.estimatedEndTime).toLocaleTimeString("de-AT", {
        hour: "2-digit",
        minute: "2-digit",
      });
      msg += ` Geschätztes Ende: ${time}`;
    }
    toast.success(msg);
  } else {
    toast.success("Phase generiert. Keine Spielstätte konfiguriert – Spiele ohne Zeitplan.");
  }
  for (const warning of result.schedulingWarnings ?? []) {
    toast.warning(warning);
  }
  if (result.unscheduledMatchCount > 0) {
    toast.warning(`${result.unscheduledMatchCount} Spiele konnten nicht eingeplant werden.`);
  }
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
      showSchedulingToasts(result);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const handleGeneratePhase = async (phaseId: string) => {
    setGeneratingPhaseId(phaseId);
    try {
      const result = await generatePhase(tournamentId!, phaseId);
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
      showSchedulingToasts(result);
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

  const [resetTarget, setResetTarget] = useState<PhaseResponse | null>(null);
  const [resettingPhaseId, setResettingPhaseId] = useState<string | null>(null);

  const handleResetConfirm = async () => {
    if (!resetTarget) return;
    const phaseId = resetTarget.id;
    setResettingPhaseId(phaseId);
    setResetTarget(null);
    try {
      await resetPhase(tournamentId!, phaseId);
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
      toast.success("Phase wurde zurückgesetzt");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setResettingPhaseId(null);
    }
  };

  const [scheduleTarget, setScheduleTarget] = useState<PhaseResponse | null>(null);
  const [schedulingPhaseId, setSchedulingPhaseId] = useState<string | null>(null);

  const handleScheduleConfirm = async () => {
    if (!scheduleTarget) return;
    const phaseId = scheduleTarget.id;
    setSchedulingPhaseId(phaseId);
    setScheduleTarget(null);
    try {
      await schedulePhase(tournamentId!, phaseId);
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
      toast.success("Spielplan wurde neu generiert");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSchedulingPhaseId(null);
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
              className="border-[#3FA97B] text-[#3FA97B]"
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
        <div className="rounded-lg border border-[#F3A83B]/30 bg-[rgba(243,168,59,0.08)] p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F3A83B]" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#c47e00]">
                Konfiguration ungültig:
              </p>
              <ul className="list-inside list-disc text-sm text-[#c47e00]/80">
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
                  onReset={() => setResetTarget(phase)}
                  resetting={resettingPhaseId === phase.id}
                  onSchedule={() => setScheduleTarget(phase)}
                  scheduling={schedulingPhaseId === phase.id}
                />
              ) : (
                <EliminationPhaseCard
                  key={phase.id}
                  phase={phase}
                  tournamentId={tournamentId!}
                  onDelete={() => handleDelete(phase)}
                  deleting={deleteMutation.isPending}
                  onGenerate={() => handleGeneratePhase(phase.id)}
                  generating={generatingPhaseId === phase.id}
                  onReset={() => setResetTarget(phase)}
                  resetting={resettingPhaseId === phase.id}
                  onSchedule={() => setScheduleTarget(phase)}
                  scheduling={schedulingPhaseId === phase.id}
                />
              ),
            )}
        </div>
      )}

      {/* Reset confirmation dialog */}
      <Dialog
        open={resetTarget !== null}
        onOpenChange={(open) => { if (!open) setResetTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phase zurücksetzen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Alle generierten Spiele und Gruppenzuordnungen werden gelöscht.
            Die Phasenkonfiguration (Anzahl Gruppen, Aufsteiger etc.) bleibt
            erhalten.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleResetConfirm}>
              Zurücksetzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule confirmation dialog */}
      <Dialog
        open={scheduleTarget !== null}
        onOpenChange={(open) => { if (!open) setScheduleTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spielplan neu generieren?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Courts und Zeiten werden neu berechnet. Bestehende Ergebnisse
            bleiben erhalten. Bitte stelle sicher dass die
            Spielstätten-Konfiguration aktuell ist.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setScheduleTarget(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleScheduleConfirm}>
              Neu generieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
