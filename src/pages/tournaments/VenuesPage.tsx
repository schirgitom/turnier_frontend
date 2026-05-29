import { useState } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getVenues, createVenue, deleteVenue } from "@/api/venues";
import {
  getPhaseVenues,
  addPhaseVenue,
  updatePhaseVenue,
  removePhaseVenue,
  getVenueCourts,
} from "@/api/phaseVenues";
import { getPhases } from "@/api/phases";
import { getApiErrorMessage } from "@/api/client";
import { VenueCard } from "@/components/venues/VenueCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PhaseVenueDto, AddPhaseVenueRequest } from "@/types/phaseVenue";
import type { VenueListItemDto } from "@/types/venue";
import type { PhaseResponse } from "@/types/phase";

// ─── Constants ───────────────────────────────────────────────────────────────

const STRATEGY_LABELS: Record<"EarliestFirst" | "Distributed", { label: string; description: string }> = {
  EarliestFirst: {
    label: "Frühestmöglich",
    description: "Spiele werden so früh wie möglich eingeplant",
  },
  Distributed: {
    label: "Gleichmäßig verteilt",
    description: "Spiele werden gleichmäßig auf alle Plätze verteilt",
  },
};

const PHASE_STATUS_LABELS: Record<string, string> = {
  Pending: "Ausstehend",
  Active: "Aktiv",
  Generated: "Generiert",
  InProgress: "Laufend",
  Completed: "Abgeschlossen",
};

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const configSchema = z.object({
  venueId: z.string().min(1, "Spielstätte ist erforderlich"),
  availableFrom: z.string().min(1, "Startzeit ist erforderlich"),
  matchDurationMinutes: z.coerce.number().int().min(5, "Mindestens 5 Minuten"),
  breakBetweenMatchesMinutes: z.coerce.number().int().min(0),
  schedulingStrategy: z.enum(["EarliestFirst", "Distributed"]),
  activeCourtIds: z.array(z.string()).min(1, "Mindestens ein Platz muss aktiv sein"),
});

type ConfigForm = z.infer<typeof configSchema>;

function makeDefaults(existing: PhaseVenueDto | null): ConfigForm {
  if (existing) {
    return {
      venueId: existing.venueId,
      availableFrom: existing.availableFrom.slice(0, 16),
      matchDurationMinutes: existing.matchDurationMinutes,
      breakBetweenMatchesMinutes: existing.breakBetweenMatchesMinutes,
      schedulingStrategy: existing.schedulingStrategy,
      activeCourtIds: existing.activeCourts.map((c) => c.id),
    };
  }
  return {
    venueId: "",
    availableFrom: "",
    matchDurationMinutes: 45,
    breakBetweenMatchesMinutes: 15,
    schedulingStrategy: "EarliestFirst",
    activeCourtIds: [],
  };
}

// ─── Add / Edit dialog ────────────────────────────────────────────────────────

interface PhaseVenueDialogProps {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  phaseId: string;
  existing: PhaseVenueDto | null;
  venues: VenueListItemDto[];
}

