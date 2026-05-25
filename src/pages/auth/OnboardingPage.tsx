import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Clock, Loader2, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/hooks/useAuth";
import { createOrganization } from "@/api/organizations";
import { getMyOrganizations, login } from "@/api/auth";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const createOrgSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  slug: z.string().min(1, "Slug ist erforderlich"),
});

type CreateOrgForm = z.infer<typeof createOrgSchema>;

const roleLabels: Record<string, string> = {
  Admin: "Admin",
  Owner: "Inhaber",
  Member: "Mitglied",
};

function LogoutButton() {
  const logoutMutation = useLogout();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => logoutMutation.mutate()}
      disabled={logoutMutation.isPending}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Abmelden
    </Button>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const credentials = location.state as
    | { email: string; password: string }
    | null;
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg);
  const user = useAuthStore((s) => s.user);
  const [mode, setMode] = useState<"choose" | "create" | "wait">("choose");

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ["my-organizations"],
    queryFn: () => getMyOrganizations(),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreateOrgForm>({
    resolver: zodResolver(createOrgSchema),
  });

  const name = useWatch({ control, name: "name" }) ?? "";
  const slugValue = useWatch({ control, name: "slug" }) ?? "";

  const autoSlug = toSlug(name);
  const showAutoSlug = slugValue === "" || slugValue === toSlug(name);

  const createMutation = useMutation({
    mutationFn: (data: CreateOrgForm) => createOrganization(data),
    onSuccess: async () => {
      const freshOrgs = await getMyOrganizations();
      const newOrg = freshOrgs[freshOrgs.length - 1];

      if (credentials && newOrg) {
        const loginResponse = await login({
          email: credentials.email,
          password: credentials.password,
          organizationId: newOrg.organizationId,
        });
        useAuthStore.getState().setAuthWithOrg(loginResponse, newOrg);
        navigate("/tournaments");
      } else if (newOrg) {
        setActiveOrg(newOrg);
        navigate("/login", {
          state: {
            message:
              "Organisation erstellt. Bitte erneut anmelden.",
          },
        });
      } else {
        navigate("/login");
      }
    },
  });

  const onSubmit = (data: CreateOrgForm) => {
    const finalSlug = data.slug || toSlug(data.name);
    createMutation.mutate({ name: data.name, slug: finalSlug });
  };

  const displayName = user?.displayName || "";
  const hasOrgs = orgs && orgs.length > 0;

  if (mode === "choose") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="absolute right-4 top-4">
          <LogoutButton />
        </div>
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center">
            {orgsLoading ? (
              <>
                <Skeleton className="mx-auto mb-2 h-8 w-64" />
                <Skeleton className="mx-auto h-5 w-80" />
              </>
            ) : hasOrgs ? (
              <>
                <h1 className="text-2xl font-bold">Organisation wählen</h1>
                <p className="mt-2 text-muted-foreground">
                  {displayName
                    ? `Hallo ${displayName}! Wähle eine Organisation oder erstelle eine neue.`
                    : "Wähle eine Organisation oder erstelle eine neue."}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold">
                  {displayName
                    ? `Willkommen, ${displayName}!`
                    : "Willkommen!"}
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Du bist noch keiner Organisation zugeordnet. Wie möchtest du
                  fortfahren?
                </p>
              </>
            )}
          </div>

          {orgsLoading && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {!orgsLoading && hasOrgs && (
            <>
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Deine Organisationen
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {orgs.map((org) => (
                    <Card
                      key={org.organizationId}
                      className="cursor-pointer transition-shadow hover:shadow-md"
                      onClick={() => {
                        navigate("/login", {
                          state: {
                            message:
                              "Bitte erneut anmelden um die Organisation zu wechseln.",
                          },
                        });
                      }}
                    >
                      <CardHeader className="flex flex-row items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base">
                            {org.organizationName}
                          </CardTitle>
                          <Badge variant="secondary" className="mt-1">
                            {roleLabels[org.role] ?? org.role}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-sm text-muted-foreground">oder</span>
                <Separator className="flex-1" />
              </div>
            </>
          )}

          {!orgsLoading && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => {
                  setMode("create");
                  setValue("slug", "");
                }}
              >
                <CardHeader className="text-center">
                  <Building2 className="mx-auto h-10 w-10 text-primary" />
                  <CardTitle className="text-lg">
                    Neue Organisation erstellen
                  </CardTitle>
                  <CardDescription>
                    Erstelle eine eigene Organisation und lade dein Team ein.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => setMode("wait")}
              >
                <CardHeader className="text-center">
                  <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
                  <CardTitle className="text-lg">
                    Warte auf Einladung
                  </CardTitle>
                  <CardDescription>
                    Warte, bis ein Admin dich zu einer Organisation einlädt.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === "wait") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="absolute right-4 top-4">
          <LogoutButton />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
            <CardTitle>Warte auf Einladung</CardTitle>
            <CardDescription>
              Du wirst per E-Mail eingeladen, sobald ein Admin dich hinzufügt.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="outline" onClick={() => setMode("choose")}>
              Zurück
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="absolute right-4 top-4">
        <LogoutButton />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Organisation erstellen</CardTitle>
          <CardDescription>
            Gib deiner Organisation einen Namen.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {createMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(createMutation.error)}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Organisationsname</Label>
              <Input
                id="name"
                placeholder="z.B. Sportverein Musterstadt"
                {...register("name", {
                  onChange: (e) => {
                    if (showAutoSlug) {
                      setValue("slug", toSlug(e.target.value));
                    }
                  },
                })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input id="slug" {...register("slug")} />
              {autoSlug && slugValue !== autoSlug && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setValue("slug", autoSlug)}
                >
                  Automatisch: {autoSlug}
                </button>
              )}
              {errors.slug && (
                <p className="text-sm text-destructive">
                  {errors.slug.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardContent className="flex flex-col gap-3 pt-0">
            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Organisation erstellen
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode("choose")}
            >
              Zurück
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
