import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { updateParticipant } from "@/api/participants";
import { getApiErrorMessage } from "@/api/client";
import type { ParticipantDto } from "@/types/participant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const editSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  dateOfBirth: z.string().optional(),
  phoneNumber: z.string().optional(),
  notes: z.string().optional(),
});

type EditForm = z.infer<typeof editSchema>;

interface Props {
  participantId: string;
  initialData: ParticipantDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditParticipantDialog({
  participantId,
  initialData,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      phoneNumber: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        firstName: initialData.firstName,
        lastName: initialData.lastName,
        dateOfBirth: initialData.dateOfBirth ?? "",
        phoneNumber: initialData.phoneNumber ?? "",
        notes: initialData.notes ?? "",
      });
    }
  }, [open, initialData, form]);

  const mutation = useMutation({
    mutationFn: (data: EditForm) =>
      updateParticipant(participantId, {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth || undefined,
        phoneNumber: data.phoneNumber || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      onOpenChange(false);
      onSuccess();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Teilnehmer bearbeiten</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          {mutation.isError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {getApiErrorMessage(mutation.error)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ep-firstName">Vorname</Label>
              <Input id="ep-firstName" {...form.register("firstName")} />
              {form.formState.errors.firstName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ep-lastName">Nachname</Label>
              <Input id="ep-lastName" {...form.register("lastName")} />
              {form.formState.errors.lastName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-dob">Geburtsdatum (optional)</Label>
            <Input
              id="ep-dob"
              type="date"
              {...form.register("dateOfBirth")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-phone">Telefon (optional)</Label>
            <Input id="ep-phone" {...form.register("phoneNumber")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-notes">Notizen (optional)</Label>
            <Input id="ep-notes" {...form.register("notes")} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