function PhaseVenueDialog({
  open,
  onClose,
  tournamentId,
  phaseId,
  existing,
  venues,
}: PhaseVenueDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: makeDefaults(existing),
  });

  const watchedVenueId = form.watch("venueId");
  const watchedCourtIds = form.watch("activeCourtIds") ?? [];
  const watchedStrategy = form.watch("schedulingStrategy");

  const { data: courts = [], isLoading: courtsLoading } = useQuery({
    queryKey: ["venueCourts", watchedVenueId],
    queryFn: () => getVenueCourts(watchedVenueId),
    enabled: !!watchedVenueId,
  });

  const allSelected =
    courts.length > 0 && courts.every((c) => watchedCourtIds.includes(c.id));

  const mutation = useMutation({
    mutationFn: (data: AddPhaseVenueRequest) =>
      existing
        ? updatePhaseVenue(tournamentId, phaseId, existing.id, data)
        : addPhaseVenue(tournamentId, phaseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["phaseVenues", tournamentId, phaseId],
      });
      toast.success(
        existing ? "Spielstätte aktualisiert" : "Spielstätte hinzugefügt",
      );
      onClose();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const handleSubmit = form.handleSubmit((data) => {
    mutation.mutate({
      ...data,
      availableFrom:
        data.availableFrom.length === 16
          ? data.availableFrom + ":00"
          : data.availableFrom,
    });
  });

  const toggleCourt = (id: string) => {
    const current = form.getValues("activeCourtIds") ?? [];
    form.setValue(
      "activeCourtIds",
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
      { shouldValidate: true },
    );
  };

  const toggleAll = () => {
    form.setValue(
      "activeCourtIds",
      allSelected ? [] : courts.map((c) => c.id),
      { shouldValidate: true },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing
              ? "Spielstätte bearbeiten"
              : "Spielstätte zur Phase hinzufügen"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {mutation.isError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {getApiErrorMessage(mutation.error)}
            </div>
          )}

          {/* Venue */}
          <div className="space-y-2">
            <Label>Spielstätte</Label>
            <Controller
              name="venueId"
              control={form.control}
              render={({ field }) => (
                <select
                  className={SELECT_CLASS}
                  value={field.value}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    form.setValue("activeCourtIds", []);
                  }}
                >
                  <option value="">Spielstätte wählen…</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {form.formState.errors.venueId && (
              <p className="text-sm text-destructive">
                {form.formState.errors.venueId.message}
              </p>
            )}
          </div>

          {/* Available from */}
          <div className="space-y-2">
            <Label htmlFor="pv-availableFrom">Verfügbar ab</Label>
            <Input
              id="pv-availableFrom"
              type="datetime-local"
              {...form.register("availableFrom")}
            />
            {form.formState.errors.availableFrom && (
              <p className="text-sm text-destructive">
                {form.formState.errors.availableFrom.message}
              </p>
            )}
          </div>

          {/* Duration + break */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pv-duration">Minuten pro Spiel</Label>
              <Input
                id="pv-duration"
                type="number"
                min={5}
                {...form.register("matchDurationMinutes")}
              />
              {form.formState.errors.matchDurationMinutes && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.matchDurationMinutes.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pv-break">Pause zwischen Spielen (Min)</Label>
              <Input
                id="pv-break"
                type="number"
                min={0}
                {...form.register("breakBetweenMatchesMinutes")}
              />
            </div>
          </div>

          {/* Strategy radio cards */}
          <div className="space-y-2">
            <Label>Planungsstrategie</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["EarliestFirst", "Distributed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    form.setValue("schedulingStrategy", s, {
                      shouldValidate: true,
                    })
                  }
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    watchedStrategy === s
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-muted",
                  )}
                >
                  <p className="text-sm font-medium">
                    {STRATEGY_LABELS[s].label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {STRATEGY_LABELS[s].description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Court checkboxes */}
          {watchedVenueId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Aktive Plätze</Label>
                {courts.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {allSelected ? "Alle abwählen" : "Alle auswählen"}
                  </button>
                )}
              </div>
              {courtsLoading ? (
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ) : courts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine Plätze für diese Spielstätte vorhanden.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {courts.map((court) => {
                    const checked = watchedCourtIds.includes(court.id);
                    return (
                      <label
                        key={court.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input accent-primary"
                          checked={checked}
                          onChange={() => toggleCourt(court.id)}
                        />
                        {court.name}
                      </label>
                    );
                  })}
                </div>
              )}
              {form.formState.errors.activeCourtIds && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.activeCourtIds.message}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Speichern…
                </>
              ) : (
                "Speichern"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Venue card for one phase-venue assignment ────────────────────────────────

function PhaseVenueCard({
  venue,
  canEdit,
  onEdit,
  onRemove,
  removing,
}: {
  venue: PhaseVenueDto;
  canEdit: boolean;
  onEdit: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const slot = venue.slotDurationMinutes ?? venue.matchDurationMinutes + venue.breakBetweenMatchesMinutes;
  const strategyLabel =
    STRATEGY_LABELS[venue.schedulingStrategy]?.label ?? venue.schedulingStrategy;
  const courtNames = venue.activeCourts.map((c) => c.name).join(", ");

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          {venue.venueName}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              disabled={removing}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Verfügbar ab</dt>
        <dd>{format(new Date(venue.availableFrom), "dd.MM.yyyy HH:mm")}</dd>

        <dt className="text-muted-foreground">Spieldauer</dt>
        <dd>
          {venue.matchDurationMinutes} Min + {venue.breakBetweenMatchesMinutes}{" "}
          Min Pause = {slot} Min/Slot
        </dd>

        <dt className="text-muted-foreground">Strategie</dt>
        <dd>{strategyLabel}</dd>

        <dt className="text-muted-foreground">Aktive Plätze</dt>
        <dd>
          {courtNames || "–"}{" "}
          {venue.totalActiveCourts > 0 && (
            <span className="text-muted-foreground">
              ({venue.totalActiveCourts} gesamt)
            </span>
          )}
        </dd>
      </dl>
    </div>
  );
}

// ─── Content for one phase tab ────────────────────────────────────────────────

function PhaseVenueSection({
  tournamentId,
  phase,
  venues,
}: {
  tournamentId: string;
  phase: PhaseResponse;
  venues: VenueListItemDto[];
}) {
  const queryClient = useQueryClient();
  const canEdit = phase.status === "Pending";

  const [dialogKey, setDialogKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PhaseVenueDto | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["phaseVenues", tournamentId, phase.id],
    queryFn: () => getPhaseVenues(tournamentId, phase.id),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removePhaseVenue(tournamentId, phase.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["phaseVenues", tournamentId, phase.id],
      });
      toast.success("Spielstätte entfernt");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const openAdd = () => {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const openEdit = (venue: PhaseVenueDto) => {
    setEditing(venue);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const handleRemove = (venue: PhaseVenueDto) => {
    if (confirm(`Spielstätte "${venue.venueName}" aus dieser Phase entfernen?`)) {
      removeMutation.mutate(venue.id);
    }
  };

  const phaseVenues = data?.venues ?? [];

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {PHASE_STATUS_LABELS[phase.status] ?? phase.status}
          </Badge>
          {!isLoading && phaseVenues.length === 0 && (
            <Badge
              variant="outline"
              className="border-yellow-400 text-yellow-600 dark:border-yellow-500 dark:text-yellow-400"
            >
              <AlertTriangle className="mr-1 h-3 w-3" />
              Keine Spielstätte
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : phaseVenues.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Noch keine Spielstätte für diese Phase konfiguriert.
          </div>
        ) : (
          <div className="space-y-3">
            {phaseVenues.map((pv) => (
              <PhaseVenueCard
                key={pv.id}
                venue={pv}
                canEdit={canEdit}
                onEdit={() => openEdit(pv)}
                onRemove={() => handleRemove(pv)}
                removing={removeMutation.isPending}
              />
            ))}
          </div>
        )}

        {canEdit && (
          <Button variant="outline" size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Spielstätte hinzufügen
          </Button>
        )}
      </div>

      <PhaseVenueDialog
        key={dialogKey}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        tournamentId={tournamentId}
        phaseId={phase.id}
        existing={editing}
        venues={venues}
      />
    </>
  );
}

// ─── Create venue form schema ─────────────────────────────────────────────────

const venueCreateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  address: z.string().optional(),
  description: z.string().optional(),
});
type VenueCreateForm = z.infer<typeof venueCreateSchema>;

