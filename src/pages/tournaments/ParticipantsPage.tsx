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
  UserMinus,
  LogIn,
  Wand2,
  Settings2,
} from "lucide-react";
import {
  getRegistrations,
  registerParticipant,
  bulkRegister,
  removeRegistration,
  checkInRegistration,
  withdrawRegistration,
  bulkCreateRegistration,
} from "@/api/registrations";
import { getParticipants, getParticipant, createParticipant } from "@/api/participants";
import { updateTournament } from "@/api/tournaments";
import type { ParticipantDto, ParticipantListItem } from "@/types/participant";
import { EditParticipantDialog } from "@/components/participants/EditParticipantDialog";
import { getApiErrorMessage } from "@/api/client";
import type { TournamentDto } from "@/types/tournament";
import {
  MAX_STARTS_LIMIT,
  DEFAULT_MAX_STARTS_PER_PERSON,
  buildStartNumbers,
  countActiveStartsByUser,
  personKey,
} from "@/lib/multiStart";
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
import { cn } from "@/lib/utils";

const createSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  dateOfBirth: z.string().optional(),
  phoneNumber: z.string().optional(),
  notes: z.string().optional(),
  starts: z.coerce
    .number()
    .int()
    .min(1, "Mindestens 1 Start")
    .max(MAX_STARTS_LIMIT, `Maximal ${MAX_STARTS_LIMIT} Starts`),
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
  { label: string; className: string }
