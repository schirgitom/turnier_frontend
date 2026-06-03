import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  CalendarClock,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserMinus,
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
  createGroup,
  renameGroup,
  deleteGroup,
  addParticipantToGroup,
  removeParticipantFromGroup,
} from "@/api/phases";
import { getPhaseVenues, updatePhaseVenue } from "@/api/phaseVenues";
import {
  retimePhase,
  downloadFinalRankingPdf,
  downloadGroupSchedulePdf,
  downloadPhaseQualifiersPdf,
  downloadParticipantSchedulePdf,
} from "@/api/scheduling";
import type { AddPhaseVenueRequest } from "@/types/phaseVenue";
import { getRegistrations } from "@/api/registrations";
import { isGroupPhase } from "@/types/phase";
import type {
  PhaseResponse,
  GroupPhaseResponse,
  EliminationPhaseResponse,
  GroupParticipant,
  GenerateMatchesResponse,
  ReassignParticipantRequest,
} from "@/types/phase";
import { getApiErrorMessage } from "@/api/client";
import { cn } from "@/lib/utils";
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

function getPhaseStatusHint(status: string): string {
  switch (status) {
    case "Pending":
      return "Phase ist noch ausstehend. Zeiten können erst nach der Generierung aktualisiert werden.";
    case "Generated":
      return "Phase ist generiert. Zeiten können aktualisiert oder die Phase zurückgesetzt werden.";
    case "InProgress":
      return "Phase läuft aktuell. Zeiten können noch aktualisiert werden.";
    case "Completed":
      return "Phase ist abgeschlossen. Zeitaktualisierung ist daher nicht mehr verfügbar.";
    default:
      return `Status: ${statusLabels[status] ?? status}`;
  }
}

const NATIVE_SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function cleanName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 3 && parts[1] === parts[2]) return `${parts[0]} ${parts[1]}`;
  return name;
}

function groupCodeFromName(name: string): string {
  const normalized = germanGroupName(name).trim();
  if (normalized.toLowerCase().startsWith("gruppe ")) {
    return normalized.slice("Gruppe ".length).trim();
  }
  return normalized;
}

function resolveParticipantName(
  participantId: string,
  displayName: string | null | undefined,
  registrationDisplayNameById?: Map<string, string>,
): string {
  const normalizedDisplayName = (displayName ?? "").trim();
  if (
    normalizedDisplayName &&
    !/\bunbekannt\b/i.test(normalizedDisplayName) &&
    !/\bunknown\b/i.test(normalizedDisplayName)
  ) {
    return normalizedDisplayName;
  }

  const registrationName =
    registrationDisplayNameById?.get(participantId)?.trim() ?? "";
  if (registrationName) return registrationName;

  return `Teilnehmer ${participantId}`;
}

function germanGroupName(name: string): string {
  return name.replace("Group", "Gruppe");
}

const UNASSIGNED_ID = "__unassigned__";

interface DragData {
  participantId: string;
  sourceGroupId: string;
  displayName: string;
}

function DraggableParticipantRow({
  participant,
  sourceGroupId,
  sourceGroupCode,
  onOpenReassign,
  reassigning,
  isActiveReassign,
  trailing,
}: {
  participant: GroupParticipant;
  sourceGroupId: string;
  sourceGroupCode?: string;
  onOpenReassign?: () => void;
  reassigning?: boolean;
  isActiveReassign?: boolean;
  trailing?: React.ReactNode;
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
        {sourceGroupCode && (
          <span className="shrink-0 rounded border border-input bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
            {sourceGroupCode}
          </span>
        )}
      </div>
      <div className="flex shrink-0 gap-0.5">
        {trailing}
        {onOpenReassign && (
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
        )}
      </div>
    </li>
  );
}

function stripDropId(id: string): string {
  return id.replace("topbar-", "").replace("card-", "");
}

