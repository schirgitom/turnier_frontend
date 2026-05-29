import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Loader2, Trash2, MapPin, Pencil, X } from "lucide-react";
import { getVenue, createCourt, deleteCourt, renameCourt, updateVenue } from "@/api/venues";
import { getApiErrorMessage } from "@/api/client";
import { toast } from "sonner";
import type { VenueListItemDto } from "@/types/venue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const courtSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
});
type CourtForm = z.infer<typeof courtSchema>;

const venueSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  address: z.string().optional(),
  description: z.string().optional(),
});
type VenueEditForm = z.infer<typeof venueSchema>;

interface VenueCardProps {
  venue: VenueListItemDto;
  onDelete: (id: string) => void;
  deleting: boolean;
}

export function VenueCard({ venue, onDelete, deleting }: VenueCardProps) {
  const queryClient = useQueryClient();

  const [courtDialogOpen, setCourtDialogOpen] = useState(false);
  const [editVenueOpen, setEditVenueOpen] = useState(false);
  const [renameCourtId, setRenameCourtId] = useState<string | null>(null);

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["venue", venue.id],
    queryFn: () => getVenue(venue.id),
  });

  const courtForm = useForm<CourtForm>({
    resolver: zodResolver(courtSchema),
  });

  const renameForm = useForm<CourtForm>({
    resolver: zodResolver(courtSchema),
  });

  const venueEditForm = useForm<VenueEditForm>({
    resolver: zodResolver(venueSchema),
    values: {
      name: venue.name,
      address: venue.address ?? "",
      description: detail?.description ?? "",
    },
  });

  const updateVenueMutation = useMutation({
    mutationFn: (data: VenueEditForm) => updateVenue(venue.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      queryClient.invalidateQueries({ queryKey: ["venue", venue.id] });
      setEditVenueOpen(false);
      toast.success("Spielstätte aktualisiert");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const createCourtMutation = useMutation({
    mutationFn: (data: CourtForm) => createCourt(venue.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue", venue.id] });
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      setCourtDialogOpen(false);
      courtForm.reset();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteCourtMutation = useMutation({
    mutationFn: (courtId: string) => deleteCourt(venue.id, courtId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue", venue.id] });
      queryClient.invalidateQueries({ queryKey: ["venues"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const renameCourtMutation = useMutation({
    mutationFn: ({ courtId, name }: { courtId: string; name: string }) =>
      renameCourt(venue.id, courtId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue", venue.id] });
      setRenameCourtId(null);
      renameForm.reset();
      toast.success("Platz umbenannt");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const handleOpenRename = (courtId: string, currentName: string) => {
    renameForm.setValue("name", currentName);
    setRenameCourtId(courtId);
  };

  const courts = detail?.courts ?? [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              {venue.name}
            </CardTitle>
            {venue.address && (
              <p className="text-sm text-muted-foreground">{venue.address}</p>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditVenueOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(venue.id)}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Plätze</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCourtDialogOpen(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Platz
              </Button>
            </div>

            {loadingDetail ? (
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
            ) : courts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Plätze</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {courts.map((court) => (
                  <div
                    key={court.id}
                    className="flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium"
                  >
                    <span>{court.name}</span>
                    <button
                      onClick={() => handleOpenRename(court.id, court.name)}
                      className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                      title="Umbenennen"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteCourtMutation.mutate(court.id)}
                      disabled={deleteCourtMutation.isPending}
                      className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="Löschen"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit venue dialog */}
      <Dialog open={editVenueOpen} onOpenChange={setEditVenueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spielstätte bearbeiten</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={venueEditForm.handleSubmit((data) =>
              updateVenueMutation.mutate(data),
            )}
            className="space-y-4"
          >
            {updateVenueMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(updateVenueMutation.error)}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`edit-name-${venue.id}`}>Name</Label>
              <Input
                id={`edit-name-${venue.id}`}
                {...venueEditForm.register("name")}
              />
              {venueEditForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {venueEditForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-address-${venue.id}`}>Adresse</Label>
              <Input
                id={`edit-address-${venue.id}`}
                {...venueEditForm.register("address")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-desc-${venue.id}`}>Beschreibung</Label>
              <Input
                id={`edit-desc-${venue.id}`}
                {...venueEditForm.register("description")}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setEditVenueOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={updateVenueMutation.isPending}>
                {updateVenueMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Speichern
                  </>
                ) : (
                  "Speichern"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add court dialog */}
      <Dialog open={courtDialogOpen} onOpenChange={setCourtDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Platz</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={courtForm.handleSubmit((data) =>
              createCourtMutation.mutate(data),
            )}
            className="space-y-4"
          >
            {createCourtMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(createCourtMutation.error)}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`court-name-${venue.id}`}>Name</Label>
              <Input
                id={`court-name-${venue.id}`}
                {...courtForm.register("name")}
              />
              {courtForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {courtForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createCourtMutation.isPending}>
                {createCourtMutation.isPending ? (
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

      {/* Rename court dialog */}
      <Dialog
        open={renameCourtId !== null}
        onOpenChange={(open) => !open && setRenameCourtId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Platz umbenennen</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={renameForm.handleSubmit((data) => {
              if (!renameCourtId) return;
              renameCourtMutation.mutate({ courtId: renameCourtId, name: data.name });
            })}
            className="space-y-4"
          >
            {renameCourtMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(renameCourtMutation.error)}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rename-court-name">Name</Label>
              <Input id="rename-court-name" {...renameForm.register("name")} />
              {renameForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {renameForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setRenameCourtId(null)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={renameCourtMutation.isPending}>
                {renameCourtMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Speichern
                  </>
                ) : (
                  "Speichern"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
