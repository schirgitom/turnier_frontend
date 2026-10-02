import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Users } from "lucide-react";
import {
  getCurrentMembers,
  removeMember,
} from "@/api/organizations";
import { getApiErrorMessage, getApiErrorStatus } from "@/api/client";
import { AddExistingMemberDialog } from "@/components/organization/AddExistingMemberDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isAdminRole, roleLabel, type OrganizationMemberDto } from "@/types/auth";
import { useAuthStore } from "@/store/authStore";
import { CURRENT_MEMBERS_QUERY_KEY } from "@/components/organization/AddExistingMemberDialog";
import { useState } from "react";
import { toast } from "sonner";

export function MembersPage() {
  const activeOrg = useAuthStore((state) => state.activeOrg);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] =
    useState<OrganizationMemberDto | null>(null);
  const queryClient = useQueryClient();
  const isAdmin = isAdminRole(activeOrg?.role);

  const membersQuery = useQuery({
    queryKey: CURRENT_MEMBERS_QUERY_KEY,
    queryFn: getCurrentMembers,
    enabled: isAdmin,
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: CURRENT_MEMBERS_QUERY_KEY,
      });
      setMemberToRemove(null);
      toast.success("Mitglied wurde entfernt.");
    },
    onError: (error) => {
      toast.error(
        getApiErrorStatus(error) === 409
          ? "Der letzte Admin der Organisation kann nicht entfernt werden."
          : getApiErrorMessage(error),
      );
    },
  });

  if (!isAdmin || !activeOrg) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Mitglieder</CardTitle>
            <CardDescription>
              Nur Admins können die Mitgliederliste dieser Organisation ansehen.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mitglieder</h1>
          <p className="text-sm text-muted-foreground">
            Mitglieder von {activeOrg.organizationName}
          </p>
        </div>
        <Button onClick={() => setAddMemberOpen(true)}>
          <Users className="mr-2 h-4 w-4" />
          Bestehenden Benutzer hinzufügen
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {membersQuery.isPending ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Mitglieder werden geladen …
            </div>
          ) : membersQuery.isError ? (
            <div className="p-6 text-sm text-destructive">
              {getApiErrorMessage(membersQuery.error)}
            </div>
          ) : membersQuery.data.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Noch keine Mitglieder gefunden.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Beigetreten</TableHead>
                  <TableHead className="w-16 text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersQuery.data.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.displayName}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{roleLabel(member.role)}</TableCell>
                    <TableCell>
                      {format(new Date(member.joinedAt), "dd.MM.yyyy", {
                        locale: de,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${member.displayName} entfernen`}
                        title="Mitglied entfernen"
                        onClick={() => setMemberToRemove(member)}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddExistingMemberDialog
        organizationName={activeOrg.organizationName}
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
      />

      <Dialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open && !removeMutation.isPending) setMemberToRemove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mitglied entfernen?</DialogTitle>
            <DialogDescription>
              {memberToRemove?.displayName} ({memberToRemove?.email}) verliert
              damit sofort den Zugriff auf diese Organisation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={removeMutation.isPending}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (memberToRemove) {
                  removeMutation.mutate(memberToRemove.userId);
                }
              }}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


