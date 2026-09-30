import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { inviteUser } from "@/api/auth";
import { getApiErrorMessage, getApiErrorStatus } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ASSIGNABLE_ROLES, roleLabel } from "@/types/auth";

const inviteSchema = z.object({
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse eingeben"),
  displayName: z.string().trim().optional(),
  role: z.string().min(1, "Rolle ist erforderlich"),
});

type InviteForm = z.infer<typeof inviteSchema>;

const DEFAULTS: InviteForm = { email: "", displayName: "", role: "Referee" };

export const INVITATIONS_QUERY_KEY = ["org-invitations"] as const;

interface Props {
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({
  organizationName,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: DEFAULTS,
  });

  const mutation = useMutation({
    mutationFn: (data: InviteForm) =>
      inviteUser({
        email: data.email,
        displayName: data.displayName || undefined,
        role: data.role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY });
    },
    onError: (error) => {
      if (getApiErrorStatus(error) === 422) {
        form.setError("displayName", {
          message:
            "Zu dieser E-Mail gibt es noch kein Konto – bitte einen Namen angeben.",
        });
      }
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(DEFAULTS);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors = form.formState.errors;
  const errorStatus = getApiErrorStatus(mutation.error);
  const result = mutation.data;
  const devLink = result?.token
    ? `${window.location.origin}/invite/${result.token}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Person einladen</DialogTitle>
          <DialogDescription>
            Die Person erhält eine E-Mail mit einem Link, um{" "}
            <span className="font-medium">{organizationName}</span> beizutreten.
            Bestehende Konten treten mit ihrem vorhandenen Login bei.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p>
                  Einladung an{" "}
                  <span className="font-medium">{result.email}</span> wurde
                  versendet.
                </p>
                <p className="text-green-700">
                  {result.existingUser
                    ? "Die Person hat bereits ein Konto und kann nach dem Anmelden direkt beitreten."
                    : "Die Person legt beim Annehmen ein neues Konto an."}
                </p>
                <p className="text-green-700">
                  Gültig bis{" "}
                  {format(new Date(result.expiresAt), "dd.MM.yyyy, HH:mm", {
                    locale: de,
                  })}{" "}
                  Uhr.
                </p>
              </div>
            </div>

            {devLink && (
              <div className="space-y-2">
                <Label>Einladungslink (nur Entwicklung)</Label>
                <div className="flex gap-2">
                  <Input value={devLink} readOnly className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(devLink);
                      toast.success("Link kopiert");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset(DEFAULTS);
                  mutation.reset();
                }}
              >
                Weitere Person einladen
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Fertig
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            {mutation.isError && errorStatus !== 422 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errorStatus === 409
                  ? "Diese Person ist bereits Mitglied der Organisation."
                  : errorStatus === 403
                    ? "Du hast keine Berechtigung, Personen einzuladen."
                    : getApiErrorMessage(mutation.error)}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="inv-email">E-Mail</Label>
              <Input
                id="inv-email"
                type="email"
                autoComplete="off"
                {...form.register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="inv-name">Name</Label>
              <Input id="inv-name" {...form.register("displayName")} />
              {errors.displayName ? (
                <p className="text-sm text-destructive">
                  {errors.displayName.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nur nötig, wenn die Person noch kein Konto hat.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="inv-role">Rolle</Label>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="inv-role">
                      <SelectValue placeholder="Rolle wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && (
                <p className="text-sm text-destructive">
                  {errors.role.message}
                </p>
              )}
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
                Einladung senden
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

