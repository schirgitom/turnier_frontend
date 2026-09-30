import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Loader2 } from "lucide-react";
import { useLogin } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import type { OrgMembershipDto } from "@/types/auth";
import { roleLabel } from "@/types/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const prefillEmail = searchParams.get("email") ?? "";
  const loginMutation = useLogin(redirectTo);
  const location = useLocation();
  const lastOrgId = useAuthStore((s) => s.lastOrgId);
  const [orgChoice, setOrgChoice] = useState<OrgMembershipDto[] | null>(null);
  const [credentials, setCredentials] = useState<LoginForm | null>(null);
  const stateMessage = (location.state as { message?: string } | null)
    ?.message;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefillEmail, password: "" },
  });

  const onSubmit = (data: LoginForm) => {
    setCredentials(data);
    loginMutation.mutate(data, {
      onSuccess: (result) => {
        if (result.kind === "choice") setOrgChoice(result.organizations);
      },
    });
  };

  const chooseOrg = (org: OrgMembershipDto) => {
    if (!credentials) return;
    loginMutation.mutate({ ...credentials, organizationId: org.organizationId });
  };

  if (orgChoice && credentials) {
    const sorted = [...orgChoice].sort((a, b) =>
      a.organizationId === lastOrgId ? -1 : b.organizationId === lastOrgId ? 1 : a.organizationName.localeCompare(b.organizationName, "de"),
    );
    const pendingOrgId = loginMutation.isPending
      ? loginMutation.variables?.organizationId
      : undefined;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Organisation wählen</CardTitle>
          <CardDescription>
            Du bist Mitglied in mehreren Organisationen. Mit welcher möchtest du dich anmelden?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loginMutation.isError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {getApiErrorMessage(loginMutation.error)}
            </div>
          )}
          {sorted.map((org) => (
            <button
              key={org.organizationId}
              type="button"
              disabled={loginMutation.isPending}
              onClick={() => chooseOrg(org)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60",
                org.organizationId === lastOrgId && "border-primary",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {pendingOrgId === org.organizationId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{org.organizationName || "Unbenannt"}</div>
                <div className="text-xs text-muted-foreground">
                  {roleLabel(org.role)}
                  {org.organizationId === lastOrgId ? " · zuletzt verwendet" : ""}
                </div>
              </div>
            </button>
          ))}
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loginMutation.isPending}
            onClick={() => {
              setOrgChoice(null);
              loginMutation.reset();
            }}
          >
            Zurück
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anmelden</CardTitle>
        <CardDescription>
          Melde dich mit deinem Konto an, um fortzufahren.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {stateMessage && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {stateMessage}
            </div>
          )}
          {loginMutation.isError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {getApiErrorMessage(loginMutation.error)}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@beispiel.de"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              autoFocus={!!prefillEmail}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Anmelden
          </Button>
          <p className="text-sm text-muted-foreground">
            Noch kein Konto?{" "}
            <Link to="/register" className="text-primary hover:underline">
              Registrieren
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
