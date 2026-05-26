import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useOutletContext, useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  User,
  Users,
  Shield,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  UserPlus,
  Check,
  LogIn,
  Wand2,
} from "lucide-react";
import {
  getRegistrations,
  registerParticipant,
  bulkRegister,
  removeRegistration,
  confirmRegistration,
  checkInRegistration,
} from "@/api/registrations";
import { getParticipants, getParticipant, createParticipant } from "@/api/participants";
import type { ParticipantDto } from "@/types/participant";
import { EditParticipantDialog } from "@/components/participants/EditParticipantDialog";
import { getApiErrorMessage } from "@/api/client";
import type { TournamentDto } from "@/types/tournament";
import { TournamentStatus } from "@/types/tournament";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const createSchema = z.object({
  displayName: z.string().min(1, "Name ist erforderlich"),
  dateOfBirth: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

const PARTICIPANT_TYPE_LABELS = {
  Single: "Einzelspieler",
  Double: "Doppel",
  Team: "Teams",
} as const;

const PARTICIPANT_TYPE_ICONS = {
  Single: User,
  Double: Users,
  Team: Shield,
} as const;

const statusConfig: Record<
  string,
  { label: string; variant: "secondary" | "default" | "outline" | "destructive" }
> = {
  Pending: { label: "Ausstehend", variant: "secondary" },
  Confirmed: { label: "Bestätigt", variant: "default" },
  CheckedIn: { label: "Eingecheckt", variant: "outline" },
  Withdrawn: { label: "Zurückgezogen", variant: "destructive" },
};

export function ParticipantsPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { tournament } = useOutletContext<{
    tournament: TournamentDto | undefined;
  }>();
  const queryClient = useQueryClient();

  const regQueryKey = ["registrations", tournamentId];

  // --- State ---
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);

  // Sort state for registrations table
  const [sortColumn, setSortColumn] = useState<"name" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Search state for "add from pool" dialog
  const [poolSearch, setPoolSearch] = useState("");
  const [debouncedPoolSearch, setDebouncedPoolSearch] = useState("");
  const [poolSelected, setPoolSelected] = useState<Set<string>>(new Set());

  // Generate dialog state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [generateProgress, setGenerateProgress] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Edit participant state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editParticipant, setEditParticipant] = useState<ParticipantDto | null>(null);
  const [fetchingEditId, setFetchingEditId] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedPoolSearch(poolSearch), 300);
    return () => clearTimeout(id);
  }, [poolSearch]);

  // --- Queries ---
  const { data, isLoading } = useQuery({
    queryKey: regQueryKey,
    queryFn: () => getRegistrations(tournamentId!),
    enabled: !!tournamentId,
  });

  const registrations = data?.registrations ?? [];

  const { data: poolData, isLoading: poolLoading } = useQuery({
    queryKey: ["participants", "pool", debouncedPoolSearch],
    queryFn: () =>
      getParticipants({
        page: 1,
        pageSize: 1000,
        ...(debouncedPoolSearch ? { search: debouncedPoolSearch } : {}),
      }),
    enabled: addDialogOpen,
  });

  const registeredIds = useMemo(
    () => new Set(registrations.map((r) => r.participantId)),
    [registrations],
  );

  const availablePool = useMemo(
    () =>
      (poolData?.items ?? []).filter((p) => !registeredIds.has(p.id)),
    [poolData, registeredIds],
  );

  // --- Sorting ---
  const sortedRegistrations = useMemo(() => {
    if (!sortColumn) return registrations;
    return [...registrations].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      const numA = parseInt(a.participantDisplayName.split(" ").pop() ?? "");
      const numB = parseInt(b.participantDisplayName.split(" ").pop() ?? "");
      if (!isNaN(numA) && !isNaN(numB)) return dir * (numA - numB);
      return dir * a.participantDisplayName.localeCompare(b.participantDisplayName, "de");
    });
  }, [registrations, sortColumn, sortDirection]);

  const toggleSort = () => {
    if (sortColumn !== "name") {
      setSortColumn("name");
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortColumn(null);
      setSortDirection("asc");
    }
  };

  // --- Selection ---
  const allSelected =
    sortedRegistrations.length > 0 &&
    sortedRegistrations.every((r) => selectedIds.has(r.participantId));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(sortedRegistrations.map((r) => r.participantId)),
      );
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- Mutations ---
  const confirmMutation = useMutation({
    mutationFn: (participantId: string) =>
      confirmRegistration(tournamentId!, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: regQueryKey });
    },
  });

  const checkInMutation = useMutation({
    mutationFn: (participantId: string) =>
      checkInRegistration(tournamentId!, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: regQueryKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (participantId: string) =>
      removeRegistration(tournamentId!, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: regQueryKey });
    },
  });

  const addBulkMutation = useMutation({
    mutationFn: (ids: string[]) => bulkRegister(tournamentId!, ids),
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: regQueryKey });
      setPoolSelected(new Set());
      setAddDialogOpen(false);
      toast.success(`${ids.length} Teilnehmer registriert`);
    },
  });

  // --- Create new + auto-register ---
  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const createAndRegisterMutation = useMutation({
    mutationFn: async (data: CreateForm) => {
      const created = await createParticipant(
        tournament?.participantType ?? "Single",
        {
          firstName: data.displayName,
          lastName: "",
          dateOfBirth: data.dateOfBirth || undefined,
        },
      );
      await registerParticipant(tournamentId!, created.id);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: regQueryKey });
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      setCreateDialogOpen(false);
      createForm.reset();
      toast.success("Teilnehmer erstellt und registriert");
    },
  });

  // --- Bulk confirm ---
  const handleBulkConfirm = async () => {
    const pendingIds = [...selectedIds].filter((id) => {
      const reg = registrations.find((r) => r.participantId === id);
      return reg?.status === "Pending";
    });
    if (pendingIds.length === 0) return;

    setBulkConfirming(true);
    let succeeded = 0;
    for (const id of pendingIds) {
      try {
        await confirmRegistration(tournamentId!, id);
        succeeded++;
      } catch {
        // continue with remaining
      }
    }
    setBulkConfirming(false);
    queryClient.invalidateQueries({ queryKey: regQueryKey });
    setSelectedIds(new Set());
    toast.success(`${succeeded} Teilnehmer bestätigt`);
  };

  // --- Generate participants ---
  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const poolMeta = await getParticipants({ page: 1, pageSize: 1 });
      const startIndex = poolMeta.totalCount + 1;

      const newIds: string[] = [];
      for (let i = 0; i < generateCount; i++) {
        const x = startIndex + i;
        setGenerateProgress(`Erstelle Teilnehmer... (${i + 1}/${generateCount})`);
        const created = await createParticipant(
          tournament?.participantType ?? "Single",
          { firstName: "Teilnehmer", lastName: String(x) },
        );
        newIds.push(created.id);
      }

      setGenerateProgress("Registriere Teilnehmer...");
      await bulkRegister(tournamentId!, newIds);

      for (let i = 0; i < newIds.length; i++) {
        const id = newIds[i];
        setGenerateProgress(`Bestätige... (${i + 1}/${newIds.length})`);
        if (id) await confirmRegistration(tournamentId!, id);
      }

      queryClient.invalidateQueries({ queryKey: regQueryKey });
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      setGenerateDialogOpen(false);
      toast.success(`${generateCount} Teilnehmer erstellt und bestätigt`);
    } catch (e) {
      setGenerateError(getApiErrorMessage(e));
    } finally {
      setGenerating(false);
      setGenerateProgress(null);
    }
  };

  // --- Edit participant ---
  const handleEditClick = async (participantId: string) => {
    setFetchingEditId(participantId);
    try {
      const participant = await getParticipant(participantId);
      setEditParticipant(participant);
      setEditDialogOpen(true);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setFetchingEditId(null);
    }
  };

  // --- Pool dialog helpers ---
  const togglePoolItem = (id: string) => {
    setPoolSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSelected = () => {
    if (poolSelected.size === 0) return;
    addBulkMutation.mutate([...poolSelected]);
  };

  const handleAddAll = () => {
    if (availablePool.length === 0) return;
    addBulkMutation.mutate(availablePool.map((p) => p.id));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const pType = tournament?.participantType;
  const TypeIcon = pType ? PARTICIPANT_TYPE_ICONS[pType] : null;
  const typeLabel = pType ? PARTICIPANT_TYPE_LABELS[pType] : null;

  const pendingSelectedCount = [...selectedIds].filter((id) => {
    const reg = registrations.find((r) => r.participantId === id);
    return reg?.status === "Pending";
  }).length;

  return (
    <div className="space-y-4">

      {typeLabel && TypeIcon && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground w-fit">
          <TypeIcon className="h-4 w-4" />
          Dieses Turnier ist für {typeLabel}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Teilnehmer ({registrations.length})
          </h2>
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.totalConfirmed} bestätigt · {data.totalCheckedIn} eingecheckt
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && pendingSelectedCount > 0 && (
            <Button
              variant="outline"
              onClick={handleBulkConfirm}
              disabled={bulkConfirming}
            >
              {bulkConfirming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {pendingSelectedCount} bestätigen
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setGenerateCount(10);
              setGenerateError(null);
              setGenerateDialogOpen(true);
            }}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Teilnehmer generieren
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setPoolSearch("");
              setDebouncedPoolSearch("");
              setPoolSelected(new Set());
              setAddDialogOpen(true);
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Teilnehmer hinzufügen
          </Button>
          <Button
            onClick={() => {
              createForm.reset();
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Neu erstellen
          </Button>
        </div>
      </div>

      {sortedRegistrations.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Noch keine Teilnehmer registriert.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={toggleSort}
                >
                  Name
                  {sortColumn === "name" ? (
                    sortDirection === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-48">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRegistrations.map((reg) => {
              const cfg = statusConfig[reg.status];
              return (
                <TableRow key={reg.participantId}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={selectedIds.has(reg.participantId)}
                      onChange={() => toggleSelect(reg.participantId)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {reg.participantDisplayName}
                  </TableCell>
                  <TableCell>
                    {cfg ? (
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    ) : (
                      <Badge variant="secondary">{reg.status}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {reg.status === "Pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            confirmMutation.mutate(reg.participantId)
                          }
                          disabled={confirmMutation.isPending}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          Bestätigen
                        </Button>
                      )}
                      {reg.status === "Confirmed" &&
                        (tournament?.status === TournamentStatus.RegistrationClosed ||
                          tournament?.status === TournamentStatus.InProgress) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              checkInMutation.mutate(reg.participantId)
                            }
                            disabled={checkInMutation.isPending}
                          >
                            <LogIn className="mr-1 h-3.5 w-3.5" />
                            Check-In
                          </Button>
                        )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(reg.participantId)}
                        disabled={fetchingEditId === reg.participantId}
                      >
                        {fetchingEditId === reg.participantId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Pencil className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (
                            confirm(
                              `${reg.participantDisplayName} wirklich entfernen?`,
                            )
                          ) {
                            removeMutation.mutate(reg.participantId);
                          }
                        }}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Generate participants dialog */}
      <Dialog
        open={generateDialogOpen}
        onOpenChange={(open) => {
          if (!generating) setGenerateDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teilnehmer generieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {generateError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {generateError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="generateCount">Anzahl</Label>
              <Input
                id="generateCount"
                type="number"
                min={1}
                max={100}
                value={generateCount}
                onChange={(e) =>
                  setGenerateCount(
                    Math.min(100, Math.max(1, parseInt(e.target.value) || 1)),
                  )
                }
                disabled={generating}
              />
            </div>
            {generateProgress && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {generateProgress}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGenerateDialogOpen(false)}
              disabled={generating}
            >
              Abbrechen
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Generieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add from global pool dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-h-[80vh] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Teilnehmer hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Teilnehmer suchen..."
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {addBulkMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(addBulkMutation.error)}
              </div>
            )}

            <div className="max-h-[40vh] overflow-y-auto rounded-md border">
              {poolLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : availablePool.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {debouncedPoolSearch
                    ? "Keine verfügbaren Teilnehmer gefunden."
                    : "Alle Teilnehmer sind bereits registriert."}
                </p>
              ) : (
                <div className="divide-y">
                  {availablePool.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={poolSelected.has(p.id)}
                        onChange={() => togglePoolItem(p.id)}
                      />
                      <span className="text-sm">{p.displayName}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={handleAddAll}
              disabled={
                availablePool.length === 0 || addBulkMutation.isPending
              }
            >
              {addBulkMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Alle hinzufügen ({availablePool.length})
            </Button>
            <Button
              onClick={handleAddSelected}
              disabled={poolSelected.size === 0 || addBulkMutation.isPending}
            >
              {addBulkMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Ausgewählte hinzufügen ({poolSelected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit participant dialog */}
      {editParticipant && (
        <EditParticipantDialog
          participantId={editParticipant.id}
          initialData={editParticipant}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: regQueryKey });
            toast.success("Teilnehmer aktualisiert");
          }}
        />
      )}

      {/* Create new participant + auto-register dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Teilnehmer</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit((data) =>
              createAndRegisterMutation.mutate(data),
            )}
            className="space-y-4"
          >
            {createAndRegisterMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(createAndRegisterMutation.error)}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayName">Name</Label>
              <Input
                id="displayName"
                {...createForm.register("displayName")}
              />
              {createForm.formState.errors.displayName && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.displayName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Geburtsdatum (optional)</Label>
              <Input
                id="dateOfBirth"
                type="date"
                {...createForm.register("dateOfBirth")}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={createAndRegisterMutation.isPending}
              >
                {createAndRegisterMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Erstellen & Registrieren
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