> = {
  Confirmed: { label: "Angemeldet", className: "bg-[rgba(87,25,75,0.1)] text-[#57194B] border-transparent" },
  CheckedIn: { label: "Eingecheckt", className: "bg-[#3FA97B] text-white border-transparent" },
  Withdrawn: { label: "Zurückgezogen", className: "bg-[#D94E5F] text-white border-transparent" },
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

  // Obergrenze an Starts pro Person – wird im Backend am Turnier gespeichert
  // (tournament.maxStartsPerPerson). Lokaler State nur für die Bearbeitung im
  // Einstellungs-Dialog; wird beim Speichern per updateTournament persistiert.
  const tournamentMaxStarts =
    tournament?.maxStartsPerPerson ?? DEFAULT_MAX_STARTS_PER_PERSON;
  const maxStarts = tournamentMaxStarts;
  const [settingsMaxStarts, setSettingsMaxStarts] = useState<number>(
    tournamentMaxStarts,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedPoolSearch(poolSearch), 300);
    return () => clearTimeout(id);
  }, [poolSearch]);

  // Beim Öffnen des Dialogs den aktuellen Turnierwert übernehmen.
  useEffect(() => {
    if (settingsOpen) setSettingsMaxStarts(tournamentMaxStarts);
  }, [settingsOpen, tournamentMaxStarts]);

  // --- Queries ---
  const { data, isLoading } = useQuery({
    queryKey: regQueryKey,
    queryFn: () => getRegistrations(tournamentId!),
    enabled: !!tournamentId,
  });

  const registrations = data?.registrations ?? [];
  const activeCount = registrations.filter((r) => r.status !== "Withdrawn").length;

  // Mehrere Starts pro Person: participantId → Start-Nummer (nur für Personen
  // mit ≥ 2 Starts). Damit wird "(Start N)" im Roster angezeigt.
  const startNumbers = useMemo(
    () => buildStartNumbers(registrations),
    [registrations],
  );

  // Anzahl eindeutiger Personen. Personen werden über personKey identifiziert
  // (userId oder – ohne Account – normalisierter Anzeigename).
  const distinctPersonCount = useMemo(() => {
    const persons = new Set<string>();
    for (const r of registrations) {
      if (r.status === "Withdrawn") continue;
      const key = personKey({
        userId: r.userId,
        displayName: r.participantDisplayName,
      });
      persons.add(key ?? `pid:${r.participantId}`);
    }
    return persons.size;
  }, [registrations]);

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

  // Aktive Starts je Person. Wir schlüsseln BEWUSST doppelt:
  //  - über personKey (userId bevorzugt, sonst Name) für den Normalfall.
  //  - zusätzlich rein über den normalisierten Namen, um verwaiste Karten
  //    derselben Person zusammenzuführen, selbst wenn deren userId-Zustand
  //    abweicht (mal gesetzt, mal null).
  const activeStartsByUser = useMemo(
    () =>
      countActiveStartsByUser(
        registrations.map((r) => ({
          participantId: r.participantId,
          userId: r.userId,
          registeredAt: r.registeredAt,
          status: r.status,
          displayName: r.participantDisplayName,
        })),
      ),
    [registrations],
  );

  // Aktive Starts rein nach normalisiertem Namen (Fallback-Zusammenführung).
  const activeStartsByName = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of registrations) {
      if (r.status === "Withdrawn") continue;
      const name = r.participantDisplayName?.trim().toLowerCase();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [registrations]);

  // Pool-Einträge mit Info, wie viele Starts die Person schon im Turnier hat und
  // ob noch ein weiterer Start erlaubt ist (unter der konfigurierten Grenze).
  const poolEntries = useMemo(() => {
    // Dieselbe Person kann mehrere participant-Karten haben (unterschiedliche id,
    // teils mit/ohne userId, gleicher Name). Das Backend setzt bei mehreren Starts
    // KEINE gemeinsame userId und löscht beim Entfernen einer Registrierung den
    // Participant nicht – es entstehen also verwaiste Karten. Für die Auswahlliste
    // führen wir daher robust über den normalisierten Namen zusammen.
    const groups = new Map<string, ParticipantListItem[]>();
    const standalone: ParticipantListItem[] = [];
    for (const p of poolData?.items ?? []) {
      const name = p.displayName?.trim().toLowerCase();
      if (!name) {
        standalone.push(p); // ohne Namen keine Zusammenführung möglich
        continue;
      }
      const bucket = groups.get(name);
      if (bucket) bucket.push(p);
      else groups.set(name, [p]);
    }

    const grouped = Array.from(groups.values()).map((bucket) => {
      // Repräsentant: bevorzugt eine Karte mit userId (stabiler Schlüssel).
      const representative = bucket.find((p) => p.userId) ?? bucket[0]!;
      return { representative };
    });

    const representatives = [
      ...grouped.map((g) => g.representative),
      ...standalone,
    ];

    return representatives.map((p) => {
      const nameKey = p.displayName?.trim().toLowerCase();
      const key = personKey({ userId: p.userId, displayName: p.displayName });
      // Starts zuerst über personKey, dann über den Namen (deckt verwaiste
      // Karten mit abweichendem userId-Zustand ab), sonst participantId.
      const currentStarts =
        (key ? activeStartsByUser.get(key) : undefined) ??
        (nameKey ? activeStartsByName.get(nameKey) : undefined) ??
        (registeredIds.has(p.id) ? 1 : 0);
      const canAddMore = currentStarts < maxStarts;
      return { ...p, currentStarts, canAddMore };
    });
  }, [poolData, activeStartsByUser, activeStartsByName, registeredIds, maxStarts]);

  // Auswählbar sind Personen, die noch mindestens einen weiteren Start dürfen.
  const availablePool = useMemo(
    () => poolEntries.filter((p) => p.canAddMore),
    [poolEntries],
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

  // --- Mutations ---
  const checkInMutation = useMutation({
    mutationFn: (participantId: string) =>
      checkInRegistration(tournamentId!, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: regQueryKey });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const withdrawMutation = useMutation({
    mutationFn: (participantId: string) =>
      withdrawRegistration(tournamentId!, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: regQueryKey });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const removeMutation = useMutation({
    mutationFn: (participantId: string) =>
      removeRegistration(tournamentId!, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: regQueryKey });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  // Persistiert die maximale Anzahl Starts pro Person am Turnier (Backend).
  const maxStartsMutation = useMutation({
    mutationFn: (value: number) =>
      updateTournament(tournamentId!, { maxStartsPerPerson: value }),
    onSuccess: (_data, value) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      setSettingsOpen(false);
      toast.success(`Maximale Starts: ${value}`);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const addBulkMutation = useMutation({
    mutationFn: async (
      entries: Array<{
        id: string;
        userId: string | null;
        currentStarts: number;
      }>,
    ) => {
      // Aufteilen in:
      //  - "erste Anmeldung": Person noch nicht im Turnier → vorhandene
      //    participantId direkt registrieren (bulkRegister).
      //  - "weiterer Start": Person schon dabei → NEUEN Participant mit
      //    derselben userId anlegen und registrieren (eigene participantId).
      const firstTimeIds: string[] = [];
      const extraStartFor: Array<{ id: string; userId: string | null }> = [];
      for (const e of entries) {
        if (e.currentStarts > 0) extraStartFor.push({ id: e.id, userId: e.userId });
        else firstTimeIds.push(e.id);
      }

      let count = 0;

      if (firstTimeIds.length > 0) {
        await bulkRegister(tournamentId!, firstTimeIds);
        count += firstTimeIds.length;
      }

      // Für jeden weiteren Start die Stammdaten der Person laden und einen
      // neuen Participant mit derselben userId erzeugen, dann registrieren.
      for (const entry of extraStartFor) {
        const source = await getParticipant(entry.id);
        const sharedUserId = entry.userId ?? source.userId ?? crypto.randomUUID();
        const created = await createParticipant(
          tournament?.participantType ?? "Single",
          {
            firstName: source.firstName,
            lastName: source.lastName,
            dateOfBirth: source.dateOfBirth || undefined,
            phoneNumber: source.phoneNumber || undefined,
            notes: source.notes || undefined,
            userId: sharedUserId,
          },
        );
        await registerParticipant(tournamentId!, created.id);
        count += 1;
      }

      return { count };
    },
    onSuccess: ({ count }) => {
      queryClient.invalidateQueries({ queryKey: regQueryKey });
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      setPoolSelected(new Set());
      setAddDialogOpen(false);
      toast.success(`${count} Start${count === 1 ? "" : "s"} hinzugefügt`);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  // --- Create new + auto-register ---
  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      phoneNumber: "",
      notes: "",
      starts: 1,
    },
  });

  const createAndRegisterMutation = useMutation({
    mutationFn: async (data: CreateForm) => {
      // Neuer Ein-Schritt-Flow: Person (ohne Account) anlegen und alle Starts
      // transaktional registrieren. Die 3-Starts-Grenze prüft das Backend; wir
      // klemmen clientseitig zusätzlich für bessere UX.
      const startCount = Math.min(
        maxStarts,
        Math.max(1, data.starts),
      );
      const result = await bulkCreateRegistration(tournamentId!, {
        firstName: data.firstName,
        lastName: data.lastName,
        startCount,
        dateOfBirth: data.dateOfBirth || undefined,
        phoneNumber: data.phoneNumber || undefined,
        notes: data.notes || undefined,
      });
      return { count: result.starts.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: regQueryKey });
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      setCreateDialogOpen(false);
      createForm.reset({
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        phoneNumber: "",
        notes: "",
        starts: 1,
      });
      toast.success(
        result.count > 1
          ? `${result.count} Starts erstellt und registriert`
          : "Teilnehmer erstellt und registriert",
      );
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

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

      setGenerateDialogOpen(false);
      toast.success(`${generateCount} Teilnehmer erstellt und registriert`);
    } catch (e) {
      setGenerateError(getApiErrorMessage(e));
    } finally {
      queryClient.invalidateQueries({ queryKey: regQueryKey });
      queryClient.invalidateQueries({ queryKey: ["participants"] });
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
    const entries = poolEntries
      .filter((p) => poolSelected.has(p.id))
      .map((p) => ({ id: p.id, userId: p.userId, currentStarts: p.currentStarts }));
    addBulkMutation.mutate(entries);
  };

  const handleAddAll = () => {
    if (availablePool.length === 0) return;
    const entries = availablePool.map((p) => ({
      id: p.id,
      userId: p.userId,
      currentStarts: p.currentStarts,
    }));
    addBulkMutation.mutate(entries);
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
          <h2 className="text-lg font-semibold">Teilnehmer ({activeCount})</h2>
          <p className="text-xs text-muted-foreground">
            {distinctPersonCount === activeCount
              ? `${distinctPersonCount} Personen`
              : `${distinctPersonCount} Personen · ${activeCount} Starts`}
            {data && data.totalCheckedIn > 0
              ? ` · ${data.totalCheckedIn} eingecheckt`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            title="Start-Einstellungen"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
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
              const isWithdrawn = reg.status === "Withdrawn";
              return (
                <TableRow
                  key={reg.participantId}
                  className={cn(isWithdrawn && "opacity-50")}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{reg.participantDisplayName}</span>
                      {startNumbers.has(reg.participantId) && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] font-normal text-muted-foreground"
                        >
                          Start {startNumbers.get(reg.participantId)}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {cfg ? (
                      <Badge className={cfg.className}>{cfg.label}</Badge>
                    ) : (
                      <Badge className="bg-[rgba(87,25,75,0.1)] text-[#57194B] border-transparent">{reg.status}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!isWithdrawn && reg.status !== "CheckedIn" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => checkInMutation.mutate(reg.participantId)}
                          disabled={checkInMutation.isPending}
                        >
                          <LogIn className="mr-1 h-3.5 w-3.5" />
                          Check-In
                        </Button>
                      )}
                      {!isWithdrawn && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => withdrawMutation.mutate(reg.participantId)}
                          disabled={withdrawMutation.isPending}
                        >
                          <UserMinus className="mr-1 h-3.5 w-3.5" />
                          Zurückziehen
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
                          if (confirm(`${reg.participantDisplayName} wirklich entfernen?`)) {
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
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generiere...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generieren
                </>
              )}
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
                      {p.currentStarts > 0 && (
                        <Badge
                          variant="outline"
                          className="ml-auto shrink-0 text-[10px] font-normal text-muted-foreground"
                        >
                          {p.currentStarts}/{maxStarts} Starts
                        </Badge>
                      )}
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
              disabled={availablePool.length === 0 || addBulkMutation.isPending}
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
              <Label htmlFor="firstName">Vorname</Label>
              <Input id="firstName" {...createForm.register("firstName")} />
              {createForm.formState.errors.firstName && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nachname</Label>
              <Input id="lastName" {...createForm.register("lastName")} />
              {createForm.formState.errors.lastName && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.lastName.message}
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
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Telefonnummer (optional)</Label>
              <Input
                id="phoneNumber"
                {...createForm.register("phoneNumber")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notizen (optional)</Label>
              <Input
                id="notes"
                {...createForm.register("notes")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="starts">Anzahl der Starts</Label>
              <Input
                id="starts"
                type="number"
                min={1}
                max={maxStarts}
                {...createForm.register("starts")}
              />
              {createForm.formState.errors.starts && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.starts.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Mehrere Starts = mehrere Karten derselben Person. Jeder Start ist
                ein eigener Turniereintrag und wird bei der Auslosung auf einen
                anderen Baum verteilt. Maximal {maxStarts} Starts.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createAndRegisterMutation.isPending}>
                {createAndRegisterMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Erstellen & Registrieren
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Start settings dialog: variable max starts per person */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start-Einstellungen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="maxStarts">Maximale Starts pro Person</Label>
            <Input
              id="maxStarts"
              type="number"
              min={1}
              max={MAX_STARTS_LIMIT}
              value={settingsMaxStarts}
              onChange={(e) => {
                const val = Math.min(
                  MAX_STARTS_LIMIT,
                  Math.max(1, parseInt(e.target.value) || 1),
                );
                setSettingsMaxStarts(val);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Wie oft dieselbe Person in diesem Turnier starten darf (mehrere
              Karten). Der Wert gilt pro Turnier und wird gespeichert.
              Maximal {MAX_STARTS_LIMIT}.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSettingsOpen(false)}
              disabled={maxStartsMutation.isPending}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => maxStartsMutation.mutate(settingsMaxStarts)}
              disabled={maxStartsMutation.isPending}
            >
              {maxStartsMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