function DropZoneTarget({
  groupId,
  isSrc,
  isOver,
  children,
}: {
  groupId: string;
  isSrc: boolean;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `topbar-${groupId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
        isSrc
          ? "border-muted-foreground/30 text-muted-foreground"
          : isOver
            ? "border-victora-secondary bg-victora-secondary/15 text-victora-secondary"
            : "border-input bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </div>
  );
}

function DroppableGroupCard({
  groupId,
  isDragging,
  isOver,
  children,
}: {
  groupId: string;
  isDragging: boolean;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `card-${groupId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border p-3 space-y-2 transition-colors",
        isDragging && !isOver && "border-dashed border-primary/30",
        isOver && "border-solid border-victora-secondary bg-victora-secondary/5",
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
  const canDownloadSchedules = phase.status !== "Pending";
  const phaseStatusHint = getPhaseStatusHint(phase.status);
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

  const isPending = phase.status === "Pending";

  const { data: registrationsData } = useQuery({
    queryKey: ["registrations", tournamentId],
    queryFn: () => getRegistrations(tournamentId),
    enabled: expanded && (hasGroups || isPending),
  });

  const { data: phaseVenuesData } = useQuery({
    queryKey: ["phaseVenues", tournamentId, phase.id],
    queryFn: () => getPhaseVenues(tournamentId, phase.id),
  });
  const venuesList = phaseVenuesData?.venues ?? [];
  const venueCount = venuesList.length;

  const sortedVenues = [...venuesList].sort((a, b) => {
    const aTime = a.availableFrom ? new Date(a.availableFrom).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.availableFrom ? new Date(b.availableFrom).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
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
  const [downloadingParticipantId, setDownloadingParticipantId] = useState<
    string | null
  >(null);
  const [downloadingGroupId, setDownloadingGroupId] = useState<string | null>(
    null,
  );
  const [downloadingQualifiersPdf, setDownloadingQualifiersPdf] = useState(false);

  const groups = phase.groups ?? [];
  const displayGroups = useMemo(
    () =>
      [...groups].sort((a, b) =>
        a.name.localeCompare(b.name, "de", {
          numeric: true,
          sensitivity: "base",
        }),
      ),
    [groups],
  );
  const registrationDisplayNameById = useMemo(
    () =>
      new Map(
        (registrationsData?.registrations ?? []).map((registration) => [
          registration.participantId,
          registration.participantDisplayName,
        ]),
      ),
    [registrationsData?.registrations],
  );
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

  const [newGroupName, setNewGroupName] = useState("");
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const invalidatePhases = () =>
    queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });

  const createGroupMutation = useMutation({
    mutationFn: (name: string) => createGroup(tournamentId, phase.id, name),
    onSuccess: () => {
      invalidatePhases();
      setNewGroupName("");
      toast.success("Gruppe erstellt");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const renameGroupMutation = useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) =>
      renameGroup(tournamentId, phase.id, groupId, name),
    onSuccess: () => {
      invalidatePhases();
      setRenamingGroupId(null);
      toast.success("Gruppe umbenannt");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) =>
      deleteGroup(tournamentId, phase.id, groupId),
    onSuccess: () => {
      invalidatePhases();
      toast.success("Gruppe gelöscht");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const addToGroupMutation = useMutation({
    mutationFn: ({
      groupId,
      participantId,
    }: {
      groupId: string;
      participantId: string;
    }) => addParticipantToGroup(tournamentId, phase.id, groupId, participantId),
    onSuccess: () => {
      invalidatePhases();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const randomAssignMutation = useMutation({
    mutationFn: async () => {
      if (groups.length === 0 || unassigned.length === 0) return;

      const shuffledParticipants = [...unassigned];
      for (let i = shuffledParticipants.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const current = shuffledParticipants[i]!;
        shuffledParticipants[i] = shuffledParticipants[j]!;
        shuffledParticipants[j] = current;
      }

      const shuffledGroupIds = displayGroups.map((group) => group.id);
      for (let i = shuffledGroupIds.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const current = shuffledGroupIds[i]!;
        shuffledGroupIds[i] = shuffledGroupIds[j]!;
        shuffledGroupIds[j] = current;
      }

      await Promise.all(
        shuffledParticipants.map((participant, index) => {
          const groupId = shuffledGroupIds[index % shuffledGroupIds.length]!;
          return addParticipantToGroup(
            tournamentId,
            phase.id,
            groupId,
            participant.participantId,
          );
        }),
      );
    },
    onSuccess: () => {
      invalidatePhases();
      toast.success("Nicht zugeordnete Teilnehmer zufällig verteilt");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const removeFromGroupMutation = useMutation({
    mutationFn: ({
      groupId,
      participantId,
    }: {
      groupId: string;
      participantId: string;
    }) =>
      removeParticipantFromGroup(
        tournamentId,
        phase.id,
        groupId,
        participantId,
      ),
    onSuccess: () => {
      invalidatePhases();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
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
    const rawId = event.over?.id?.toString() ?? null;
    setOverGroupId(rawId ? stripDropId(rawId) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;
    const drag = activeDragData;
    setActiveDragData(null);
    setOverGroupId(null);
    if (!over || !drag) return;
    const tgtGroupId = stripDropId(over.id.toString());
    if (tgtGroupId === drag.sourceGroupId) return;
    if (drag.sourceGroupId === UNASSIGNED_ID) {
      addToGroupMutation.mutate({
        groupId: tgtGroupId,
        participantId: drag.participantId,
      });
    } else {
      reassignMutation.mutate({
        participantId: drag.participantId,
        sourceGroupId: drag.sourceGroupId,
        targetGroupId: tgtGroupId,
      });
    }
  };

  const handleParticipantPdfDownload = async (participantId: string) => {
    setDownloadingParticipantId(participantId);
    try {
      await downloadParticipantSchedulePdf(tournamentId, phase.id, participantId);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setDownloadingParticipantId(null);
    }
  };

  const handleGroupPdfDownload = async (groupId: string) => {
    setDownloadingGroupId(groupId);
    try {
      await downloadGroupSchedulePdf(tournamentId, phase.id, groupId);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setDownloadingGroupId(null);
    }
  };

  const handleQualifiersPdfDownload = async () => {
    setDownloadingQualifiersPdf(true);
    try {
      await downloadPhaseQualifiersPdf(tournamentId, phase.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setDownloadingQualifiersPdf(false);
    }
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
            <p className="text-xs text-muted-foreground">{phaseStatusHint}</p>
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
              variant="outline"
              size="sm"
              onClick={canSchedule ? onSchedule : undefined}
              disabled={!canSchedule || scheduling}
              title={canSchedule ? "Zeiten der Phase aktualisieren" : phaseStatusHint}
            >
              {scheduling ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
              )}
              Zeiten aktualisieren
            </Button>
            {canDownloadSchedules && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleQualifiersPdfDownload}
                disabled={downloadingQualifiersPdf}
              >
                {downloadingQualifiersPdf ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                )}
                Aufsteiger PDF
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
                {/* Pending: create group form */}
                {isPending && (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newGroupName.trim())
                        createGroupMutation.mutate(newGroupName.trim());
                    }}
                  >
                    <Input
                      placeholder="Neue Gruppe…"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="h-8 w-48 text-sm"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={
                        !newGroupName.trim() || createGroupMutation.isPending
                      }
                    >
                      {createGroupMutation.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="mr-1 h-3 w-3" />
                      )}
                      Gruppe erstellen
                    </Button>
                  </form>
                )}

                {/* Drop zone bar – slides in while dragging */}
                {activeDragData && (
                  <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-primary/30 bg-muted/50 p-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <span className="flex items-center text-xs font-medium text-muted-foreground mr-1">
                      {activeDragData.sourceGroupId === UNASSIGNED_ID
                        ? "Zuweisen zu:"
                        : "Verschieben nach:"}
                    </span>
                    {displayGroups.map((g) => {
                      const isSrc = g.id === activeDragData.sourceGroupId;
                      return (
                        <DropZoneTarget key={g.id} groupId={g.id} isSrc={isSrc} isOver={overGroupId === g.id}>
                          {germanGroupName(g.name)}
                        </DropZoneTarget>
                      );
                    })}
                  </div>
                )}

                {/* Group cards */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {displayGroups.map((group) => (
                    <DroppableGroupCard
                      key={group.id}
                      groupId={group.id}
                      isDragging={!!activeDragData}
                      isOver={overGroupId === group.id}
                    >
                      <div className="flex items-center justify-between gap-1">
                        {isPending && renamingGroupId === group.id ? (
                          <form
                            className="flex flex-1 items-center gap-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (renameValue.trim())
                                renameGroupMutation.mutate({
                                  groupId: group.id,
                                  name: renameValue.trim(),
                                });
                            }}
                          >
                            <Input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              disabled={
                                !renameValue.trim() ||
                                renameGroupMutation.isPending
                              }
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          </form>
                        ) : (
                          <span className="text-sm font-semibold">
                            {germanGroupName(group.name)}
                          </span>
                        )}
                        <div className="flex shrink-0 items-center gap-0.5">
                          <span className="mr-1 text-xs text-muted-foreground">
                            {group.participants.length} Teilnehmer
                          </span>
                          {canDownloadSchedules && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleGroupPdfDownload(group.id)}
                              disabled={downloadingGroupId === group.id}
                              title="Gruppen-Spielplan als PDF"
                            >
                              {downloadingGroupId === group.id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Download className="mr-1 h-3 w-3" />
                              )}
                              PDF
                            </Button>
                          )}
                          {isPending && renamingGroupId !== group.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                setRenamingGroupId(group.id);
                                setRenameValue(group.name);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          {isPending && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                if (
                                  group.participants.length > 0 &&
                                  !confirm(
                                    `${germanGroupName(group.name)} mit ${group.participants.length} Teilnehmern löschen?`,
                                  )
                                )
                                  return;
                                deleteGroupMutation.mutate(group.id);
                              }}
                              disabled={deleteGroupMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <ul className="space-y-1">
                        {group.participants.map((p, participantIndex) => {
                          const baseGroupCode = groupCodeFromName(group.name);
                          const participantGroupCode = baseGroupCode
                            ? `${baseGroupCode}${participantIndex + 1}`
                            : undefined;
                          const participant = {
                            ...p,
                            displayName: resolveParticipantName(
                              p.participantId,
                              p.displayName,
                              registrationDisplayNameById,
                            ),
                          };

                          return (
                            <DraggableParticipantRow
                              key={p.participantId}
                              participant={participant}
                              sourceGroupId={group.id}
                              sourceGroupCode={participantGroupCode}
                              onOpenReassign={() =>
                                openReassign(
                                  participant,
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
                              trailing={
                                <>
                                  {canDownloadSchedules && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() =>
                                        handleParticipantPdfDownload(p.participantId)
                                      }
                                      disabled={
                                        downloadingParticipantId === p.participantId
                                      }
                                      title="Teilnehmer-Spielplan als PDF"
                                    >
                                      {downloadingParticipantId === p.participantId ? (
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                      ) : (
                                        <Download className="mr-1 h-3 w-3" />
                                      )}
                                      PDF
                                    </Button>
                                  )}
                                  {isPending && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        removeFromGroupMutation.mutate({
                                          groupId: group.id,
                                          participantId: p.participantId,
                                        })
                                      }
                                      disabled={removeFromGroupMutation.isPending}
                                    >
                                      <UserMinus className="h-3 w-3" />
                                    </Button>
                                  )}
                                </>
                              }
                            />
                          );
                        })}
                        {group.participants.length === 0 && (
                          <li className="py-2 text-center text-xs text-muted-foreground">
                            Teilnehmer hierher ziehen
                          </li>
                        )}
                      </ul>
                    </DroppableGroupCard>
                  ))}
                </div>

                {/* Unassigned participants */}
                {unassigned.length > 0 && (
                  <div className="rounded-lg border border-dashed p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">
                        Nicht zugeordnet ({unassigned.length})
                      </h4>
                      {isPending && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            randomAssignMutation.isPending ||
                            addToGroupMutation.isPending ||
                            groups.length === 0
                          }
                          onClick={() => randomAssignMutation.mutate()}
                        >
                          {randomAssignMutation.isPending && (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          )}
                          Zufällig verteilen
                        </Button>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {unassigned.map((r) => (
                        <DraggableParticipantRow
                          key={r.participantId}
                          participant={{
                            participantId: r.participantId,
                            displayName: resolveParticipantName(
                              r.participantId,
                              r.participantDisplayName,
                              registrationDisplayNameById,
                            ),
                          }}
                          sourceGroupId={UNASSIGNED_ID}
                          sourceGroupCode="-"
                          trailing={
                            isPending ? (
                              <select
                                className={cn(
                                  NATIVE_SELECT_CLASS,
                                  "h-7 w-auto py-0 text-xs",
                                )}
                                defaultValue=""
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  addToGroupMutation.mutate({
                                    groupId: e.target.value,
                                    participantId: r.participantId,
                                  });
                                  e.target.value = "";
                                }}
                                disabled={addToGroupMutation.isPending}
                              >
                                <option value="">Zuweisen…</option>
                                {displayGroups.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {germanGroupName(g.name)}
                                  </option>
                                ))}
                              </select>
                            ) : undefined
                          }
                        />
                      ))}
                    </ul>
                  </div>
                )}

                <DragOverlay>
                  {activeDragData && (
                    <div className="inline-flex w-fit max-w-[24rem] items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm shadow-lg">
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {cleanName(activeDragData.displayName)}
                      </span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            ) : isPending ? (
              <>
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newGroupName.trim())
                      createGroupMutation.mutate(newGroupName.trim());
                  }}
                >
                  <Input
                    placeholder="Neue Gruppe…"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="h-8 w-48 text-sm"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={
                      !newGroupName.trim() || createGroupMutation.isPending
                    }
                  >
                    {createGroupMutation.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="mr-1 h-3 w-3" />
                    )}
                    Gruppe erstellen
                  </Button>
                </form>
                <p className="text-sm text-muted-foreground">
                  {unassigned.length > 0
                    ? `${unassigned.length} registrierte Teilnehmer. Erstelle Gruppen um sie zuzuweisen, oder klicke „Generieren" für automatische Verteilung.`
                    : `Erstelle Gruppen manuell oder klicke „Generieren" für automatische Verteilung.`}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Phase noch nicht generiert.
              </p>
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
                    {displayGroups
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
  const canDownloadFinalRanking = phase.status !== "Pending";
  const phaseStatusHint = getPhaseStatusHint(phase.status);
  const [expanded, setExpanded] = useState(false);
  const [downloadingFinalRanking, setDownloadingFinalRanking] = useState(false);

  const { data: phaseVenues } = useQuery({
    queryKey: ["phaseVenues", tournamentId, phase.id],
    queryFn: () => getPhaseVenues(tournamentId, phase.id),
  });
  const venueCount = phaseVenues?.venues.length ?? 0;

  const handleFinalRankingPdfDownload = async () => {
    setDownloadingFinalRanking(true);
    try {
      await downloadFinalRankingPdf(tournamentId, phase.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setDownloadingFinalRanking(false);
    }
  };

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
          <p className="text-xs text-muted-foreground">{phaseStatusHint}</p>
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
          {canDownloadFinalRanking && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFinalRankingPdfDownload}
              disabled={downloadingFinalRanking}
            >
              {downloadingFinalRanking ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              Finale Rangliste PDF
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={canSchedule ? onSchedule : undefined}
            disabled={!canSchedule || scheduling}
            title={canSchedule ? "Zeiten der Phase aktualisieren" : phaseStatusHint}
          >
            {scheduling ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
            )}
            Zeiten aktualisieren
          </Button>
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
      await retimePhase(tournamentId!, phaseId);
      queryClient.invalidateQueries({ queryKey: ["phases", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
      toast.success("Zeiten der Phase wurden aktualisiert");
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
