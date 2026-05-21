import { useState } from "react";
import { useOutletContext } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Loader2, Trash2, User, Users, Shield } from "lucide-react";
import {
  getParticipants,
  createParticipant,
  deleteParticipant,
} from "@/api/participants";
import { getApiErrorMessage } from "@/api/client";
import type { TournamentDto } from "@/types/tournament";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";

const createSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  dateOfBirth: z.string().optional(),
  phoneNumber: z.string().optional(),
  notes: z.string().optional(),
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

export function ParticipantsPage() {
  const { tournament } = useOutletContext<{ tournament: TournamentDto | undefined }>();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: participantsData, isLoading } = useQuery({
    queryKey: ["participants"],
    queryFn: () => getParticipants(),
  });

  const participants = participantsData?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) =>
      createParticipant(tournament?.participantType ?? "Single", {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth || undefined,
        phoneNumber: data.phoneNumber || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      setDialogOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteParticipant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants"] });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

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
        <h2 className="text-lg font-semibold">
          Teilnehmer ({participantsData?.total ?? 0})
        </h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Teilnehmer hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neuer Teilnehmer</DialogTitle>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Vorname</Label>
                  <Input id="firstName" {...register("firstName")} />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">
                      {errors.firstName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nachname</Label>
                  <Input id="lastName" {...register("lastName")} />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Geburtsdatum (optional)</Label>
                <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Telefon (optional)</Label>
                <Input id="phoneNumber" type="tel" {...register("phoneNumber")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notizen (optional)</Label>
                <textarea
                  id="notes"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  {...register("notes")}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Hinzufügen
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {participants.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Noch keine Teilnehmer vorhanden.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead className="w-24">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((p) => {
              const fullName = `${p.firstName} ${p.lastName}`;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{fullName}</TableCell>
                  <TableCell>{p.phoneNumber ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`${fullName} wirklich entfernen?`)) {
                          deleteMutation.mutate(p.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
