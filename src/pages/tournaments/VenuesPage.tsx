import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Loader2, Trash2, MapPin } from "lucide-react";
import {
  getVenues,
  createVenue,
  deleteVenue,
  createCourt,
  deleteCourt,
} from "@/api/venues";
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
  DialogTrigger,
} from "@/components/ui/dialog";

const venueSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  address: z.string().optional(),
  description: z.string().optional(),
});

const courtSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
});

type VenueForm = z.infer<typeof venueSchema>;
type CourtForm = z.infer<typeof courtSchema>;

export function VenuesPage() {
  const queryClient = useQueryClient();
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [courtDialogVenueId, setCourtDialogVenueId] = useState<string | null>(
    null,
  );

  const { data: venuesData, isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: () => getVenues(),
  });

  const venues = venuesData?.items ?? [];

  const createVenueMutation = useMutation({
    mutationFn: (data: VenueForm) => createVenue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      setVenueDialogOpen(false);
      venueForm.reset();
    },
  });

  const deleteVenueMutation = useMutation({
    mutationFn: (id: string) => deleteVenue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
    },
  });

  const createCourtMutation = useMutation({
    mutationFn: ({ venueId, data }: { venueId: string; data: CourtForm }) =>
      createCourt(venueId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      setCourtDialogVenueId(null);
      courtForm.reset();
    },
  });

  const deleteCourtMutation = useMutation({
    mutationFn: ({ venueId, courtId }: { venueId: string; courtId: string }) =>
      deleteCourt(venueId, courtId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
    },
  });

  const venueForm = useForm<VenueForm>({
    resolver: zodResolver(venueSchema),
  });

  const courtForm = useForm<CourtForm>({
    resolver: zodResolver(courtSchema),
  });

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
        <h2 className="text-lg font-semibold">Spielstätten</h2>
        <Dialog open={venueDialogOpen} onOpenChange={setVenueDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Spielstätte hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Spielstätte</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={venueForm.handleSubmit((data) =>
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
                <Label htmlFor="venueName">Name</Label>
                <Input id="venueName" {...venueForm.register("name")} />
                {venueForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {venueForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="venueAddress">Adresse</Label>
                <Input id="venueAddress" {...venueForm.register("address")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venueDescription">Beschreibung</Label>
                <Input
                  id="venueDescription"
                  {...venueForm.register("description")}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createVenueMutation.isPending}>
                  {createVenueMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Erstellen
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {venues.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Noch keine Spielstätten vorhanden.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {venues.map((venue) => (
            <Card key={venue.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4" />
                    {venue.name}
                  </CardTitle>
                  {venue.address && (
                    <p className="text-sm text-muted-foreground">
                      {venue.address}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(`${venue.name} wirklich löschen?`)) {
                      deleteVenueMutation.mutate(venue.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Plätze</span>
                    <Dialog
                      open={courtDialogVenueId === venue.id}
                      onOpenChange={(open) =>
                        setCourtDialogVenueId(open ? venue.id : null)
                      }
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="mr-1 h-3 w-3" />
                          Platz
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Neuer Platz</DialogTitle>
                        </DialogHeader>
                        <form
                          onSubmit={courtForm.handleSubmit((data) =>
                            createCourtMutation.mutate({
                              venueId: venue.id,
                              data,
                            }),
                          )}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <Label htmlFor="courtName">Name</Label>
                            <Input
                              id="courtName"
                              {...courtForm.register("name")}
                            />
                          </div>
                          <DialogFooter>
                            <Button
                              type="submit"
                              disabled={createCourtMutation.isPending}
                            >
                              {createCourtMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Erstellen
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {venue.courts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Keine Plätze
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {venue.courts.map((court) => (
                        <Badge
                          key={court.id}
                          variant="secondary"
                          className="gap-1"
                        >
                          {court.name}
                          <button
                            onClick={() =>
                              deleteCourtMutation.mutate({
                                venueId: venue.id,
                                courtId: court.id,
                              })
                            }
                            className="ml-1 hover:text-destructive"
                          >
                            &times;
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
