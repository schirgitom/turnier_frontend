import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { addCurrentMember } from "@/api/organizations";
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
import {
  DIRECT_ASSIGNABLE_ROLES,
  roleLabel,
  type DirectAssignableRole,
} from "@/types/auth";

const addMemberSchema = z.object({
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse eingeben"),
  role: z.enum(DIRECT_ASSIGNABLE_ROLES),
});

type AddMemberForm = z.infer<typeof addMemberSchema>;

const DEFAULTS: AddMemberForm = { email: "", role: "Referee" };

export const CURRENT_MEMBERS_QUERY_KEY = ["org-members"] as const;

interface Props {
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddExistingMemberDialog({
  organizationName,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const form = useForm<AddMemberForm>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: DEFAULTS,
  });

  const mutation = useMutation({
    mutationFn: (data: AddMemberForm) =>
      addCurrentMember({
        email: data.email,
        role: data.role as DirectAssignableRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRENT_MEMBERS_QUERY_KEY });
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
  const member = mutation.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bestehenden Benutzer hinzufügen</DialogTitle>
          <DialogDescription>
            Ein vorhandenes Konto wird sofort als Mitglied von{" "}
            <span className="font-medium">{organizationName}</span> aktiviert.
            Es wird keine Einladung versendet.
          </DialogDescription>
        </DialogHeader>

        {member ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <span className="font-medium">
                  {member.displayName || member.email}
                </span>{" "}
                wurde sofort als {roleLabel(member.role)} hinzugefügt. Die Person
                muss ihre Organisationsliste aktualisieren und bei Bedarf zu
                dieser Organisation wechseln.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset(DEFAULTS);
                  mutation.reset();
                }}
              >
                Weitere Person hinzufügen
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
            {mutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errorStatus === 422
                  ? "Diese Person ist bereits Mitglied oder die Rolle ist ungültig."
                  : errorStatus === 404
                    ? "Zu dieser E-Mail-Adresse wurde kein Benutzerkonto gefunden."
                    : errorStatus === 403
                      ? "Du hast keine Admin-Berechtigung für diese Organisation."
                      : getApiErrorMessage(mutation.error)}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="member-email">E-Mail</Label>
              <Input
                id="member-email"
                type="email"
                autoComplete="off"
                {...form.register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="member-role">Rolle</Label>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="member-role">
                      <SelectValue placeholder="Rolle wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIRECT_ASSIGNABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
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
                Direkt hinzufügen
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

