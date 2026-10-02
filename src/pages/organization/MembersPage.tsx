import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { getCurrentMembers } from "@/api/organizations";
import { getApiErrorMessage } from "@/api/client";
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
import { isAdminRole, roleLabel } from "@/types/auth";
import { useAuthStore } from "@/store/authStore";
import { CURRENT_MEMBERS_QUERY_KEY } from "@/components/organization/AddExistingMemberDialog";
import { useState } from "react";

export function MembersPage() {
  const activeOrg = useAuthStore((state) => state.activeOrg);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const isAdmin = isAdminRole(activeOrg?.role);

  const membersQuery = useQuery({
    queryKey: CURRENT_MEMBERS_QUERY_KEY,
    queryFn: getCurrentMembers,
    enabled: isAdmin,
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
    </div>
  );
}

