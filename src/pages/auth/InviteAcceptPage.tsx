import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { getInviteInfo, acceptInvite, revoke } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useAcceptInviteExisting } from "@/hooks/useAuth";
import { broadcastAuthEvent } from "@/lib/authSync";
import { orgFromAuthResponse, roleLabel } from "@/types/auth";
import { getApiErrorMessage, getApiErrorStatus } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const acceptSchema = z.object({
  displayName: z.string().min(1, "Anzeigename ist erforderlich"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
});

type AcceptForm = z.infer<typeof acceptSchema>;

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshToken, setAuthWithOrg, logout } = useAuthStore();
  const isLoggedIn = !!refreshToken;
  const acceptExisting = useAcceptInviteExisting();

  const inviteQuery = useQuery({
    queryKey: ["invite", token],
    queryFn: () => getInviteInfo(token!),
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: (data: AcceptForm) =>
      acceptInvite({
        token: token!,
        password: data.password,
        displayName: data.displayName,
      }),
    onSuccess: (response) => {
      const org = orgFromAuthResponse(response);
      queryClient.clear();
      setAuthWithOrg(response, org);
      navigate(org ? "/tournaments" : "/onboarding", { replace: true });
    },
  });

  const logoutHere = async () => {
    if (refreshToken) await revoke(refreshToken).catch(() => {});
    logout();
    queryClient.clear();
    broadcastAuthEvent({ type: "logout" });
  };

  const goToLogin = (email: string) => {
    const params = new URLSearchParams({
      redirect: `/invite/${token}`,
      email,
    });
    navigate(`/login?${params}`, {
      state: { message: "Melde dich an, um die Einladung anzunehmen." },
    });
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptForm>({ resolver: zodResolver(acceptSchema) });

  if (!token || inviteQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    const status = getApiErrorStatus(inviteQuery.error);
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {status === 410 ? "Einladung abgelaufen" : "Ungültige Einladung"}
          </CardTitle>
          <CardDescription>
            {status === 410
              ? "Diese Einladung ist abgelaufen oder wurde bereits verwendet. Bitte fordere eine neue an."
              : status === 404
                ? "Diese Einladung existiert nicht."
                : getApiErrorMessage(inviteQuery.error)}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link to={isLoggedIn ? "/tournaments" : "/login"}>Weiter</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const invite = inviteQuery.data;
  const emailMatches =
    !!user?.email &&
    user.email.toLowerCase() === invite.email.toLowerCase();

  const header = (
    <CardHeader>
      <CardTitle>Einladung annehmen</CardTitle>
      <CardDescription>
        {invite.inviterName} hat dich zu{" "}
        <span className="font-medium">{invite.organizationName}</span> als{" "}
        <span className="font-medium">{roleLabel(invite.role)}</span>{" "}
        eingeladen. Gültig bis{" "}
        {format(new Date(invite.expiresAt), "dd.MM.yyyy, HH:mm")} Uhr.
      </CardDescription>
    </CardHeader>
  );

  // Angemeldet, aber mit anderem Konto
  if (isLoggedIn && !emailMatches) {
    return (
      <Card>
        {header}
        <CardContent>
          <div className="rounded-md bg-muted p-3 text-sm">
            Du bist als <span className="font-medium">{user?.email}</span>{" "}
            angemeldet. Die Einladung gilt aber für{" "}
            <span className="font-medium">{invite.email}</span>.
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button className="w-full" onClick={logoutHere}>
            Abmelden und fortfahren
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/tournaments">Abbrechen</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Angemeldet mit passendem Konto → ein Klick
  if (isLoggedIn) {
    const status = getApiErrorStatus(acceptExisting.error);
    return (
      <Card>
        {header}
        {acceptExisting.isError && (
          <CardContent>
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {status === 409
                ? "Du bist bereits Mitglied dieser Organisation."
                : status === 403
                  ? "Diese Einladung gilt nicht für dein Konto."
                  : status === 410
                    ? "Die Einladung ist abgelaufen oder wurde bereits verwendet."
                    : getApiErrorMessage(acceptExisting.error)}
            </div>
          </CardContent>
        )}
        <CardFooter className="flex flex-col gap-2">
          <Button
            className="w-full"
            disabled={acceptExisting.isPending}
            onClick={() => acceptExisting.mutate(token)}
          >
            {acceptExisting.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {invite.organizationName} beitreten
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/tournaments">Später</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Nicht angemeldet, Konto existiert → Login mit Rücksprung
  if (invite.existingUser) {
    return (
      <Card>
        {header}
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Für <span className="font-medium">{invite.email}</span> gibt es
            bereits ein Konto. Melde dich an, um beizutreten.
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => goToLogin(invite.email)}>
            Anmelden und beitreten
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Nicht angemeldet, neues Konto anlegen
  const acceptStatus = getApiErrorStatus(acceptMutation.error);
  return (
    <Card>
      {header}
      <form onSubmit={handleSubmit((data) => acceptMutation.mutate(data))}>
        <CardContent className="space-y-4">
          {acceptMutation.isError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {acceptStatus === 409 ? (
                <>
                  Zu dieser E-Mail gibt es bereits ein Konto.{" "}
                  <button
                    type="button"
                    className="font-medium underline"
                    onClick={() => goToLogin(invite.email)}
                  >
                    Jetzt anmelden
                  </button>
                </>
              ) : (
                getApiErrorMessage(acceptMutation.error)
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>E-Mail</Label>
            <Input value={invite.email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Anzeigename</Label>
            <Input id="displayName" {...register("displayName")} />
            {errors.displayName && (
              <p className="text-sm text-destructive">
                {errors.displayName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort festlegen</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Konto erstellen und beitreten
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