// ─── Main page ────────────────────────────────────────────────────────────────

export function VenuesPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const queryClient = useQueryClient();

  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [globalOpen, setGlobalOpen] = useState(false);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);

  const { data: phasesData, isLoading: phasesLoading } = useQuery({
    queryKey: ["phases", tournamentId],
    queryFn: () => getPhases(tournamentId!),
    enabled: !!tournamentId,
  });

  const { data: venuesData, isLoading: venuesLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: () => getVenues(),
  });

  const phases = [...(phasesData?.phases ?? [])].sort(
    (a, b) => a.phaseOrder - b.phaseOrder,
  );
  const venues = venuesData?.items ?? [];

  const activePhaseId = selectedPhaseId ?? phases[0]?.id ?? null;
  const activePhase = phases.find((p) => p.id === activePhaseId) ?? null;

  const venueCreateForm = useForm<VenueCreateForm>({
    resolver: zodResolver(venueCreateSchema),
  });

  const createVenueMutation = useMutation({
    mutationFn: (data: VenueCreateForm) => createVenue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      setVenueDialogOpen(false);
      venueCreateForm.reset();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteVenueMutation = useMutation({
    mutationFn: (id: string) => deleteVenue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
    },
  });

  const handleDeleteVenue = (id: string) => {
    const venue = venues.find((v) => v.id === id);
    if (confirm(`${venue?.name ?? "Spielstätte"} wirklich löschen?`)) {
      deleteVenueMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Section 1: Phase venue configuration ── */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">
          Spielstätten nach Phase
        </h2>

        {phasesLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : phases.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Noch keine Phasen definiert.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tab row */}
            <div className="flex flex-wrap gap-1 border-b">
              {phases.map((phase) => (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => setSelectedPhaseId(phase.id)}
                  className={cn(
                    "rounded-t-md px-4 py-2 text-sm font-medium transition-colors",
                    phase.id === activePhaseId
                      ? "border border-b-background bg-background text-foreground -mb-px"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {phase.name}
                </button>
              ))}
            </div>

            {/* Active phase content */}
            {activePhase && (
              <PhaseVenueSection
                key={activePhase.id}
                tournamentId={tournamentId!}
                phase={activePhase}
                venues={venues}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Section 2: Global venue management ── */}
      <div className="border-t pt-6">
        <button
          type="button"
          onClick={() => setGlobalOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Spielstätten &amp; Plätze verwalten
          {globalOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {globalOpen && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {venuesLoading
                  ? "Laden…"
                  : venues.length === 0
                    ? "Noch keine Spielstätten vorhanden."
                    : `${venues.length} Spielstätte${venues.length !== 1 ? "n" : ""}`}
              </span>
              <Button size="sm" onClick={() => setVenueDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Spielstätte hinzufügen
              </Button>
            </div>

            {venuesLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {venues.map((venue) => (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    onDelete={handleDeleteVenue}
                    deleting={deleteVenueMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create venue dialog */}
      <Dialog open={venueDialogOpen} onOpenChange={setVenueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Spielstätte</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={venueCreateForm.handleSubmit((data) =>
              createVenueMutation.mutate(data),
            )}
            className="space-y-4"
          >
            {createVenueMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(createVenueMutation.error)}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newVenueName">Name</Label>
              <Input
                id="newVenueName"
                {...venueCreateForm.register("name")}
              />
              {venueCreateForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {venueCreateForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newVenueAddress">Adresse</Label>
              <Input
                id="newVenueAddress"
                {...venueCreateForm.register("address")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newVenueDescription">Beschreibung</Label>
              <Input
                id="newVenueDescription"
                {...venueCreateForm.register("description")}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setVenueDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={createVenueMutation.isPending}>
                {createVenueMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Erstellen
                  </>
                ) : (
                  "Erstellen"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
